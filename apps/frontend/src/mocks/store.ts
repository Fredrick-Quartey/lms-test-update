/**
 * In-browser mock backend state (Manual Phase Three, step 10: realistic mocks matching the contract).
 * This stands in for the FastAPI service in apps/api until its endpoints are announced ready.
 * Data is SYNTHETIC ONLY (SRS §2.7) and is kept in localStorage so a demo survives a reload.
 */
import type * as T from '@ldy/api-client';

export interface StoredUser extends T.User {
  password: string; // mock only — the real backend stores Argon2/bcrypt hashes (NFR-SEC4)
  failedAttempts: number;
}

export interface Audience {
  userId?: string;
  role?: T.Role;
  customerId?: string;
}

export interface StoredNotification extends T.InAppNotification {
  audience: Audience;
}

export interface Db {
  version: number;
  clockOffsetMs: number;
  counters: Record<string, number>;
  users: StoredUser[];
  sessions: Record<string, { userId: string; mfaPending?: boolean }>;
  resetCodes: Record<string, { code: string; expires: number; used: boolean }>;
  settings: T.Settings;
  serviceTypes: T.ServiceType[];
  categories: T.ItemCategory[];
  prices: T.PriceEntry[];
  machines: T.Machine[];
  customers: T.Customer[];
  orders: T.Order[];
  batches: T.Batch[];
  damage: T.DamageReport[];
  routes: T.Route[];
  approvals: T.ApprovalRequest[];
  cashups: T.Cashup[];
  statements: T.Statement[];
  bookings: T.Booking[];
  audit: T.AuditEvent[];
  templates: T.NotificationTemplate[];
  notificationLog: T.NotificationLogEntry[];
  inApp: StoredNotification[];
  imports: T.ImportBatch[];
  alertedBatches: string[];
}

export const DB_VERSION = 5;
const STORAGE_KEY = 'ldy-mock-db';

// ---------------- Errors ----------------
export class MockError extends Error {
  constructor(
    public status: number,
    public code: string,
    public field?: string,
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}
export const fail = (status: number, code: string, field?: string, details?: Record<string, unknown>): never => {
  throw new MockError(status, code, field, details);
};

// ---------------- Clock ----------------
let seedNow: Date | null = null;
export function setSeedNow(d: Date | null) {
  seedNow = d;
}
export function now(): Date {
  if (seedNow) return new Date(seedNow);
  return new Date(Date.now() + (state?.clockOffsetMs ?? 0));
}
export const iso = (d: Date = now()) => d.toISOString();
export const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
export const todayStr = (d: Date = now()) => {
  // Africa/Accra is UTC+0 all year, so the ISO date is the local date.
  return d.toISOString().slice(0, 10);
};

// ---------------- State ----------------
 
export let state: Db = undefined as unknown as Db;

export function setState(db: Db) {
  state = db;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function persist() {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — the demo still works in memory */
  }
}

export function loadPersisted(): Db | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as Db;
    return db.version === DB_VERSION ? db : null;
  } catch {
    return null;
  }
}

export function clearPersisted() {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------- Ids ----------------
export function nextNo(key: string, prefix: string, width = 6) {
  state.counters[key] = (state.counters[key] ?? 0) + 1;
  return `${prefix}${String(state.counters[key]).padStart(width, '0')}`;
}
export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;

// ---------------- Context ----------------
export interface Ctx {
  user: StoredUser | null;
  token?: string;
}

export function requireUser(ctx: Ctx): StoredUser {
  if (!ctx.user) fail(401, 'UNAUTHENTICATED');
  return ctx.user as StoredUser;
}

export function requireRole(ctx: Ctx, roles: T.Role[]): StoredUser {
  const u = requireUser(ctx);
  if (u.status !== 'ACTIVE') fail(401, 'ACCOUNT_DEACTIVATED');
  if (!u.roles.some((r) => roles.includes(r))) fail(403, 'FORBIDDEN');
  return u;
}

export const publicUser = (u: StoredUser): T.User => {
  // never send the password field to the client
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, failedAttempts, ...rest } = u;
  return rest;
};

// ---------------- Audit (F-02) — append only ----------------
export function audit(
  actor: { id: string; name: string } | null,
  entityType: string,
  entityId: string,
  action: string,
  before?: unknown,
  after?: unknown,
  entityRef?: string,
) {
  state.audit.push({
    id: uid('evt'),
    entityType,
    entityId,
    entityRef,
    actorId: actor?.id ?? 'system',
    actorName: actor?.name ?? 'System',
    action,
    before,
    after,
    at: iso(),
  });
}

// ---------------- In-app notifications to staff ----------------
export function notifyStaff(audience: Audience, text: string, link?: string) {
  state.inApp.push({ id: uid('ntf'), audience, text, link, at: iso(), read: false });
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function findOrder(id: string) {
  const o = state.orders.find((x) => x.id === id || x.orderNo === id);
  if (!o) fail(404, 'NOT_FOUND');
  return o as T.Order;
}
