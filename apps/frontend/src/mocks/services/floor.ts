// Module B (sorting & processing), Module C (QC, damage, packaging), A-03 scan/reprint, A-04 flags
import type * as T from '@ldy/api-client';
import { state, fail, uid, iso, now, audit, nextNo, requireRole, notifyStaff, findOrder, type Ctx, type StoredUser } from '../store';
import { recompute, isOpen, contactOf } from './orders';
import { notifyCustomer } from './notifications';

const FLOOR: T.Role[] = ['ATTENDANT', 'MANAGER'];

export function locateTag(tag: string) {
  const t = tag.trim().toUpperCase();
  for (const o of state.orders) {
    if (!isOpen(o)) continue;
    const item = o.items.find((i) => i.tag === t && i.status !== 'CANCELLED');
    if (item) return { order: o, item };
  }
  return null;
}

function locateItem(itemId: string) {
  for (const o of state.orders) {
    const item = o.items.find((i) => i.id === itemId);
    if (item) return { order: o, item };
  }
  return fail(404, 'NOT_FOUND');
}

function packable(i: T.OrderItem) {
  return i.status === 'QC_PASSED' || i.status === 'PACKAGED' || i.status === 'DISCARDED';
}

export function scanResult(order: T.Order, item: T.OrderItem): T.ScanResult {
  const batch = item.batchId ? state.batches.find((b) => b.id === item.batchId) : undefined;
  let nextAction: T.ScanResult['nextAction'] = 'CLOSED';
  switch (item.status) {
    case 'RECEIVED':
      nextAction = 'SORT';
      break;
    case 'REWORK':
      nextAction = item.batchId ? 'IN_BATCH' : 'SORT';
      break;
    case 'IN_SORTING':
    case 'IN_PROCESSING':
      nextAction = 'IN_BATCH';
      break;
    case 'PROCESSING_COMPLETE':
      nextAction = 'QC';
      break;
    case 'QC_FAILED':
      nextAction = 'AWAIT_QC_RESOLUTION';
      break;
    case 'QC_PASSED':
      nextAction = order.items.every(packable) ? 'PACK' : 'WAITING_FOR_OTHER_ITEMS';
      break;
    case 'PACKAGED':
      nextAction = 'PACKAGED';
      break;
  }
  return { order, item, batch, nextAction, qcRequired: item.qcRequired };
}

export function scan(ctx: Ctx, tag: string) {
  requireRole(ctx, ['ATTENDANT', 'MANAGER', 'FRONT_DESK']);
  const hit = locateTag(tag);
  if (!hit) return fail(404, 'TAG_NOT_FOUND', 'tag');
  return scanResult(hit.order, hit.item);
}

export function reprint(ctx: Ctx, tag: string) {
  const u = requireRole(ctx, ['ATTENDANT', 'MANAGER', 'FRONT_DESK']);
  const hit = locateTag(tag);
  if (!hit) return fail(404, 'TAG_NOT_FOUND', 'tag');
  audit(u, 'OrderItem', hit.item.id, 'TAG_REPRINTED', undefined, { tag: hit.item.tag }, hit.order.orderNo);
  return { tag: hit.item.tag!, reprintedAt: iso() };
}

export function addFlag(ctx: Ctx, itemId: string, b: { type: T.FlagType; note?: string; photo?: string; stage: string }) {
  const u = requireRole(ctx, ['ATTENDANT', 'MANAGER', 'FRONT_DESK']);
  const { order, item } = locateItem(itemId);
  if (!b.type) fail(422, 'REQUIRED', 'type');
  if (b.type === 'DAMAGE' && !b.note?.trim() && !b.photo) fail(422, 'MISSING_DAMAGE_NOTE', 'note');
  // A-04: later flags are added alongside — they never alter the intake flag
  const f: T.ItemFlag = { id: uid('flg'), type: b.type, note: b.note?.trim() || undefined, photo: b.photo, stage: b.stage || 'FLOOR', by: u.name, at: iso() };
  item.flags.push(f);
  audit(u, 'OrderItem', item.id, 'FLAG_ADDED', undefined, { type: f.type, note: f.note, stage: f.stage }, order.orderNo);
  return item;
}

