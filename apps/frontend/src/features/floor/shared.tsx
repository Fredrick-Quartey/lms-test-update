/**
 * Shared floor pieces for the attendant (REDESIGN §9): plain words, one big button, "handle with care" first.
 * A-03 reprint, A-04 flags at every stage, B-04 rework, C-01 check, C-02 damage/loss.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Flag, MoreHorizontal, Printer, ShieldAlert } from 'lucide-react';
import { api, type Batch, type FlagType, type OrderItem, type ScanResult } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, BigActionButton, ErrorAlert, Field, ItemStatusBadge, Modal, Ticket, useToast } from '@/components/ui';
import { PhotoInput } from '@/components/inputs';
import { FLAG_LABEL } from '@/components/order';
import { useNames, useSettings } from '@/config/settings';
import { errorCode, errorField, errorMessage, msg } from '@/lib/errors';
import { dateTime, time } from '@/lib/format';

// ---------------- Plain words (D26) ----------------
const GERUND: Record<string, string> = {
  wash: 'washing', dry: 'drying', iron: 'ironing', fold: 'folding', press: 'pressing', 'solvent clean': 'solvent cleaning', steam: 'steaming',
};
export const stageWord = (name: string) => GERUND[name.toLowerCase()] ?? name.toLowerCase();
export const StageWord = (name: string) => {
  const w = stageWord(name);
  return w.charAt(0).toUpperCase() + w.slice(1);
};
export const loadName = (b: Pick<Batch, 'batchNo'>) => `Load ${Number(b.batchNo.replace(/\D/g, '')) || b.batchNo}`;

export function minutesBetween(a?: string, b?: string | number) {
  if (!a) return 0;
  const end = typeof b === 'number' ? b : b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(a).getTime()) / 60000));
}
export function duration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Ticks every second while `on` (running timers). */
export function useNow(on = true, ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [on, ms]);
  return now;
}

/** What the one big button on a load does next (D20: every stage has its own Start and Finish). */
export function nextStep(b: Batch): { kind: 'start' | 'finish' | 'done'; stage?: string; label: string } {
  if (b.status === 'PROCESSING_COMPLETE') return { kind: 'done', label: 'Ready for check' };
  const st = b.stages[b.currentStageIndex];
  if (!st.startedAt) return { kind: 'start', stage: st.name, label: `Start ${stageWord(st.name)}` };
  return { kind: 'finish', stage: st.name, label: `Finish ${stageWord(st.name)}` };
}

/** Start/Finish with optimistic update and a confirmation that names what changed (§12.1, §12.2). */
export function useStageAction(b: Batch) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  type Vars = { kind: 'start' | 'finish' | 'done'; stage?: string; index: number };
  const m = useMutation({
    mutationFn: (v: Vars) => (v.kind === 'start' ? api.batches.startStage(b.id) : api.batches.completeStage(b.id)),
    onMutate: async (v: Vars) => {
      const key = ['batch', b.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      if (prev) {
        const now = new Date().toISOString();
        const draft = structuredClone(prev) as Batch;
        const st = draft.stages[v.index];
        if (v.kind === 'start') {
          st.startedAt = now;
          st.startedBy = user?.name;
          draft.status = 'IN_PROCESSING';
        } else {
          st.completedAt = now;
          st.completedBy = user?.name;
          if (v.index < draft.stages.length - 1) draft.currentStageIndex = v.index + 1;
          else draft.status = 'PROCESSING_COMPLETE';
        }
        qc.setQueryData(key, draft);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['batch', b.id], ctx.prev);
    },
    onSuccess: (r, v) => {
      const st = r.stages[v.index];
      if (v.kind === 'start') toast(`${StageWord(v.stage!)} started for ${loadName(r)} at ${time(st?.startedAt)}.`);
      else
        toast(
          `${StageWord(v.stage!)} finished for ${loadName(r)} at ${time(st?.completedAt)} (${duration(minutesBetween(st?.startedAt, st?.completedAt))}).${r.status === 'PROCESSING_COMPLETE' ? ' Ready for check.' : ''}`,
        );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['batch', b.id] });
      void qc.invalidateQueries({ queryKey: ['batches'] });
      void qc.invalidateQueries({ queryKey: ['floor'] });
      void qc.invalidateQueries({ queryKey: ['machines'] });
    },
  });
  const step = nextStep(b);
  return { ...m, run: () => m.mutate({ kind: step.kind, stage: step.stage, index: b.currentStageIndex }) };
}

