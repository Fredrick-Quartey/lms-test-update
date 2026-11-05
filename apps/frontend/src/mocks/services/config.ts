// SRS-LDY-F-03 System configuration, SRS-LDY-E-01 Pricing configuration, SRS-LDY-B-03 machine register
import type * as T from '@ldy/api-client';
import { state, fail, uid, audit, requireRole, requireUser, type Ctx } from '../store';

export const DEFAULT_SETTINGS: T.Settings = {
  organisation: {
    name: 'LDY Laundry, Osu Branch',
    address: '12 Oxford Street, Osu, Accra',
    phone: '0302 000 000',
    tin: 'C0000000000',
    currency: 'GHS',
    dateFormat: 'dd/MM/yyyy',
    timeZone: 'Africa/Accra',
  },
  sla: { standardHours: 48, expressHours: 24 },
  express: { surchargeType: 'PERCENT', value: 50 },
  stageAlertHours: 4,
  reworkLimit: 2,
  qc: { mode: 'ALL', samplePercent: 25, independent: false },
  batching: { separateColours: true, separateDelicates: true },
  handover: { reminderDays: [7, 14], managerFlagDays: 14, disposalDays: 90, routeCapacity: 10, paymentPolicy: 'EITHER' },
  billing: {
    taxes: [],
    liabilityTerms:
      'Liability for damage or loss is limited to 10 times the cleaning charge of the affected item. Items not collected within 90 days of the ready notice may be disposed of.',
    cashupTolerance: 5,
    corporateDefaultLimit: 2000,
    corporateTermsDays: 30,
  },
  bookings: { openHour: 8, closeHour: 18, slotMinutes: 60, maxPerSlot: 3, cancelCutoffHours: 2 },
  security: { idleTimeoutMinutes: 15, lockoutAttempts: 5, lockoutMinutes: 15 },
  features: { bookings: true, corporate: true },
};

export function getSettings(ctx: Ctx) {
  requireUser(ctx);
  return state.settings;
}

/** Public subset for the customer portal and receipts (no security values). */
export function publicSettings() {
  const s = state.settings;
  return { organisation: s.organisation, sla: s.sla, express: s.express, handover: s.handover, billing: s.billing, bookings: s.bookings, features: s.features } as Partial<T.Settings>;
}

const MANAGER_KEYS: (keyof T.Settings)[] = ['sla', 'express']; // Appendix A note ²: pricing and SLAs only

function positive(path: string, v: unknown, allowZero = false) {
  if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || (!allowZero && v === 0)) fail(422, 'INVALID_CONFIG_VALUE', path);
}

function validate(s: T.Settings) {
  positive('sla.standardHours', s.sla.standardHours);
  positive('sla.expressHours', s.sla.expressHours);
  positive('express.value', s.express.value, true);
  positive('stageAlertHours', s.stageAlertHours);
  positive('reworkLimit', s.reworkLimit, true);
  positive('qc.samplePercent', s.qc.samplePercent);
  if (s.qc.samplePercent > 100) fail(422, 'INVALID_CONFIG_VALUE', 'qc.samplePercent');
  s.handover.reminderDays.forEach((d, i) => positive(`handover.reminderDays.${i}`, d));
  positive('handover.managerFlagDays', s.handover.managerFlagDays);
  positive('handover.disposalDays', s.handover.disposalDays);
  positive('handover.routeCapacity', s.handover.routeCapacity);
  positive('billing.cashupTolerance', s.billing.cashupTolerance, true);
  positive('billing.corporateDefaultLimit', s.billing.corporateDefaultLimit);
  positive('billing.corporateTermsDays', s.billing.corporateTermsDays);
  s.billing.taxes.forEach((t, i) => {
    if (!t.name?.trim()) fail(422, 'REQUIRED', `billing.taxes.${i}.name`);
    positive(`billing.taxes.${i}.ratePercent`, t.ratePercent);
  });
  positive('bookings.slotMinutes', s.bookings.slotMinutes);
  positive('bookings.maxPerSlot', s.bookings.maxPerSlot);
  positive('bookings.cancelCutoffHours', s.bookings.cancelCutoffHours, true);
  if (s.bookings.closeHour <= s.bookings.openHour) fail(422, 'INVALID_CONFIG_VALUE', 'bookings.closeHour');
  positive('security.idleTimeoutMinutes', s.security.idleTimeoutMinutes);
  positive('security.lockoutAttempts', s.security.lockoutAttempts);
  positive('security.lockoutMinutes', s.security.lockoutMinutes);
  if (!s.organisation.name.trim()) fail(422, 'REQUIRED', 'organisation.name');
  if (typeof s.features?.bookings !== 'boolean' || typeof s.features?.corporate !== 'boolean') fail(422, 'INVALID_CONFIG_VALUE', 'features');
}

export function updateSettings(ctx: Ctx, patch: Partial<T.Settings>) {
  const u = requireRole(ctx, ['ADMIN', 'MANAGER']);
  const isAdmin = u.roles.includes('ADMIN');
  const keys = Object.keys(patch) as (keyof T.Settings)[];
  if (!isAdmin && keys.some((k) => !MANAGER_KEYS.includes(k))) fail(403, 'FORBIDDEN');
  const next = structuredClone(state.settings);
  for (const k of keys) (next as unknown as Record<string, unknown>)[k] = structuredClone(patch[k]);
  validate(next); // previous value stays in effect on failure
  for (const k of keys) {
    const before = state.settings[k];
    const after = next[k];
    if (JSON.stringify(before) !== JSON.stringify(after)) audit(u, 'Settings', String(k), 'CONFIG_CHANGED', before, after, String(k));
  }
  state.settings = next;
  return state.settings;
}

