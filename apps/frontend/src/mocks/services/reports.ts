// F-01 Dashboards & reporting, F-02 Audit trail, manager inbox, customer portal, F-06 import, scheduled rules
import type * as T from '@ldy/api-client';
import { state, fail, iso, now, audit, round2, requireRole, requireUser, notifyStaff, type Ctx } from '../store';
import { contactOf, customerTimeline, createCustomerRecord, normalisePhone, validPhone } from './orders';
import { notifyCustomer } from './notifications';
import { listBatches } from './floor';
import { publicUser } from '../store';
import { STAFF_ROLES } from '@ldy/api-client';
import { createMachine, upsertPrice } from './config';
import { uid } from '../store';

// ---------------- Scheduled jobs (SRS §2.6: reminders, escalations) ----------------
export function tick() {
  const s = state.settings;
  for (const o of state.orders) {
    if (o.status !== 'READY_FOR_PICKUP' || !o.readyNotifiedAt) continue;
    const days = Math.floor((now().getTime() - new Date(o.readyNotifiedAt).getTime()) / 86400_000);
    for (const d of s.handover.reminderDays) {
      if (days >= d && !o.remindersSent.includes(d)) {
        o.remindersSent.push(d);
        notifyCustomer('UNCOLLECTED_REMINDER', contactOf(o), { reference: o.orderNo, days: String(d), disposalDays: String(s.handover.disposalDays) }, o.orderNo);
        audit(null, 'Order', o.id, 'REMINDER_SENT', undefined, { day: d }, o.orderNo);
      }
    }
  }
  for (const b of state.batches) {
    const st = b.stages[b.currentStageIndex];
    if (!st?.startedAt || st.completedAt || b.status !== 'IN_PROCESSING') continue;
    const key = `${b.id}:${b.currentStageIndex}`;
    if (now().getTime() - new Date(st.startedAt).getTime() > s.stageAlertHours * 3600_000 && !state.alertedBatches.includes(key)) {
      state.alertedBatches.push(key);
      notifyStaff({ role: 'MANAGER' }, `Batch ${b.batchNo} has been in ${st.name} for over ${s.stageAlertHours} h`, '/staff/batches');
      audit(null, 'Batch', b.id, 'STAGE_DELAY_ALERT', undefined, { stage: st.name }, b.batchNo);
    }
  }
}

// ---------------- Manager inbox ----------------
export function inbox(ctx: Ctx): T.InboxSummary {
  requireRole(ctx, ['MANAGER']);
  const s = state.settings.handover;
  const age = (o: T.Order) => (now().getTime() - new Date(o.readyNotifiedAt ?? o.createdAt).getTime()) / 86400_000;
  const ready = state.orders.filter((o) => o.status === 'READY_FOR_PICKUP' && o.readyNotifiedAt);
  return {
    overdueBatches: listBatches(ctx).filter((b) => b.overdue),
    openDamage: state.damage.filter((d) => d.status === 'OPEN'),
    pendingApprovals: state.approvals.filter((a) => a.status === 'PENDING'),
    uncollected: ready.filter((o) => age(o) >= s.managerFlagDays && age(o) < s.disposalDays),
    disposable: ready.filter((o) => age(o) >= s.disposalDays),
    flaggedCashups: state.cashups.filter((c) => c.status === 'FLAGGED'),
    failedNotifications: state.notificationLog.filter((n) => n.status === 'FAILED').slice(-20),
  };
}

// ---------------- Dashboard (F-01) ----------------
function inRange(isoDate: string | undefined, from: string, to: string) {
  if (!isoDate) return false;
  const d = isoDate.slice(0, 10);
  return d >= from && d <= to;
}