// ---------------- Batches (B-01, B-02, B-03) ----------------
function batchView(b: T.Batch): T.Batch {
  const stage = b.stages[b.currentStageIndex];
  const limit = state.settings.stageAlertHours * 3600_000;
  b.overdue = Boolean(stage?.startedAt && !stage.completedAt && now().getTime() - new Date(stage.startedAt).getTime() > limit);
  return b;
}

export function listBatches(ctx: Ctx, status?: string) {
  requireRole(ctx, ['ATTENDANT', 'MANAGER', 'AUDITOR']);
  return state.batches
    .filter((b) => (status ? b.status === status : b.status !== 'CANCELLED'))
    .map(batchView)
    .reverse();
}

export function getBatch(ctx: Ctx, id: string) {
  requireRole(ctx, ['ATTENDANT', 'MANAGER', 'AUDITOR']);
  const b = state.batches.find((x) => x.id === id);
  if (!b) return fail(404, 'NOT_FOUND');
  const items = b.itemIds.map((iid) => {
    const { order, item } = locateItem(iid);
    return { ...item, orderNo: order.orderNo };
  });
  return { ...batchView(b), items };
}

export function createBatch(ctx: Ctx, b: { serviceTypeId: string; colour?: T.Colour; fabric: T.Fabric; isRework?: boolean; fromStage?: string }) {
  const u = requireRole(ctx, FLOOR);
  return createBatchAs(u, b);
}

export function createBatchAs(u: StoredUser, b: { serviceTypeId: string; colour?: T.Colour; fabric: T.Fabric; isRework?: boolean; fromStage?: string }) {
  const st = state.serviceTypes.find((s) => s.id === b.serviceTypeId);
  if (!st) return fail(422, 'REQUIRED', 'serviceTypeId');
  const startIdx = b.fromStage ? Math.max(0, st.stages.indexOf(b.fromStage)) : 0;
  const batch: T.Batch = {
    id: uid('bat'),
    batchNo: nextNo('batch', 'B-', 4),
    serviceTypeId: st.id,
    colour: state.settings.batching.separateColours ? b.colour : undefined,
    fabric: b.fabric ?? 'REGULAR',
    attendantId: u.id,
    attendantName: u.name,
    itemIds: [],
    status: 'OPEN',
    stages: st.stages.slice(startIdx).map((name) => ({ name })),
    currentStageIndex: 0,
    isRework: Boolean(b.isRework),
    reworkStartIndex: startIdx,
    createdAt: iso(),
    overdue: false,
  };
  state.batches.push(batch);
  audit(u, 'Batch', batch.id, 'BATCH_CREATED', undefined, { serviceType: st.name, colour: batch.colour, fabric: batch.fabric, rework: batch.isRework }, batch.batchNo);
  return batch;
}

function findBatch(id: string) {
  const b = state.batches.find((x) => x.id === id || x.batchNo === id);
  if (!b) return fail(404, 'NOT_FOUND');
  return b;
}

export function addToBatch(ctx: Ctx, id: string, b: { tag: string }) {
  const u = requireRole(ctx, FLOOR);
  return addToBatchAs(u, id, b.tag);
}

