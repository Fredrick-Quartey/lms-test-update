/**
 * Staff order record. D-04 (status + full history), F-02 (audit trail with actor and before/after),
 * A-05 (cancel), E-02 (payments), E-03 (refund / adjustment request — authorised only by a Branch Manager),
 * D-01 (unclaimed disposal by Branch Manager), D-03 (proof of delivery), C-02 (damage reports).
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AuditEvent, type Order } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, ErrorAlert, Field, KeyValue, Modal, PageHeader, PaymentBadge, QueryState, Section, StatusBadge, Ticket, useToast } from '@/components/ui';
import { InvoiceTable, ItemsTable, JourneyBar, PaymentsTable } from '@/components/order';
import { PaymentPanel } from '@/components/PaymentPanel';
import { dateTime, money } from '@/lib/format';
import { errorField, errorMessage } from '@/lib/errors';
import { useSettings } from '@/config/settings';

export function OrderDetail() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api.orders.get(id!), refetchInterval: 15_000 });
  return <QueryState q={q}>{(o) => <Detail o={o} />}</QueryState>;
}

function Detail({ o }: { o: Order }) {
  const { can, activeRole } = useAuth();
  const settings = useSettings();
  const [modal, setModal] = useState<null | 'cancel' | 'refund' | 'dispose'>(null);
  const damage = useQuery({ queryKey: ['damage', 'order', o.id], queryFn: () => api.damage.list(), select: (d) => d.filter((r) => r.orderId === o.id) });
  const canCancel = can('order.cancel') && (o.status === 'RECEIVED' || o.status === 'IN_SORTING');
  const daysReady = o.readyNotifiedAt ? (Date.now() - new Date(o.readyNotifiedAt).getTime()) / 86400_000 : 0;
  const canDispose = can('item.discard') && o.status === 'READY_FOR_PICKUP' && daysReady >= (settings.data?.handover.disposalDays ?? 90);
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        back={activeRole === 'ATTENDANT' ? { to: '/staff/work', label: 'My work' } : { to: '/staff/orders', label: 'Orders' }}
        title={o.orderNo}
        intro={<>{o.customerName}, {o.customerPhone}{o.guest ? ' (guest)' : ''}</>}
        actions={
          <>
            {can('payment.capture') && o.status !== 'DRAFT' && <a className="btn" href={`/print/invoice/${o.id}`} target="_blank">Print invoice</a>}
            {can('refund.request') && o.amountPaid > 0 && <button className="btn" onClick={() => setModal('refund')}>Request refund or adjustment</button>}
            {canCancel && <button className="btn-danger" onClick={() => setModal('cancel')}>Cancel order</button>}
            {canDispose && <button className="btn-danger" onClick={() => setModal('dispose')}>Mark unclaimed and disposed</button>}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Ticket size="lg">{o.orderNo}</Ticket>
        <StatusBadge status={o.status} />
        <PaymentBadge state={o.paymentState} balance={o.balance} />
        {o.speed === 'EXPRESS' && <span className="rounded-full bg-tag px-2 text-xs font-semibold">Express</span>}
      </div>
      {o.status === 'CANCELLED' && o.cancellation && (
        <Alert tone="warning">Cancelled by {o.cancellation.by} on {dateTime(o.cancellation.at)}: {o.cancellation.reason.replace(/_/g, ' ').toLowerCase()}{o.cancellation.note ? `, ${o.cancellation.note}` : ''}.</Alert>
      )}
      {o.disposal && <Alert tone="warning">Disposed by {o.disposal.by} on {dateTime(o.disposal.at)}: {o.disposal.reason}</Alert>}
      <Section>
        <JourneyBar status={o.status} deliveryFlag={o.deliveryFlag} />
        <div className="mt-4">
          <KeyValue rows={[
            ['Ready by', dateTime(o.expectedReadyBy)],
            ['Handover', o.deliveryFlag ? `Delivery to ${o.deliveryAddress ?? '—'}` : 'Collect at the counter'],
            ['Shelf', o.shelf ?? '—'],
            ['Customer notified', o.readyNotifiedAt ? dateTime(o.readyNotifiedAt) : 'Not yet'],
            ['Reminders sent', o.remindersSent.length ? o.remindersSent.map((d) => `day ${d}`).join(', ') : 'None'],
            ...(o.failedDeliveries.length ? ([['Failed deliveries', o.failedDeliveries.map((f) => `${dateTime(f.at)}: ${f.reason}`).join('; ')]] as [string, string][]) : []),
          ]} />
        </div>
      </Section>
      <Section title="Items">
        <ItemsTable order={o} />
        <ItemHistory o={o} />
      </Section>
      {damage.data && damage.data.length > 0 && (
        <Section title="Damage and loss reports">
          <ul className="space-y-2 text-sm">
            {damage.data.map((d) => (
              <li key={d.id}>
                <Ticket>{d.tag}</Ticket> {d.type === 'LOST' ? 'Lost' : 'Damage'}: {d.description}.{' '}
                <strong>{d.status === 'OPEN' ? 'Waiting for the Branch Manager' : `Resolved: ${d.resolution?.replace('_', ' ').toLowerCase()}`}</strong>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={`Invoice ${o.invoice?.number ?? ''}`}>
          <InvoiceTable invoice={o.invoice} />
        </Section>
        <Section title="Payments">
          <PaymentsTable payments={o.payments} />
          {can('payment.capture') && o.balance > 0 && !['CANCELLED', 'UNCLAIMED_DISPOSED', 'DRAFT'].includes(o.status) && (
            <div className="mt-4 border-t border-line pt-4"><PaymentPanel order={o} /></div>
          )}
        </Section>
      </div>
      {o.pod && (
        <Section title="Proof of delivery">
          <p className="text-sm">Received by <strong>{o.pod.recipientName}</strong>, {dateTime(o.pod.at)}, recorded by {o.pod.byName}</p>
          {o.pod.signature && <img src={o.pod.signature} alt={`Signature of ${o.pod.recipientName}`} className="mt-2 h-24 rounded-[8px] border border-line bg-white" />}
          {o.pod.photo && <img src={o.pod.photo} alt="Delivery photo" className="mt-2 max-h-48 rounded-[8px] border border-line" />}
        </Section>
      )}
      <History orderId={o.id} />
      <CancelModal open={modal === 'cancel'} onClose={() => setModal(null)} o={o} />
      <RefundModal open={modal === 'refund'} onClose={() => setModal(null)} o={o} />
      <DisposeModal open={modal === 'dispose'} onClose={() => setModal(null)} o={o} />
    </div>
  );
}

function ItemHistory({ o }: { o: Order }) {
  const withHistory = o.items.filter((i) => i.stageLog.length || i.qc.length);
  if (!withHistory.length) return null;
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-semibold">Processing and QC history per item</summary>
      <div className="mt-3 space-y-4">
        {withHistory.map((i) => (
          <div key={i.id} className="text-sm">
            <p className="mb-1"><Ticket>{i.tag}</Ticket></p>
            <ul className="ml-4 list-disc space-y-0.5">
              {i.stageLog.map((l, k) => (
                <li key={`s${k}`}>
                  {l.rework ? 'Rework: ' : ''}{l.stage} started {dateTime(l.startedAt)}{l.startedBy ? ` by ${l.startedBy}` : ''}
                  {l.completedAt ? `, completed ${dateTime(l.completedAt)}` : ', in progress'}
                </li>
              ))}
              {i.qc.map((r, k) => (
                <li key={`q${k}`}>
                  QC {r.outcome === 'PASS' ? 'pass' : r.outcome === 'FAIL' ? 'fail' : 'sent for rework'} by {r.byName}, {dateTime(r.at)}{r.reason ? `: ${r.reason}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function History({ orderId }: { orderId: string }) {
  const q = useQuery({ queryKey: ['order', orderId, 'history'], queryFn: () => api.orders.history(orderId), refetchInterval: 20_000 });
  return (
    <Section title="History" className="scroll-mt-20">
      <div id="history" />
      <QueryState q={q} isEmpty={(d) => !d.length}>
        {(events) => (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Change</th></tr></thead>
              <tbody>
                {events.map((e) => <HistoryRow key={e.id} e={e} />)}
              </tbody>
            </table>
            <p className="muted mt-2 text-sm">History is append-only. Corrections are new entries; nothing here can be edited or deleted.</p>
          </div>
        )}
      </QueryState>
    </Section>
  );
}

export function HistoryRow({ e }: { e: AuditEvent }) {
  return (
    <tr>
      <td className="whitespace-nowrap">{dateTime(e.at)}</td>
      <td>{e.actorName}</td>
      <td>{humanAction(e.action)}</td>
      <td className="max-w-md text-xs text-slate"><ChangeText before={e.before} after={e.after} /></td>
    </tr>
  );
}

export function humanAction(a: string) {
  const s = a.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ChangeText({ before, after }: { before?: unknown; after?: unknown }) {
  const fmt = (v: unknown) => (v === undefined || v === null ? '' : typeof v === 'object' ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined && x !== null && x !== '').map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`).join(', ') : String(v));
  const b = fmt(before);
  const a = fmt(after);
  if (!b && !a) return null;
  return (
    <span>
      {b && <span className="line-through decoration-navy/30">{b}</span>}
      {b && a && ' to '}
      {a && <span>{a}</span>}
    </span>
  );
}

function CancelModal({ open, onClose, o }: { open: boolean; onClose: () => void; o: Order }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('CUSTOMER_REQUEST');
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: () => api.orders.cancel(o.id, reason, note || undefined),
    onSuccess: (r) => {
      qc.setQueryData(['order', r.id], r);
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast(r.amountPaid > 0 ? `Order cancelled. A refund request for ${money(r.amountPaid)} was sent to the Branch Manager.` : 'Order cancelled and tags released.');
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={`Cancel ${o.orderNo}`}>
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
        <p className="text-sm">Only possible before any item starts processing. Tags are released, and the customer is told.</p>
        {o.amountPaid > 0 && <Alert tone="warning">{money(o.amountPaid)} has been paid. Cancelling raises a refund request for the Branch Manager; you can't pay it out from here.</Alert>}
        <fieldset>
          <legend className="label">Reason</legend>
          {[['CUSTOMER_REQUEST', 'Customer asked to cancel'], ['DUPLICATE_ENTRY', 'Duplicate entry'], ['OTHER', 'Other']].map(([v, l]) => (
            <label key={v} className="flex min-h-10 items-center gap-2"><input type="radio" checked={reason === v} onChange={() => setReason(v)} /> {l}</label>
          ))}
        </fieldset>
        <Field label={reason === 'OTHER' ? 'Note' : 'Note (optional)'} required={reason === 'OTHER'} error={errorField(m.error) === 'note' ? errorMessage(m.error) : null}>
          {(p) => <input {...p} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {errorField(m.error) !== 'note' && <ErrorAlert error={m.error} />}
        <button className="btn-danger" disabled={m.isPending || (reason === 'OTHER' && !note.trim())}>Cancel the order</button>
      </form>
    </Modal>
  );
}

function RefundModal({ open, onClose, o }: { open: boolean; onClose: () => void; o: Order }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<'REFUND' | 'ADJUSTMENT'>('REFUND');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [damageId, setDamageId] = useState('');
  const damage = useQuery({ queryKey: ['damage', 'order', o.id], queryFn: () => api.damage.list(), select: (d) => d.filter((r) => r.orderId === o.id), enabled: open });
  const m = useMutation({
    mutationFn: () => api.approvals.requestRefund({ orderId: o.id, amount: Number(amount), reason, kind, damageReportId: damageId || undefined }),
    onSuccess: () => {
      toast('Request sent to the Branch Manager for approval.');
      void qc.invalidateQueries({ queryKey: ['approvals'] });
      onClose();
      setAmount('');
      setReason('');
    },
  });
  return (
    <Modal open={open} onClose={onClose} title="Request a refund or price adjustment">
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
        <p className="text-sm">A Branch Manager who did not take payment on this order must approve it. Paid so far: <strong>{money(o.amountPaid)}</strong>.</p>
        <fieldset className="flex gap-4">
          <legend className="label">Type</legend>
          <label className="flex min-h-10 items-center gap-2"><input type="radio" checked={kind === 'REFUND'} onChange={() => setKind('REFUND')} /> Refund money</label>
          <label className="flex min-h-10 items-center gap-2"><input type="radio" checked={kind === 'ADJUSTMENT'} onChange={() => setKind('ADJUSTMENT')} /> Reduce the price</label>
        </fieldset>
        <Field label="Amount" required error={errorField(m.error) === 'amount' ? errorMessage(m.error) : null}>
          {(p) => <input {...p} className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="Reason" required error={errorField(m.error) === 'reason' ? errorMessage(m.error) : null}>
          {(p) => <textarea {...p} className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        {damage.data && damage.data.length > 0 && (
          <Field label="Link to a damage report (optional)">
            {(p) => (
              <select {...p} className="input" value={damageId} onChange={(e) => setDamageId(e.target.value)}>
                <option value="">None</option>
                {damage.data!.map((d) => <option key={d.id} value={d.id}>{d.tag}: {d.description}</option>)}
              </select>
            )}
          </Field>
        )}
        {!errorField(m.error) && <ErrorAlert error={m.error} />}
        <button className="btn-primary" disabled={m.isPending || !(Number(amount) > 0) || !reason.trim()}>Send for approval</button>
      </form>
    </Modal>
  );
}

function DisposeModal({ open, onClose, o }: { open: boolean; onClose: () => void; o: Order }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('Not collected after the unclaimed-items period stated on the receipt');
  const m = useMutation({
    mutationFn: () => api.orders.dispose(o.id, reason),
    onSuccess: (r) => {
      qc.setQueryData(['order', r.id], r);
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={`Dispose of ${o.orderNo}`}>
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
        <p className="text-sm">The order closes as Unclaimed – Disposed. This decision is logged with your name.</p>
        <Field label="Reason" required>{(p) => <textarea {...p} className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <ErrorAlert error={m.error} />
        <button className="btn-danger" disabled={!reason.trim() || m.isPending}>Record disposal</button>
      </form>
    </Modal>
  );
}