// ---------------- Item card: care notes first ----------------
export function CareNotes({ item }: { item: OrderItem }) {
  if (!item.instructions && !item.flags.length) return null;
  return (
    <div className="rounded-[12px] border border-warning/30 bg-warning-wash p-3 text-sm">
      <p className="flex items-center gap-1.5 font-bold text-warning"><AlertTriangle size={16} aria-hidden /> Handle with care</p>
      {item.instructions && <p className="mt-1">{item.instructions}</p>}
      {item.flags.map((f) => (
        <div key={f.id} className="mt-1">
          <span className="font-semibold">{FLAG_LABEL[f.type]}</span>
          {f.note ? `: ${f.note}` : ''} <span className="text-slate">({f.stage === 'INTAKE' ? 'at the counter' : 'on the floor'}, {f.by})</span>
          {f.photo && <img src={f.photo} alt={`${FLAG_LABEL[f.type]} photo`} className="mt-1 max-h-32 rounded-[8px] border border-line" />}
        </div>
      ))}
    </div>
  );
}

export function ItemSummary({ r }: { r: ScanResult }) {
  const names = useNames();
  const { item, order } = r;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Ticket size="lg">{item.tag}</Ticket>
        <ItemStatusBadge status={item.status} />
        {order.speed === 'EXPRESS' && <span className="rounded-full bg-tag px-2 text-xs font-bold">Express</span>}
      </div>
      <p className="text-lg font-semibold">
        {names.category(item.categoryId)} {item.weightKg ? `${item.weightKg} kg` : `× ${item.quantity}`}
        <span className="block text-sm font-normal text-slate">
          {names.service(item.serviceTypeId)}, {item.colour.toLowerCase()}, {item.fabric.toLowerCase()}. Order {order.orderNo}, ready by {dateTime(order.expectedReadyBy)}
        </span>
      </p>
      <CareNotes item={item} />
    </div>
  );
}

/** Secondary actions live in a "More" sheet (§9.6). */
export function MoreActions({ r, onChanged }: { r: ScanResult; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState<null | 'menu' | 'flag' | 'damage'>(null);
  const reprint = useMutation({
    mutationFn: () => api.tags.reprint(r.item.tag!),
    onSuccess: () => {
      toast(`Tag ${r.item.tag} sent to the printer again with the same number.`);
      setOpen(null);
    },
  });
  return (
    <>
      <button className="btn w-full sm:w-auto" onClick={() => setOpen('menu')}>
        <MoreHorizontal size={20} aria-hidden /> More
      </button>
      <Modal open={open === 'menu'} onClose={() => setOpen(null)} title={`More for ${r.item.tag}`}>
        <div className="grid gap-2">
          <button className="btn justify-start" onClick={() => setOpen('flag')}><Flag size={18} aria-hidden /> Add a care flag</button>
          <button className="btn justify-start" onClick={() => setOpen('damage')}><ShieldAlert size={18} aria-hidden /> Report damage or loss</button>
          <button className="btn justify-start" onClick={() => reprint.mutate()} disabled={reprint.isPending}><Printer size={18} aria-hidden /> Reprint tag</button>
          <ErrorAlert error={reprint.error} />
        </div>
      </Modal>
      <FlagModal open={open === 'flag'} onClose={() => setOpen(null)} itemId={r.item.id} onDone={onChanged} />
      <DamageModal open={open === 'damage'} onClose={() => setOpen(null)} r={r} onDone={onChanged} />
    </>
  );
}

// ---------------- Check (C-01): Passed or Problem ----------------
export function CheckPanel({ r, onDone }: { r: ScanResult; onDone: (msg: string) => void }) {
  const qc = useQueryClient();
  const settings = useSettings();
  const { user } = useAuth();
  const [problem, setProblem] = useState(false);
  const pass = useMutation({
    mutationFn: () => api.items.qc(r.item.id, 'PASS'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['floor'] });
      onDone(`${r.item.tag} passed the check.`);
    },
  });
  const blocked = settings.data?.qc.independent && r.item.lastStageCompletedBy === user?.id;
  return (
    <div className="space-y-3">
      {blocked && <Alert tone="warning">{msg('INDEPENDENT_QC_REQUIRED')}</Alert>}
      <ErrorAlert error={pass.error} />
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-success min-h-16 text-lg" onClick={() => pass.mutate()} disabled={pass.isPending}>
          Passed
        </button>
        <button className="btn-danger min-h-16 text-lg" onClick={() => setProblem(true)}>
          Problem
        </button>
      </div>
      <ProblemSheet open={problem} onClose={() => setProblem(false)} r={r} onDone={(m) => { setProblem(false); onDone(m); }} />
    </div>
  );
}