export function addToBatchAs(u: StoredUser, id: string, tag: string) {
  const batch = findBatch(id);
  if (batch.status !== 'OPEN') fail(409, 'BATCH_ALREADY_STARTED');
  const hit = locateTag(tag);
  if (!hit) return fail(404, 'TAG_NOT_FOUND', 'tag');
  const { order, item } = hit;
  if (batch.itemIds.includes(item.id)) return batch; // NFR-R2 idempotent scan
  if (item.status !== 'RECEIVED' && !(item.status === 'REWORK' && !item.batchId)) fail(409, 'ITEM_NOT_READY_FOR_SORTING', 'tag', { status: item.status });
  const st = state.serviceTypes.find((s) => s.id === batch.serviceTypeId)!;
  const itemSt = state.serviceTypes.find((s) => s.id === item.serviceTypeId)!;
  const mismatches: string[] = [];
  if (item.serviceTypeId !== batch.serviceTypeId) mismatches.push(`service type is ${itemSt.name}, batch is ${st.name}`);
  const set = state.settings.batching;
  if (set.separateColours && batch.colour && item.colour !== batch.colour) mismatches.push(`colour is ${item.colour.toLowerCase()}, batch is ${batch.colour.toLowerCase()}`);
  if (set.separateDelicates && item.fabric !== batch.fabric) mismatches.push(`fabric is ${item.fabric.toLowerCase()}, batch is ${batch.fabric.toLowerCase()}`);
  if (item.status === 'REWORK') {
    if (!batch.isRework || batch.stages[0]?.name !== item.reworkStage) mismatches.push(`item needs a rework batch starting at ${item.reworkStage}`);
  } else if (batch.isRework) mismatches.push('this is a rework batch');
  if (mismatches.length) fail(422, 'INCOMPATIBLE_BATCH', 'tag', { mismatch: mismatches.join('; ') });
  batch.itemIds.push(item.id);
  item.batchId = batch.id;
  if (item.status === 'RECEIVED') item.status = 'IN_SORTING';
  recompute(order);
  audit(u, 'OrderItem', item.id, 'ADDED_TO_BATCH', undefined, { batch: batch.batchNo, tag: item.tag }, order.orderNo);
  return batch;
}

// ---------------- Automatic loads (REDESIGN §9.2, D27) ----------------
function fits(batch: T.Batch, item: T.OrderItem) {
  if (batch.status !== 'OPEN' || batch.serviceTypeId !== item.serviceTypeId) return false;
  const set = state.settings.batching;
  if (set.separateColours && batch.colour && batch.colour !== item.colour) return false;
  if (set.separateDelicates && batch.fabric !== item.fabric) return false;
  if (item.status === 'REWORK') return batch.isRework && batch.stages[0]?.name === item.reworkStage;
  return !batch.isRework;
}

/** Scan an item: it joins the right open load, or a new load is made for it. B-01 rules still apply. */
export function scanIntoLoad(ctx: Ctx, b: { tag: string }) {
  const u = requireRole(ctx, FLOOR);
  const hit = locateTag(b.tag ?? '');
  if (!hit) return fail(404, 'TAG_NOT_FOUND', 'tag');
  const { item } = hit;
  if (item.batchId) {
    const current = state.batches.find((x) => x.id === item.batchId)!;
    return { batch: batchView(current), created: false, alreadyIn: true, tag: item.tag! }; // NFR-R2 idempotent
  }
  if (item.status !== 'RECEIVED' && item.status !== 'REWORK') fail(409, 'ITEM_NOT_READY_FOR_SORTING', 'tag', { status: item.status });
  let batch = state.batches.find((x) => fits(x, item));
  const created = !batch;
  if (!batch) batch = createBatchAs(u, { serviceTypeId: item.serviceTypeId, colour: item.colour, fabric: item.fabric, isRework: item.status === 'REWORK', fromStage: item.status === 'REWORK' ? item.reworkStage : undefined });
  addToBatchAs(u, batch.id, item.tag!);
  return { batch: batchView(batch), created, alreadyIn: false, tag: item.tag! };
}

export function floorQueue(ctx: Ctx): T.FloorQueue {
  requireRole(ctx, ['ATTENDANT', 'MANAGER', 'AUDITOR']);
  const q: T.FloorQueue = { toSort: 0, readyForCheck: [], failed: [], readyToPack: [] };
  for (const o of state.orders) {
    if (!isOpen(o) || o.status === 'DRAFT') continue;
    for (const i of o.items) {
      if (i.status === 'RECEIVED' || (i.status === 'REWORK' && !i.batchId)) q.toSort += 1;
      if (i.status === 'PROCESSING_COMPLETE')
        q.readyForCheck.push({ itemId: i.id, tag: i.tag!, orderId: o.id, orderNo: o.orderNo, serviceTypeId: i.serviceTypeId, categoryId: i.categoryId, quantity: i.quantity, weightKg: i.weightKg, flags: i.flags.length, express: o.speed === 'EXPRESS' });
      if (i.status === 'QC_FAILED') q.failed.push({ itemId: i.id, tag: i.tag!, orderId: o.id, orderNo: o.orderNo, needsManagerReview: i.needsManagerReview });
    }
    const active = o.items.filter((i) => i.status !== 'DISCARDED' && i.status !== 'CANCELLED');
    if (active.length && active.every((i) => i.status === 'QC_PASSED') )
      q.readyToPack.push({ orderId: o.id, orderNo: o.orderNo, items: active.length, checked: active.filter((i) => i.checkedOff).length, express: o.speed === 'EXPRESS', delivery: o.deliveryFlag });
  }
  // express first, then oldest (array order is creation order)
  q.readyForCheck.sort((a, b) => Number(b.express) - Number(a.express));
  q.readyToPack.sort((a, b) => Number(b.express) - Number(a.express));
  return q;
}

