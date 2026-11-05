/**
 * Front Desk home: "Overview" (REDESIGN §10, D15/D16/D25). Three task tiles, then today's numbers.
 * F-01 Front Desk scope: daily intake and payment summaries. Money is hidden until the eye is pressed;
 * the balance due on an order is never hidden.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, PlusCircle, ShoppingBag } from 'lucide-react';
import { api } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { EyeToggle, MoneyVisibility, PaymentBadge, QueryState, Section, StatCard, TaskTile, Ticket } from '@/components/ui';
import { useSettings } from '@/config/settings';
import { money, todayISO } from '@/lib/format';

export function Overview() {
  const { user } = useAuth();
  const settings = useSettings();
  const today = todayISO();
  const dash = useQuery({ queryKey: ['dashboard', today, today], queryFn: () => api.reports.dashboard(today, today), refetchInterval: 30_000 });
  const ready = useQuery({ queryKey: ['orders', 'ready'], queryFn: () => api.orders.list({ status: 'READY_FOR_PICKUP', pageSize: 100 }), refetchInterval: 20_000 });
  const queue = useQuery({ queryKey: ['routes', 'queue'], queryFn: api.routes.queue, refetchInterval: 30_000 });
  const bookingsOn = settings.data?.features?.bookings !== false;
  const bookings = useQuery({ queryKey: ['bookings', today], queryFn: () => api.bookings.schedule(today), enabled: bookingsOn });
  const unpaidReady = (ready.data?.items ?? []).filter((o) => o.balance > 0 && !o.onAccount);
  const failed = (queue.data ?? []).filter((o) => o.failedDeliveries.length > 0);
  const arriving = (bookings.data ?? []).filter((b) => b.status === 'CONFIRMED' || b.status === 'COLLECTED');
  const needs = unpaidReady.length + failed.length + arriving.length;
  return (
    <MoneyVisibility>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="muted">Good to see you, {user?.name.split(' ')[0]}. Here's the counter today.</p>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <TaskTile to="/staff/counter" title="New order" note="Find or add the customer, list items, take payment" icon={<PlusCircle size={24} />} />
          <TaskTile to="/staff/collection" title="Hand over" note="Scan a bag to hand it to the customer" icon={<ShoppingBag size={24} />} count={ready.data?.total} tone="aqua" />
          <TaskTile to="#needs-you" title="Needs you" note="Unpaid, failed deliveries, bookings today" icon={<AlertTriangle size={24} />} count={needs} tone="warn" />
        </div>

        <Section title="Today" aside={<EyeToggle />}>
          <QueryState q={dash}>
            {(d) => (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Revenue received" value={money(d.revenue)} note={d.refunds ? `${money(d.refunds)} refunded` : undefined} hideable />
                <StatCard label="Cash taken" value={money(d.paymentsByMethod.CASH)} hideable />
                <StatCard label="Mobile money" value={money(d.paymentsByMethod.MOMO)} hideable />
                <StatCard label="Card" value={money(d.paymentsByMethod.CARD)} hideable />
                <StatCard label="Orders received" value={d.ordersReceived} />
                <StatCard label="Orders handed over" value={d.ordersCompleted} />
                <StatCard label="Ready to collect" value={ready.data?.total ?? '—'} />
                <StatCard label="Waiting for delivery" value={queue.data?.length ?? '—'} />
              </div>
            )}
          </QueryState>
        </Section>

        <section id="needs-you" className="scroll-mt-24 space-y-3" aria-labelledby="needs-h">
          <h2 id="needs-h" className="section-title">Needs you {needs > 0 && <span className="ml-1 rounded-full bg-warning-wash px-2 text-sm text-warning">{needs}</span>}</h2>
          {needs === 0 && <p className="panel p-4 text-slate">Nothing waiting. Nice.</p>}
          {unpaidReady.length > 0 && (
            <Section title="Ready, but not fully paid">
              <ul className="divide-y divide-line">
                {unpaidReady.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <Link to={`/staff/orders/${o.id}`} className="flex items-center gap-2"><Ticket>{o.orderNo}</Ticket> {o.customerName}</Link>
                    <PaymentBadge state={o.paymentState} balance={o.balance} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {failed.length > 0 && (
            <Section title="Deliveries to reschedule" aside={<Link to="/staff/dispatch" className="btn-link text-sm">Open dispatch</Link>}>
              <ul className="divide-y divide-line">
                {failed.map((o) => (
                  <li key={o.id} className="py-2.5 text-sm">
                    <Ticket>{o.orderNo}</Ticket> {o.customerName}: {o.failedDeliveries.at(-1)?.reason}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {arriving.length > 0 && (
            <Section title="Bookings today" aside={<Link to="/staff/bookings" className="btn-link text-sm">Open bookings</Link>}>
              <ul className="divide-y divide-line">
                {arriving.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="flex items-center gap-2"><CalendarClock size={16} aria-hidden className="text-aqua" /> {b.slot}, {b.customerName}</span>
                    <span className="text-slate">{b.kind === 'PICKUP' ? (b.status === 'COLLECTED' ? 'Picked up, convert on arrival' : 'Pickup') : 'Drop-off'}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </section>
      </div>
    </MoneyVisibility>
  );
}
