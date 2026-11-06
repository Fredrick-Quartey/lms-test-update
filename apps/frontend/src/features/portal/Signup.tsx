/**
 * Customer sign-up, one short question per step (round 2):
 *   1 name + phone  →  2 email (optional, can skip)  →  3 where are you?  →  4 password + consent.
 * A-01: phone required, email optional. NFR-SEC4: password at least 10 characters. OQ16: address required for
 * self-sign-up. OQ17: "Use my location" asks the browser only (no geocoding). NFR-C4: consent before saving.
 * Server errors send the customer back to the step with the problem, next to the field.
 */
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Lock, LocateFixed, Mail, MapPin, Phone, User } from 'lucide-react';
import { api } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, ErrorAlert, Field } from '@/components/ui';
import { errorCode, errorField, errorMessage, msg } from '@/lib/errors';
import { PHONE_RE, cleanPhone } from '@/lib/validation';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { PrivacyNotice } from './PrivacyNotice';

type Form = { name: string; phone: string; email: string; address: string; password: string; confirm: string };
type Errs = Partial<Record<keyof Form, string>>;

const STEPS = [
  { title: "Let's get you set up", subtitle: 'Your name and phone number. We send order updates to this phone.' },
  { title: 'Your email', subtitle: 'Optional. Add it if you want receipts by email too.' },
  { title: 'Where are you located?', subtitle: 'So our rider can pick up and deliver to you.' },
  { title: 'Create a password', subtitle: 'You will log in with your phone number and this password.' },
] as const;