export function removeFromBatch(ctx: Ctx, id: string, itemId: string) {
  const u = requireRole(ctx, FLOOR);
  const batch = findBatch(id);
  if (batch.status !== 'OPEN') fail(409, 'BATCH_ALREADY_STARTED');
  const { order, item } = locateItem(itemId);
  batch.itemIds = batch.itemIds.filter((x) => x !== itemId);
  item.batchId = undefined;
  if (item.status === 'IN_SORTING') item.status = 'RECEIVED';
  recompute(order);
  audit(u, 'OrderItem', item.id, 'REMOVED_FROM_BATCH', { batch: batch.batchNo }, undefined, order.orderNo);
  return batch;
}

export function assignMachine(ctx: Ctx, id: string, b: { machineId: string }) {
  const u = requireRole(ctx, FLOOR);
  return assignMachineAs(u, id, b.machineId);
}

export function assignMachineAs(u: StoredUser, id: string, machineId: string) {
  const batch = findBatch(id);
  if (batch.status === 'PROCESSING_COMPLETE' || batch.status === 'CANCELLED') fail(409, 'BATCH_CLOSED');
  const m = state.machines.find((x) => x.id === machineId);
  if (!m) return fail(404, 'NOT_FOUND');
  if (batch.machineId === m.id) return batch;
  if (m.status !== 'AVAILABLE') fail(409, 'MACHINE_UNAVAILABLE', 'machineId');
  const prev = batch.machineId ? state.machines.find((x) => x.id === batch.machineId) : undefined;
  if (prev && prev.currentBatchId === batch.id) {
    prev.status = 'AVAILABLE';
    prev.currentBatchId = undefined;
  }
  batch.machineId = m.id;
  m.status = 'IN_USE';
  m.currentBatchId = batch.id;
  audit(u, 'Batch', batch.id, 'MACHINE_ASSIGNED', prev ? { machine: prev.name } : undefined, { machine: m.name }, batch.batchNo);
  audit(u, 'Machine', m.id, 'MACHINE_IN_USE', { status: 'AVAILABLE' }, { status: 'IN_USE', batch: batch.batchNo }, m.name);
  return batch;
}

function forItems(batch: T.Batch, fn: (o: T.Order, i: T.OrderItem) => void) {
  const touched = new Set<T.Order>();
  for (const iid of batch.itemIds) {
    const { order, item } = locateItem(iid);
    fn(order, item);
    touched.add(order);
  }
  touched.forEach((o) => recompute(o));
}

export function startStage(ctx: Ctx, id: string) {
  const u = requireRole(ctx, FLOOR);
  return startStageAs(u, id);
}

export function startStageAs(u: StoredUser, id: string) {
  const batch = findBatch(id);
  if (!batch.itemIds.length) fail(422, 'EMPTY_BATCH');
  if (batch.status === 'PROCESSING_COMPLETE') fail(409, 'BATCH_CLOSED');
  const stage = batch.stages[batch.currentStageIndex];
  if (stage.startedAt) return batch; // idempotent (NFR-R2)
  stage.startedAt = iso();
  stage.startedBy = u.name;
  batch.status = 'IN_PROCESSING';
  forItems(batch, (_o, item) => {
    item.status = 'IN_PROCESSING';
    item.stageLog.push({ stage: stage.name, batchId: batch.id, startedAt: stage.startedAt, startedBy: u.name, rework: batch.isRework });
  });
  audit(u, 'Batch', batch.id, 'STAGE_STARTED', undefined, { stage: stage.name }, batch.batchNo);
  return batchView(batch);
}