export function dashboard(ctx: Ctx, from: string, to: string): T.DashboardData {
  requireRole(ctx, ['MANAGER', 'AUDITOR', 'FRONT_DESK']);
  const orders = state.orders.filter((o) => o.status !== 'DRAFT');
  const payments = orders.flatMap((o) => o.payments.map((p) => ({ ...p, order: o })));
  const inPeriod = payments.filter((p) => inRange(p.at, from, to));
  const revenue = round2(inPeriod.filter((p) => p.kind === 'PAYMENT').reduce((a, p) => a + p.amount, 0));
  const refunds = round2(inPeriod.filter((p) => p.kind === 'REFUND').reduce((a, p) => a + p.amount, 0));
  const completed = orders.filter((o) => inRange(o.collectedAt ?? o.deliveredAt, from, to));
  const turnaround = orders
    .filter((o) => o.finalisedAt && o.readyNotifiedAt && inRange(o.readyNotifiedAt, from, to))
    .map((o) => ({
      hours: (new Date(o.readyNotifiedAt!).getTime() - new Date(o.finalisedAt!).getTime()) / 3600_000,
      onTime: o.expectedReadyBy ? new Date(o.readyNotifiedAt!) <= new Date(o.expectedReadyBy) : true,
    }));
  const days: { date: string; revenue: number }[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`) && days.length < 92; d = new Date(d.getTime() + 86400_000)) {
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, revenue: round2(inPeriod.filter((p) => p.kind === 'PAYMENT' && p.at.slice(0, 10) === key).reduce((a, p) => a + p.amount, 0)) });
  }
  const bySvc = new Map<string, number>();
  for (const o of orders.filter((x) => inRange(x.finalisedAt, from, to))) {
    for (const i of o.items) {
      const n = state.serviceTypes.find((s) => s.id === i.serviceTypeId)?.name ?? '—';
      bySvc.set(n, round2((bySvc.get(n) ?? 0) + (i.lineTotal ?? 0)));
    }
  }
  const periodMinutes = Math.max(1, ((new Date(`${to}T23:59:59Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 60000) * (10 / 24)); // assume 10 operating hours a day
  const deliveries = orders.filter((o) => o.deliveryFlag && (inRange(o.deliveredAt, from, to) || o.failedDeliveries.some((f) => inRange(f.at, from, to))));
  const delivered = deliveries.filter((o) => o.deliveredAt).length;
  const attempts = delivered + deliveries.reduce((a, o) => a + o.failedDeliveries.filter((f) => inRange(f.at, from, to)).length, 0);
  const itemsInPeriod = orders.filter((o) => inRange(o.finalisedAt, from, to)).reduce((a, o) => a + o.items.length, 0);
  const damageInPeriod = state.damage.filter((d) => inRange(d.createdAt, from, to)).length;
  const byMethod: T.MethodTotals = { CASH: 0, CARD: 0, MOMO: 0 };
  inPeriod.forEach((p) => (byMethod[p.method] = round2(byMethod[p.method] + (p.kind === 'PAYMENT' ? p.amount : -p.amount))));
  const today = now().toISOString().slice(0, 10);
  const stageMap = new Map<string, { total: number; count: number }>();
  for (const b of state.batches)
    for (const st of b.stages)
      if (st.startedAt && st.completedAt && inRange(st.completedAt, from, to)) {
        const m = (new Date(st.completedAt).getTime() - new Date(st.startedAt).getTime()) / 60000;
        const cur = stageMap.get(st.name) ?? { total: 0, count: 0 };
        stageMap.set(st.name, { total: cur.total + m, count: cur.count + 1 });
      }
  return {
    stageAverages: [...stageMap.entries()].map(([stage, v]) => ({ stage, minutes: Math.round(v.total / v.count), count: v.count })),
    from,
    to,
    ordersReceived: orders.filter((o) => inRange(o.finalisedAt, from, to)).length,
    ordersCompleted: completed.length,
    revenue,
    refunds,
    avgTurnaroundHours: turnaround.length ? round2(turnaround.reduce((a, t) => a + t.hours, 0) / turnaround.length) : null,
    onTimeRate: turnaround.length ? round2((turnaround.filter((t) => t.onTime).length / turnaround.length) * 100) : null,
    damageRate: itemsInPeriod ? round2((damageInPeriod / itemsInPeriod) * 100) : 0,
    deliverySuccessRate: attempts ? round2((delivered / attempts) * 100) : null,
    revenueByDay: days,
    revenueByService: [...bySvc.entries()].map(([service, r]) => ({ service, revenue: r })),
    machineUtilisation: state.machines.map((m) => ({ machine: m.name, percent: Math.min(100, round2((m.minutesInUse / periodMinutes) * 100)) })),
    paymentsByMethod: byMethod,
    intakeToday: orders.filter((o) => o.finalisedAt?.slice(0, 10) === today).length,
  };
}