/** Rework (stage + reason), Fail (reason) or Report damage. */
export function ProblemSheet({ open, onClose, r, onDone }: { open: boolean; onClose: () => void; r: ScanResult; onDone: (msg: string) => void }) {
  const qc = useQueryClient();
  const names = useNames();
  const stages = names.serviceType(r.item.serviceTypeId)?.stages ?? [];
  const [kind, setKind] = useState<'rework' | 'fail' | 'damage'>('rework');
  const [stage, setStage] = useState(stages[0] ?? '');
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const done = (m: string) => {
    void qc.invalidateQueries({ queryKey: ['floor'] });
    void qc.invalidateQueries({ queryKey: ['scan'] });
    setReason('');
    onDone(m);
  };
  const rework = useMutation({ mutationFn: () => api.items.rework(r.item.id, stage || stages[0], reason), onSuccess: () => done(`${r.item.tag} sent back to ${stageWord(stage || stages[0])}. Scan it into a load when you're ready.`) });
  const fail = useMutation({ mutationFn: () => api.items.qc(r.item.id, 'FAIL', reason), onSuccess: () => done(`${r.item.tag} marked as a problem. The Branch Manager can see it.`) });
  const damage = useMutation({ mutationFn: () => api.damage.create({ itemId: r.item.id, type: 'DAMAGE', description: reason, photo: photo ?? undefined }), onSuccess: () => done(`Damage on ${r.item.tag} reported to the Branch Manager.`) });
  const m = kind === 'rework' ? rework : kind === 'fail' ? fail : damage;
  const limitHit = errorCode(rework.error) === 'REWORK_LIMIT_REACHED';
  const canFail = r.item.status === 'PROCESSING_COMPLETE';
  return (
    <Modal open={open} onClose={onClose} title={`Problem with ${r.item.tag}`}>
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), m.mutate())} noValidate>
        <fieldset>
          <legend className="label">What should happen?</legend>
          <div className="grid gap-2">
            <label className={`btn cursor-pointer justify-start ${kind === 'rework' ? 'border-blue bg-sky' : ''}`}><input type="radio" className="sr-only" checked={kind === 'rework'} onChange={() => setKind('rework')} />Do it again (rework)</label>
            {canFail && <label className={`btn cursor-pointer justify-start ${kind === 'fail' ? 'border-blue bg-sky' : ''}`}><input type="radio" className="sr-only" checked={kind === 'fail'} onChange={() => setKind('fail')} />It can't be fixed here (fail)</label>}
            <label className={`btn cursor-pointer justify-start ${kind === 'damage' ? 'border-blue bg-sky' : ''}`}><input type="radio" className="sr-only" checked={kind === 'damage'} onChange={() => setKind('damage')} />It is damaged</label>
          </div>
        </fieldset>
        {kind === 'rework' && stages.length > 1 && (
          <Field label="Start again from">{(p) => <select {...p} className="input" value={stage} onChange={(e) => setStage(e.target.value)}>{stages.map((s) => <option key={s} value={s}>{StageWord(s)}</option>)}</select>}</Field>
        )}
        <Field label={kind === 'damage' ? 'Describe the damage' : 'Reason'} required error={errorField(m.error) === 'reason' || errorField(m.error) === 'description' ? errorMessage(m.error) : null}>
          {(p) => <input {...p} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'rework' ? 'e.g. stain still visible' : ''} />}
        </Field>
        {kind === 'damage' && (
          <>
            <PhotoInput id="problem-photo" label="Photo (optional)" value={photo} onChange={setPhoto} />
            {r.item.flags.filter((f) => f.stage === 'INTAKE').length > 0 && (
              <div className="rounded-[12px] bg-mist p-3 text-sm">
                <p className="font-semibold">Recorded at the counter</p>
                {r.item.flags.filter((f) => f.stage === 'INTAKE').map((f) => <p key={f.id}>{FLAG_LABEL[f.type]}{f.note ? `: ${f.note}` : ''}</p>)}
              </div>
            )}
          </>
        )}
        {limitHit && <Alert tone="warning">{errorMessage(rework.error)}</Alert>}
        {!limitHit && errorField(m.error) !== 'reason' && errorField(m.error) !== 'description' && <ErrorAlert error={m.error} />}
        <BigActionButton sticky={false} disabled={m.isPending}>
          {kind === 'rework' ? 'Send for rework' : kind === 'fail' ? 'Record problem' : 'Report damage'}
        </BigActionButton>
      </form>
    </Modal>
  );
}