function applySampling(batch: T.Batch) {
  const q = state.settings.qc;
  if (q.mode !== 'SAMPLE') return;
  // TODO(OPEN_QUESTIONS #9): confirm how the sample is chosen. Interim rule: the first ceil(n × %) items scanned in.
  const n = Math.max(1, Math.ceil((batch.itemIds.length * q.samplePercent) / 100));
  batch.itemIds.forEach((iid, idx) => {
    const { item } = locateItem(iid);
    item.qcRequired = idx < n;
  });
}

export function completeStage(ctx: Ctx, id: string) {
  const u = requireRole(ctx, FLOOR);
  return completeStageAs(u, id);
}

export function completeStageAs(u: StoredUser, id: string) {
  const batch = findBatch(id);
  if (batch.status === 'PROCESSING_COMPLETE') fail(409, 'BATCH_CLOSED');
  const stage = batch.stages[batch.currentStageIndex];
  if (!stage.startedAt) fail(409, 'STAGE_OUT_OF_SEQUENCE');
  stage.completedAt = iso();
  stage.completedBy = u.name;
  forItems(batch, (_o, item) => {
    const log = [...item.stageLog].reverse().find((l) => l.stage === stage.name && l.batchId === batch.id);
    if (log) {
      log.completedAt = stage.completedAt;
      log.completedBy = u.name;
    }
  });
  audit(u, 'Batch', batch.id, 'STAGE_COMPLETED', undefined, { stage: stage.name }, batch.batchNo);
  const isLast = batch.currentStageIndex >= batch.stages.length - 1;
  if (!isLast) {
    // D20 / OQ20: the next stage is lined up immediately, but its clock starts only when the attendant taps Start,
    // so waiting time between machines isn't counted as working time.
    batch.currentStageIndex += 1;
    return batchView(batch);
  }
  batch.status = 'PROCESSING_COMPLETE';
  const m = batch.machineId ? state.machines.find((x) => x.id === batch.machineId) : undefined;
  if (m && m.currentBatchId === batch.id) {
    const first = batch.stages[0].startedAt ? new Date(batch.stages[0].startedAt).getTime() : now().getTime();
    m.minutesInUse += Math.round((now().getTime() - first) / 60000);
    m.status = 'AVAILABLE';
    m.currentBatchId = undefined;
    audit(u, 'Machine', m.id, 'MACHINE_RELEASED', { status: 'IN_USE' }, { status: 'AVAILABLE' }, m.name);
  }
  applySampling(batch);
  forItems(batch, (order, item) => {
    item.lastStageCompletedBy = u.id;
    item.batchId = undefined;
    if (item.qcRequired) item.status = 'PROCESSING_COMPLETE';
    else {
      item.status = 'QC_PASSED';
      item.qc.push({ outcome: 'PASS', reason: 'Not in QC sample', by: 'system', byName: 'System (sampling)', at: iso() });
      audit(null, 'OrderItem', item.id, 'QC_NOT_SAMPLED', undefined, { tag: item.tag }, order.orderNo);
    }
  });
  audit(u, 'Batch', batch.id, 'PROCESSING_COMPLETE', undefined, undefined, batch.batchNo);
  return batchView(batch);
}

// ---------------- QC (C-01) & rework (B-04) ----------------
export function qc(ctx: Ctx, itemId: string, b: { outcome: 'PASS' | 'FAIL'; reason?: string }) {
  const u = requireRole(ctx, FLOOR);
  return qcAs(u, itemId, b);
}

export function qcAs(u: StoredUser, itemId: string, b: { outcome: 'PASS' | 'FAIL'; reason?: string }) {
  const { order, item } = locateItem(itemId);
  if (item.status !== 'PROCESSING_COMPLETE') fail(409, 'ITEM_NOT_READY_FOR_QC', undefined, { status: item.status });
  if (state.settings.qc.independent && item.lastStageCompletedBy === u.id) fail(403, 'INDEPENDENT_QC_REQUIRED');
  if (b.outcome === 'FAIL' && !b.reason?.trim()) fail(422, 'QC_REASON_REQUIRED', 'reason');
  item.qc.push({ outcome: b.outcome, reason: b.reason?.trim() || undefined, by: u.id, byName: u.name, at: iso() });
  item.status = b.outcome === 'PASS' ? 'QC_PASSED' : 'QC_FAILED';
  recompute(order);
  audit(u, 'OrderItem', item.id, `QC_${b.outcome}`, { status: 'PROCESSING_COMPLETE' }, { status: item.status, reason: b.reason }, order.orderNo);
  return scanResult(order, item);
}

