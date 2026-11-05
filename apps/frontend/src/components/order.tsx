import type { ReactNode } from 'react';
import type { Invoice, Order, OrderStatus, Payment } from '@ldy/api-client';
import { useTranslation } from 'react-i18next';
import { dateTime, money } from '@/lib/format';
import { useNames } from '@/config/settings';
import { ItemStatusBadge, Ticket } from './ui';

export function InvoiceTable({ invoice }: { invoice?: Invoice }) {
  if (!invoice) return <p className="muted text-sm">No invoice yet. It is created when the order is finalised.</p>;
  return (
    <table className="table">
      <caption className="sr-only">Invoice {invoice.number}</caption>
      <tbody>
        {invoice.lines.map((l, i) => (
          <tr key={i}>
            <td>{l.label}</td>
            <td className="text-right tabular-nums">{money(l.amount)}</td>
          </tr>
        ))}
        {invoice.surcharge > 0 && (
          <tr>
            <td>Express surcharge</td>
            <td className="text-right tabular-nums">{money(invoice.surcharge)}</td>
          </tr>
        )}
        {invoice.taxes.map((t) => (
          <tr key={t.label}>
            <td>{t.label}</td>
            <td className="text-right tabular-nums">{money(t.amount)}</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td>Total</td>
          <td className="text-right tabular-nums">{money(invoice.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  if (!payments.length) return <p className="muted text-sm">No payments recorded.</p>;
  const label = { CASH: 'Cash', CARD: 'Card', MOMO: 'Mobile money' };
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Receipt</th>
            <th>When</th>
            <th>Method</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>
                <a href={`/print/receipt/${p.id}`} target="_blank" className="btn-link font-normal">
                  {p.receiptNo}
                </a>
              </td>
              <td>{dateTime(p.at)}</td>
              <td>
                {label[p.method]}
                {p.reference ? `, ref ${p.reference}` : ''}
              </td>
              <td className={`text-right tabular-nums ${p.kind === 'REFUND' ? 'text-danger' : ''}`}>
                {p.kind === 'REFUND' ? `Refund −${money(p.amount)}` : money(p.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ItemsTable({ order, showStatus = true, extra }: { order: Order; showStatus?: boolean; extra?: (itemId: string) => ReactNode }) {
  const names = useNames();
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Item</th>
            <th>Service</th>
            <th>Notes</th>
            {showStatus && <th>Stage</th>}
            <th className="text-right">Line</th>
            {extra && <th><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id}>
              <td>{i.tag ? <Ticket>{i.tag}</Ticket> : <span className="muted">On confirm</span>}</td>
              <td>
                {names.category(i.categoryId)}
                <span className="muted">{i.weightKg ? `, ${i.weightKg} kg` : ` × ${i.quantity}`}</span>
                <span className="block text-xs text-slate">
                  {i.colour.toLowerCase()}, {i.fabric.toLowerCase()}
                </span>
              </td>
              <td>{names.service(i.serviceTypeId)}</td>
              <td className="max-w-56">
                {i.instructions && <p>{i.instructions}</p>}
                {i.flags.map((f) => (
                  <p key={f.id} className="text-xs">
                    <span className="font-semibold">{FLAG_LABEL[f.type]}</span>
                    {f.note ? `: ${f.note}` : ''}
                    {f.stage !== 'INTAKE' ? ` (added at ${f.stage.toLowerCase()})` : ''}
                  </p>
                ))}
                {i.reworkCount > 0 && <p className="text-xs text-warning">Reworked {i.reworkCount}×</p>}
              </td>
              {showStatus && (
                <td>
                  <ItemStatusBadge status={i.status} />
                </td>
              )}
              <td className="text-right tabular-nums">{money(i.lineTotal)}</td>
              {extra && <td>{extra(i.id)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const FLAG_LABEL: Record<string, string> = {
  STAIN: 'Pre-existing stain',
  DAMAGE: 'Pre-existing damage',
  DELICATE: 'Delicate fabric',
  NO_STARCH: 'No starch',
  COLOUR_RUN_RISK: 'Colour may run',
  OTHER: 'Note',
};

/** The journey as a simple progress line (customer + staff tracking, D-04). */
const STEPS: OrderStatus[] = ['RECEIVED', 'IN_SORTING', 'IN_PROCESSING', 'QC_PASSED', 'PACKAGED'];
export function JourneyBar({ status, deliveryFlag }: { status: OrderStatus; deliveryFlag: boolean }) {
  const { t } = useTranslation('status');
  if (status === 'CANCELLED' || status === 'UNCLAIMED_DISPOSED' || status === 'DRAFT') return null;
  const last: OrderStatus = deliveryFlag ? 'DELIVERED' : 'COLLECTED';
  const ready: OrderStatus = deliveryFlag ? 'OUT_FOR_DELIVERY' : 'READY_FOR_PICKUP';
  const steps = [...STEPS, ready, last];
  const map: Partial<Record<OrderStatus, number>> = { QC_FAILED: 2 };
  let idx = steps.indexOf(status);
  if (idx < 0) idx = map[status] ?? 0;
  if (status === 'PACKAGED' && !deliveryFlag) idx = steps.indexOf('READY_FOR_PICKUP');
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1 text-xs sm:text-sm" aria-current={i === idx ? 'step' : undefined}>
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${
              i < idx ? 'bg-sky text-blue-dark' : i === idx ? 'bg-tag text-navy' : 'bg-mist text-slate'
            }`}
          >
            {s === 'QC_PASSED' ? 'Quality check' : t(`order.${s}`)}
          </span>
          {i < steps.length - 1 && <span aria-hidden className="text-navy/30">/</span>}
        </li>
      ))}
    </ol>
  );
}

/** Plain-words status for customers (REDESIGN §8, D26), e.g. "Being washed", "Ready to collect at shelf A-03". */
export function plainStatus(o: { status: OrderStatus; shelf?: string; deliveryFlag: boolean }) {
  switch (o.status) {
    case 'DRAFT':
    case 'RECEIVED':
      return 'Received at the counter';
    case 'IN_SORTING':
      return 'Being sorted';
    case 'IN_PROCESSING':
      return 'Being washed, dried and ironed';
    case 'QC_FAILED':
      return 'Getting extra care';
    case 'QC_PASSED':
      return 'Checked, being packed';
    case 'PACKAGED':
      return o.deliveryFlag ? 'Packed, waiting for a rider' : 'Packed';
    case 'READY_FOR_PICKUP':
      return o.shelf ? `Ready to collect at shelf ${o.shelf}` : 'Ready to collect';
    case 'OUT_FOR_DELIVERY':
      return 'On its way to you';
    case 'COLLECTED':
      return 'Collected';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    case 'UNCLAIMED_DISPOSED':
      return 'Not collected, closed';
    default:
      return o.status;
  }
}