function csv(rows: (string | number | undefined)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function exportReport(ctx: Ctx, type: string, b: { from: string; to: string }) {
  const u = requireRole(ctx, ['MANAGER', 'AUDITOR', 'FRONT_DESK']);
  const { from, to } = b;
  const orders = state.orders.filter((o) => o.status !== 'DRAFT');
  let rows: (string | number | undefined)[][] = [];
  if (type === 'revenue' || type === 'accounting') {
    rows = [['date', 'order', 'receipt', 'type', 'method', 'reference', 'amount', 'captured_by']];
    for (const o of orders) for (const p of o.payments) if (inRange(p.at, from, to)) rows.push([p.at, o.orderNo, p.receiptNo, p.kind, p.method, p.reference, p.kind === 'REFUND' ? -p.amount : p.amount, p.byName]);
    if (type === 'accounting') {
      rows.push([]);
      rows.push(['cash-up date', 'officer', 'status', 'expected_cash', 'counted_cash', 'variance_cash', 'expected_card', 'counted_card', 'expected_momo', 'counted_momo']);
      for (const c of state.cashups.filter((x) => x.date >= from && x.date <= to))
        rows.push([c.date, c.officerName, c.status, c.expected.CASH, c.counted?.CASH, c.variance?.CASH, c.expected.CARD, c.counted?.CARD, c.expected.MOMO, c.counted?.MOMO]);
    }
  } else if (type === 'orders') {
    rows = [['order', 'created', 'status', 'speed', 'items', 'total', 'paid', 'balance', 'ready_by', 'ready_at', 'closed_at']];
    for (const o of orders.filter((x) => inRange(x.createdAt, from, to)))
      rows.push([o.orderNo, o.createdAt, o.status, o.speed, o.items.length, o.invoice?.total, o.amountPaid, o.balance, o.expectedReadyBy, o.readyNotifiedAt, o.collectedAt ?? o.deliveredAt]);
  } else if (type === 'machines') {
    rows = [['machine', 'type', 'status', 'minutes_in_use']];
    for (const m of state.machines) rows.push([m.name, m.type, m.status, m.minutesInUse]);
  } else if (type === 'damage') {
    rows = [['report', 'order', 'tag', 'type', 'reported', 'status', 'resolution']];
    for (const d of state.damage.filter((x) => inRange(x.createdAt, from, to))) rows.push([d.id, d.orderNo, d.tag, d.type, d.createdAt, d.status, d.resolution]);
  } else return fail(404, 'NOT_FOUND');
  // NFR-SEC7 / §5.2: every export is logged (who, what, when)
  audit(u, 'Export', type, 'REPORT_EXPORTED', undefined, { type, from, to, rows: rows.length - 1 });
  return { filename: `ldy-${type}-${from}-to-${to}.csv`, csv: csv(rows) };
}

// ---------------- Audit (F-02) ----------------
export function listAudit(ctx: Ctx, q: Record<string, string>) {
  requireRole(ctx, ['MANAGER', 'ADMIN', 'AUDITOR']);
  let rows = state.audit.slice().reverse();
  if (q.entity) rows = rows.filter((e) => e.entityType === q.entity);
  if (q.entityId) {
    const t = q.entityId.toLowerCase();
    rows = rows.filter((e) => e.entityId.toLowerCase().includes(t) || (e.entityRef ?? '').toLowerCase().includes(t));
  }
  if (q.user) rows = rows.filter((e) => e.actorName.toLowerCase().includes(q.user.toLowerCase()));
  if (q.action) rows = rows.filter((e) => e.action.toLowerCase().includes(q.action.toLowerCase()));
  if (q.from) rows = rows.filter((e) => e.at.slice(0, 10) >= q.from);
  if (q.to) rows = rows.filter((e) => e.at.slice(0, 10) <= q.to);
  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(100, Number(q.pageSize ?? 25));
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export function auditImmutable() {
  return fail(405, 'AUDIT_IMMUTABLE');
}

// ---------------- Customer portal ----------------
export function register(_ctx: Ctx, b: { name: string; phone: string; email?: string; address: string; location?: { lat: number; lng: number }; preferences?: T.Preferences; password: string; consent: boolean }) {
  if (!b.consent) fail(422, 'CONSENT_REQUIRED', 'consent');
  // OQ16: a pickup and delivery address is required when customers sign themselves up.
  if (!b.address?.trim()) fail(422, 'ADDRESS_REQUIRED', 'address');
  if ((b.password ?? '').length < 10) fail(422, 'PASSWORD_TOO_SHORT', 'password');
  const phone = normalisePhone(b.phone);
  if (!validPhone(phone)) fail(422, 'INVALID_PHONE', 'phone');
  if (state.users.some((u) => u.phone === phone || (b.email && u.email?.toLowerCase() === b.email.toLowerCase()))) fail(409, 'DUPLICATE_PHONE', 'phone');
  // A counter-registered customer can claim their existing profile by registering with the same phone.
  let c = state.customers.find((x) => x.phone === phone);
  if (!c) c = createCustomerRecord(null, { ...b, phone, preferences: b.preferences ?? { starch: false, softener: true, finish: 'HANGER' } });
  else {
    c.email = b.email || c.email;
    c.address = b.address || c.address;
    c.preferences = b.preferences ?? c.preferences;
  }
  if (b.location) audit(null, 'Customer', c.id, 'LOCATION_SHARED_AT_SIGNUP', undefined, { lat: b.location.lat, lng: b.location.lng }, c.name);
  const user = {
    id: uid('usr'), name: b.name.trim(), username: phone, email: b.email || undefined, phone, roles: ['CUSTOMER' as const],
    status: 'ACTIVE' as const, mfaEnabled: false, password: b.password, failedAttempts: 0, customerId: c.id, lastSignInAt: iso(),
  };
  state.users.push(user);
  audit(user, 'User', user.id, 'CUSTOMER_SELF_REGISTERED', undefined, { customer: c.id, consent: true }, c.name);
  const token = uid('tok');
  state.sessions[token] = { userId: user.id };
  return { token, user: publicUser(user) };
}

function myCustomer(ctx: Ctx) {
  const u = requireRole(ctx, ['CUSTOMER']);
  const c = state.customers.find((x) => x.id === u.customerId);
  if (!c) return fail(404, 'NOT_FOUND');
  return { u, c };
}

export function portalMe(ctx: Ctx) {
  return myCustomer(ctx).c;
}

export function portalUpdate(ctx: Ctx, b: Partial<T.Customer>) {
  const { u, c } = myCustomer(ctx);
  const before = structuredClone(c);
  if (b.phone !== undefined) {
    const p = normalisePhone(b.phone);
    if (!validPhone(p)) fail(422, 'INVALID_PHONE', 'phone');
    if (state.customers.some((x) => x.phone === p && x.id !== c.id)) fail(409, 'DUPLICATE_PHONE', 'phone');
    c.phone = p;
    u.phone = p;
  }
  if (b.name !== undefined) {
    if (!b.name.trim()) fail(422, 'REQUIRED', 'name');
    c.name = b.name.trim();
    u.name = c.name;
  }
  if (b.email !== undefined) {
    if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) fail(422, 'INVALID_EMAIL', 'email');
    c.email = b.email || undefined;
    u.email = c.email;
  }
  if (b.address !== undefined) c.address = b.address || undefined;
  if (b.preferences) c.preferences = b.preferences;
  if (b.optOutReminders !== undefined) c.optOutReminders = b.optOutReminders;
  audit(u, 'Customer', c.id, 'CUSTOMER_SELF_UPDATED', before, structuredClone(c), c.name);
  return c;
}

export function portalOrders(ctx: Ctx) {
  const { c } = myCustomer(ctx);
  return state.orders.filter((o) => o.customerId === c.id && o.status !== 'DRAFT').slice().reverse();
}

export function portalOrder(ctx: Ctx, id: string) {
  const { c } = myCustomer(ctx);
  const o = state.orders.find((x) => (x.id === id || x.orderNo === id) && x.customerId === c.id && x.status !== 'DRAFT');
  if (!o) return fail(404, 'NOT_FOUND'); // never reveal another customer's order
  return { ...o, timeline: customerTimeline(o), damage: state.damage.filter((d) => d.orderId === o.id && d.customerMessageSent) };
}

export function portalExport(ctx: Ctx) {
  const { u, c } = myCustomer(ctx);
  const rows = portalOrders(ctx).map((o) => [o.orderNo, o.createdAt.slice(0, 10), o.status, o.invoice?.total ?? 0, o.amountPaid, o.balance]);
  audit(u, 'Export', c.id, 'CUSTOMER_EXPORTED_OWN_HISTORY', undefined, { rows: rows.length });
  return { filename: `my-ldy-orders-${now().toISOString().slice(0, 10)}.csv`, csv: csv([['order', 'date', 'status', 'total', 'paid', 'balance'], ...rows]) };
}

// ---------------- Bulk import (F-06) ----------------
const TEMPLATES: Record<T.ImportBatch['entityType'], string[]> = {
  customers: ['name', 'phone', 'email', 'address', 'account_type', 'credit_limit'],
  prices: ['service_type', 'category', 'price'],
  machines: ['name', 'type'],
};

export function importTemplate(ctx: Ctx, type: T.ImportBatch['entityType']) {
  requireRole(ctx, ['ADMIN']);
  const head = TEMPLATES[type];
  if (!head) return fail(404, 'NOT_FOUND');
  const sample: Record<string, string[]> = {
    customers: ['Esi Quansah', '0244000111', 'esi@example.com', 'East Legon, Accra', 'INDIVIDUAL', ''],
    prices: ['Wash & Iron', 'Shirt', '15'],
    machines: ['Washer 3', 'WASHER'],
  };
  return { filename: `ldy-import-${type}-template.csv`, csv: csv([head, sample[type]]) };
}

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ''));
}