export function rework(ctx: Ctx, itemId: string, b: { stage: string; reason: string }) {
  const u = requireRole(ctx, FLOOR);
  return reworkAs(u, itemId, b);
}

export function reworkAs(u: StoredUser, itemId: string, b: { stage: string; reason: string }) {
  const { order, item } = locateItem(itemId);
  if (!['PROCESSING_COMPLETE', 'QC_FAILED'].includes(item.status)) fail(409, 'ITEM_NOT_READY_FOR_QC', undefined, { status: item.status });
  if (!b.reason?.trim()) fail(422, 'MISSING_REWORK_REASON', 'reason');
  const st = state.serviceTypes.find((s) => s.id === item.serviceTypeId)!;
  if (!st.stages.includes(b.stage)) fail(422, 'REQUIRED', 'stage');
  if (item.reworkCount >= state.settings.reworkLimit && !item.overrideApproved) {
    // B-04: flagged for Branch Manager review instead of being reprocessed again automatically
    if (!item.needsManagerReview) {
      item.needsManagerReview = true;
      if (item.status === 'PROCESSING_COMPLETE') item.status = 'QC_FAILED';
      const a: T.ApprovalRequest = {
        id: uid('apr'), kind: 'REWORK_REVIEW', orderId: order.id, orderNo: order.orderNo, itemId: item.id, tag: item.tag,
        reason: `Rework limit (${state.settings.reworkLimit}) reached. Latest reason: ${b.reason} (wants ${b.stage})`,
        requestedBy: u.id, requestedByName: u.name, requestedAt: iso(), status: 'PENDING',
      };
      state.approvals.push(a);
      audit(u, 'OrderItem', item.id, 'REWORK_LIMIT_REACHED', undefined, { reworkCount: item.reworkCount }, order.orderNo);
      notifyStaff({ role: 'MANAGER' }, `Item ${item.tag} (${order.orderNo}) reached the rework limit`, '/staff/approvals');
      recompute(order);
    }
    return fail(409, 'REWORK_LIMIT_REACHED', undefined, { limit: state.settings.reworkLimit });
  }
  item.qc.push({ outcome: 'REWORK', reason: b.reason.trim(), by: u.id, byName: u.name, at: iso() });
  item.reworkCount += 1;
  item.reworkStage = b.stage;
  item.status = 'REWORK';
  item.batchId = undefined;
  item.overrideApproved = false;
  recompute(order);
  // original stage history is kept; the rework entries are appended and marked rework: true
  audit(u, 'OrderItem', item.id, 'SENT_FOR_REWORK', undefined, { stage: b.stage, reason: b.reason, reworkCount: item.reworkCount }, order.orderNo);
  return scanResult(order, item);
}

export function requestQcOverride(ctx: Ctx, itemId: string, b: { reason: string }) {
  const u = requireRole(ctx, FLOOR);
  const { order, item } = locateItem(itemId);
  if (item.status !== 'QC_FAILED') fail(409, 'ITEM_NOT_FAILED');
  if (!b.reason?.trim()) fail(422, 'REQUIRED', 'reason');
  if (state.approvals.some((a) => a.itemId === item.id && a.kind === 'QC_OVERRIDE' && a.status === 'PENDING')) fail(409, 'ALREADY_REQUESTED');
  const a: T.ApprovalRequest = {
    id: uid('apr'), kind: 'QC_OVERRIDE', orderId: order.id, orderNo: order.orderNo, itemId: item.id, tag: item.tag,
    reason: b.reason.trim(), requestedBy: u.id, requestedByName: u.name, requestedAt: iso(), status: 'PENDING',
  };
  state.approvals.push(a);
  audit(u, 'Approval', a.id, 'QC_OVERRIDE_REQUESTED', undefined, { tag: item.tag, reason: a.reason }, order.orderNo);
  notifyStaff({ role: 'MANAGER' }, `QC override requested for ${item.tag} (${order.orderNo})`, '/staff/approvals');
  return a;
}

