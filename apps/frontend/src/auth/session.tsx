/**
 * Session handling (SRS-LDY-F-04, NFR-SEC1).
 * - Token kept in sessionStorage (the real backend should prefer an httpOnly cookie — see OPEN_QUESTIONS).
 * - Idle timeout from settings (default 15 min) with a one-minute warning.
 * - Any 401 mid-session signs the user out and explains why.
 * - Multi-role users choose an active role; navigation follows it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, configureClient, type Role, type Session, type User } from '@ldy/api-client';
import { can as canFor, type Action } from './permissions';

const TOKEN_KEY = 'ldy.token';
const USER_KEY = 'ldy.user';
const ROLE_KEY = 'ldy.role';

function read<T>(key: string): T | null {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown) {
  try {
    if (v === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode — session lives in memory only */
  }
}

let memoryToken: string | null = read<string>(TOKEN_KEY);
configureClient({ getToken: () => memoryToken });

export type SignOutReason = 'manual' | 'timeout' | 'ended';

interface AuthState {
  user: User | null;
  token: string | null;
  activeRole: Role | null;
  setActiveRole: (r: Role) => void;
  signIn: (s: Session) => void;
  signOut: (reason?: SignOutReason) => void;
  lastSignOut: SignOutReason | null;
  can: (a: Action) => boolean;
  isStaff: boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children, idleMinutes = 15 }: { children: ReactNode; idleMinutes?: number }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(() => read<User>(USER_KEY));
  const [token, setToken] = useState<string | null>(() => {
    // read again on mount: a session may have been stored after this module first loaded (tests, other tabs)
    memoryToken = read<string>(TOKEN_KEY);
    return memoryToken;
  });
  const [activeRole, setRole] = useState<Role | null>(() => read<Role>(ROLE_KEY) ?? read<User>(USER_KEY)?.roles[0] ?? null);
  const [lastSignOut, setLastSignOut] = useState<SignOutReason | null>(null);

  const signOut = useCallback(
    (reason: SignOutReason = 'manual') => {
      if (memoryToken && reason === 'manual') void api.auth.logout().catch(() => {});
      memoryToken = null;
      write(TOKEN_KEY, null);
      write(USER_KEY, null);
      write(ROLE_KEY, null);
      setToken(null);
      setUser(null);
      setRole(null);
      setLastSignOut(reason);
      qc.clear();
    },
    [qc],
  );

  const signIn = useCallback((s: Session) => {
    memoryToken = s.token;
    write(TOKEN_KEY, s.token);
    write(USER_KEY, s.user);
    const role = s.user.roles[0];
    write(ROLE_KEY, role);
    setToken(s.token);
    setUser(s.user);
    setRole(role);
    setLastSignOut(null);
  }, []);

  useEffect(() => {
    configureClient({ onUnauthorised: () => signOut('ended') });
  }, [signOut]);

  // Revalidate the session on load so a deactivated user is refused straight away.
  useEffect(() => {
    if (!token) return;
    api.auth.me().then(
      (u) => {
        setUser(u);
        write(USER_KEY, u);
      },
      () => {},
    );
  }, [token]);

  const setActiveRole = useCallback((r: Role) => {
    write(ROLE_KEY, r);
    setRole(r);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      activeRole,
      setActiveRole,
      signIn,
      signOut,
      lastSignOut,
      can: (a) => canFor(activeRole, a),
      isStaff: Boolean(user && user.roles.some((r) => r !== 'CUSTOMER')),
    }),
    [user, token, activeRole, setActiveRole, signIn, signOut, lastSignOut],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {token && <IdleWatcher minutes={idleMinutes} onTimeout={() => signOut('timeout')} />}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

// ---------------- Idle timeout ----------------
import { useTranslation } from 'react-i18next';

function IdleWatcher({ minutes, onTimeout }: { minutes: number; onTimeout: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const last = useRef(Date.now());
  const [remaining, setRemaining] = useState<number | null>(null);
  // F-03: the timeout comes from settings (default 15 minutes) once they have loaded
  const configured = qc.getQueryData<{ security?: { idleTimeoutMinutes: number } }>(['settings', 'staff'])?.security?.idleTimeoutMinutes;
  const limit = (configured ?? minutes) * 60_000;

  useEffect(() => {
    const bump = () => {
      last.current = Date.now();
    };
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = window.setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= limit) onTimeout();
      else if (idle >= limit - 60_000) setRemaining(Math.ceil((limit - idle) / 1000));
      else setRemaining(null);
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(id);
    };
  }, [limit, onTimeout]);

  if (remaining === null) return null;
  return (
    <div role="alertdialog" aria-live="assertive" aria-labelledby="idle-msg" className="fixed inset-x-0 bottom-0 z-50 p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="rounded-[16px] border border-navy/15 bg-white p-4 shadow-lg">
        <p id="idle-msg" className="text-navy">{t('session.idleWarning', { seconds: remaining })}</p>
        <button
          className="btn-primary mt-3"
          autoFocus
          onClick={() => {
            last.current = Date.now();
            setRemaining(null);
          }}
        >
          {t('action.stay')}
        </button>
      </div>
    </div>
  );
}