export function validateImport(ctx: Ctx, b: { type: T.ImportBatch['entityType']; fileName: string; csv: string }) {
  const u = requireRole(ctx, ['ADMIN']);
  const head = TEMPLATES[b.type];
  if (!head) return fail(422, 'REQUIRED', 'type');
  const rows = parseCsv(b.csv ?? '');
  if (!rows.length) return fail(422, 'IMPORT_EMPTY', 'file');
  const cols = rows[0].map((h) => h.trim().toLowerCase());
  const missingCols = head.filter((h) => !cols.includes(h));
  if (missingCols.length) fail(422, 'IMPORT_BAD_HEADER', 'file', { missing: missingCols });
  const seen = new Set<string>();
  const results: T.ImportRowResult[] = rows.slice(1).map((r, idx) => {
    const data: Record<string, string> = {};
    cols.forEach((c, i) => (data[c] = (r[i] ?? '').trim()));
    const errors: string[] = [];
    if (b.type === 'customers') {
      if (!data.name) errors.push('name is required');
      const p = normalisePhone(data.phone);
      if (!validPhone(p)) errors.push('phone is not a valid number');
      else if (state.customers.some((c) => c.phone === p)) errors.push('a customer with this phone number already exists');
      else if (seen.has(p)) errors.push('duplicate phone number in this file');
      seen.add(p);
      if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) errors.push('email is not valid');
      if (data.account_type && !['INDIVIDUAL', 'CORPORATE'].includes(data.account_type.toUpperCase())) errors.push('account_type must be INDIVIDUAL or CORPORATE');
      if (data.credit_limit && !(Number(data.credit_limit) > 0)) errors.push('credit_limit must be a positive number');
    } else if (b.type === 'prices') {
      const st = state.serviceTypes.find((s) => s.name.toLowerCase() === data.service_type?.toLowerCase());
      if (!st) errors.push(`service_type "${data.service_type}" does not exist`);
      if (st?.pricing === 'PER_ITEM' && !state.categories.some((c) => c.name.toLowerCase() === data.category?.toLowerCase())) errors.push(`category "${data.category}" does not exist`);
      if (!(Number(data.price) > 0)) errors.push('price must be a positive number');
      const key = `${data.service_type}|${data.category}`.toLowerCase();
      if (seen.has(key)) errors.push('duplicate service_type/category in this file');
      seen.add(key);
    } else if (b.type === 'machines') {
      if (!data.name) errors.push('name is required');
      if (!['WASHER', 'DRYER', 'PRESS', 'STATION'].includes((data.type ?? '').toUpperCase())) errors.push('type must be WASHER, DRYER, PRESS or STATION');
      if (state.machines.some((m) => m.name.toLowerCase() === data.name?.toLowerCase()) || seen.has(data.name?.toLowerCase())) errors.push('a machine with this name already exists');
      seen.add(data.name?.toLowerCase());
    }
    return { row: idx + 2, data, errors };
  });
  const valid = results.filter((r) => !r.errors.length).length;
  const batch: T.ImportBatch = {
    id: uid('imp'),
    entityType: b.type,
    fileName: b.fileName || 'upload.csv',
    rowsTotal: results.length,
    rowsValid: valid,
    rowsRejected: results.length - valid,
    rowsCommitted: 0,
    rows: results,
    status: 'VALIDATED',
    runBy: u.name,
    runAt: iso(),
  };
  state.imports.push(batch);
  return batch;
}

