/**
 * Print views (SRS §4.2, A-03, E-02, C-03, E-04, E-05): item tags with a scannable Code 39 barcode (58 mm labels),
 * invoices and receipts showing business name, TIN, separate tax lines and the terms of service,
 * packaging manifest, daily cash-up report and corporate statement.
 */
import { useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, http, type Settings } from '@ldy/api-client';
import { Loading, ErrorAlert } from '@/components/ui';
import { InvoiceTable } from '@/components/order';
import { useNames } from '@/config/settings';
import { date, dateTime, money, setOrganisation } from '@/lib/format';

export function Print() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const settings = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: async () => {
      const s = (await http.get<Partial<Settings>>('/public/settings')) as Settings;
      setOrganisation(s.organisation);
      return s;
    },
  });
  if (settings.isPending) return <Loading />;
  if (settings.isError) return <ErrorAlert error={settings.error} />;
  const s = settings.data;
  return (
    <div className="mx-auto max-w-2xl bg-white p-6 text-navy print:p-0">
      <div className="no-print mb-6 flex gap-2">
        <button className="btn-primary" onClick={() => window.print()}>Print</button>
        <button className="btn" onClick={() => window.close()}>Close</button>
      </div>
      {kind === 'tags' && <Tags id={id!} />}
      {kind === 'invoice' && <InvoiceDoc id={id!} s={s} />}
      {kind === 'receipt' && <ReceiptDoc id={id!} s={s} />}
      {kind === 'manifest' && <ManifestDoc id={id!} />}
      {kind === 'cashup' && <CashupDoc id={id!} s={s} />}
      {kind === 'statement' && <StatementDoc id={id!} s={s} />}
    </div>
  );
}

function AutoPrint({ ready }: { ready: boolean }) {
  useEffect(() => {
    if (ready && new URLSearchParams(window.location.search).get('auto') === '1') window.print();
  }, [ready]);
  return null;
}

function Letterhead({ s, title, children }: { s: Settings; title: string; children?: ReactNode }) {
  return (
    <header className="mb-4 border-b-2 border-navy pb-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{s.organisation.name}</p>
          <p className="text-sm">{s.organisation.address}, {s.organisation.phone}</p>
          <p className="text-sm">TIN {s.organisation.tin}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{title}</p>
          {children}
        </div>
      </div>
    </header>
  );
}

function Terms({ s }: { s: Settings }) {
  return <p className="mt-6 border-t border-line pt-3 text-xs">{s.billing.liabilityTerms}</p>;
}