export function Signup() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>({ name: '', phone: '', email: '', address: '', password: '', confirm: '' });
  const [errs, setErrs] = useState<Errs>({});
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const top = useRef<HTMLFormElement>(null);

  const go = (n: number) => {
    setStep(n);
    // move focus to the new question so screen readers and keyboards follow along
    requestAnimationFrame(() => top.current?.querySelector<HTMLElement>('input, textarea')?.focus());
  };

  const register = useMutation({
    mutationFn: () =>
      api.portal.register({
        name: f.name.trim(),
        phone: cleanPhone(f.phone),
        email: f.email.trim() || undefined,
        address: f.address.trim(),
        location: location ?? undefined,
        password: f.password,
        consent,
      }),
    onSuccess: (s) => {
      signIn(s);
      nav('/me/welcome', { replace: true, state: { from: loc.state?.from } });
    },
    onError: (e) => {
      const code = errorCode(e);
      const back = (n: number, field: keyof Form) => {
        setErrs({ [field]: errorMessage(e) });
        go(n);
      };
      if (code === 'DUPLICATE_PHONE' || code === 'INVALID_PHONE') back(0, 'phone');
      else if (code === 'INVALID_EMAIL') back(1, 'email');
      else if (code === 'ADDRESS_REQUIRED' || errorField(e) === 'address') back(2, 'address');
      else if (code === 'PASSWORD_TOO_SHORT') setErrs({ password: errorMessage(e) });
    },
  });

  const check = (n: number): Errs => {
    const x: Errs = {};
    if (n === 0) {
      if (f.name.trim().length < 2) x.name = 'Enter your full name.';
      if (!PHONE_RE.test(cleanPhone(f.phone))) x.phone = msg('INVALID_PHONE');
    }
    if (n === 1 && f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) x.email = msg('INVALID_EMAIL');
    if (n === 2 && !f.address.trim()) x.address = msg('ADDRESS_REQUIRED');
    if (n === 3) {
      if (f.password.length < 10) x.password = msg('PASSWORD_TOO_SHORT');
      else if (f.password !== f.confirm) x.confirm = msg('PASSWORDS_DONT_MATCH');
    }
    return x;
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    const x = check(step);
    setErrs(x);
    if (Object.keys(x).length) return;
    if (step < 3) go(step + 1);
    else if (consent) register.mutate();
  };

  const useMyLocation = () => {
    setLocMsg(null);
    if (!('geolocation' in navigator)) return setLocMsg('This browser cannot share a location. Type your address instead.');
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocBusy(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setLocation({ lat, lng, accuracy: Math.round(pos.coords.accuracy) });
        const gps = `GPS ${lat}, ${lng}`;
        setF((v) => ({ ...v, address: v.address.trim() ? `${v.address.replace(/\s*\(GPS [^)]*\)$/, '')} (${gps})` : `${gps}\n` }));
        setErrs((x) => ({ ...x, address: undefined }));
        setLocMsg(`Location added (accurate to about ${Math.round(pos.coords.accuracy)} m). Add a house number or landmark so the rider finds you easily.`);
      },
      (err) => {
        setLocBusy(false);
        setLocMsg(err.code === err.PERMISSION_DENIED ? 'Location access was not allowed. Type your address instead.' : 'Your location could not be found. Type your address instead.');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const s = STEPS[step];

  return (
    <AuthLayout image="customer" kicker="Create your account" tagline="Fresh clothes, picked up from your door." title={s.title} subtitle={s.subtitle}>
      <Progress step={step} />
      <form ref={top} className="mt-6 space-y-4" onSubmit={next} noValidate aria-label={`Step ${step + 1} of 4: ${s.title}`}>
        {step === 0 && (
          <>
            <Field label="Full name" icon={<User size={16} />} error={errs.name} required>
              {(p) => <input {...p} className="input" autoComplete="name" value={f.name} onChange={set('name')} autoFocus />}
            </Field>
            <Field label="Phone number" icon={<Phone size={16} />} error={errs.phone} required>
              {(p) => <input {...p} className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0244123456" value={f.phone} onChange={set('phone')} />}
            </Field>
          </>
        )}

        {step === 1 && (
          <Field label="Email (optional)" icon={<Mail size={16} />} error={errs.email}>
            {(p) => <input {...p} className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={f.email} onChange={set('email')} />}
          </Field>
        )}

        {step === 2 && (
          <>
            <button type="button" onClick={useMyLocation} disabled={locBusy} className="flex min-h-14 w-full items-center gap-3 rounded-[16px] border-2 border-dashed border-blue/40 bg-sky px-4 text-left font-semibold text-blue-dark hover:border-blue disabled:opacity-60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue text-white"><LocateFixed size={20} aria-hidden /></span>
              <span>
                {locBusy ? 'Finding you…' : location ? 'Location added. Tap to update it' : 'Use my current location'}
                <span className="block text-xs font-normal text-slate">Only to fill in your address. We don't track you.</span>
              </span>
            </button>
            {locMsg && <Alert tone={location ? 'success' : 'warning'}>{locMsg}</Alert>}
            <Field label="Address" icon={<MapPin size={16} />} error={errs.address} hint="House number, street, area and a landmark, or your GhanaPost GPS address." required>
              {(p) => <textarea {...p} className="input" rows={3} autoComplete="street-address" value={f.address} onChange={set('address')} />}
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Password" icon={<Lock size={16} />} error={errs.password} hint="At least 10 characters." required>
              {(p) => <input {...p} className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />}
            </Field>
            <Field label="Type it again" icon={<Lock size={16} />} error={errs.confirm} required>
              {(p) => <input {...p} className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} />}
            </Field>
            <div className="rounded-[14px] bg-mist p-3">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I agree that LDY keeps my details to handle my orders and send me updates about them.</span>
              </label>
              <button type="button" className="btn-link ml-8 mt-1 text-sm" onClick={() => setPrivacy(true)}>Read the privacy notice</button>
            </div>
            <ErrorAlert error={register.error && !['DUPLICATE_PHONE', 'INVALID_PHONE', 'INVALID_EMAIL', 'ADDRESS_REQUIRED', 'PASSWORD_TOO_SHORT'].includes(errorCode(register.error) ?? '') ? register.error : null} />
          </>
        )}

        <div className="flex items-center gap-3 pt-2">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className="inline-flex min-h-13 w-13 shrink-0 items-center justify-center rounded-full ring-1 ring-line hover:bg-mist" aria-label="Back to the previous step">
              <ArrowLeft size={20} aria-hidden />
            </button>
          )}
          <Primary disabled={(step === 3 && !consent) || register.isPending}>
            {step === 3 ? (register.isPending ? 'Creating your account…' : 'Create account') : step === 1 && !f.email.trim() ? 'Skip' : 'Next'}
          </Primary>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-slate">
        Already have an account? <Link to="/login" state={loc.state} className="btn-link">Log in</Link>
      </p>
      <PrivacyNotice open={privacy} onClose={() => setPrivacy(false)} />
    </AuthLayout>
  );
}

function Primary({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button className="btn-primary min-h-13 flex-1 rounded-full text-base" disabled={disabled}>
      {children}
    </button>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate">Step {step + 1} of 4</p>
      <ol className="flex gap-2" aria-hidden>
        {STEPS.map((_, i) => (
          <li key={i} className={`h-2 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-blue' : 'bg-line'}`} />
        ))}
      </ol>
    </div>
  );
}