export function discard(ctx: Ctx, itemId: string, b: { reason: string }) {
  const u = requireRole(ctx, ['MANAGER']);
  const { order, item } = locateItem(itemId);
  if (item.status !== 'QC_FAILED') fail(409, 'ITEM_NOT_FAILED');
  if (!b.reason?.trim()) fail(422, 'REQUIRED', 'reason');
  item.status = 'DISCARDED';
  item.needsManagerReview = false;
  recompute(order);
  audit(u, 'OrderItem', item.id, 'ITEM_DISCARDED', { status: 'QC_FAILED' }, { status: 'DISCARDED', reason: b.reason }, order.orderNo);
  notifyCustomer('DAMAGE_NOTICE', contactOf(order), {
    message: `Hi ${order.customerName}, item ${item.tag} on order ${order.orderNo} could not be restored and has been set aside: ${b.reason}. Please contact the branch.`,
    reference: order.orderNo,
  }, order.orderNo);
  return scanResult(order, item);
}

// ---------------- Damage & loss (C-02) ----------------
export function listDamage(ctx: Ctx, status?: string) {
  requireRole(ctx, ['MANAGER', 'ATTENDANT', 'AUDITOR', 'FRONT_DESK']);
  return state.damage.filter((d) => !status || d.status === status).slice().reverse();
}

export function createDamage(ctx: Ctx, b: { itemId: string; type: 'DAMAGE' | 'LOST'; description: string; photo?: string }) {
  const u = requireRole(ctx, FLOOR);
  return createDamageAs(u, b);
}

export function createDamageAs(u: StoredUser, b: { itemId: string; type: 'DAMAGE' | 'LOST'; description: string; photo?: string }) {
  const { order, item } = locateItem(b.itemId);
  if (!b.description?.trim()) fail(422, 'REQUIRED', 'description');
  const r: T.DamageReport = {
    id: uid('dmg'),
    orderId: order.id,
    orderNo: order.orderNo,
    itemId: item.id,
    tag: item.tag,
    type: b.type,
    description: b.description.trim(),
    photo: b.photo,
    intakeFlags: item.flags.filter((f) => f.stage === 'INTAKE'), // shown side by side for comparison
    reportedBy: u.id,
    reportedByName: u.name,
    createdAt: iso(),
    status: 'OPEN',
    customerMessage: `Dear ${order.customerName}, during processing of order ${order.orderNo} we found ${
      b.type === 'LOST' ? 'that an item (tag ' + item.tag + ') cannot be located' : 'damage on item ' + item.tag
    }. Our Branch Manager is reviewing it and will contact you.`,
    customerMessageSent: false,
  };
  state.damage.push(r);
  audit(u, 'DamageReport', r.id, `${b.type}_REPORTED`, undefined, { tag: item.tag, description: r.description }, order.orderNo);
  notifyStaff({ role: 'MANAGER' }, `${b.type === 'LOST' ? 'Lost item' : 'Damage'} reported on ${item.tag} (${order.orderNo})`, '/staff/approvals?tab=damage');
  return r;
}

export function resolveDamage(ctx: Ctx, id: string, b: { resolution?: T.DamageResolution; note?: string; customerMessage: string }) {
  const u = requireRole(ctx, ['MANAGER']);
  const r = state.damage.find((x) => x.id === id);
  if (!r) return fail(404, 'NOT_FOUND');
  if (r.status === 'CLOSED') fail(409, 'ALREADY_CLOSED');
  if (!b.resolution) fail(422, 'RESOLUTION_REQUIRED', 'resolution');
  if (!b.customerMessage?.trim()) fail(422, 'REQUIRED', 'customerMessage');
  r.resolution = b.resolution;
  r.resolutionNote = b.note;
  r.resolvedBy = u.name;
  r.resolvedAt = iso();
  r.status = 'CLOSED';
  r.customerMessage = b.customerMessage.trim();
  r.customerMessageSent = true;
  const order = findOrder(r.orderId);
  notifyCustomer('DAMAGE_NOTICE', contactOf(order), { message: r.customerMessage, reference: order.orderNo }, order.orderNo);
  audit(u, 'DamageReport', r.id, 'DAMAGE_RESOLVED', { status: 'OPEN' }, { status: 'CLOSED', resolution: r.resolution, note: r.resolutionNote }, r.orderNo);
  return r;
}

