// SRS-LDY-D-02: schedule packaged delivery orders onto routes (capacity from settings), assign riders, depart.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type Order, type Route } from '@ldy/api-client';
import { ErrorAlert, Field, PageHeader, Pill, PaymentBadge, Section, Ticket, useToast } from '@/components/ui';
import { day as fmtDay, todayISO } from '@/lib/format';

export function Dispatch() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('status');
  const [day, setDay] = useState(todayISO());
  const queue = useQuery({ queryKey: ['routes', 'queue'], queryFn: api.routes.queue, refetchInterval: 20_000 });
  const routes = useQuery({ queryKey: ['routes', day], queryFn: () => api.routes.list(day), refetchInterval: 20_000 });
  const riders = useQuery({ queryKey: ['riders'], queryFn: api.riders });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['routes'] });
  const [win, setWin] = useState('14:00–17:00');
  const [rider, setRider] = useState('');
  const create = useMutation({ mutationFn: () => api.routes.create({ date: day, window: win, riderId: rider || undefined }), onSuccess: (r) => { toast(`Route ${r.routeNo} created.`); refresh(); } });
  const [target, setTarget] = useState('');
  const add = useMutation({ mutationFn: ({ rid, oid }: { rid: string; oid: string }) => api.routes.addOrder(rid, oid), onSuccess: refresh });
  const planned = routes.data?.filter((r) => r.status === 'PLANNED') ?? [];
  const chosen = target || planned[0]?.id || '';
  return (
    <div>
      <PageHeader title="Delivery dispatch" intro="Group packed delivery orders into routes, give each route a rider, then mark it departed." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Section title={`Ready for delivery (${queue.data?.length ?? 0})`}>
          {planned.length > 0 && (
            <Field label="Add to route">
              {(p) => <select {...p} className="input mb-3" value={chosen} onChange={(e) => setTarget(e.target.value)}>{planned.map((r) => <option key={r.id} value={r.id}>{r.routeNo}, {r.window}, {r.orderIds.length}/{r.capacity}</option>)}</select>}
            </Field>
          )}
          <ErrorAlert error={add.error} />
          <ul className="mt-2 divide-y divide-line">
            {queue.data?.map((o) => <QueueRow key={o.id} o={o} canAdd={Boolean(chosen)} onAdd={() => add.mutate({ rid: chosen, oid: o.id })} />)}
            {!queue.data?.length && <li className="muted py-3 text-sm">Nothing is waiting for delivery.</li>}
          </ul>
        </Section>
        <div className="space-y-5">
          <Section title="Routes">
            <form className="grid gap-3 sm:grid-cols-4 sm:items-end" onSubmit={(e) => (e.preventDefault(), create.mutate())}>
              <Field label="Date">{(p) => <input {...p} type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} />}</Field>
              <Field label="Window">{(p) => <input {...p} className="input" value={win} onChange={(e) => setWin(e.target.value)} />}</Field>
              <Field label="Rider">{(p) => <select {...p} className="input" value={rider} onChange={(e) => setRider(e.target.value)}><option value="">Assign later</option>{riders.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}</Field>
              <button className="btn-primary" disabled={create.isPending || !win.trim()}>New route</button>
            </form>
            <div className="mt-2"><ErrorAlert error={create.error} /></div>
          </Section>
          {routes.data?.map((r) => <RouteCard key={r.id} r={r} riders={riders.data ?? []} onChange={refresh} statusLabel={t(`route.${r.status}`)} />)}
          {routes.data && !routes.data.length && <p className="muted text-sm">No routes on {fmtDay(day)}.</p>}
        </div>
      </div>
    </div>
  );
}

function QueueRow({ o, onAdd, canAdd }: { o: Order; onAdd: () => void; canAdd: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <div>
        <Link to={`/staff/orders/${o.id}`}><Ticket>{o.orderNo}</Ticket></Link> {o.customerName}
        <p className="text-slate">{o.deliveryAddress}</p>
        <div className="mt-1 flex gap-2"><PaymentBadge state={o.paymentState} balance={o.balance} />{o.failedDeliveries.length > 0 && <Pill tone="warn">{o.failedDeliveries.length} failed attempt(s)</Pill>}</div>
      </div>
      <button className="btn" disabled={!canAdd} onClick={onAdd} title={canAdd ? undefined : 'Create a route first'}>Add to route</button>
    </li>
  );
}

function RouteCard({ r, riders, onChange, statusLabel }: { r: Route; riders: { id: string; name: string }[]; onChange: () => void; statusLabel: string }) {
  const toast = useToast();
  const orders = useQuery({ queryKey: ['routes', r.id, 'orders', r.orderIds.join()], queryFn: () => Promise.all(r.orderIds.map((id) => api.orders.get(id))) });
  const assign = useMutation({ mutationFn: (riderId: string) => api.routes.assignRider(r.id, riderId), onSuccess: onChange });
  const depart = useMutation({ mutationFn: () => api.routes.depart(r.id), onSuccess: () => { toast(`Route ${r.routeNo} departed. Customers have been told.`); onChange(); } });
  const remove = useMutation({ mutationFn: (oid: string) => api.routes.removeOrder(r.id, oid), onSuccess: onChange });
  const planned = r.status === 'PLANNED';
  return (
    <Section title={`${r.routeNo}, ${r.window}`} aside={<span className="flex items-center gap-2 text-sm"><span className="tabular-nums">{r.orderIds.length} of {r.capacity}</span><Pill tone={planned ? 'info' : r.status === 'DEPARTED' ? 'warn' : 'good'}>{statusLabel}</Pill></span>}>
      {planned ? (
        <Field label="Rider">{(p) => <select {...p} className="input" value={r.riderId ?? ''} onChange={(e) => e.target.value && assign.mutate(e.target.value)}><option value="">Choose a rider</option>{riders.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
      ) : (
        <p className="text-sm">Rider: <strong>{r.riderName}</strong></p>
      )}
      <ul className="mt-3 divide-y divide-line text-sm">
        {orders.data?.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 py-2">
            <span><Ticket>{o.orderNo}</Ticket> {o.customerName}, {o.deliveryAddress}</span>
            {planned ? <button className="btn-link text-danger" onClick={() => remove.mutate(o.id)}>Remove</button> : <span className="text-slate">{o.status.replace(/_/g, ' ').toLowerCase()}</span>}
          </li>
        ))}
        {!r.orderIds.length && <li className="muted py-2">No orders yet.</li>}
      </ul>
      {r.bookingIds.length > 0 && <p className="mt-2 text-sm">{r.bookingIds.length} pickup(s) on this route.</p>}
      <ErrorAlert error={assign.error ?? depart.error ?? remove.error} />
      {planned && <button className="btn-primary mt-3" onClick={() => depart.mutate()} disabled={depart.isPending}>Mark departed</button>}
    </Section>
  );
}
