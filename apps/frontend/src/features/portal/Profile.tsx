// A-01 profile; NFR-C4 / §5.2 data subject access and correction; F-05 opt-out of non-essential messages.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Customer } from '@ldy/api-client';
import { LogOut } from 'lucide-react';
import { useSignOutConfirm } from '@/components/layout';
import { ErrorAlert, Field, PageHeader, QueryState, Section, useToast } from '@/components/ui';
import { errorField, errorMessage } from '@/lib/errors';

export function Profile() {
  const q = useQuery({ queryKey: ['portal', 'me'], queryFn: api.portal.me });
  const signout = useSignOutConfirm();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My profile" intro="This is everything we store about you. Correct anything that is wrong." />
      <QueryState q={q}>{(c) => <ProfileForm c={c} />}</QueryState>
      <button className="btn-danger mt-6 w-full sm:w-auto" onClick={signout.ask}><LogOut size={18} aria-hidden /> Sign out</button>
      {signout.dialog}
    </div>
  );
}

function ProfileForm({ c }: { c: Customer }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState(c);
  useEffect(() => setF(c), [c]);
  const save = useMutation({
    mutationFn: () => api.portal.updateMe({ name: f.name, phone: f.phone, email: f.email ?? '', address: f.address ?? '', preferences: f.preferences, optOutReminders: f.optOutReminders }),
    onSuccess: () => {
      toast('Profile saved.');
      void qc.invalidateQueries({ queryKey: ['portal', 'me'] });
    },
  });
  const err = (field: string) => (errorField(save.error) === field ? errorMessage(save.error) : null);
  return (
    <form className="space-y-5" onSubmit={(e) => (e.preventDefault(), save.mutate())}>
      <Section title="Contact details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={err('name')} required>{(p) => <input {...p} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Phone number" error={err('phone')} required>{(p) => <input {...p} className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
          <Field label="Email" error={err('email')}>{(p) => <input {...p} className="input" type="email" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Address">{(p) => <textarea {...p} className="input" rows={2} value={f.address ?? ''} onChange={(e) => setF({ ...f, address: e.target.value })} />}</Field>
        </div>
      </Section>
      <Section title="Standing preferences">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={f.preferences.starch} onChange={(e) => setF({ ...f, preferences: { ...f.preferences, starch: e.target.checked } })} /> Starch shirts</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={f.preferences.softener} onChange={(e) => setF({ ...f, preferences: { ...f.preferences, softener: e.target.checked } })} /> Use fabric softener</label>
        <div className="flex flex-wrap gap-4">
          {(['HANGER', 'FOLD'] as const).map((v) => (
            <label key={v} className="flex min-h-11 items-center gap-2"><input type="radio" checked={f.preferences.finish === v} onChange={() => setF({ ...f, preferences: { ...f.preferences, finish: v } })} /> {v === 'HANGER' ? 'On hangers' : 'Folded'}</label>
          ))}
        </div>
      </Section>
      <Section title="Messages">
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={!f.optOutReminders} onChange={(e) => setF({ ...f, optOutReminders: !e.target.checked })} />
          <span>Send me reminders about orders I haven't collected yet.</span>
        </label>
        <p className="hint">Order receipts, ready notices and password reset codes are always sent; they can't be switched off.</p>
      </Section>
      {!errorField(save.error) && <ErrorAlert error={save.error} />}
      <button className="btn-primary" disabled={save.isPending}>Save changes</button>
    </form>
  );
}
