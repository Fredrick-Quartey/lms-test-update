// SRS-LDY-D-04 public tracking by ORDER NUMBER ONLY (D8 / OQ5). Minimal view: status, timeline, ready-by and
// shelf; never a name, phone, address or amount. Signed-in customers get full detail in My orders.
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Hash, Search } from 'lucide-react';
import { api, type TrackingView } from '@ldy/api-client';
import { ErrorAlert, Field, Loading, StatusBadge, Ticket } from '@/components/ui';
import { JourneyBar } from '@/components/order';
import { Timeline } from '@/components/inputs';
import { dateTime } from '@/lib/format';

export function Track() {
  const [params, setParams] = useSearchParams();
  const orderNo = params.get('order') ?? '';
  const [value, setValue] = useState(orderNo);
  const q = useQuery({
    queryKey: ['track', orderNo],
    queryFn: () => api.track({ orderNo }),
    enabled: Boolean(orderNo),
    refetchInterval: 30_000, // updates without a manual refresh (D-04)
    retry: false,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim().toUpperCase();
    if (v) setParams({ order: v });
  };
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="page-title">Track an order</h1>
      <p className="muted mt-1">No account needed. You only need the order number on your receipt.</p>
      <form onSubmit={submit} className="panel mt-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
        <div className="flex-1">
          <Field label="Order number" icon={<Hash size={16} />} hint="For example LDY-000012">
            {(p) => <input {...p} className="input text-lg font-semibold uppercase" value={value} onChange={(e) => setValue(e.target.value)} autoCapitalize="characters" />}
          </Field>
        </div>
        <button className="btn-primary min-h-12 sm:mb-[1.6rem]" disabled={!value.trim()}><Search size={18} aria-hidden /> Track</button>
      </form>
      <div className="mt-6 space-y-5">
        {q.isFetching && !q.data && <Loading rows={1} />}
        {q.isError && <ErrorAlert error={q.error} />}
        {q.data?.map((v) => <TrackCard key={v.orderNo} v={v} />)}
        {q.data && (
          <p className="text-center text-sm text-slate">
            Signed in? See full details, receipts and payments in <Link to="/me/orders" className="btn-link">My orders</Link>.
          </p>
        )}
      </div>
    </div>
  );
}

function TrackCard({ v }: { v: TrackingView }) {
  return (
    <article className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4 sm:p-5">
        <Ticket size="lg">{v.orderNo}</Ticket>
        <StatusBadge status={v.status} />
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        {v.status === 'READY_FOR_PICKUP' && v.shelf && (
          <p className="rounded-[12px] bg-success-wash p-3 font-semibold text-success">Ready to collect from shelf {v.shelf}.</p>
        )}
        <JourneyBar status={v.status} deliveryFlag={v.deliveryFlag} />
        {v.expectedReadyBy && <p className="text-sm">Expected ready by <strong>{dateTime(v.expectedReadyBy)}</strong></p>}
        <Timeline entries={v.timeline} />
      </div>
    </article>
  );
}
