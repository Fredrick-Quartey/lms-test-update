// Shown once after sign-up (D6, A-01 standing preferences): one question, two big choices, skippable.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Shirt, Layers } from 'lucide-react';
import { api } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { ErrorAlert, useToast } from '@/components/ui';

export function Welcome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const loc = useLocation() as { state?: { from?: string } };
  const me = useQuery({ queryKey: ['portal', 'me'], queryFn: api.portal.me });
  const [finish, setFinish] = useState<'HANGER' | 'FOLD' | null>(null);
  const [starch, setStarch] = useState(false);
  const [softener, setSoftener] = useState(true);
  const go = () => nav(loc.state?.from ?? '/me/orders', { replace: true });
  const save = useMutation({
    mutationFn: () => api.portal.updateMe({ preferences: { starch, softener, finish: finish ?? 'HANGER' } }),
    onSuccess: () => {
      toast('Preferences saved. You can change them any time in Profile.');
      go();
    },
  });
  const first = (me.data?.name ?? user?.name ?? '').split(' ')[0];
  const card = (v: 'HANGER' | 'FOLD', label: string, icon: React.ReactNode) => (
    <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-[16px] border-2 p-5 text-center font-bold transition-colors ${finish === v ? 'border-blue bg-sky text-blue-dark' : 'border-line bg-white hover:border-blue/40'}`}>
      <input type="radio" name="finish" className="sr-only" checked={finish === v} onChange={() => setFinish(v)} />
      <span aria-hidden className="text-blue">{icon}</span>
      {label}
    </label>
  );
  return (
    <div className="mx-auto max-w-md py-4">
      <h1 className="page-title">Welcome, {first}.</h1>
      <p className="muted mt-1">One quick question so we get it right the first time.</p>
      <form className="mt-6 space-y-5" onSubmit={(e) => (e.preventDefault(), save.mutate())}>
        <fieldset>
          <legend className="mb-3 text-lg font-semibold">How do you like your clothes returned?</legend>
          <div className="grid grid-cols-2 gap-3">
            {card('HANGER', 'On hangers', <Shirt size={36} />)}
            {card('FOLD', 'Folded', <Layers size={36} />)}
          </div>
        </fieldset>
        <div className="panel divide-y divide-line">
          <label className="flex min-h-14 items-center justify-between px-4"><span>Starch my shirts</span><input type="checkbox" className="h-5 w-5" checked={starch} onChange={(e) => setStarch(e.target.checked)} /></label>
          <label className="flex min-h-14 items-center justify-between px-4"><span>Use fabric softener</span><input type="checkbox" className="h-5 w-5" checked={softener} onChange={(e) => setSoftener(e.target.checked)} /></label>
        </div>
        <ErrorAlert error={save.error} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn" onClick={go}>Skip for now</button>
          <button className="btn-primary" disabled={!finish || save.isPending}>Save</button>
        </div>
      </form>
    </div>
  );
}
