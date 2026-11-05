// SRS-LDY-F-02: immutable, append-only audit trail; read-only for everyone; filters; no edit/delete controls.
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@ldy/api-client';
import { PageHeader, QueryState } from '@/components/ui';
import { ResponsiveTable } from '@/components/ResponsiveTable';
import { Pager } from '@/components/inputs';
import { ChangeText, humanAction } from '@/features/orders/OrderDetail';
import { dateTime } from '@/lib/format';

const ENTITIES = ['Order', 'OrderItem', 'Payment', 'Approval', 'Batch', 'Machine', 'DamageReport', 'Route', 'Booking', 'Cashup', 'Statement', 'Customer', 'User', 'Settings', 'PriceListEntry', 'ServiceType', 'NotificationTemplate', 'Import', 'Export'];

export function Audit() {
  const [f, setF] = useState({ entity: '', entityId: '', user: '', action: '', from: '', to: '', page: 1 });
  const [draft, setDraft] = useState(f);
  const q = useQuery({ queryKey: ['audit', f], queryFn: () => api.audit.list({ ...f, pageSize: 25 }), placeholderData: keepPreviousData });
  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader title="Audit history" intro="Who did what, and when. Records are append-only: corrections appear as new entries that reference the original." />
      <form className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end" onSubmit={(e) => (e.preventDefault(), setF({ ...draft, page: 1 }))}>
        <label className="text-sm"><span className="label">Record type</span><select className="input" value={draft.entity} onChange={(e) => setDraft({ ...draft, entity: e.target.value })}><option value="">Any</option>{ENTITIES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-sm"><span className="label">Reference</span><input className="input" placeholder="LDY-000012, B-0003…" value={draft.entityId} onChange={(e) => setDraft({ ...draft, entityId: e.target.value })} /></label>
        <label className="text-sm"><span className="label">Person</span><input className="input" value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} /></label>
        <label className="text-sm"><span className="label">Action contains</span><input className="input" placeholder="refund, sign_in…" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} /></label>
        <label className="text-sm"><span className="label">From</span><input type="date" className="input" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
        <label className="text-sm"><span className="label">To</span><input type="date" className="input" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
        <div className="sm:col-span-3 lg:col-span-6"><button className="btn-primary">Apply filters</button></div>
      </form>
      <QueryState q={q} isEmpty={(d) => !d.items.length} empty="No entries match.">
        {(d) => (
          <div>
            <ResponsiveTable
              caption="Audit history"
              rows={d.items}
              rowKey={(e) => e.id}
              columns={[
                { key: 'w', header: 'When', className: 'whitespace-nowrap', cell: (e) => dateTime(e.at) },
                { key: 'p', header: 'Who', cell: (e) => e.actorName },
                { key: 'r', header: 'Record', cell: (e) => <>{e.entityType}<span className="block text-xs text-slate">{e.entityRef ?? e.entityId}</span></> },
                { key: 'a', header: 'What', cell: (e) => humanAction(e.action) },
                { key: 'c', header: 'Before and after', className: 'max-w-md text-xs text-slate', cell: (e) => <ChangeText before={e.before} after={e.after} /> },
              ]}
              mobileCard={(e) => (
                <div className="text-sm">
                  <p className="font-semibold">{humanAction(e.action)}</p>
                  <p className="text-slate">{e.actorName}, {dateTime(e.at)}</p>
                  <p className="text-xs text-slate">{e.entityType} {e.entityRef ?? e.entityId}</p>
                  <p className="mt-1 break-words text-xs text-slate"><ChangeText before={e.before} after={e.after} /></p>
                </div>
              )}
            />
            <Pager page={d.page} pageSize={d.pageSize} total={d.total} onPage={(p) => setF({ ...f, page: p })} />
          </div>
        )}
      </QueryState>
    </div>
  );
}
