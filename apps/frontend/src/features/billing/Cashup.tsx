// SRS-LDY-E-05: officer closes the till against expected totals per method; variance above tolerance is flagged
// for a Branch Manager, who cannot be the officer who closed it.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type Cashup as CashupT, type MethodTotals } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, ErrorAlert, Field, PageHeader, Pill, QueryState, Section } from '@/components/ui';
import { dateTime, money } from '@/lib/format';
import { msg } from '@/lib/errors';
import { useSettings } from '@/config/settings';

const METHODS: { k: keyof MethodTotals; l: string; hint: string }[] = [
  { k: 'CASH', l: 'Cash counted in the till', hint: 'Count notes and coins.' },
  { k: 'MOMO', l: 'Mobile money statement total', hint: 'From the merchant statement for this session.' },
  { k: 'CARD', l: 'Card terminal total', hint: 'From the terminal settlement slip.' },
];

export function Cashup() {
  const { can } = useAuth();
  return (
    <div>
      <PageHeader title="Cash-up" intro="Close your session by counting what you took. Differences above the tolerance go to the Branch Manager." />
      <div className="space-y-5">
        {can('cashup.close') && <CloseMine />}
        <AllCashups />
      </div>
    </div>
  );
}

function CloseMine() {
  const qc = useQueryClient();
  const settings = useSettings();
  const q = useQuery({ queryKey: ['cashup', 'current'], queryFn: api.cashups.current, refetchInterval: 30_000 });
  const [counted, setCounted] = useState<Record<string, string>>({ CASH: '', MOMO: '', CARD: '' });
  const [result, setResult] = useState<CashupT | null>(null);
  const close = useMutation({
    mutationFn: (id: string) => api.cashups.close(id, { CASH: Number(counted.CASH || 0), CARD: Number(counted.CARD || 0), MOMO: Number(counted.MOMO || 0) }),
    onSuccess: (c) => {
      setResult(c);
      setCounted({ CASH: '', MOMO: '', CARD: '' });
      void qc.invalidateQueries({ queryKey: ['cashup'] });
      void qc.invalidateQueries({ queryKey: ['cashups'] });
    },
  });
  const tol = settings.data?.billing.cashupTolerance ?? 5;
  const worst = result?.variance ? Object.values(result.variance).reduce((a, v) => (Math.abs(v) > Math.abs(a) ? v : a), 0) : 0;
  return (
    <Section title="My open session">
      {result && (
        <div className="mb-4">
          {result.status === 'BALANCED' ? (
            <Alert tone="success">Balanced. Every method is within {money(tol)} of the expected amount.</Alert>
          ) : (
            <Alert tone="warning">{msg('VARIANCE_REQUIRES_REVIEW', { amount: money(worst) })}</Alert>
          )}
        </div>
      )}
      <QueryState q={q}>
        {(c) => (
          <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), close.mutate(c.id))}>
            <p className="text-sm text-slate">Opened {dateTime(c.openedAt)}. Expected is payments taken minus refunds paid out in this session.</p>
            {c.pendingReferences > 0 && <Alert tone="error">{msg('CASHUP_PENDING_REFERENCES', { count: c.pendingReferences })}</Alert>}
            <div className="grid gap-4 md:grid-cols-3">
              {METHODS.map((m) => {
                const v = counted[m.k];
                const diff = v === '' ? null : Number(v) - c.expected[m.k];
                return (
                  <div key={m.k} className="rounded-[12px] border border-line p-3">
                    <p className="text-sm text-slate">Expected</p>
                    <p className="text-xl font-semibold tabular-nums">{money(c.expected[m.k])}</p>
                    <div className="mt-2">
                      <Field label={m.l} hint={diff !== null ? `Difference ${diff >= 0 ? '+' : ''}${money(diff)}${Math.abs(diff) > tol ? ', above tolerance' : ''}` : m.hint}>
                        {(p) => <input {...p} className="input" inputMode="decimal" value={v} onChange={(e) => setCounted({ ...counted, [m.k]: e.target.value })} />}
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
            <ErrorAlert error={close.error} />
            <button className="btn-primary" disabled={close.isPending || Object.values(counted).some((x) => x === '')}>Close my session</button>
          </form>
        )}
      </QueryState>
    </Section>
  );
}

function AllCashups() {
  const { can, user } = useAuth();
  const { t } = useTranslation('status');
  const q = useQuery({ queryKey: ['cashups'], queryFn: api.cashups.list, refetchInterval: 30_000 });
  return (
    <Section title="Closed sessions">
      <QueryState q={q} isEmpty={(d) => !d.filter((c) => c.status !== 'OPEN').length} empty="No sessions closed yet.">
        {(rows) => (
          <ul className="space-y-3">
            {rows.filter((c) => c.status !== 'OPEN').map((c) => (
              <li key={c.id} className="rounded-[12px] border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{c.officerName}</strong>
                  <span className="text-sm text-slate">closed {dateTime(c.closedAt)}</span>
                  <Pill tone={c.status === 'FLAGGED' ? 'bad' : 'good'}>{t(`cashup.${c.status}`)}</Pill>
                  <a className="btn-link ml-auto text-sm" href={`/print/cashup/${c.id}`} target="_blank">Daily cash-up report</a>
                </div>
                <ul className="mt-3 space-y-2 sm:hidden">
                  {(['CASH', 'MOMO', 'CARD'] as const).map((k) => (
                    <li key={k} className="rounded-[12px] bg-mist p-3 text-sm">
                      <p className="font-semibold">{k === 'MOMO' ? 'Mobile money' : k === 'CASH' ? 'Cash' : 'Card'}</p>
                      <dl className="mt-1 grid grid-cols-3 gap-2">
                        <div><dt className="text-xs text-slate">Expected</dt><dd className="tabular">{money(c.expected[k])}</dd></div>
                        <div><dt className="text-xs text-slate">Counted</dt><dd className="tabular">{money(c.counted?.[k])}</dd></div>
                        <div><dt className="text-xs text-slate">Variance</dt><dd className={`tabular ${c.variance && c.variance[k] !== 0 ? 'font-semibold text-danger' : ''}`}>{money(c.variance?.[k])}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
                <div className="hidden sm:block"><table className="table mt-2 max-w-xl">
                  <thead><tr><th>Method</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th className="text-right">Variance</th></tr></thead>
                  <tbody>
                    {(['CASH', 'MOMO', 'CARD'] as const).map((k) => (
                      <tr key={k}>
                        <td>{k === 'MOMO' ? 'Mobile money' : k === 'CASH' ? 'Cash' : 'Card'}</td>
                        <td className="text-right tabular-nums">{money(c.expected[k])}</td>
                        <td className="text-right tabular-nums">{money(c.counted?.[k])}</td>
                        <td className={`text-right tabular-nums ${c.variance && c.variance[k] !== 0 ? 'font-semibold text-danger' : ''}`}>{money(c.variance?.[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                {c.status === 'RECONCILED' && <p className="mt-2 text-sm">Reconciled by {c.reviewedByName}: {c.explanation}</p>}
                {c.status === 'FLAGGED' && can('cashup.reconcile') && (c.officerId === user?.id ? (
                  <p className="mt-2 text-sm font-semibold text-danger">You closed this session, so another Branch Manager must reconcile it.</p>
                ) : <Reconcile id={c.id} />)}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </Section>
  );
}

function Reconcile({ id }: { id: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const m = useMutation({ mutationFn: () => api.cashups.reconcile(id, text), onSuccess: () => qc.invalidateQueries({ queryKey: ['cashups'] }) });
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
      <div className="min-w-64 flex-1"><Field label="Explanation for the variance" required>{(p) => <input {...p} className="input" value={text} onChange={(e) => setText(e.target.value)} />}</Field></div>
      <button className="btn-primary" disabled={!text.trim() || m.isPending}>Mark reconciled</button>
      <div className="w-full"><ErrorAlert error={m.error} /></div>
    </form>
  );
}
