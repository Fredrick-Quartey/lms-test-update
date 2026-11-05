// SRS-LDY-A-06 (COULD): daily booking schedule; assign riders to pickups; convert a booking to a draft order on arrival.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type Booking } from '@ldy/api-client';
import { ResponsiveTable } from '@/components/ResponsiveTable';
import { ErrorAlert, PageHeader, Pill, QueryState, Ticket } from '@/components/ui';
import { useNames } from '@/config/settings';
import { day as fmtDay, todayISO } from '@/lib/format';

export function Bookings() {
  const { t } = useTranslation('status');
  const names = useNames();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [day, setDay] = useState(todayISO(1));
  const q = useQuery({ queryKey: ['bookings', day], queryFn: () => api.bookings.schedule(day), refetchInterval: 30_000 });
  const riders = useQuery({ queryKey: ['riders'], queryFn: api.riders });
  const assign = useMutation({ mutationFn: ({ id, rider }: { id: string; rider: string }) => api.bookings.assignRider(id, rider), onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }) });
  const convert = useMutation({ mutationFn: (id: string) => api.bookings.convert(id), onSuccess: (o) => nav(`/staff/counter/${o.id}`) });
  const cancel = useMutation({ mutationFn: (id: string) => api.bookings.cancel(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }) });
  const RiderPick = ({ b }: { b: Booking }) =>
    b.kind === 'PICKUP' && b.status === 'CONFIRMED' ? (
      <select aria-label={`Rider for ${b.bookingNo}`} className="input min-h-10 py-1" value={b.riderId ?? ''} onChange={(e) => e.target.value && assign.mutate({ id: b.id, rider: e.target.value })}>
        <option value="">No rider yet</option>
        {riders.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    ) : (
      <span>{b.riderName ?? '—'}</span>
    );
  const Actions = ({ b }: { b: Booking }) => (
    <>
      {(b.status === 'COLLECTED' || (b.status === 'CONFIRMED' && b.kind === 'DROPOFF')) && <button className="btn min-h-10 text-sm" onClick={() => convert.mutate(b.id)}>Convert to order</button>}
      {b.status === 'CONFIRMED' && <button className="btn-link px-2 text-sm text-danger" onClick={() => cancel.mutate(b.id)}>Cancel</button>}
    </>
  );
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Bookings"
        intro="Customers book online. Walk-ins go straight to New order. Convert a booking when the laundry arrives."
        actions={
          <label className="text-sm">
            <span className="label">Day</span>
            <input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
        }
      />
      <ErrorAlert error={assign.error ?? convert.error ?? cancel.error} />
      <QueryState q={q} isEmpty={(d) => !d.length} empty={`No bookings on ${fmtDay(day)}.`}>
        {(rows) => (
          <ResponsiveTable
            caption="Bookings"
            rows={rows}
            rowKey={(b) => b.id}
            columns={[
              { key: 't', header: 'Time', className: 'font-semibold tabular', cell: (b) => b.slot },
              { key: 'n', header: 'Booking', cell: (b) => <Ticket>{b.bookingNo}</Ticket> },
              { key: 'c', header: 'Customer', cell: (b) => <>{b.customerName}<span className="block text-xs text-slate">{b.customerPhone}</span></> },
              { key: 'k', header: 'Type', cell: (b) => (b.kind === 'PICKUP' ? <>Pickup<span className="block text-xs text-slate">{b.address}</span></> : 'Drop-off') },
              { key: 's', header: 'Service', cell: (b) => names.service(b.serviceTypeId) },
              { key: 'st', header: 'Status', cell: (b) => <Pill tone={b.status === 'COMPLETED' ? 'good' : b.status === 'CANCELLED' ? 'neutral' : 'info'}>{t(`booking.${b.status}`)}</Pill> },
              { key: 'r', header: 'Rider', cell: (b) => <RiderPick b={b} /> },
              { key: 'a', header: <span className="sr-only">Actions</span>, className: 'whitespace-nowrap', cell: (b) => <Actions b={b} /> },
            ]}
            mobileCard={(b) => (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold tabular">{b.slot}</span>
                  <Pill tone={b.status === 'COMPLETED' ? 'good' : b.status === 'CANCELLED' ? 'neutral' : 'info'}>{t(`booking.${b.status}`)}</Pill>
                </div>
                <p><Ticket>{b.bookingNo}</Ticket> <strong>{b.customerName}</strong>, {b.kind === 'PICKUP' ? 'pickup' : 'drop-off'}, {names.service(b.serviceTypeId)}</p>
                {b.address && <p className="text-slate">{b.address}</p>}
                <RiderPick b={b} />
                <div className="flex flex-wrap gap-2"><Actions b={b} /></div>
              </div>
            )}
          />
        )}
      </QueryState>
    </div>
  );
}
