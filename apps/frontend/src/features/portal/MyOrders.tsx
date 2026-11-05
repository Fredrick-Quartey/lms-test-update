// D-04 status tracking, E-02 invoices/receipts/payment history, D-03 proof of delivery, F-01 own export.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@ldy/api-client';
import { Alert, ErrorAlert, PageHeader, PaymentBadge, QueryState, Section, StatusBadge, Ticket } from '@/components/ui';
import { InvoiceTable, ItemsTable, JourneyBar, PaymentsTable, plainStatus } from '@/components/order';
import { useSettings } from '@/config/settings';
import { Timeline } from '@/components/inputs';
import { date, dateTime, day, downloadText, money } from '@/lib/format';
import { useTranslation } from 'react-i18next';

export function MyOrders() {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const q = useQuery({ queryKey: ['portal', 'orders'], queryFn: api.portal.orders, refetchInterval: 20_000 });
  const exp = useMutation({ mutationFn: api.portal.exportCsv, onSuccess: (r) => downloadText(r.filename, r.csv) });
  const bookings = useQuery({ queryKey: ['portal', 'bookings'], queryFn: api.bookings.mine });
  const settings = useSettings();
  const bookingsOn = settings.data?.features?.bookings !== false;
  const { t } = useTranslation('status');
  const closed = ['COLLECTED', 'DELIVERED', 'CANCELLED', 'UNCLAIMED_DISPOSED'];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Where's my laundry?"
        actions={bookingsOn && <Link to="/me/book" className="btn-primary hidden sm:inline-flex">Book a pickup</Link>}
      />
      <ErrorAlert error={exp.error} />
      <QueryState q={q} isEmpty={(d) => !d.length} empty="You have no orders yet. Book a pickup, or drop your laundry at the branch.">
        {(orders) => {
          const ready = orders.filter((o) => o.status === 'READY_FOR_PICKUP' || o.status === 'OUT_FOR_DELIVERY');
          const rows = orders.filter((o) => (filter === 'all' || !closed.includes(o.status)) && !ready.includes(o));
          return (
            <div className="space-y-5">
              {ready.map((o) => (
                <Link key={o.id} to={`/me/orders/${o.id}`} className="block rounded-[20px] bg-gradient-to-br from-blue to-blue-dark p-5 text-white shadow-[0_14px_30px_-16px_rgb(15_47_143/.8)]">
                  <span className="flex items-center justify-between gap-2"><Ticket>{o.orderNo}</Ticket><span className="text-sm text-white/80">{o.items.length} line{o.items.length === 1 ? '' : 's'}</span></span>
                  <span className="mt-3 block text-2xl font-bold">{plainStatus(o)}</span>
                  <span className="mt-1 block text-white/85">{o.balance > 0 && !o.onAccount ? `Please bring ${money(o.balance)} to settle the balance.` : 'Fully paid.'}</span>
                </Link>
              ))}
              <div className="flex gap-2" role="group" aria-label="Filter orders">
                {(['open', 'all'] as const).map((f) => (
                  <button key={f} className={`btn min-h-10 rounded-full text-sm ${filter === f ? 'border-blue bg-sky text-blue-dark' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {f === 'open' ? 'In progress' : 'All orders'}
                  </button>
                ))}
              </div>
              {!rows.length && !ready.length && <p className="muted">Nothing in progress right now.</p>}
              <ul className="space-y-3">
                {rows.map((o) => (
                  <li key={o.id}>
                    <Link to={`/me/orders/${o.id}`} className="panel block p-4 hover:border-blue/50">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <Ticket>{o.orderNo}</Ticket>
                        <PaymentBadge state={o.paymentState} balance={o.balance} />
                      </span>
                      <span className="mt-2 block text-lg font-bold">{plainStatus(o)}</span>
                      <span className="mt-0.5 block text-sm text-slate">
                        {closed.includes(o.status) ? `Dropped off ${date(o.createdAt)}` : o.expectedReadyBy ? `Expected ready by ${dateTime(o.expectedReadyBy)}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button className="btn w-full sm:w-auto" onClick={() => exp.mutate()} disabled={exp.isPending}>Download my order history</button>
            </div>
          );
        }}
      </QueryState>
      {bookingsOn && bookings.data && bookings.data.length > 0 && (
        <Section title="My bookings" className="mt-8">
          <ul className="divide-y divide-line">
            {bookings.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <Ticket>{b.bookingNo}</Ticket> {b.kind === 'PICKUP' ? 'Pickup' : 'Drop-off'} on {day(b.date)} at {b.slot}
                </span>
                <span className="font-semibold">{t(`booking.${b.status}`)}</span>
              </li>
            ))}
          </ul>
          <Link to="/me/book" className="btn-link mt-2 inline-block text-sm">Manage bookings</Link>
        </Section>
      )}
    </div>
  );
}

export function MyOrder() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['portal', 'order', id], queryFn: () => api.portal.order(id!), refetchInterval: 15_000 });
  return (
    <QueryState q={q}>
      {(o) => (
        <div className="mx-auto max-w-2xl space-y-4">
          <PageHeader
            back={{ to: '/me/orders', label: 'My orders' }}
            title={<span className="flex flex-wrap items-center gap-2"><Ticket size="lg">{o.orderNo}</Ticket></span>}
            actions={<><StatusBadge status={o.status} /><PaymentBadge state={o.paymentState} balance={o.balance} /></>}
          />
          <Section>
            <p className="text-xl font-bold">{plainStatus(o)}</p>
            {o.status === 'READY_FOR_PICKUP' && <p className="mt-1 text-slate">{o.balance > 0 && !o.onAccount ? `Please bring ${money(o.balance)} to settle the balance.` : 'It is fully paid.'}</p>}
            {o.expectedReadyBy && !['COLLECTED', 'DELIVERED', 'CANCELLED'].includes(o.status) && <p className="mt-1 text-sm">Expected ready by <strong>{dateTime(o.expectedReadyBy)}</strong></p>}
            <div className="mt-4"><JourneyBar status={o.status} deliveryFlag={o.deliveryFlag} /></div>
            <div className="mt-5"><Timeline entries={o.timeline} /></div>
          </Section>
          {o.damage.length > 0 && (
            <Collapse title="Messages about your items" open>
              <div className="space-y-2">{o.damage.map((d) => <Alert key={d.id} tone="warning">{d.customerMessage}</Alert>)}</div>
            </Collapse>
          )}
          <Collapse title={`Items (${o.items.length})`}>
            <ItemsTable order={o} />
          </Collapse>
          <Collapse title={`Invoice ${o.invoice?.number ?? ''}`}>
            <InvoiceTable invoice={o.invoice} />
            {o.invoice && <a className="btn mt-3" href={`/print/invoice/${o.id}`} target="_blank">Print invoice</a>}
          </Collapse>
          <Collapse title="Payments and receipts">
            <PaymentsTable payments={o.payments} />
            <p className="mt-2 text-sm">Paid {money(o.amountPaid)}, balance {money(o.balance)}</p>
          </Collapse>
          {o.pod && (
            <Collapse title="Proof of delivery" open>
              <p className="text-sm">Received by <strong>{o.pod.recipientName}</strong> on {dateTime(o.pod.at)}</p>
              {o.pod.signature && <img src={o.pod.signature} alt={`Signature of ${o.pod.recipientName}`} className="mt-2 h-24 rounded-[8px] border border-line bg-white" />}
              {o.pod.photo && <img src={o.pod.photo} alt="Delivery photo" className="mt-2 max-h-48 rounded-[8px] border border-line" />}
            </Collapse>
          )}
        </div>
      )}
    </QueryState>
  );
}

function Collapse({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="panel group" open={open}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-semibold sm:px-5">
        {title}
        <ChevronDown size={20} aria-hidden className="text-slate transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line p-4 sm:p-5">{children}</div>
    </details>
  );
}