export function commitImport(ctx: Ctx, id: string, b: { mode: 'ALL' | 'VALID_ONLY' }) {
  const u = requireRole(ctx, ['ADMIN']);
  const batch = state.imports.find((x) => x.id === id);
  if (!batch) return fail(404, 'NOT_FOUND');
  if (batch.status === 'COMMITTED') fail(409, 'ALREADY_COMMITTED');
  if (b.mode === 'ALL' && batch.rowsRejected > 0) fail(422, 'IMPORT_VALIDATION_FAILED', undefined, { count: batch.rowsRejected, valid: batch.rowsValid });
  let n = 0;
  for (const r of batch.rows.filter((x) => !x.errors.length)) {
    const d = r.data;
    // imports go through the same rules as the equivalent manual screen
    if (batch.entityType === 'customers') {
      const corp = (d.account_type ?? '').toUpperCase() === 'CORPORATE';
      const c = createCustomerRecord(u, { name: d.name, phone: d.phone, email: d.email, address: d.address, accountType: corp ? 'CORPORATE' : 'INDIVIDUAL' });
      if (corp && d.credit_limit && c.corporate) c.corporate.creditLimit = Number(d.credit_limit);
    } else if (batch.entityType === 'prices') {
      const st = state.serviceTypes.find((s) => s.name.toLowerCase() === d.service_type.toLowerCase())!;
      const cat = state.categories.find((c) => c.name.toLowerCase() === d.category?.toLowerCase());
      upsertPrice(ctx, { serviceTypeId: st.id, categoryId: cat?.id ?? '*', price: Number(d.price) });
    } else {
      createMachine(ctx, { name: d.name, type: d.type.toUpperCase() as T.Machine['type'] });
    }
    n++;
  }
  batch.rowsCommitted = n;
  batch.status = 'COMMITTED';
  audit(u, 'Import', batch.id, 'IMPORT_COMMITTED', undefined, { entityType: batch.entityType, file: batch.fileName, total: batch.rowsTotal, committed: n, rejected: batch.rowsRejected }, batch.fileName);
  return batch;
}

