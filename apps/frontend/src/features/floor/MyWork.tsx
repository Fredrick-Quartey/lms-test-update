/**
 * Attendant home: "My work" (REDESIGN §9.1, D25). Three short stacks, one big button each:
 * running loads, ready for check, ready to pack. One scan bar does the right thing for the item:
 * a received item joins the right load automatically (D27, scan + 0 taps).
 */
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ClipboardCheck, PackageCheck, WashingMachine } from 'lucide-react';
import { api, type Batch } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Empty, ErrorAlert, Pill, QueryState, Section, Skeleton, useToast } from '@/components/ui';
import { ScanInput } from '@/components/inputs';
import { useNames, useSettings } from '@/config/settings';
import { errorMessage } from '@/lib/errors';
import { clock, loadName, nextStep, stageWord, StageWord, useNow, useStageAction } from './shared';

/** One scan, the right next step (sort / check / pack / open the load). */
export function useSmartScan() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const names = useNames();
  return useMutation({
    mutationFn: async (tag: string) => {
      const r = await api.tags.scan(tag);
      if (r.nextAction === 'SORT') {
        const l = await api.loads.scan(tag);
        return { r, load: l };
      }
      return { r, load: undefined };
    },
    onSuccess: ({ r, load }) => {
      void qc.invalidateQueries({ queryKey: ['floor'] });
      void qc.invalidateQueries({ queryKey: ['batches'] });
      if (load) {
        const b = load.batch;
        toast(
          load.alreadyIn
            ? `${load.tag} is already in ${loadName(b)}. Nothing changed.`
            : `${load.tag} added to ${loadName(b)} (${names.service(b.serviceTypeId)}${b.colour ? `, ${b.colour.toLowerCase()}` : ''}, ${b.fabric.toLowerCase()}). ${b.itemIds.length} item${b.itemIds.length === 1 ? '' : 's'}${load.created ? ', new load' : ''}.`,
          load.alreadyIn ? 'info' : 'success',
        );
        return;
      }
      if (r.nextAction === 'IN_BATCH' && r.batch) nav(`/staff/batches/${r.batch.id}`);
      else if (r.nextAction === 'QC') nav(`/staff/check?tag=${r.item.tag}`);
      else if (r.nextAction === 'PACK') nav(`/staff/pack/${r.order.id}`);
      else nav(`/staff/scan?tag=${r.item.tag}`);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
}

export function MyWork() {
  const { user } = useAuth();
  const batches = useQuery({ queryKey: ['batches', 'all'], queryFn: () => api.batches.list(), refetchInterval: 15_000 });
  const queue = useQuery({ queryKey: ['floor', 'queue'], queryFn: api.loads.queue, refetchInterval: 15_000 });
  const scan = useSmartScan();
  const running = (batches.data ?? []).filter((b) => b.status === 'OPEN' || b.status === 'IN_PROCESSING');
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="page-title">My work</h1>
        <p className="muted">Hello {user?.name.split(' ')[0]}. Scan an item, or tap the button on a load.</p>
      </header>

      <Section>
        <ScanInput label="Scan an item" placeholder="Scan or type a tag" onScan={(t) => scan.mutate(t)} busy={scan.isPending} buttonLabel="Go" />
        <p className="hint mt-2">
          {queue.data ? (queue.data.toSort > 0 ? `${queue.data.toSort} item${queue.data.toSort === 1 ? '' : 's'} waiting to be sorted into loads.` : 'Nothing waiting to be sorted.') : ' '}
        </p>
      </Section>

      <section aria-labelledby="loads-h">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="loads-h" className="section-title flex items-center gap-2"><WashingMachine size={20} aria-hidden className="text-aqua" /> Loads</h2>
          <Link to="/staff/batches" className="btn-link text-sm">All loads</Link>
        </div>
        <QueryState q={batches} isEmpty={() => !running.length} empty="No loads running. Scan an item to start one.">
          {() => (
            <ul className="space-y-3">
              {running.map((b) => <LoadCard key={b.id} b={b} />)}
            </ul>
          )}
        </QueryState>
      </section>

      <QueueCards />
    </div>
  );
}

function LoadCard({ b }: { b: Batch }) {
  const names = useNames();
  const settings = useSettings();
  const step = nextStep(b);
  const act = useStageAction(b);
  const st = b.stages[b.currentStageIndex];
  const running = Boolean(st?.startedAt && !st.completedAt);
  const now = useNow(running);
  const overLimit = running && now - new Date(st.startedAt!).getTime() > (settings.data?.stageAlertHours ?? 4) * 3600_000;
  return (
    <li className={`panel overflow-hidden ${overLimit ? 'border-warning ring-1 ring-warning/40' : ''}`}>
      <Link to={`/staff/batches/${b.id}`} className="flex items-start justify-between gap-3 p-4 pb-3 hover:bg-mist/60">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 font-bold">
            {loadName(b)} {b.isRework && <Pill tone="warn">Rework</Pill>} {overLimit && <Pill tone="warn">Over time</Pill>}
          </span>
          <span className="block text-sm text-slate">
            {b.itemIds.length} item{b.itemIds.length === 1 ? '' : 's'}, {names.service(b.serviceTypeId)}{b.colour ? `, ${b.colour.toLowerCase()}` : ''}
          </span>
        </span>
        <span className="text-right text-sm">
          {running ? (
            <span className="tabular block font-bold text-blue">{StageWord(st.name)} {clock(now - new Date(st.startedAt!).getTime())}</span>
          ) : (
            <span className="block text-slate">{b.status === 'OPEN' ? 'Filling' : `Waiting: ${stageWord(st.name)}`}</span>
          )}
          <ChevronRight size={18} aria-hidden className="ml-auto mt-1 text-slate" />
        </span>
      </Link>
      <ol aria-label="Stages" className="flex gap-1 px-4">
        {b.stages.map((s, i) => (
          <li key={s.name + i} title={StageWord(s.name)} className={`h-1.5 flex-1 rounded-full ${s.completedAt ? 'bg-success' : i === b.currentStageIndex && s.startedAt ? 'bg-blue' : 'bg-line'}`}>
            <span className="sr-only">{StageWord(s.name)}: {s.completedAt ? 'done' : s.startedAt ? 'running' : 'not started'}</span>
          </li>
        ))}
      </ol>
      <div className="p-4 pt-3">
        <button className={`flex min-h-14 w-full items-center justify-center rounded-[14px] text-base font-bold text-white disabled:opacity-60 ${step.kind === 'finish' ? 'bg-success hover:brightness-110' : 'bg-blue hover:bg-blue-dark'}`} onClick={() => act.run()} disabled={act.isPending}>
          {step.label}
        </button>
        {act.error && <div className="mt-2"><ErrorAlert error={act.error} /></div>}
      </div>
    </li>
  );
}

function QueueCards() {
  const q = useQuery({ queryKey: ['floor', 'queue'], queryFn: api.loads.queue, refetchInterval: 15_000 });
  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  if (q.isError) return <ErrorAlert error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="panel p-4" aria-labelledby="check-h">
        <h2 id="check-h" className="flex items-center gap-2 font-bold"><ClipboardCheck size={20} aria-hidden className="text-aqua" /> Ready for check</h2>
        <p className="mt-1 text-3xl font-bold tabular">{d.readyForCheck.length}</p>
        <p className="text-sm text-slate">{d.failed.length ? `${d.failed.length} with a problem waiting` : 'items finished processing'}</p>
        <Link to="/staff/check" className={`mt-3 flex min-h-12 items-center justify-center rounded-[12px] font-bold ${d.readyForCheck.length ? 'bg-blue text-white hover:bg-blue-dark' : 'bg-mist text-slate'}`} aria-disabled={!d.readyForCheck.length}>
          Start checking
        </Link>
      </section>
      <section className="panel p-4" aria-labelledby="pack-h">
        <h2 id="pack-h" className="flex items-center gap-2 font-bold"><PackageCheck size={20} aria-hidden className="text-aqua" /> Ready to pack</h2>
        <p className="mt-1 text-3xl font-bold tabular">{d.readyToPack.length}</p>
        {d.readyToPack.length === 0 ? (
          <p className="text-sm text-slate">orders with every item checked</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {d.readyToPack.slice(0, 4).map((o) => (
              <li key={o.orderId}>
                <Link to={`/staff/pack/${o.orderId}`} className="flex min-h-11 items-center justify-between rounded-[12px] bg-sky px-3 text-sm font-semibold text-blue-dark hover:bg-sky/70">
                  <span>{o.orderNo}{o.express ? ', express' : ''}</span>
                  <span>Pack {o.items} <ChevronRight size={16} aria-hidden className="inline" /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!d.readyForCheck.length && !d.readyToPack.length && !d.toSort && (
        <div className="sm:col-span-2"><Empty>All clear. New items appear here as the counter takes orders.</Empty></div>
      )}
    </div>
  );
}
