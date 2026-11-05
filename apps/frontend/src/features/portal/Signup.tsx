/**
 * Customer sign-up in two steps (REDESIGN §6.3, D5). A-01: phone required, email optional.
 * NFR-SEC4: password at least 10 characters. Step 2 (pop-up): pickup/delivery address (OQ16), Use my location
 * (browser only, no geocoding: OQ17), short consent with the full notice behind a link (NFR-C4, D7).
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Lock, Mail, MapPin, Phone, User, UserPlus } from 'lucide-react';
import { api } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, ErrorAlert, Field, Modal } from '@/components/ui';
import { errorCode, errorField, errorMessage, msg } from '@/lib/errors';
import { PHONE_RE, cleanPhone } from '@/lib/validation';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { CUSTOMER_TABS } from '@/features/auth/Login';
import { PrivacyNotice } from './PrivacyNotice';

type Step1 = { name: string; phone: string; email: string; password: string; confirm: string };

export function Signup() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [f, setF] = useState<Step1>({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [errs, setErrs] = useState<Partial<Record<keyof Step1, string>>>({});
  const [step2, setStep2] = useState(false);
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [consent, setConsent] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: () => api.portal.register({ name: f.name.trim(), phone: cleanPhone(f.phone), email: f.email.trim() || undefined, address: address.trim(), location: location ?? undefined, password: f.password, consent }),
    onSuccess: (s) => {
      signIn(s);
      nav('/me/welcome', { replace: true, state: { from: loc.state?.from } });
    },
    onError: (e) => {
      // D5: a duplicate or invalid phone goes back to step 1, next to the phone field
      const code = errorCode(e);
      if (code === 'DUPLICATE_PHONE' || code === 'INVALID_PHONE' || code === 'PASSWORD_TOO_SHORT') {
        setStep2(false);
        setErrs(code === 'PASSWORD_TOO_SHORT' ? { password: errorMessage(e) } : { phone: errorMessage(e) });
      }
    },
  });

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    const x: typeof errs = {};
    if (f.name.trim().length < 2) x.name = 'Enter your full name.';
    if (!PHONE_RE.test(cleanPhone(f.phone))) x.phone = msg('INVALID_PHONE');
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) x.email = msg('INVALID_EMAIL');
    if (f.password.length < 10) x.password = msg('PASSWORD_TOO_SHORT');
    else if (f.password !== f.confirm) x.confirm = msg('PASSWORDS_DONT_MATCH');
    setErrs(x);
    if (!Object.keys(x).length) setStep2(true);
  };

  const useMyLocation = () => {
    setLocMsg(null);
    if (!('geolocation' in navigator)) {
      setLocMsg('This browser cannot share a location. Type your address instead.');
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocBusy(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setLocation({ lat, lng, accuracy: Math.round(pos.coords.accuracy) });
        const gps = `GPS ${lat}, ${lng}`;
        setAddress((a) => (a.trim() ? `${a.replace(/\s*\(GPS [^)]*\)$/, '')} (${gps})` : `${gps}\n`));
        setLocMsg(`Location added (accurate to about ${Math.round(pos.coords.accuracy)} m). Add a landmark or house number so the rider can find you.`);
      },
      (err) => {
        setLocBusy(false);
        setLocMsg(err.code === err.PERMISSION_DENIED ? 'Location access was not allowed. Type your address instead.' : 'Your location could not be found. Type your address instead.');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const set = (k: keyof Step1) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <AuthLayout image="customer" tagline="Your laundry, tracked tag by tag." tabs={CUSTOMER_TABS} badge={<UserPlus size={28} />} title="Create your account" subtitle="It takes a minute. Then you can book pickups and track every order.">
      <form className="space-y-4" onSubmit={next} noValidate>
        <Field label="Full name" icon={<User size={16} />} error={errs.name} required>
          {(p) => <input {...p} className="input" autoComplete="name" value={f.name} onChange={set('name')} />}
        </Field>
        <Field label="Phone number" icon={<Phone size={16} />} error={errs.phone} hint="We send order updates here. You also log in with it." required>
          {(p) => <input {...p} className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0244123456" value={f.phone} onChange={set('phone')} />}
        </Field>
        <Field label="Email (optional)" icon={<Mail size={16} />} error={errs.email}>
          {(p) => <input {...p} className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} />}
        </Field>
        <Field label="Password" icon={<Lock size={16} />} error={errs.password} hint="At least 10 characters." required>
          {(p) => <input {...p} className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />}
        </Field>
        <Field label="Confirm password" icon={<Lock size={16} />} error={errs.confirm} required>
          {(p) => <input {...p} className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} />}
        </Field>
        <button className="btn-primary w-full min-h-12 rounded-full text-base">Next</button>
      </form>

      <Modal open={step2} onClose={() => setStep2(false)} title="Where should we pick up and deliver?">
        <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), register.mutate())} noValidate>
          <div>
            <Field label="Pickup and delivery address" icon={<MapPin size={16} />} required error={errorField(register.error) === 'address' ? errorMessage(register.error) : null}>
              {(p) => <textarea {...p} className="input" rows={3} placeholder="House number, street, area and a landmark" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />}
            </Field>
            <button type="button" className="btn mt-2 w-full" onClick={useMyLocation} disabled={locBusy}>
              <MapPin size={18} aria-hidden /> {locBusy ? 'Finding you…' : 'Use my location'}
            </button>
            <p className="hint">To fill in your address for pickups and deliveries. We don't track you.</p>
            {locMsg && <div className="mt-2"><Alert tone={location ? 'success' : 'warning'}>{locMsg}</Alert></div>}
          </div>
          <div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree that LDY stores my data to process my orders and send me updates about them.</span>
            </label>
            <button type="button" className="btn-link ml-8 mt-1 text-sm" onClick={() => setPrivacy(true)}>Read the privacy notice</button>
          </div>
          {errorField(register.error) !== 'address' && <ErrorAlert error={register.error} />}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" onClick={() => setStep2(false)}>Back</button>
            <button className="btn-primary" disabled={!consent || !address.trim() || register.isPending}>{register.isPending ? 'Creating…' : 'Create account'}</button>
          </div>
        </form>
      </Modal>
      <PrivacyNotice open={privacy} onClose={() => setPrivacy(false)} />
    </AuthLayout>
  );
}