export function listImports(ctx: Ctx) {
  requireRole(ctx, ['ADMIN', 'AUDITOR']);
  return state.imports.slice().reverse().map((b) => ({ ...b, rows: [] }));
}

// ---------------- Global search (REDESIGN §4, D14): scoped by role on the server ----------------
const mask = (p: string) => (p.length > 6 ? `${p.slice(0, 3)} ••• ${p.slice(-4)}` : p);
export function search(ctx: Ctx, q: string): T.SearchResults {
  const u = requireUser(ctx);
  const out: T.SearchResults = { customers: [], orders: [], tags: [], users: [] };
  const term = (q ?? '').trim().toLowerCase();
  if (term.length < 2) return out;
  const role = (r: T.Role) => u.roles.includes(r);
  const desk = role('FRONT_DESK') || role('MANAGER') || role('AUDITOR');
  const floor = role('ATTENDANT');
  const digits = term.replace(/[\s-]/g, '');
  if (desk) {
    out.customers = state.customers
      .filter((c) => c.name.toLowerCase().includes(term) || (digits.length >= 3 && c.phone.includes(digits)))
      .slice(0, 6)
      .map((c) => ({ id: c.id, name: c.name, phoneMasked: mask(c.phone), accountType: c.accountType }));
  }
  if (desk || floor) {
    out.orders = state.orders
      .filter((o) => o.status !== 'DRAFT' && (o.orderNo.toLowerCase().includes(term) || (desk && (o.customerName.toLowerCase().includes(term) || (digits.length >= 3 && o.customerPhone.includes(digits))))))
      .slice(-6)
      .reverse()
      // the attendant never receives customer names or phone numbers
      .map((o) => ({ id: o.id, orderNo: o.orderNo, status: o.status, customerName: desk ? o.customerName : undefined }));
    out.tags = state.orders
      .flatMap((o) => o.items.filter((i) => i.tag?.toLowerCase().includes(term) && i.status !== 'CANCELLED').map((i) => ({ tag: i.tag!, orderId: o.id, orderNo: o.orderNo, status: i.status })))
      .slice(0, 6);
  }
  if (role('ADMIN')) {
    out.users = state.users
      .filter((x) => !x.roles.every((r) => r === 'CUSTOMER') && (x.name.toLowerCase().includes(term) || x.username.toLowerCase().includes(term)))
      .slice(0, 6)
      .map((x) => ({ id: x.id, name: x.name, username: x.username, roles: x.roles }));
  }
  return out;
}

export function staffRoles() {
  return STAFF_ROLES;
}

export { requireUser };
