/**
 * Loads (batches in the SRS). B-01 scan items in, B-02 Start/Finish every stage with times recorded
 * automatically (D20), B-03 optional machine. One big button at a time (REDESIGN §9.3).
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Circle, Cog } from 'lucide-react';
import { api, type Batch } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, BigActionButton, ErrorAlert, ItemStatusBadge, Modal, PageHeader, Pill, QueryState, Section, Ticket, useToast } from '@/components/ui';
import { ScanInput } from '@/components/inputs';
import { useNames, useSettings } from '@/config/settings';
import { msg } from '@/lib/errors';
import { dateTime, time } from '@/lib/format';
import { clock, duration, loadName, minutesBetween, nextStep, StageWord, useNow, useStageAction } from './shared';

export function Batches() {
  const q = useQuery({ queryKey: ['batches', 'all'], queryFn: () => api.batches.list(), refetchInterval: 15_000 });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Loads" intro="A load is a group of items washed together. Items are put into the right load when you scan them." back={{ to: '/staff/work', label: 'My work' }} />
      <QueryState q={q}>
        {(all) => {
          const groups: { key: string; title: string; rows: Batch[]; open: boolean }[] = [
            { key: 'run', title: 'Running', rows: all.filter((b) => b.status === 'IN_PROCESSING'), open: true },
            { key: 'open', title: 'Filling, not started', rows: all.filter((b) => b.status === 'OPEN'), open: true },
            { key: 'done', title: 'Finished today', rows: all.filter((b) => b.status === 'PROCESSING_COMPLETE' && (b.stages.at(-1)?.completedAt ?? '').slice(0, 10) === today), open: false },
          ];
          return (
            <div className="space-y-3">
              {groups.map((g) => (
                <details key={g.key} open={g.open && g.rows.length > 0} className="panel group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-bold">
                    <span>{g.title} <span className="ml-1 rounded-full bg-mist px-2 text-sm text-slate">{g.rows.length}</span></span>
                    <ChevronDown size={20} aria-hidden className="text-slate transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="divide-y divide-line border-t border-line">
                    {g.rows.map((b) => <LoadRow key={b.id} b={b} />)}
                    {!g.rows.length && <li className="muted px-4 py-3 text-sm">None.</li>}
                  </ul>
                </details>
              ))}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}

function LoadRow({ b }: { b: Batch }) {
  const names = useNames();
  const st = b.stages[b.currentStageIndex];
  return (
    <li>
      <Link to={`/staff/batches/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-mist">
        <span>
          <span className="font-semibold">{loadName(b)}</span> {b.overdue && <Pill tone="warn">Over time</Pill>} {b.isRework && <Pill tone="warn">Rework</Pill>}
          <span className="block text-sm text-slate">{b.itemIds.length} items, {names.service(b.serviceTypeId)}{b.colour ? `, ${b.colour.toLowerCase()}` : ''}</span>
        </span>
        <span className="text-right text-sm text-slate">
          {b.status === 'PROCESSING_COMPLETE' ? 'Ready for check' : st.startedAt ? `${StageWord(st.name)} since ${time(st.startedAt)}` : `Next: ${StageWord(st.name)}`}
        </span>
      </Link>
    </li>
  );
}

export function BatchDetail() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['batch', id], queryFn: () => api.batches.get(id!), refetchInterval: 15_000 });
  return <QueryState q={q}>{(b) => <LoadRun b={b} />}</QueryState>;
}

function LoadRun({ b }: { b: Awaited<ReturnType<typeof api.batches.get>> }) {
  const qc = useQueryClient();
  const toast = useToast();
  const names = useNames();
  const settings = useSettings();
  const { can } = useAuth();
  const work = can('floor.work');
  const step = nextStep(b);
  const act = useStageAction(b);
  const st = b.stages[b.currentStageIndex];
  const running = Boolean(st?.startedAt && !st.completedAt && b.status !== 'PROCESSING_COMPLETE');
  const now = useNow(running);
  const overLimit = running && now - new Date(st.startedAt!).getTime() > (settings.data?.stageAlertHours ?? 4) * 3600_000;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['batch', b.id] });
    void qc.invalidateQueries({ queryKey: ['batches'] });
    void qc.invalidateQueries({ queryKey: ['floor'] });
  };
  const add = useMutation({
    mutationFn: (tag: string) => api.batches.addItem(b.id, tag),
    onSuccess: (r, tag) => {
      refresh();
      toast(r.itemIds.length === b.itemIds.length ? `${tag} is already in this load. Nothing changed.` : `${tag} added. ${r.itemIds.length} items in ${loadName(r)}.`, r.itemIds.length === b.itemIds.length ? 'info' : 'success');
    },
  });
  const remove = useMutation({ mutationFn: (itemId: string) => api.batches.removeItem(b.id, itemId), onSuccess: refresh });
  const [machineOpen, setMachineOpen] = useState(false);
  const machines = useQuery({ queryKey: ['machines'], queryFn: api.machines.list });
  const machineName = machines.data?.find((m) => m.id === b.machineId)?.name;
  const done = b.status === 'PROCESSING_COMPLETE';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ to: '/staff/work', label: 'My work' }}
        title={<span className="flex flex-wrap items-center gap-2">{loadName(b)} {b.isRework && <Pill tone="warn">Rework</Pill>}</span>}
        intro={`${b.items.length} item${b.items.length === 1 ? '' : 's'}, ${names.service(b.serviceTypeId)}${b.colour ? `, ${b.colour.toLowerCase()}` : ''}, ${b.fabric.toLowerCase()}`}
        actions={
          work && !done ? (
            <button className="btn min-h-10 rounded-full text-sm" onClick={() => setMachineOpen(true)}>
              <Cog size={16} aria-hidden /> {machineName ?? 'Choose machine'}
            </button>
          ) : machineName ? <Pill tone="info">{machineName}</Pill> : undefined
        }
      />

      {/* Stage list: ✓ done with duration, ● running with timer, ○ not yet */}
      <Section>
        <ol className="space-y-1">
          {b.stages.map((s, i) => {
            const isCur = i === b.currentStageIndex && !done;
            const isRunning = isCur && s.startedAt && !s.completedAt;
            return (
              <li key={s.name + i} className={`flex items-center gap-3 rounded-[12px] px-3 py-3 ${isRunning ? (overLimit ? 'bg-warning-wash' : 'bg-sky') : ''}`}>
                <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.completedAt ? 'bg-success text-white' : isRunning ? 'bg-blue text-white' : 'border-2 border-line text-line'}`}>
                  {s.completedAt ? <Check size={18} /> : <Circle size={10} fill="currentColor" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${!s.startedAt && !s.completedAt ? 'text-slate' : ''}`}>{StageWord(s.name)}</span>
                  <span className="block text-sm text-slate">
                    {s.completedAt
                      ? `${time(s.startedAt)} to ${time(s.completedAt)}, ${s.completedBy}`
                      : s.startedAt
                        ? `Started ${time(s.startedAt)} by ${s.startedBy}`
                        : isCur ? 'Next, waiting for you to start' : 'Not started'}
                  </span>
                </span>
                <span className="tabular text-right text-sm font-bold">
                  {s.completedAt ? duration(minutesBetween(s.startedAt, s.completedAt)) : isRunning ? <span className={overLimit ? 'text-warning' : 'text-blue'}>{clock(now - new Date(s.startedAt!).getTime())}</span> : ''}
                  {isRunning && overLimit && <span className="block text-xs text-warning">Over time</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </Section>

      {overLimit && <div className="mt-3"><Alert tone="warning">{StageWord(st.name)} has been running longer than {settings.data?.stageAlertHours} hours. The Branch Manager has been told.</Alert></div>}

      {/* Scan more items in while the load hasn't started (B-01) */}
      {work && b.status === 'OPEN' && (
        <Section className="mt-4" title="Add items">
          <ScanInput label="Scan an item into this load" onScan={(tag) => add.mutate(tag)} busy={add.isPending} buttonLabel="Add" autoFocus={false} />
          <div className="mt-2"><ErrorAlert error={add.error} /></div>
        </Section>
      )}

      <details className="panel group mt-4">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-semibold">
          Items in this load ({b.items.length})
          <ChevronDown size={20} aria-hidden className="text-slate transition-transform group-open:rotate-180" />
        </summary>
        <ul className="divide-y divide-line border-t border-line">
          {b.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <Ticket>{i.tag}</Ticket> {names.category(i.categoryId)} {i.weightKg ? `${i.weightKg} kg` : `× ${i.quantity}`}
                {(i.instructions || i.flags.length > 0) && <span className="block text-xs text-warning">Care: {[i.instructions, ...i.flags.map((f) => f.note ?? f.type.toLowerCase())].filter(Boolean).join('; ')}</span>}
              </span>
              <span className="flex items-center gap-2">
                <ItemStatusBadge status={i.status} />
                {work && b.status === 'OPEN' && <button className="btn-link text-danger" onClick={() => remove.mutate(i.id)}>Remove</button>}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {/* The only main button (D20). Waiting time between stages isn't counted as working time. */}
      {work && (
        done ? (
          <div className="mt-4 space-y-3">
            <Alert tone="success" title={`${loadName(b)} is ready for check.`}>Finished {dateTime(b.stages.at(-1)?.completedAt)}.</Alert>
            <Link to="/staff/check" className="flex min-h-16 w-full items-center justify-center rounded-[16px] bg-blue text-lg font-bold text-white hover:bg-blue-dark">Start checking</Link>
          </div>
        ) : (
          <>
            {step.kind === 'start' && b.items.length === 0 && <p className="hint mt-3">{msg('EMPTY_BATCH')}</p>}
            <ErrorAlert error={act.error} />
            <BigActionButton tone={step.kind === 'finish' ? 'success' : 'primary'} onClick={() => act.run()} disabled={act.isPending}>
              {step.label}
            </BigActionButton>
          </>
        )
      )}
      <MachinePicker open={machineOpen} onClose={() => setMachineOpen(false)} b={b} onDone={refresh} />
    </div>
  );
}

/** B-03: only free machines can be chosen. */
function MachinePicker({ open, onClose, b, onDone }: { open: boolean; onClose: () => void; b: Batch; onDone: () => void }) {
  const toast = useToast();
  const machines = useQuery({ queryKey: ['machines'], queryFn: api.machines.list, enabled: open });
  const m = useMutation({
    mutationFn: (id: string) => api.batches.assignMachine(b.id, id),
    onSuccess: (_r, id) => {
      toast(`${loadName(b)} is on ${machines.data?.find((x) => x.id === id)?.name}.`);
      onDone();
      onClose();
    },
  });
  const free = machines.data?.filter((x) => x.status === 'AVAILABLE' || x.id === b.machineId) ?? [];
  return (
    <Modal open={open} onClose={onClose} title="Choose a machine">
      <p className="mb-3 text-sm text-slate">Only free machines are shown. Machines in use or under maintenance can't be chosen.</p>
      <div className="grid gap-2">
        {free.map((x) => (
          <button key={x.id} className={`btn justify-between ${x.id === b.machineId ? 'border-blue bg-sky' : ''}`} onClick={() => m.mutate(x.id)} disabled={m.isPending}>
            {x.name} <span className="text-sm font-normal text-slate">{x.type.toLowerCase()}</span>
          </button>
        ))}
        {machines.data && !free.length && <p className="muted text-sm">No machine is free right now.</p>}
      </div>
      <div className="mt-3"><ErrorAlert error={m.error} /></div>
    </Modal>
  );
}
