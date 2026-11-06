// SRS-LDY-F-04: secure sign-in, exact lockout message, MFA step for privileged roles, password reset.
// One shared AuthLayout for every portal (D2). Staff portal has Sign in only (D3). Demo hints only in dev (D9).
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Lock, Mail, User } from 'lucide-react';
import { api, type Session } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { HOME_FOR } from '@/auth/permissions';
import { Alert, ErrorAlert, Field } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

export const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true';

const STAFF_DEMO = [
  ['frontdesk@ldy.test', 'Front Desk Officer'],
  ['attendant@ldy.test', 'Laundry Attendant'],
  ['attendant2@ldy.test', 'Laundry Attendant (second, for Independent QC)'],
  ['rider@ldy.test', 'Delivery Rider'],
  ['manager@ldy.test', 'Branch Manager'],
  ['manager2@ldy.test', 'Branch Manager (second checker)'],
  ['admin@ldy.test', 'System Administrator'],
  ['auditor@ldy.test', 'Auditor'],
  ['counter2@ldy.test', 'Front Desk + Attendant (small team)'],
];
const CUSTOMER_DEMO = [
  ['0244123456', 'Ama Serwaa'],
  ['0201112233', 'Esi Mensah'],
];


function LoginForm({ portal, preset = '' }: { portal: 'staff' | 'customer'; preset?: string }) {
  const { t } = useTranslation();
  const { signIn, lastSignOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { reason?: string; from?: string } };
  const reason = loc.state?.reason ?? lastSignOut;
  const [username, setUsername] = useState(preset);
  const [password, setPassword] = useState(preset ? 'Password123!' : '');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const finish = (s: Session) => {
    signIn(s);
    nav(portal === 'staff' ? loc.state?.from ?? HOME_FOR[s.user.roles[0]] : loc.state?.from ?? '/me/orders', { replace: true });
  };
  const login = useMutation({
    mutationFn: () => api.auth.login(username.trim(), password, portal),
    onSuccess: (s) => (s.mfaRequired ? setMfaToken(s.token) : finish(s)),
  });
  const mfa = useMutation({ mutationFn: () => api.auth.verifyMfa(mfaToken!, code.trim()), onSuccess: finish });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mfaToken) mfa.mutate();
    else login.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {reason === 'timeout' && <Alert tone="warning">{t('session.timedOut', { minutes: 15 })}</Alert>}
      {reason === 'ended' && <Alert tone="warning">{t('session.ended')}</Alert>}
      {!mfaToken ? (
        <>
          <Field label={portal === 'staff' ? 'Email or phone' : 'Phone number or email'} icon={<Mail size={16} />} required>
            {(p) => <input {...p} className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />}
          </Field>
          <Field label="Password" icon={<Lock size={16} />} required>
            {(p) => <input {...p} type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <div className="text-right text-sm">
            <Link to={portal === 'staff' ? '/staff/forgot' : '/forgot'} className="btn-link">Forgot password?</Link>
          </div>
          <ErrorAlert error={login.error} />
          <button className="btn-primary w-full min-h-13 rounded-full text-base" disabled={login.isPending || !username || !password}>
            {login.isPending ? 'Signing in…' : portal === 'staff' ? t('action.signIn') : 'Log in'}
          </button>
        </>
      ) : (
        <>
          <Alert>Enter the 6-digit code sent to your registered phone or email.{SHOW_DEMO && ' In this demo the code is 123456.'}</Alert>
          <Field label="One-time code" icon={<KeyRound size={16} />} required>
            {(p) => <input {...p} className="input text-center text-xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />}
          </Field>
          <ErrorAlert error={mfa.error} />
          <button className="btn-primary w-full min-h-12 rounded-full" disabled={mfa.isPending || code.length < 6}>Verify and sign in</button>
        </>
      )}
    </form>
  );
}

function DemoDrawer({ rows, onPick, note }: { rows: string[][]; onPick: (u: string) => void; note: string }) {
  if (!SHOW_DEMO) return null;
  return (
    <details className="rounded-[16px] border border-line bg-white/90 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Demo accounts (development only)</summary>
      <p className="muted mt-2">{note}</p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {rows.map(([u, r]) => (
          <li key={u}>
            <button type="button" className="btn-link font-normal" onClick={() => onPick(u)}>{u}</button> <span className="muted">{r}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function StaffLogin() {
  const [fill, setFill] = useState('');
  return (
    <AuthLayout
      image="staff"
      tagline="Every load, every stage, on time."
      title="Staff sign in"
      subtitle="Use the email or phone your administrator set up for you."
      below={<DemoDrawer rows={STAFF_DEMO} onPick={setFill} note="Every demo account uses the password Password123!" />}
    >
      <LoginForm key={fill} portal="staff" preset={fill} />
      <p className="mt-6 text-center text-sm text-slate">No account yet? Ask your System Administrator.</p>
    </AuthLayout>
  );
}

export function CustomerLogin() {
  const [fill, setFill] = useState('');
  return (
    <AuthLayout
      image="customer"
      tagline="Fresh, folded and right on time."
      title="Welcome back"
      subtitle="Log in to request a pickup and follow your orders."
      below={<DemoDrawer rows={CUSTOMER_DEMO} onPick={setFill} note="Customer demo accounts use the password Password123!" />}
    >
      <LoginForm key={fill} portal="customer" preset={fill} />
      <p className="mt-6 text-center text-sm text-slate">
        New here? <Link to="/signup" className="btn-link">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

function ForgotPassword({ portal }: { portal: 'staff' | 'customer' }) {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const nav = useNavigate();
  const back = portal === 'staff' ? '/staff/login' : '/login';
  const request = useMutation({
    mutationFn: () => api.auth.forgot(username.trim()),
    onSuccess: (r) => {
      setSent(true);
      setDevCode(r.devCode ?? null);
    },
  });
  const reset = useMutation({ mutationFn: () => api.auth.reset(username.trim(), code.trim(), pw), onSuccess: () => nav(back, { replace: true }) });
  return (
    <AuthLayout
      image={portal}
      tagline={portal === 'staff' ? 'Every load, every stage, on time.' : 'Fresh, folded and right on time.'}
      title="Forgot your password?"
      subtitle="We'll send a one-time code to the phone or email on your account. It works once and expires after 15 minutes."
      homeTo={back}
      homeLabel={portal === 'staff' ? 'Back to sign in' : 'Back to log in'}
    >
      {!sent ? (
        <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), request.mutate())}>
          <Field label="Email or phone" icon={<User size={16} />} required>
            {(p) => <input {...p} className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />}
          </Field>
          <ErrorAlert error={request.error} />
          <button className="btn-primary w-full min-h-12 rounded-full" disabled={!username || request.isPending}>Send code</button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), reset.mutate())}>
          <Alert tone="success">If an account matches, a code has been sent.{SHOW_DEMO && devCode && <> Demo code: <strong>{devCode}</strong></>}</Alert>
          <Field label="Reset code" icon={<KeyRound size={16} />} required>
            {(p) => <input {...p} className="input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />}
          </Field>
          <Field label="New password" icon={<Lock size={16} />} hint="At least 10 characters." required>
            {(p) => <input {...p} type="password" className="input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
          </Field>
          <ErrorAlert error={reset.error} />
          <button className="btn-primary w-full min-h-12 rounded-full" disabled={!code || pw.length < 10 || reset.isPending}>Set new password</button>
        </form>
      )}
    </AuthLayout>
  );
}

export const StaffForgot = () => <ForgotPassword portal="staff" />;
export const CustomerForgot = () => <ForgotPassword portal="customer" />;
