// SRS-LDY-F-04 User account & access management; NFR-SEC1/SEC4/SEC7
import type * as T from '@ldy/api-client';
import { STAFF_ROLES } from '@ldy/api-client';
import { state, fail, uid, iso, now, audit, publicUser, requireRole, type Ctx, type StoredUser } from '../store';
import { notifyCustomer } from './notifications';

const MIN_PASSWORD = 10;

function findByUsername(username: string) {
  const u = username.trim().toLowerCase();
  return state.users.find(
    (x) => x.username.toLowerCase() === u || x.email?.toLowerCase() === u || (x.phone && x.phone === username.trim()),
  );
}

function issue(user: StoredUser, mfaPending = false): T.Session {
  const token = uid('tok');
  state.sessions[token] = { userId: user.id, mfaPending };
  return { token, user: publicUser(user), mfaRequired: mfaPending };
}

export function login(_ctx: Ctx, body: { username: string; password: string; portal: 'staff' | 'customer' }) {
  const user = findByUsername(body.username ?? '');
  if (!user) return fail(401, 'INVALID_CREDENTIALS');
  const isStaff = user.roles.some((r) => STAFF_ROLES.includes(r));
  if (body.portal === 'staff' && !isStaff) fail(401, 'INVALID_CREDENTIALS');
  if (body.portal === 'customer' && !user.roles.includes('CUSTOMER')) fail(401, 'INVALID_CREDENTIALS');
  if (user.status === 'DEACTIVATED') fail(401, 'ACCOUNT_DEACTIVATED');

  const s = state.settings.security;
  if (user.lockedUntil && new Date(user.lockedUntil) > now()) {
    const minutes = Math.ceil((new Date(user.lockedUntil).getTime() - now().getTime()) / 60000);
    audit(user, 'User', user.id, 'SIGN_IN_REFUSED_LOCKED');
    return fail(423, 'ACCOUNT_LOCKED', undefined, { minutes });
  }
  if (user.lockedUntil) {
    // lock period expired
    user.lockedUntil = undefined;
    user.status = 'ACTIVE';
    user.failedAttempts = 0;
  }
  if (user.password !== body.password) {
    user.failedAttempts += 1;
    if (user.failedAttempts >= s.lockoutAttempts) {
      user.lockedUntil = new Date(now().getTime() + s.lockoutMinutes * 60000).toISOString();
      user.status = 'LOCKED';
      audit(user, 'User', user.id, 'ACCOUNT_LOCKED', undefined, { attempts: user.failedAttempts });
      return fail(423, 'ACCOUNT_LOCKED', undefined, { minutes: s.lockoutMinutes });
    }
    audit(user, 'User', user.id, 'SIGN_IN_FAILED', undefined, { attempts: user.failedAttempts });
    return fail(401, 'INVALID_CREDENTIALS', undefined, { attemptsLeft: s.lockoutAttempts - user.failedAttempts });
  }
  user.failedAttempts = 0;
  if (user.mfaEnabled) return issue(user, true);
  user.lastSignInAt = iso();
  audit(user, 'User', user.id, 'SIGN_IN');
  return issue(user);
}

export function verifyMfa(_ctx: Ctx, body: { token: string; code: string }) {
  const sess = state.sessions[body.token];
  if (!sess || !sess.mfaPending) return fail(401, 'UNAUTHENTICATED');
  // Mock: the one-time code is always 123456. The real backend uses TOTP or an SMS/email OTP.
  if (body.code !== '123456') return fail(401, 'INVALID_MFA_CODE');
  delete state.sessions[body.token];
  const user = state.users.find((u) => u.id === sess.userId)!;
  user.lastSignInAt = iso();
  audit(user, 'User', user.id, 'SIGN_IN_MFA');
  return issue(user);
}

export function me(ctx: Ctx) {
  if (!ctx.user) return fail(401, 'UNAUTHENTICATED');
  return publicUser(ctx.user);
}