// ---------------- Packaging (C-03) ----------------
export function manifest(ctx: Ctx, orderId: string) {
  requireRole(ctx, FLOOR);
  return findOrder(orderId);
}

export function checkManifest(ctx: Ctx, orderId: string, b: { tag: string; shelf?: string }) {
  const u = requireRole(ctx, FLOOR);
  return checkManifestAs(u, orderId, b);
}

export function checkManifestAs(u: StoredUser, orderId: string, b: { tag: string; shelf?: string }) {
  const order = findOrder(orderId);
  if (!['QC_PASSED', 'IN_PROCESSING', 'QC_FAILED'].includes(order.status) && order.status !== 'PACKAGED') fail(409, 'ORDER_NOT_READY');
  const item = order.items.find((i) => i.tag === b.tag.trim().toUpperCase() && i.status !== 'DISCARDED' && i.status !== 'CANCELLED');
  if (!item) return fail(404, 'TAG_NOT_ON_MANIFEST', 'tag');
  if (item.status !== 'QC_PASSED' && item.status !== 'PACKAGED') fail(409, 'QC_NOT_PASSED', 'tag', { tag: item.tag });
  if (!item.checkedOff) {
    item.checkedOff = true;
    audit(u, 'OrderItem', item.id, 'MANIFEST_CHECKED', undefined, { tag: item.tag }, order.orderNo);
  }
  const active = order.items.filter((i) => i.status !== 'DISCARDED' && i.status !== 'CANCELLED');
  if (active.every((i) => i.checkedOff) && b.shelf?.trim()) {
    // C-03 AC1: when the last one is checked, the order automatically updates to Packaged
    return packageOrder(u, order, b.shelf.trim());
  }
  return order;
}

export function finalisePackage(ctx: Ctx, orderId: string, b: { shelf: string }) {
  const u = requireRole(ctx, FLOOR);
  const order = findOrder(orderId);
  return packageOrder(u, order, b.shelf);
}

function packageOrder(u: StoredUser, order: T.Order, shelf: string) {
  if (!shelf?.trim()) fail(422, 'SHELF_REQUIRED', 'shelf');
  const active = order.items.filter((i) => i.status !== 'DISCARDED' && i.status !== 'CANCELLED');
  const notPassed = active.filter((i) => i.status !== 'QC_PASSED' && i.status !== 'PACKAGED');
  if (notPassed.length) fail(409, 'QC_NOT_PASSED', undefined, { tags: notPassed.map((i) => i.tag) });
  const missing = active.filter((i) => !i.checkedOff);
  if (missing.length) fail(409, 'INCOMPLETE_MANIFEST', undefined, { missing: missing.map((i) => i.tag) });
  active.forEach((i) => (i.status = 'PACKAGED'));
  order.shelf = shelf.trim();
  recompute(order);
  audit(u, 'Order', order.id, 'ORDER_PACKAGED', undefined, { shelf: order.shelf, items: active.map((i) => i.tag) }, order.orderNo);
  // D-01: exactly one automatic notification per order, in the same action
  if (!order.readyNotifiedAt) {
    order.readyNotifiedAt = iso();
    const cur = state.settings.organisation.currency;
    if (order.deliveryFlag) notifyCustomer('PACKED_FOR_DELIVERY', contactOf(order), { reference: order.orderNo }, order.orderNo);
    else notifyCustomer('READY_FOR_PICKUP', contactOf(order), { reference: order.orderNo, shelf: order.shelf, balance: `${cur} ${order.balance.toFixed(2)}` }, order.orderNo);
    audit(null, 'Order', order.id, 'READY_NOTIFICATION_SENT', undefined, { deliveryFlag: order.deliveryFlag }, order.orderNo);
  }
  return order;
}
