// Branch Manager inbox: late batches (B-02), damage (C-02), approvals (E-03/E-04/C-01/B-04),
// uncollected and disposable orders (D-01), flagged cash-ups (E-05), failed notifications (F-05).
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@ldy/api-client';
import { PageHeader, QueryState, Section, Ticket } from '@/components/ui';
import { dateTime, day, money, relativeHours } from '@/lib/format';
import type { ReactNode } from 'react';

export function Inbox() {
  const q = useQuery({ queryKey: ['inbox'], queryFn: api.inbox, refetchInterval: 20_000 });
  return (
    <div>
      <PageHeader title="Inbox" intro="Everything waiting on a Branch Manager decision, oldest first." />
      <QueryState q={q}>
        {(d) => {
          const total = d.overdueBatches.length + d.openDamage.length + d.pendingApprovals.length + d.uncollected.length + d.disposable.length + d.flaggedCashups.length;
          return (
            <div className="space-y-5">
              {total === 0 && <p className="panel p-5">Nothing needs you right now.</p>}
              <Group title="Approvals waiting" count={d.pendingApprovals.length} to="/staff/approvals">
                {d.pendingApprovals.map((a) => (
                  <Row key={a.id} to="/staff/approvals">
                    <span><Ticket>{a.orderNo}</Ticket> {kindLabel(a.kind)}{a.amount ? ` of ${money(a.amount)}` : ''}{a.tag ? `, item ${a.tag}` : ''}</span>
                    <span className="text-slate">from {a.requestedByName}, {relativeHours(a.requestedAt)} ago</span>
                  </Row>
                ))}
              </Group>
              <Group title="Damage and loss reports" count={d.openDamage.length} to="/staff/approvals?tab=damage">
                {d.openDamage.map((r) => (
                  <Row key={r.id} to="/staff/approvals?tab=damage">
                    <span><Ticket>{r.tag}</Ticket> {r.type === 'LOST' ? 'Lost' : 'Damaged'}: {r.description}</span>
                    <span className="text-slate">{r.orderNo}, reported by {r.reportedByName}</span>
                  </Row>
                ))}
              </Group>
              <Group title="Batches over the stage time limit" count={d.overdueBatches.length} to="/staff/batches">
                {d.overdueBatches.map((b) => (
                  <Row key={b.id} to={`/staff/batches/${b.id}`}>
                    <span><strong>{b.batchNo}</strong> in {b.stages[b.currentStageIndex]?.name}</span>
                    <span className="text-slate">for {relativeHours(b.stages[b.currentStageIndex]?.startedAt)}, {b.attendantName}</span>
                  </Row>
                ))}
              </Group>
              <Group title="Uncollected orders" count={d.uncollected.length} to="/staff/approvals?tab=uncollected">
                {d.uncollected.map((o) => (
                  <Row key={o.id} to={`/staff/orders/${o.id}`}>
                    <span><Ticket>{o.orderNo}</Ticket> {o.customerName}, shelf {o.shelf}</span>
                    <span className="text-slate">ready since {dateTime(o.readyNotifiedAt)}; reminders: {o.remindersSent.join(', ') || 'none'}</span>
                  </Row>
                ))}
              </Group>
              <Group title="Past the unclaimed-items period" count={d.disposable.length} to="/staff/approvals?tab=uncollected">
                {d.disposable.map((o) => (
                  <Row key={o.id} to={`/staff/orders/${o.id}`}>
                    <span><Ticket>{o.orderNo}</Ticket> {o.customerName}</span>
                    <span className="text-slate">ready since {dateTime(o.readyNotifiedAt)}</span>
                  </Row>
                ))}
              </Group>
              <Group title="Cash-ups with a variance" count={d.flaggedCashups.length} to="/staff/cashup">
                {d.flaggedCashups.map((c) => (
                  <Row key={c.id} to="/staff/cashup">
                    <span>{c.officerName}, session of {day(c.date)}</span>
                    <span className="text-slate">cash variance {money(c.variance?.CASH)}</span>
                  </Row>
                ))}
              </Group>
              {d.failedNotifications.length > 0 && (
                <p className="text-sm text-slate">{d.failedNotifications.length} customer message(s) failed to send, mostly emails to customers without an address. The administrator can review them in Notifications.</p>
              )}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}

export function kindLabel(k: string) {
  return ({ REFUND: 'Refund', ADJUSTMENT: 'Price adjustment', QC_OVERRIDE: 'QC override', CREDIT_OVERRIDE: 'Credit-limit override', REWORK_REVIEW: 'Rework limit review' } as Record<string, string>)[k] ?? k;
}

function Group({ title, count, to, children }: { title: string; count: number; to: string; children: ReactNode }) {
  if (!count) return null;
  return (
    <Section title={`${title} (${count})`} aside={<Link to={to} className="btn-link text-sm">Open</Link>}>
      <ul className="divide-y divide-line">{children}</ul>
    </Section>
  );
}

function Row({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm hover:bg-mist">{children}</Link>
    </li>
  );
}