export function logout(ctx: Ctx) {
  if (ctx.token) delete state.sessions[ctx.token];
}

export function forgot(_ctx: Ctx, body: { username: string }) {
  const user = findByUsername(body.username ?? '');
  // Always answer the same way so the endpoint cannot be used to discover accounts.
  if (!user || user.status === 'DEACTIVATED') return { sent: true };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  state.resetCodes[user.id] = { code, expires: now().getTime() + 15 * 60000, used: false };
  notifyCustomer('PASSWORD_RESET', { name: user.name, phone: user.phone ?? '', email: user.email }, { code });
  audit(user, 'User', user.id, 'PASSWORD_RESET_REQUESTED');
  // devCode is returned ONLY by the mock so the flow can be demoed without SMS/email.
  return { sent: true, devCode: code };
}

export function reset(_ctx: Ctx, body: { username: string; code: string; newPassword: string }) {
  const user = findByUsername(body.username ?? '');
  const rc = user ? state.resetCodes[user.id] : undefined;
  if (!user || !rc || rc.used || rc.code !== body.code || rc.expires < now().getTime()) return fail(422, 'INVALID_RESET_CODE', 'code');
  if ((body.newPassword ?? '').length < MIN_PASSWORD) fail(422, 'PASSWORD_TOO_SHORT', 'newPassword');
  rc.used = true;
  user.password = body.newPassword;
  user.failedAttempts = 0;
  user.lockedUntil = undefined;
  if (user.status === 'LOCKED') user.status = 'ACTIVE';
  audit(user, 'User', user.id, 'PASSWORD_RESET_COMPLETED');
}

// ---------------- User administration ----------------
const SOD_PAIRS: [T.Role, T.Role][] = [['FRONT_DESK', 'MANAGER']]; // SRS §2.4: payment capture vs refund / cash-up / credit approval

export function sodConflict(roles: T.Role[]) {
  return SOD_PAIRS.some(([a, b]) => roles.includes(a) && roles.includes(b));
}

function activeAdmins() {
  return state.users.filter((u) => u.status !== 'DEACTIVATED' && u.roles.includes('ADMIN'));
}

export function listUsers(ctx: Ctx) {
  requireRole(ctx, ['ADMIN', 'AUDITOR']);
  return state.users.filter((u) => !u.roles.includes('CUSTOMER') || u.roles.length > 1).map(publicUser);
}

export function riders(ctx: Ctx) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  return state.users.filter((u) => u.roles.includes('RIDER') && u.status === 'ACTIVE').map(publicUser);
}

export function createUser(ctx: Ctx, b: { name: string; username: string; email?: string; phone?: string; roles: T.Role[]; password: string; sodJustification?: string }) {
  const admin = requireRole(ctx, ['ADMIN']);
  if (!b.name?.trim()) fail(422, 'REQUIRED', 'name');
  if (!b.username?.trim()) fail(422, 'REQUIRED', 'username');
  if (findByUsername(b.username)) fail(409, 'USERNAME_TAKEN', 'username');
  if (!b.roles?.length) fail(422, 'ROLE_REQUIRED', 'roles');
  if ((b.password ?? '').length < MIN_PASSWORD) fail(422, 'PASSWORD_TOO_SHORT', 'password');
  if (sodConflict(b.roles) && !b.sodJustification?.trim()) fail(422, 'SOD_JUSTIFICATION_REQUIRED', 'sodJustification');
  const user: StoredUser = {
    id: uid('usr'),
    name: b.name.trim(),
    username: b.username.trim(),
    email: b.email || undefined,
    phone: b.phone || undefined,
    roles: b.roles,
    status: 'ACTIVE',
    mfaEnabled: false,
    password: b.password,
    failedAttempts: 0,
    sodJustification: b.sodJustification,
  };
  state.users.push(user);
  audit(admin, 'User', user.id, 'USER_CREATED', undefined, { username: user.username, roles: user.roles, sodJustification: b.sodJustification }, user.username);
  return publicUser(user);
}