// ---------------- Catalogue ----------------
export function getCatalogue(ctx: Ctx): T.Catalogue {
  requireUser(ctx);
  return { serviceTypes: state.serviceTypes, categories: state.categories, prices: state.prices };
}

export function publicCatalogue(): T.Catalogue {
  return { serviceTypes: state.serviceTypes.filter((s) => s.active), categories: state.categories, prices: [] };
}

export function upsertPrice(ctx: Ctx, b: Omit<T.PriceEntry, 'id'> & { id?: string }) {
  const u = requireRole(ctx, ['ADMIN', 'MANAGER']);
  if (typeof b.price !== 'number' || !(b.price > 0)) fail(422, 'INVALID_CONFIG_VALUE', 'price');
  const st = state.serviceTypes.find((s) => s.id === b.serviceTypeId);
  if (!st) return fail(422, 'REQUIRED', 'serviceTypeId');
  const categoryId = st.pricing === 'PER_KG' ? '*' : b.categoryId;
  if (categoryId !== '*' && !state.categories.find((c) => c.id === categoryId)) fail(422, 'REQUIRED', 'categoryId');
  let entry = state.prices.find((p) => p.serviceTypeId === b.serviceTypeId && p.categoryId === categoryId);
  const before = entry ? { ...entry } : undefined;
  if (entry) entry.price = b.price;
  else {
    entry = { id: uid('prc'), categoryId, serviceTypeId: b.serviceTypeId, price: b.price };
    state.prices.push(entry);
  }
  audit(u, 'PriceListEntry', entry.id, before ? 'PRICE_CHANGED' : 'PRICE_ADDED', before, { ...entry });
  return entry;
}

export function deletePrice(ctx: Ctx, id: string) {
  const u = requireRole(ctx, ['ADMIN', 'MANAGER']);
  const idx = state.prices.findIndex((p) => p.id === id);
  if (idx < 0) return fail(404, 'NOT_FOUND');
  const [removed] = state.prices.splice(idx, 1);
  audit(u, 'PriceListEntry', id, 'PRICE_REMOVED', removed, undefined);
}

export function upsertServiceType(ctx: Ctx, b: Omit<T.ServiceType, 'id'> & { id?: string }) {
  const u = requireRole(ctx, ['ADMIN']);
  if (!b.name?.trim()) fail(422, 'REQUIRED', 'name');
  const stages = (b.stages ?? []).map((s) => s.trim()).filter(Boolean);
  if (!stages.length) fail(422, 'STAGES_REQUIRED', 'stages');
  let st = b.id ? state.serviceTypes.find((s) => s.id === b.id) : undefined;
  const before = st ? structuredClone(st) : undefined;
  if (st) Object.assign(st, { name: b.name.trim(), pricing: b.pricing, stages, active: b.active });
  else {
    st = { id: uid('svc'), name: b.name.trim(), pricing: b.pricing, stages, active: b.active ?? true };
    state.serviceTypes.push(st);
  }
  audit(u, 'ServiceType', st.id, before ? 'SERVICE_TYPE_CHANGED' : 'SERVICE_TYPE_ADDED', before, structuredClone(st), st.name);
  return st;
}

export function addCategory(ctx: Ctx, b: { name: string }) {
  const u = requireRole(ctx, ['ADMIN', 'MANAGER']);
  if (!b.name?.trim()) fail(422, 'REQUIRED', 'name');
  if (state.categories.some((c) => c.name.toLowerCase() === b.name.trim().toLowerCase())) fail(409, 'DUPLICATE', 'name');
  const c = { id: uid('cat'), name: b.name.trim() };
  state.categories.push(c);
  audit(u, 'ItemCategory', c.id, 'CATEGORY_ADDED', undefined, c, c.name);
  return c;
}

// ---------------- Machines (B-03) ----------------
export function listMachines(ctx: Ctx) {
  requireRole(ctx, ['ATTENDANT', 'MANAGER', 'ADMIN', 'AUDITOR']);
  return state.machines;
}

export function createMachine(ctx: Ctx, b: { name: string; type: T.Machine['type'] }) {
  const u = requireRole(ctx, ['ADMIN']);
  if (!b.name?.trim()) fail(422, 'REQUIRED', 'name');
  const m: T.Machine = { id: uid('mch'), name: b.name.trim(), type: b.type, status: 'AVAILABLE', minutesInUse: 0 };
  state.machines.push(m);
  audit(u, 'Machine', m.id, 'MACHINE_ADDED', undefined, m, m.name);
  return m;
}

export function setMachineStatus(ctx: Ctx, id: string, b: { status: T.Machine['status'] }) {
  const u = requireRole(ctx, ['ADMIN', 'MANAGER']);
  const m = state.machines.find((x) => x.id === id);
  if (!m) return fail(404, 'NOT_FOUND');
  if (b.status === 'IN_USE') fail(422, 'INVALID_CONFIG_VALUE', 'status');
  if (m.status === 'IN_USE') fail(409, 'MACHINE_IN_USE');
  const before = m.status;
  m.status = b.status;
  audit(u, 'Machine', m.id, 'MACHINE_STATUS_CHANGED', { status: before }, { status: m.status }, m.name);
  return m;
}
