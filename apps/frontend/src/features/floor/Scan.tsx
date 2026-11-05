/**
 * Scan: scan any tag and see the item with its care notes first and the one next step (REDESIGN §9).
 * A received item goes into the right load automatically (D27). A-03, A-04, B-01, B-04, C-01, C-02, C-03.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type LoadScanResult, type Order, type ScanResult } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, BigActionButton, ErrorAlert, Field, ItemStatusBadge, Loading, PageHeader, Section, Ticket, useToast } from '@/components/ui';
import { ScanInput } from '@/components/inputs';
import { useNames } from '@/config/settings';
import { dateTime } from '@/lib/format';
import { CheckPanel, ItemSummary, loadName, MoreActions, ProblemSheet } from './shared';

export function Scan() {
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag');
  const q = useQuery({ queryKey: ['scan', tag], queryFn: () => api.tags.scan(tag!), enabled: Boolean(tag), retry: false });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader back={{ to: '/staff/work', label: 'My work' }} title="Scan" intro="Scan a tag to see the item and what it needs next." />
      <Section>
        <ScanInput label="Tag number" onScan={(t) => setParams({ tag: t })} busy={q.isFetching} />
      </Section>
      {tag && q.isPending && <Loading rows={1} />}
      {q.isError && <ErrorAlert error={q.error} />}
      {q.data && <ScanCard key={`${q.data.item.id}-${q.data.item.status}`} r={q.data} onChanged={() => void q.refetch()} />}
    </div>
  );
}

function ScanCard({ r, onChanged }: { r: ScanResult; onChanged: () => void }) {
  return (
    <Section>
      <ItemSummary r={r} />
      <div className="mt-5">
        <NextAction r={r} onChanged={onChanged} />
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        <Link to={`/staff/orders/${r.order.id}`} className="btn-link self-center text-sm">Order {r.order.orderNo}</Link>
        <MoreActions r={r} onChanged={onChanged} />
      </div>
    </Section>
  );
}

function NextAction({ r, onChanged }: { r: ScanResult; onChanged: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  switch (r.nextAction) {
    case 'SORT':
      return <AutoSort r={r} />;
    case 'IN_BATCH':
      return (
        <div className="space-y-3">
          <p>In <strong>{r.batch ? loadName(r.batch) : 'a load'}</strong>, {r.batch?.status === 'OPEN' ? 'not started yet' : `now ${r.batch?.stages[r.batch.currentStageIndex]?.name.toLowerCase()}`}.</p>
          {r.batch?.overdue && <Alert tone="warning">This load is over the stage time limit. The Branch Manager has been told.</Alert>}
          <BigActionButton sticky={false} onClick={() => nav(`/staff/batches/${r.batch?.id}`)}>Open {r.batch ? loadName(r.batch) : 'the load'}</BigActionButton>
        </div>
      );
    case 'QC':
      return <CheckPanel r={r} onDone={(m) => { toast(m); onChanged(); }} />;
    case 'AWAIT_QC_RESOLUTION':
      return <FailedPanel r={r} onChanged={onChanged} />;
    case 'PACK':
      return <BigActionButton sticky={false} onClick={() => nav(`/staff/pack/${r.order.id}`)}>Pack order {r.order.orderNo}</BigActionButton>;
    case 'WAITING_FOR_OTHER_ITEMS':
      return <WaitingPanel order={r.order} />;
    case 'PACKAGED':
      return <Alert tone="success">Packed on shelf <strong>{r.order.shelf}</strong>. The customer has been notified.</Alert>;
    default:
      return <p className="muted">This order is closed.</p>;
  }
}

/** D27: no dropdowns. The item joins the right open load, or a new load is made for it. */
function AutoSort({ r }: { r: ScanResult }) {
  const qc = useQueryClient();
  const names = useNames();
  const nav = useNavigate();
  const [res, setRes] = useState<LoadScanResult | null>(null);
  const ran = useRef(false);
  const m = useMutation({
    mutationFn: () => api.loads.scan(r.item.tag!),
    onSuccess: (x) => {
      setRes(x);
      void qc.invalidateQueries({ queryKey: ['batches'] });
      void qc.invalidateQueries({ queryKey: ['floor'] });
    },
  });
  useEffect(() => {
    if (!ran.current) {
      ran.current = true;
      m.mutate();
    }
  }, [m]);
  if (m.isError) return <ErrorAlert error={m.error} onRetry={() => m.mutate()} />;
  if (!res) return <p className="muted" role="status">Putting {r.item.tag} into a load…</p>;
  const b = res.batch;
  return (
    <div className="space-y-3" role="status">
      <Alert tone="success" title={res.alreadyIn ? `Already in ${loadName(b)}` : `Added to ${loadName(b)}${res.created ? ' (new load)' : ''}`}>
        {names.service(b.serviceTypeId)}{b.colour ? `, ${b.colour.toLowerCase()}` : ''}, {b.fabric.toLowerCase()}. {b.itemIds.length} item{b.itemIds.length === 1 ? '' : 's'} in this load.
      </Alert>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => nav('/staff/scan')}>Scan next item</button>
        <button className="btn-primary" onClick={() => nav(`/staff/batches/${b.id}`)}>Open {loadName(b)}</button>
      </div>
    </div>
  );
}