// ---------- Code 39 barcode (scanner-friendly, no library needed) ----------
const C39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw',
  E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww',
  L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
};
export function Barcode({ value, height = 44 }: { value: string; height?: number }) {
  const n = 2;
  const w = 5;
  const text = `*${value.toUpperCase()}*`;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of text) {
    const pat = C39[ch] ?? C39['-'];
    [...pat].forEach((p, i) => {
      const width = p === 'w' ? w : n;
      if (i % 2 === 0) bars.push({ x, w: width });
      x += width;
    });
    x += n; // inter-character gap
  }
  return (
    <svg viewBox={`0 0 ${x} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={`Barcode ${value}`}>
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />)}
    </svg>
  );
}

function Tags({ id }: { id: string }) {
  const names = useNames();
  const q = useQuery({ queryKey: ['print', 'order', id], queryFn: () => api.print.order(id) });
  if (!q.data) return q.isError ? <ErrorAlert error={q.error} /> : <Loading />;
  const o = q.data;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-1">
      <AutoPrint ready />
      {o.items.map((i) => (
        <div key={i.id} className="w-[58mm] break-inside-avoid border border-dashed border-navy/40 p-2 print:border-0" style={{ pageBreakAfter: 'always' }}>
          <p className="font-[family-name:var(--font-ticket)] text-3xl font-semibold leading-none">{i.tag}</p>
          <Barcode value={i.tag!} />
          <p className="mt-1 text-xs leading-tight">
            {o.orderNo}, {names.category(i.categoryId)} {i.weightKg ? `${i.weightKg} kg` : `× ${i.quantity}`}
            <br />
            {names.service(i.serviceTypeId)}{o.speed === 'EXPRESS' ? ', EXPRESS' : ''}, ready {dateTime(o.expectedReadyBy)}
            {i.flags.length > 0 && <><br />Care: {i.flags.map((f) => f.type.toLowerCase().replace(/_/g, ' ')).join(', ')}</>}
          </p>
        </div>
      ))}
    </div>
  );
}

function InvoiceDoc({ id, s }: { id: string; s: Settings }) {
  const q = useQuery({ queryKey: ['print', 'order', id], queryFn: () => api.print.order(id) });
  if (!q.data) return q.isError ? <ErrorAlert error={q.error} /> : <Loading />;
  const o = q.data;
  return (
    <article>
      <Letterhead s={s} title="Invoice">
        <p className="text-sm">{o.invoice?.number}</p>
        <p className="text-sm">{date(o.invoice?.issuedAt)}</p>
      </Letterhead>
      <p className="text-sm">Bill to <strong>{o.customerName}</strong>, {o.customerPhone}. Order {o.orderNo}. Ready by {dateTime(o.expectedReadyBy)}.</p>
      <div className="mt-4"><InvoiceTable invoice={o.invoice} /></div>
      <p className="mt-3 text-right text-sm">Paid {money(o.amountPaid)}. Balance due <strong>{money(o.balance)}</strong>{o.onAccount ? ' (billed to account)' : ''}</p>
      <Terms s={s} />
    </article>
  );
}

function ReceiptDoc({ id, s }: { id: string; s: Settings }) {
  const q = useQuery({ queryKey: ['print', 'payment', id], queryFn: () => api.print.payment(id) });
  if (!q.data) return q.isError ? <ErrorAlert error={q.error} /> : <Loading />;
  const { order: o, payment: p } = q.data;
  const method = { CASH: 'Cash', CARD: 'Card', MOMO: 'Mobile money' }[p.method];
  return (
    <article className="max-w-[80mm] text-sm">
      <AutoPrint ready />
      <Letterhead s={s} title={p.kind === 'REFUND' ? 'Refund' : 'Receipt'}>
        <p>{p.receiptNo}</p>
      </Letterhead>
      <p>{dateTime(p.at)}</p>
      <p>Order {o.orderNo}, {o.customerName}</p>
      <div className="mt-3"><InvoiceTable invoice={o.invoice} /></div>
      <table className="table mt-3">
        <tbody>
          <tr><td>{p.kind === 'REFUND' ? 'Refunded' : 'Received'} ({method}{p.reference ? `, ref ${p.reference}` : ''})</td><td className="text-right">{money(p.amount)}</td></tr>
          {p.tendered !== undefined && p.tendered > p.amount && <tr><td>Cash tendered / change</td><td className="text-right">{money(p.tendered)} / {money(p.tendered - p.amount)}</td></tr>}
          <tr className="font-semibold"><td>Balance now due</td><td className="text-right">{money(o.balance)}</td></tr>
        </tbody>
      </table>
      <p className="mt-2">Served by {p.byName}</p>
      <Terms s={s} />
    </article>
  );
}

function ManifestDoc({ id }: { id: string }) {
  const names = useNames();
  const q = useQuery({ queryKey: ['print', 'order', id], queryFn: () => api.print.order(id) });
  if (!q.data) return q.isError ? <ErrorAlert error={q.error} /> : <Loading />;
  const o = q.data;
  return (
    <article>
      <h1 className="text-xl font-semibold">Packaging manifest {o.orderNo}</h1>
      <p className="text-sm">{o.customerName}. Shelf {o.shelf ?? '______'}. {o.deliveryFlag ? `Delivery to ${o.deliveryAddress}` : 'Counter collection'}</p>
      <table className="table mt-4">
        <thead><tr><th>Checked</th><th>Tag</th><th>Item</th><th>Service</th></tr></thead>
        <tbody>
          {o.items.filter((i) => i.status !== 'CANCELLED').map((i) => (
            <tr key={i.id}><td>{i.checkedOff ? 'Yes' : '[   ]'}</td><td>{i.tag}</td><td>{names.category(i.categoryId)} {i.weightKg ? `${i.weightKg} kg` : `× ${i.quantity}`}</td><td>{names.service(i.serviceTypeId)}</td></tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function CashupDoc({ id, s }: { id: string; s: Settings }) {
  const q = useQuery({ queryKey: ['print', 'cashup', id], queryFn: () => api.cashups.report(id) });
  if (!q.data) return q.isError ? <ErrorAlert error={q.error} /> : <Loading />;
  const { cashup: c, payments, refunds, adjustments } = q.data;
  return (
    <article className="text-sm">
      <Letterhead s={s} title="Daily cash-up report"><p>{c.officerName}, {c.date}</p></Letterhead>
      <p>Status: <strong>{c.status.toLowerCase()}</strong>{c.reviewedByName ? `, reviewed by ${c.reviewedByName}: ${c.explanation}` : ''}</p>
      <table className="table mt-3">
        <thead><tr><th>Method</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th className="text-right">Variance</th></tr></thead>
        <tbody>
          {(['CASH', 'MOMO', 'CARD'] as const).map((k) => <tr key={k}><td>{k}</td><td className="text-right">{money(c.expected[k])}</td><td className="text-right">{money(c.counted?.[k])}</td><td className="text-right">{money(c.variance?.[k])}</td></tr>)}
        </tbody>
      </table>
      <h2 className="mt-5 font-semibold">Payments ({payments.length})</h2>
      <table className="table"><tbody>{payments.map((p) => <tr key={p.id}><td>{dateTime(p.at)}</td><td>{p.receiptNo}</td><td>{p.method}{p.reference ? ` ${p.reference}` : ''}</td><td className="text-right">{money(p.amount)}</td></tr>)}</tbody></table>
      <h2 className="mt-5 font-semibold">Refunds paid ({refunds.length})</h2>
      <table className="table"><tbody>{refunds.map((p) => <tr key={p.id}><td>{dateTime(p.at)}</td><td>{p.receiptNo}</td><td>{p.byName}</td><td className="text-right">{money(p.amount)}</td></tr>)}</tbody></table>
      <h2 className="mt-5 font-semibold">Price adjustments approved that day ({adjustments.length})</h2>
      <table className="table"><tbody>{adjustments.map((a) => <tr key={a.id}><td>{a.orderNo}</td><td>{a.reason}</td><td>{a.decidedByName}</td><td className="text-right">{money(a.amount)}</td></tr>)}</tbody></table>
    </article>
  );
}

function StatementDoc({ id, s }: { id: string; s: Settings }) {
  const q = useQuery({ queryKey: ['print', 'statement', id], queryFn: () => api.print.statement(id) });
  if (!q.data) return q.isError ? <ErrorAlert error={q.error} /> : <Loading />;
  const st = q.data;
  return (
    <article className="text-sm">
      <Letterhead s={s} title="Statement"><p>{date(st.periodFrom)} to {date(st.periodTo)}</p></Letterhead>
      <p>To <strong>{st.customerName}</strong>. Due {date(st.dueDate)}.</p>
      <table className="table mt-3">
        <thead><tr><th>Order</th><th>Date</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {st.orders.map((o) => <tr key={o.orderNo}><td>{o.orderNo}</td><td>{date(o.date)}</td><td className="text-right">{money(o.total)}</td></tr>)}
          <tr className="font-semibold"><td colSpan={2}>Total</td><td className="text-right">{money(st.total)}</td></tr>
          <tr><td colSpan={2}>Paid</td><td className="text-right">{money(st.paid)}</td></tr>
          <tr className="font-semibold"><td colSpan={2}>Balance due</td><td className="text-right">{money(st.total - st.paid)}</td></tr>
        </tbody>
      </table>
      <Terms s={s} />
    </article>
  );
}
