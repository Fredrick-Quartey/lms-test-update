// SRS-LDY-E-04 (COULD): corporate accounts on credit terms, running balance vs limit, consolidated statements.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Customer } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { ErrorAlert, Field, KeyValue, PageHeader, QueryState, Section, StatusBadge, Ticket, useToast } from '@/components/ui';
import { date, money, todayISO } from '@/lib/format';

export function Corporate() {
  const q = useQuery({ queryKey: ['corporate'], queryFn: api.corporate.list });
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div>
      <PageHeader title="Corporate accounts" intro="Business customers billed monthly on agreed terms instead of paying per order." />
      <QueryState q={q} isEmpty={(d) => !d.length} empty="No corporate accounts yet. A Branch Manager can create one from the Counter.">
        {(rows) => {
          const current = rows.find((c) => c.id === sel) ?? rows[0];
          return (
            <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
              <ul className="space-y-2">
                {rows.map((c) => {
                  const pct = c.corporate ? Math.min(100, (c.corporate.runningBalance / c.corporate.creditLimit) * 100) : 0;
                  return (
                    <li key={c.id}>
                      <button className={`panel block w-full p-3 text-left ${current?.id === c.id ? 'border-blue' : ''}`} onClick={() => setSel(c.id)} aria-pressed={current?.id === c.id}>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-slate">{money(c.corporate?.runningBalance)} of {money(c.corporate?.creditLimit)}</p>
                        <div className="mt-2 h-2 rounded-[8px] bg-mist" aria-hidden><div className={`h-2 rounded-[8px] ${pct > 90 ? 'bg-danger' : 'bg-blue'}`} style={{ width: `${pct}%` }} /></div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {current && <Account key={current.id} c={current} />}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}

function Account({ c }: { c: Customer }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const orders = useQuery({ queryKey: ['corporate', c.id, 'orders'], queryFn: () => api.corporate.orders(c.id) });
  const statements = useQuery({ queryKey: ['corporate', c.id, 'statements'], queryFn: () => api.corporate.statements(c.id) });
  const first = new Date(); first.setUTCDate(1);
  const [from, setFrom] = useState(first.toISOString().slice(0, 10));
  const [to, setTo] = useState(todayISO());
  const gen = useMutation({ mutationFn: () => api.corporate.generateStatement(c.id, from, to), onSuccess: () => { toast('Statement generated.'); void qc.invalidateQueries({ queryKey: ['corporate', c.id] }); } });
  const [limit, setLimit] = useState(String(c.corporate?.creditLimit ?? ''));
  const [terms, setTerms] = useState(String(c.corporate?.termsDays ?? ''));
  const save = useMutation({ mutationFn: () => api.customers.update(c.id, { corporate: { creditLimit: Number(limit), termsDays: Number(terms) } }), onSuccess: () => { toast('Terms saved.'); void qc.invalidateQueries({ queryKey: ['corporate'] }); } });
  return (
    <div className="space-y-5">
      <Section title={c.name}>
        <KeyValue rows={[
          ['Contact', `${c.phone}${c.email ? `, ${c.email}` : ''}`],
          ['Running balance', <strong key="b">{money(c.corporate?.runningBalance)}</strong>],
          ['Credit limit', money(c.corporate?.creditLimit)],
          ['Terms', `Net ${c.corporate?.termsDays} days, billed monthly`],
        ]} />
        {can('corporate.configure') && (
          <form className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end" onSubmit={(e) => (e.preventDefault(), save.mutate())}>
            <Field label="Credit limit">{(p) => <input {...p} className="input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />}</Field>
            <Field label="Payment terms (days)">{(p) => <input {...p} className="input" inputMode="numeric" value={terms} onChange={(e) => setTerms(e.target.value)} />}</Field>
            <button className="btn">Save terms</button>
            <div className="sm:col-span-3"><ErrorAlert error={save.error} /></div>
          </form>
        )}
      </Section>
      <Section title="Statements">
        <form className="grid gap-3 sm:grid-cols-3 sm:items-end" onSubmit={(e) => (e.preventDefault(), gen.mutate())}>
          <Field label="From">{(p) => <input {...p} type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="To">{(p) => <input {...p} type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
          <button className="btn-primary" disabled={gen.isPending}>Generate statement</button>
        </form>
        <div className="mt-2"><ErrorAlert error={gen.error} /></div>
        <ul className="mt-4 divide-y divide-line">
          {statements.data?.map((s) => (
            <li key={s.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{date(s.periodFrom)} to {date(s.periodTo)}: {s.orders.length} order(s), <strong>{money(s.total)}</strong>, due {date(s.dueDate)}</span>
                <a className="btn-link" href={`/print/statement/${s.id}`} target="_blank">Print</a>
              </div>
              <p className="text-slate">Paid {money(s.paid)}</p>
              {s.paid < s.total && <StatementPayment id={s.id} max={s.total - s.paid} customerId={c.id} />}
            </li>
          ))}
          {!statements.data?.length && <li className="muted py-2 text-sm">No statements yet.</li>}
        </ul>
      </Section>
      <Section title="Orders on account">
        <ul className="divide-y divide-line text-sm">
          {orders.data?.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><Link to={`/staff/orders/${o.id}`}><Ticket>{o.orderNo}</Ticket></Link> {date(o.finalisedAt)}</span>
              <span className="flex items-center gap-2"><StatusBadge status={o.status} /><strong>{money(o.invoice?.total)}</strong></span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function StatementPayment({ id, max, customerId }: { id: string; max: number; customerId: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(max.toFixed(2));
  const [method, setMethod] = useState<'CASH' | 'MOMO' | 'CARD'>('MOMO');
  const [ref, setRef] = useState('');
  const m = useMutation({ mutationFn: () => api.corporate.recordPayment(id, Number(amount), method, ref || undefined), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['corporate'] }); void qc.invalidateQueries({ queryKey: ['corporate', customerId] }); } });
  return (
    <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
      <label className="text-sm">Amount<input className="input w-28" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="text-sm">Method<select className="input" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="MOMO">Mobile money</option><option value="CARD">Card</option><option value="CASH">Cash</option></select></label>
      {method !== 'CASH' && <label className="text-sm">Reference<input className="input w-40" value={ref} onChange={(e) => setRef(e.target.value)} /></label>}
      <button className="btn">Record payment</button>
      <div className="w-full"><ErrorAlert error={m.error} /></div>
    </form>
  );
}
