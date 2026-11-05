// SRS-LDY-D-01: scan or find the order, confirm identity, mark Collected (blocked while payment is outstanding).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Order } from '@ldy/api-client';
import { Alert, ErrorAlert, Field, KeyValue, PageHeader, PaymentBadge, Section, StatusBadge, Ticket, useToast } from '@/components/ui';
import { ScanInput } from '@/components/inputs';
import { ItemsTable } from '@/components/order';
import { PaymentPanel } from '@/components/PaymentPanel';
import { dateTime, money, relativeHours } from '@/lib/format';

export function Collection() {
  const [found, setFound] = useState<Order | null>(null);
  const [lookupErr, setLookupErr] = useState<unknown>(null);
  const ready = useQuery({ queryKey: ['orders', 'ready'], queryFn: () => api.orders.list({ status: 'READY_FOR_PICKUP', pageSize: 50, sort: 'readyNotifiedAt:asc' }), refetchInterval: 20_000 });
  const lookup = async (code: string) => {
    setLookupErr(null);
    try {
      if (/^T\d+$/i.test(code)) setFound((await api.tags.scan(code)).order);
      else {
        const r = await api.orders.list({ search: code, pageSize: 5 });
        if (!r.items.length) throw new Error('none');
        setFound(r.items[0]);
      }
    } catch (e) {
      setFound(null);
      setLookupErr(e instanceof Error && e.message === 'none' ? { code: 'NOT_FOUND' } : e);
    }
  };
  return (
    <div>
      <PageHeader back={{ to: '/staff/overview', label: 'Overview' }} title="Hand over" intro="Scan any tag on the bag (or use the camera), or type the order number or phone number." />
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Section>
            <ScanInput label="Tag, order number or phone" placeholder="T00012, LDY-000012 or 0244…" onScan={lookup} buttonLabel="Find order" />
            {Boolean(lookupErr) && <div className="mt-3"><Alert tone="error">No open order matches. Check the tag or order number.</Alert></div>}
          </Section>
          {found && <CollectPanel key={found.id} order={found} onDone={() => setFound(null)} />}
        </div>
        <Section title={`Waiting for collection (${ready.data?.total ?? 0})`}>
          <ul className="divide-y divide-line">
            {ready.data?.items.map((o) => (
              <li key={o.id}>
                <button className="flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-[10px] px-2 py-2 text-left text-sm hover:bg-mist" onClick={() => { setFound(o); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <span><Ticket>{o.orderNo}</Ticket> {o.customerName}</span>
                  <span className="text-slate">Shelf {o.shelf}, {relativeHours(o.readyNotifiedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function CollectPanel({ order, onDone }: { order: Order; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['order', order.id], queryFn: () => api.orders.get(order.id), initialData: order });
  const o = q.data;
  const [idChecked, setIdChecked] = useState(false);
  const [idNote, setIdNote] = useState('Phone number confirmed');
  const collect = useMutation({
    mutationFn: () => api.orders.collect(o.id, idNote),
    onSuccess: (r) => {
      toast(`${r.orderNo} handed over to the customer at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Tags are retired.`);
      void qc.invalidateQueries({ queryKey: ['orders'] });
      onDone();
    },
  });
  const isReady = o.status === 'READY_FOR_PICKUP' || (o.status === 'PACKAGED' && !o.deliveryFlag);
  return (
    <Section title={`Order ${o.orderNo}`} aside={<span className="flex gap-2"><StatusBadge status={o.status} /><PaymentBadge state={o.paymentState} balance={o.balance} /></span>}>
      <KeyValue rows={[
        ['Customer', `${o.customerName}, ${o.customerPhone}`],
        ['Shelf', o.shelf ? <strong className="text-lg">{o.shelf}</strong> : '—'],
        ['Ready since', dateTime(o.readyNotifiedAt)],
        ['Total / paid', `${money(o.invoice?.total)} / ${money(o.amountPaid)}`],
      ]} />
      <div className="mt-4"><ItemsTable order={o} /></div>
      {!isReady && <div className="mt-4"><Alert tone="warning">This order is {o.status.replace(/_/g, ' ').toLowerCase()} and is not ready for collection. <Link className="btn-link" to={`/staff/orders/${o.id}`}>Open the order</Link></Alert></div>}
      {isReady && o.balance > 0 && !o.onAccount && (
        <div className="mt-5 rounded-[12px] border border-line p-4">
          <h3 className="mb-2 font-semibold">Take payment first</h3>
          <PaymentPanel order={o} onPaid={() => void q.refetch()} />
        </div>
      )}
      {isReady && (
        <form className="mt-5 space-y-3" onSubmit={(e) => (e.preventDefault(), collect.mutate())}>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} />
            <span>I have confirmed the person collecting is the customer or someone they sent.</span>
          </label>
          <Field label="How identity was confirmed" required>
            {(p) => <input {...p} className="input" value={idNote} onChange={(e) => setIdNote(e.target.value)} />}
          </Field>
          <ErrorAlert error={collect.error} />
          <button className="btn-primary min-h-14 w-full text-lg" disabled={!idChecked || !idNote.trim() || collect.isPending}>Mark collected</button>
          {o.balance > 0 && !o.onAccount && <p className="hint">Take the payment above first. The balance due is {money(o.balance)}.</p>}
        </form>
      )}
    </Section>
  );
}
