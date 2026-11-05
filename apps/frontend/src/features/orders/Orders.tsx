// §3.6 / §4.1: search, filter, sort, pagination; status and a link to history on every row.
// Phones: filters in a sheet, rows as cards (REDESIGN §3.4, §10).
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { api, type Order, type OrderStatus } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Modal, PageHeader, PaymentBadge, QueryState, StatusBadge, Ticket } from '@/components/ui';
import { Pager, SortHeader } from '@/components/inputs';
import { ResponsiveTable } from '@/components/ResponsiveTable';
import { date, maskPhone, money } from '@/lib/format';

const STATUSES: OrderStatus[] = ['DRAFT', 'RECEIVED', 'IN_SORTING', 'IN_PROCESSING', 'QC_FAILED', 'QC_PASSED', 'PACKAGED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'COLLECTED', 'DELIVERED', 'CANCELLED', 'UNCLAIMED_DISPOSED'];
type F = { search: string; status: string; payment: string; delivery: string; from: string; to: string; sort: string; page: number };

export function Orders() {
  const { can } = useAuth();
  const [params] = useSearchParams();
  const initial = params.get('search') ?? '';
  const [f, setF] = useState<F>({ search: initial, status: initial ? 'ALL' : 'OPEN', payment: 'ALL', delivery: 'ALL', from: '', to: '', sort: 'createdAt:desc', page: 1 });
  const [search, setSearch] = useState(initial);
  const [sheet, setSheet] = useState(false);
  const q = useQuery({ queryKey: ['orders', f], queryFn: () => api.orders.list({ ...f, pageSize: 20 }), placeholderData: keepPreviousData, refetchInterval: 20_000 });
  const upd = (p: Partial<F>) => setF({ ...f, page: 1, ...p });
  const active = [f.status !== 'OPEN', f.payment !== 'ALL', f.delivery !== 'ALL', Boolean(f.from), Boolean(f.to)].filter(Boolean).length;
  const linkFor = (o: Order) => (o.status === 'DRAFT' ? `/staff/counter/${o.id}` : `/staff/orders/${o.id}`);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Orders" actions={can('order.create') && <Link to="/staff/counter" className="btn-primary">New order</Link>} />
      <form className="mb-4 flex gap-2" onSubmit={(e) => (e.preventDefault(), upd({ search }))} role="search">
        <label className="sr-only" htmlFor="o-search">Search orders</label>
        <input id="o-search" className="input" placeholder="Order no., tag, name or phone" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => upd({ search })} />
        <button type="button" className="btn shrink-0" onClick={() => setSheet(true)}>
          <SlidersHorizontal size={18} aria-hidden /> <span className="hidden sm:inline">Filters</span>{active > 0 && <span className="rounded-full bg-blue px-1.5 text-xs text-white">{active}</span>}
        </button>
      </form>
      <QueryState q={q} isEmpty={(d) => !d.items.length} empty="No orders match these filters.">
        {(d) => (
          <>
            <ResponsiveTable
              caption="Orders"
              rows={d.items}
              rowKey={(o) => o.id}
              columns={[
                { key: 'no', header: 'Order', th: <SortHeader key="no" label="Order" field="orderNo" sort={f.sort} onSort={(s) => setF({ ...f, sort: s })} />, cell: (o) => <Link to={linkFor(o)}><Ticket>{o.orderNo}</Ticket></Link> },
                { key: 'cust', header: 'Customer', cell: (o) => <>{o.customerName}<span className="block text-xs text-slate">{maskPhone(o.customerPhone)}</span></> },
                { key: 'st', header: 'Status', cell: (o) => <><StatusBadge status={o.status} />{o.deliveryFlag && <span className="block text-xs text-slate">Delivery</span>}</> },
                { key: 'pay', header: 'Payment', cell: (o) => <PaymentBadge state={o.paymentState} balance={o.balance} /> },
                { key: 'ready', header: 'Ready by', th: <SortHeader key="ready" label="Ready by" field="expectedReadyBy" sort={f.sort} onSort={(s) => setF({ ...f, sort: s })} />, cell: (o) => date(o.expectedReadyBy) },
                { key: 'made', header: 'Created', th: <SortHeader key="made" label="Created" field="createdAt" sort={f.sort} onSort={(s) => setF({ ...f, sort: s })} />, cell: (o) => date(o.createdAt) },
                { key: 'tot', header: 'Total', className: 'text-right tabular', cell: (o) => money(o.invoice?.total) },
                { key: 'h', header: <span className="sr-only">History</span>, cell: (o) => <Link className="btn-link text-sm" to={`/staff/orders/${o.id}#history`}>History</Link> },
              ]}
              mobileCard={(o) => (
                <Link to={linkFor(o)} className="block">
                  <span className="flex items-center justify-between gap-2"><Ticket>{o.orderNo}</Ticket><StatusBadge status={o.status} /></span>
                  <span className="mt-1.5 block font-semibold">{o.customerName}</span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-sm text-slate">
                    <span>Ready by {date(o.expectedReadyBy)}</span>
                    <PaymentBadge state={o.paymentState} balance={o.balance} />
                  </span>
                </Link>
              )}
            />
            <Pager page={d.page} pageSize={d.pageSize} total={d.total} onPage={(p) => setF({ ...f, page: p })} />
          </>
        )}
      </QueryState>
      <Filters open={sheet} onClose={() => setSheet(false)} f={f} onApply={(p) => { upd(p); setSheet(false); }} />
    </div>
  );
}

function Filters({ open, onClose, f, onApply }: { open: boolean; onClose: () => void; f: F; onApply: (p: Partial<F>) => void }) {
  const { t } = useTranslation('status');
  const [d, setD] = useState(f);
  return (
    <Modal open={open} onClose={onClose} title="Filter orders">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm"><span className="label">Status</span>
          <select className="input" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>
            <option value="OPEN">All open</option>
            <option value="ALL">Everything</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`order.${s}`)}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="label">Payment</span>
          <select className="input" value={d.payment} onChange={(e) => setD({ ...d, payment: e.target.value })}>
            <option value="ALL">Any</option>
            {['UNPAID', 'PARTIAL', 'PAID', 'ON_ACCOUNT'].map((s) => <option key={s} value={s}>{t(`payment.${s}`)}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="label">From</span><input type="date" className="input" value={d.from} onChange={(e) => setD({ ...d, from: e.target.value })} /></label>
        <label className="text-sm"><span className="label">To</span><input type="date" className="input" value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })} /></label>
        <fieldset className="sm:col-span-2">
          <legend className="label">Handover</legend>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'PICKUP', 'DELIVERY'] as const).map((x) => (
              <label key={x} className={`btn flex-1 cursor-pointer text-sm ${d.delivery === x ? 'border-blue bg-sky' : ''}`}>
                <input type="radio" className="sr-only" checked={d.delivery === x} onChange={() => setD({ ...d, delivery: x })} /> {x === 'ALL' ? 'Both' : x === 'PICKUP' ? 'Pickup' : 'Delivery'}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => { const r = { status: 'OPEN', payment: 'ALL', delivery: 'ALL', from: '', to: '' }; setD({ ...d, ...r }); onApply(r); }}>Clear</button>
        <button className="btn-primary" onClick={() => onApply(d)}>Show results</button>
      </div>
    </Modal>
  );
}