function FailedPanel({ r, onChanged }: { r: ScanResult; onChanged: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<null | 'override' | 'discard'>(null);
  const [reason, setReason] = useState('');
  const last = [...r.item.qc].reverse().find((x) => x.outcome === 'FAIL');
  const override = useMutation({ mutationFn: () => api.items.requestOverride(r.item.id, reason), onSuccess: () => { toast('Override request sent to the Branch Manager.'); onChanged(); } });
  const discard = useMutation({ mutationFn: () => api.items.discard(r.item.id, reason), onSuccess: () => { toast(`${r.item.tag} set aside. The customer will be told.`); onChanged(); } });
  return (
    <div className="space-y-3">
      <Alert tone="error" title="This item has a problem">
        {last ? <>Recorded by {last.byName}, {dateTime(last.at)}: {last.reason}</> : 'It failed the check.'} It can't be packed until it is fixed or the Branch Manager decides.
      </Alert>
      {r.item.needsManagerReview ? (
        <Alert tone="warning">It has been reworked the maximum number of times and is waiting for the Branch Manager.</Alert>
      ) : (
        <BigActionButton sticky={false} onClick={() => setSheet(true)}>Do it again (rework)</BigActionButton>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setMode('override')}>Ask the manager to accept it</button>
        {can('item.discard') && <button className="btn-danger" onClick={() => setMode('discard')}>Set aside and tell the customer</button>}
      </div>
      {mode && (
        <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), mode === 'override' ? override.mutate() : discard.mutate())}>
          <Field label="Reason" required>{(p) => <input {...p} className="input" value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          <ErrorAlert error={override.error ?? discard.error} />
          <button className={mode === 'override' ? 'btn-primary' : 'btn-danger'} disabled={!reason.trim()}>{mode === 'override' ? 'Send request' : 'Set the item aside'}</button>
        </form>
      )}
      <ProblemSheet open={sheet} onClose={() => setSheet(false)} r={r} onDone={(m) => { setSheet(false); toast(m); onChanged(); }} />
    </div>
  );
}

function WaitingPanel({ order }: { order: Order }) {
  const waiting = order.items.filter((i) => !['QC_PASSED', 'PACKAGED', 'DISCARDED', 'CANCELLED'].includes(i.status));
  return (
    <div className="text-sm">
      <Alert tone="success">Passed. Keep it with the rest of order {order.orderNo}.</Alert>
      <p className="mt-3 font-semibold">Still waiting on:</p>
      <ul className="mt-2 space-y-1.5">
        {waiting.map((i) => <li key={i.id} className="flex items-center gap-2"><Ticket>{i.tag}</Ticket> <ItemStatusBadge status={i.status} /></li>)}
      </ul>
    </div>
  );
}