// ---------------- Flag and damage modals (A-04, C-02) ----------------
const FLAG_TYPES: FlagType[] = ['STAIN', 'DAMAGE', 'DELICATE', 'NO_STARCH', 'COLOUR_RUN_RISK', 'OTHER'];

export function FlagModal({ open, onClose, itemId, onDone }: { open: boolean; onClose: () => void; itemId: string; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<FlagType>('STAIN');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.items.addFlag(itemId, { type, note: note || undefined, photo: photo ?? undefined, stage: 'FLOOR' }),
    onSuccess: () => {
      toast(`Flag added: ${FLAG_LABEL[type]}.`);
      onDone();
      onClose();
      setNote('');
      setPhoto(null);
    },
  });
  const damageMissing = type === 'DAMAGE' && !note.trim() && !photo;
  return (
    <Modal open={open} onClose={onClose} title="Add a care flag">
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
        <p className="text-sm text-slate">The new flag sits next to the counter's notes. It never changes them.</p>
        <Field label="Flag">{(p) => <select {...p} className="input" value={type} onChange={(e) => setType(e.target.value as FlagType)}>{FLAG_TYPES.map((t) => <option key={t} value={t}>{FLAG_LABEL[t]}</option>)}</select>}</Field>
        <Field label="Note" hint={damageMissing ? msg('MISSING_DAMAGE_NOTE') : undefined}>{(p) => <input {...p} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        <PhotoInput id="flag-photo" label="Photo (optional)" value={photo} onChange={setPhoto} />
        <ErrorAlert error={m.error} />
        <button className="btn-primary w-full" disabled={m.isPending || damageMissing}>Add flag</button>
      </form>
    </Modal>
  );
}

export function DamageModal({ open, onClose, r, onDone }: { open: boolean; onClose: () => void; r: ScanResult; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<'DAMAGE' | 'LOST'>('DAMAGE');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const intake = r.item.flags.filter((f) => f.stage === 'INTAKE');
  const m = useMutation({
    mutationFn: () => api.damage.create({ itemId: r.item.id, type, description, photo: photo ?? undefined }),
    onSuccess: () => {
      toast(`${type === 'LOST' ? 'Lost item' : 'Damage'} on ${r.item.tag} reported to the Branch Manager.`);
      onDone();
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={`Report damage or loss: ${r.item.tag}`} wide>
      <form className="grid gap-5 md:grid-cols-2" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
        <div className="space-y-4">
          <fieldset className="flex gap-2">
            <legend className="label">What happened?</legend>
            <label className={`btn flex-1 cursor-pointer ${type === 'DAMAGE' ? 'border-blue bg-sky' : ''}`}><input type="radio" className="sr-only" checked={type === 'DAMAGE'} onChange={() => setType('DAMAGE')} /> Damaged</label>
            <label className={`btn flex-1 cursor-pointer ${type === 'LOST' ? 'border-blue bg-sky' : ''}`}><input type="radio" className="sr-only" checked={type === 'LOST'} onChange={() => setType('LOST')} /> Lost</label>
          </fieldset>
          <Field label="Describe it" required>{(p) => <textarea {...p} className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
          <PhotoInput id="damage-photo" label="Photo (optional)" value={photo} onChange={setPhoto} />
          <ErrorAlert error={m.error} />
          <button className="btn-primary w-full" disabled={!description.trim() || m.isPending}>Send report</button>
        </div>
        <div className="rounded-[12px] border border-line bg-mist p-3 text-sm">
          {/* C-02: intake condition shown alongside, so pre-existing damage isn't blamed on processing */}
          <p className="font-semibold">Recorded at the counter</p>
          {intake.length === 0 && <p className="muted mt-1">Nothing was flagged at the counter.</p>}
          {intake.map((f) => (
            <div key={f.id} className="mt-2">
              <p><strong>{FLAG_LABEL[f.type]}</strong>{f.note ? `: ${f.note}` : ''}</p>
              <p className="text-slate">{f.by}, {dateTime(f.at)}</p>
              {f.photo && <img src={f.photo} alt="Photo taken at the counter" className="mt-1 max-h-40 rounded-[8px] border border-line" />}
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
