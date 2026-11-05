/**
 * Approvals (checker). E-03 refunds/adjustments, C-01 QC overrides, E-04 credit overrides, B-04 rework review,
 * C-02 damage resolution, D-01 uncollected + disposal. Maker is always shown; SoD blocks come from the server.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type ApprovalRequest, type DamageReport, type DamageResolution } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, ErrorAlert, Field, PageHeader, Pill, QueryState, Section, Tabs, Ticket, useToast } from '@/components/ui';
import { FLAG_LABEL } from '@/components/order';
import { dateTime, money } from '@/lib/format';
import { kindLabel } from './Inbox';
import { errorField, errorMessage } from '@/lib/errors';

type Tab = 'requests' | 'damage' | 'uncollected' | 'history';

export function Approvals() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'requests';
  const pending = useQuery({ queryKey: ['approvals', 'PENDING'], queryFn: () => api.approvals.list('PENDING'), refetchInterval: 20_000 });
  const damage = useQuery({ queryKey: ['damage', 'OPEN'], queryFn: () => api.damage.list('OPEN') });
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox, enabled: useAuth().activeRole === 'MANAGER' });
  return (
    <div>
      <PageHeader title="Approvals" intro="The person who raised a request, or who took the payment, can't approve it. Another Branch Manager has to." />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { key: 'requests', label: 'Requests', count: pending.data?.length },
          { key: 'damage', label: 'Damage and loss', count: damage.data?.length },
          { key: 'uncollected', label: 'Uncollected', count: (inbox.data?.uncollected.length ?? 0) + (inbox.data?.disposable.length ?? 0) },
          { key: 'history', label: 'Decided' },
        ]}
      />
      {tab === 'requests' && (
        <QueryState q={pending} isEmpty={(d) => !d.length} empty="No requests are waiting.">
          {(rows) => <div className="space-y-4">{rows.map((a) => <RequestCard key={a.id} a={a} />)}</div>}
        </QueryState>
      )}
      {tab === 'damage' && (
        <QueryState q={damage} isEmpty={(d) => !d.length} empty="No open damage or loss reports.">
          {(rows) => <div className="space-y-4">{rows.map((r) => <DamageCard key={r.id} r={r} />)}</div>}
        </QueryState>
      )}
      {tab === 'uncollected' && (
        <QueryState q={inbox}>
          {(d) => (
            <div className="space-y-5">
              <Section title="Flagged for follow-up">
                {!d.uncollected.length && <p className="muted text-sm">None.</p>}
                <ul className="divide-y divide-line text-sm">
                  {d.uncollected.map((o) => (
                    <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span><Link to={`/staff/orders/${o.id}`}><Ticket>{o.orderNo}</Ticket></Link> {o.customerName}, {o.customerPhone}</span>
                      <span className="text-slate">Ready since {dateTime(o.readyNotifiedAt)}, reminders on day {o.remindersSent.join(' and ') || '—'}</span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Eligible for disposal">
                {!d.disposable.length && <p className="muted text-sm">None.</p>}
                <ul className="divide-y divide-line text-sm">
                  {d.disposable.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span><Ticket>{o.orderNo}</Ticket> {o.customerName}, ready since {dateTime(o.readyNotifiedAt)}</span>
                      <Link className="btn" to={`/staff/orders/${o.id}`}>Review and dispose</Link>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}
        </QueryState>
      )}
      {tab === 'history' && <Decided />}
    </div>
  );
}

function RequestCard({ a }: { a: ApprovalRequest }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user, can } = useAuth();
  const [note, setNote] = useState('');
  const order = useQuery({ queryKey: ['order', a.orderId], queryFn: () => api.orders.get(a.orderId) });
  const m = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') => api.approvals.decide(a.id, decision, note),
    onSuccess: (r) => {
      toast(`${kindLabel(r.kind)} ${r.status.toLowerCase()}.`);
      void qc.invalidateQueries({ queryKey: ['approvals'] });
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['order', a.orderId] });
    },
  });
  const ownRequest = a.requestedBy === user?.id;
  const tookPayment = (a.kind === 'REFUND' || a.kind === 'ADJUSTMENT') && order.data?.payments.some((p) => p.kind === 'PAYMENT' && p.by === user?.id);
  return (
    <Section>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="warn">{kindLabel(a.kind)}</Pill>
        <Link to={`/staff/orders/${a.orderId}`}><Ticket>{a.orderNo}</Ticket></Link>
        {a.tag && <Ticket>{a.tag}</Ticket>}
        {a.amount !== undefined && <strong className="ml-auto text-lg">{money(a.amount)}</strong>}
      </div>
      <p className="mt-2">{a.reason}</p>
      <p className="mt-1 text-sm text-slate">
        Requested by <strong className="text-navy">{a.requestedByName}</strong>, {dateTime(a.requestedAt)}
        {a.kind === 'REFUND' && a.method ? `. Paid back by ${a.method === 'CASH' ? 'cash' : a.method === 'MOMO' ? 'mobile money' : 'card'}` : ''}
        {order.data ? `. Order paid ${money(order.data.amountPaid)} of ${money(order.data.invoice?.total)}` : ''}
      </p>
      {can('approve') && (
        <>
          {ownRequest && <div className="mt-3"><Alert tone="warning">You raised this request, so a different Branch Manager must decide it.</Alert></div>}
          {!ownRequest && tookPayment && <div className="mt-3"><Alert tone="warning">You took a payment on this order, so a different Branch Manager must authorise it.</Alert></div>}
          {!ownRequest && !tookPayment && (
            <form className="mt-3 space-y-3" onSubmit={(e) => (e.preventDefault(), m.mutate('APPROVE'))}>
              <Field label="Decision note" required error={errorField(m.error) === 'note' ? errorMessage(m.error) : null}>
                {(p) => <input {...p} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}
              </Field>
              {errorField(m.error) !== 'note' && <ErrorAlert error={m.error} />}
              <div className="flex gap-2">
                <button className="btn-primary" disabled={!note.trim() || m.isPending}>Approve</button>
                <button type="button" className="btn-danger" disabled={!note.trim() || m.isPending} onClick={() => m.mutate('REJECT')}>Reject</button>
              </div>
            </form>
          )}
        </>
      )}
    </Section>
  );
}

const RESOLUTIONS: { v: DamageResolution; l: string }[] = [
  { v: 'COMPENSATION', l: 'Compensation' },
  { v: 'DISCOUNT', l: 'Discount' },
  { v: 'REPLACEMENT', l: 'Replacement' },
  { v: 'NO_FAULT', l: 'No fault found' },
];

function DamageCard({ r }: { r: DamageReport }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const [resolution, setResolution] = useState<DamageResolution | ''>('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState(r.customerMessage);
  const m = useMutation({
    mutationFn: () => api.damage.resolve(r.id, { resolution: resolution || undefined, note, customerMessage: message }),
    onSuccess: () => {
      toast('Report closed and the customer message sent.');
      void qc.invalidateQueries({ queryKey: ['damage'] });
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
  return (
    <Section>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="bad">{r.type === 'LOST' ? 'Lost item' : 'Damage'}</Pill>
        <Ticket>{r.tag}</Ticket>
        <Link to={`/staff/orders/${r.orderId}`} className="btn-link text-sm">{r.orderNo}</Link>
        <span className="ml-auto text-sm text-slate">{r.reportedByName}, {dateTime(r.createdAt)}</span>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div className="rounded-[12px] border border-danger/30 bg-danger-wash p-3 text-sm">
          <p className="font-semibold">Reported now</p>
          <p>{r.description}</p>
          {r.photo && <img src={r.photo} alt="Damage photo" className="mt-2 max-h-40 rounded-[8px] border border-line" />}
        </div>
        <div className="rounded-[12px] border border-line bg-mist p-3 text-sm">
          <p className="font-semibold">Recorded at intake</p>
          {!r.intakeFlags.length && <p className="muted">Nothing was flagged at intake.</p>}
          {r.intakeFlags.map((f) => (
            <div key={f.id} className="mt-1">
              <p><strong>{FLAG_LABEL[f.type]}</strong>{f.note ? `: ${f.note}` : ''}</p>
              {f.photo && <img src={f.photo} alt="Intake photo" className="mt-1 max-h-40 rounded-[8px] border border-line" />}
            </div>
          ))}
        </div>
      </div>
      {can('damage.resolve') && (
        <form className="mt-4 space-y-3" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
          <fieldset>
            <legend className="label">Resolution</legend>
            <div className="flex flex-wrap gap-2">
              {RESOLUTIONS.map((x) => (
                <label key={x.v} className={`btn cursor-pointer ${resolution === x.v ? 'border-blue bg-sky' : ''}`}>
                  <input type="radio" className="sr-only" checked={resolution === x.v} onChange={() => setResolution(x.v)} />{x.l}
                </label>
              ))}
            </div>
            {errorField(m.error) === 'resolution' && <p className="field-error">{errorMessage(m.error)}</p>}
          </fieldset>
          <Field label="Internal note">{(p) => <input {...p} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <Field label="Message to the customer" hint="Review the wording before it is sent.">{(p) => <textarea {...p} className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />}</Field>
          {(resolution === 'COMPENSATION' || resolution === 'DISCOUNT') && (
            <p className="text-sm">To pay compensation or give a discount, also record a refund or price adjustment on the <Link className="btn-link" to={`/staff/orders/${r.orderId}`}>order</Link> and link it to this report.</p>
          )}
          {errorField(m.error) !== 'resolution' && <ErrorAlert error={m.error} />}
          <button className="btn-primary" disabled={m.isPending}>Close report and send message</button>
        </form>
      )}
    </Section>
  );
}

function Decided() {
  const { t } = useTranslation('status');
  const q = useQuery({ queryKey: ['approvals', 'decided'], queryFn: () => api.approvals.list(), select: (d) => d.filter((a) => a.status !== 'PENDING') });
  return (
    <QueryState q={q} isEmpty={(d) => !d.length} empty="Nothing decided yet.">
      {(rows) => (
        <Section>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Type</th><th>Order</th><th>Amount</th><th>Requested by</th><th>Decided by</th><th>Outcome</th><th>Note</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{kindLabel(a.kind)}</td>
                    <td><Link className="btn-link font-normal" to={`/staff/orders/${a.orderId}`}>{a.orderNo}</Link></td>
                    <td>{a.amount !== undefined ? money(a.amount) : '—'}</td>
                    <td>{a.requestedByName}</td>
                    <td>{a.decidedByName}, {dateTime(a.decidedAt)}</td>
                    <td><Pill tone={a.status === 'APPROVED' ? 'good' : 'bad'}>{t(`approval.${a.status}`)}</Pill></td>
                    <td className="max-w-xs">{a.decisionNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </QueryState>
  );
}