export function updateUser(ctx: Ctx, id: string, b: { name?: string; roles?: T.Role[]; email?: string; phone?: string; sodJustification?: string; mfaEnabled?: boolean }) {
  const admin = requireRole(ctx, ['ADMIN']);
  const user = state.users.find((u) => u.id === id);
  if (!user) return fail(404, 'NOT_FOUND');
  const before = { roles: [...user.roles], name: user.name, email: user.email, phone: user.phone, mfaEnabled: user.mfaEnabled };
  if (b.roles) {
    if (!b.roles.length) fail(422, 'ROLE_REQUIRED', 'roles');
    if (user.roles.includes('ADMIN') && !b.roles.includes('ADMIN') && activeAdmins().length <= 1) fail(409, 'LAST_ADMINISTRATOR');
    const newConflict = sodConflict(b.roles) && !sodConflict(user.roles);
    if (newConflict && !b.sodJustification?.trim()) fail(422, 'SOD_JUSTIFICATION_REQUIRED', 'sodJustification');
    user.roles = b.roles;
    if (b.sodJustification) user.sodJustification = b.sodJustification;
  }
  if (b.name !== undefined) user.name = b.name;
  if (b.email !== undefined) user.email = b.email || undefined;
  if (b.phone !== undefined) user.phone = b.phone || undefined;
  if (b.mfaEnabled !== undefined) user.mfaEnabled = b.mfaEnabled;
  audit(admin, 'User', user.id, 'USER_UPDATED', before, { roles: user.roles, name: user.name, email: user.email, phone: user.phone, mfaEnabled: user.mfaEnabled, sodJustification: b.sodJustification }, user.username);
  return publicUser(user);
}

export function deactivateUser(ctx: Ctx, id: string) {
  const admin = requireRole(ctx, ['ADMIN']);
  const user = state.users.find((u) => u.id === id);
  if (!user) return fail(404, 'NOT_FOUND');
  if (user.roles.includes('ADMIN') && activeAdmins().length <= 1) fail(409, 'LAST_ADMINISTRATOR');
  user.status = 'DEACTIVATED';
  // end every active session immediately
  for (const [tok, s] of Object.entries(state.sessions)) if (s.userId === user.id) delete state.sessions[tok];
  audit(admin, 'User', user.id, 'USER_DEACTIVATED', { status: 'ACTIVE' }, { status: 'DEACTIVATED' }, user.username);
  return publicUser(user);
}

export function reactivateUser(ctx: Ctx, id: string) {
  const admin = requireRole(ctx, ['ADMIN']);
  const user = state.users.find((u) => u.id === id);
  if (!user) return fail(404, 'NOT_FOUND');
  user.status = 'ACTIVE';
  user.failedAttempts = 0;
  user.lockedUntil = undefined;
  audit(admin, 'User', user.id, 'USER_REACTIVATED', { status: 'DEACTIVATED' }, { status: 'ACTIVE' }, user.username);
  return publicUser(user);
}

export function unlockUser(ctx: Ctx, id: string) {
  const admin = requireRole(ctx, ['ADMIN']);
  const user = state.users.find((u) => u.id === id);
  if (!user) return fail(404, 'NOT_FOUND');
  user.status = 'ACTIVE';
  user.failedAttempts = 0;
  user.lockedUntil = undefined;
  audit(admin, 'User', user.id, 'ACCOUNT_UNLOCKED', { status: 'LOCKED' }, { status: 'ACTIVE' }, user.username);
  return publicUser(user);
}

export function sendReset(ctx: Ctx, id: string) {
  const admin = requireRole(ctx, ['ADMIN']);
  const user = state.users.find((u) => u.id === id);
  if (!user) return fail(404, 'NOT_FOUND');
  forgot(ctx, { username: user.username });
  audit(admin, 'User', user.id, 'PASSWORD_RESET_SENT_BY_ADMIN', undefined, undefined, user.username);
  return { sent: true };
}
