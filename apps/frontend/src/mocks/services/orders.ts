// Module A (intake), E-01/E-02 (pricing, invoice, payments), D-01 (collection), D-04 (tracking)
import type * as T from '@ldy/api-client';
import {
  state, fail, uid, iso, now, audit, nextNo, round2, requireRole, requireUser, findOrder, notifyStaff,
  type Ctx, type StoredUser,
} from '../store';
import { notifyCustomer } from './notifications';

const PHONE_RE = /^(?:\+233|0)[235]\d{8}$/; // Ghana mobile/landline format, e.g. 0244123456 or +233244123456

export function normalisePhone(p: string) {
  return (p ?? '').replace(/[\s-]/g, '');
}
export function validPhone(p: string) {
  return PHONE_RE.test(normalisePhone(p));
}

export const OPEN_ORDER_STATUSES: T.OrderStatus[] = [
  'DRAFT', 'RECEIVED', 'IN_SORTING', 'IN_PROCESSING', 'QC_PASSED', 'QC_FAILED', 'PACKAGED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY',
];
export const isOpen = (o: T.Order) => OPEN_ORDER_STATUSES.includes(o.status);
const ACTIVE_ITEM = (i: T.OrderItem) => i.status !== 'DISCARDED' && i.status !== 'CANCELLED';

// ---------------- Customers (A-01) ----------------
export function searchCustomers(ctx: Ctx, q: string) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR']);
  const term = (q ?? '').trim().toLowerCase();
  if (!term) return state.customers.slice(-20).reverse();
  const digits = normalisePhone(term);
  return state.customers.filter(
    (c) => c.phone.includes(digits) || c.name.toLowerCase().includes(term) || (c.email ?? '').toLowerCase().includes(term),
  );
}

export function getCustomer(ctx: Ctx, id: string) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR']);
  const c = state.customers.find((x) => x.id === id);
  if (!c) return fail(404, 'NOT_FOUND');
  return c;
}

export function createCustomerRecord(actor: { id: string; name: string } | null, b: {
  name: string; phone: string; email?: string; address?: string; preferences?: T.Preferences; accountType?: 'INDIVIDUAL' | 'CORPORATE';
}) {
  if (!b.name?.trim()) fail(422, 'REQUIRED', 'name');
  const phone = normalisePhone(b.phone);
  if (!validPhone(phone)) fail(422, 'INVALID_PHONE', 'phone');
  if (state.customers.some((c) => c.phone === phone)) fail(409, 'DUPLICATE_PHONE', 'phone');
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) fail(422, 'INVALID_EMAIL', 'email');
  const c: T.Customer = {
    id: uid('cus'),
    name: b.name.trim(),
    phone,
    email: b.email || undefined,
    address: b.address || undefined,
    preferences: b.preferences ?? { starch: false, softener: true, finish: 'HANGER' },
    accountType: b.accountType ?? 'INDIVIDUAL',
    optOutReminders: false,
    createdAt: iso(),
  };
  if (c.accountType === 'CORPORATE') {
    c.corporate = {
      creditLimit: state.settings.billing.corporateDefaultLimit,
      termsDays: state.settings.billing.corporateTermsDays,
      billingCycle: 'MONTHLY',
      runningBalance: 0,
    };
  }
  state.customers.push(c);
  audit(actor, 'Customer', c.id, 'CUSTOMER_CREATED', undefined, { name: c.name, phone: c.phone, accountType: c.accountType }, c.name);
  return c;
}

export function createCustomer(ctx: Ctx, b: Parameters<typeof createCustomerRecord>[1]) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  if (b.accountType === 'CORPORATE' && !u.roles.some((r) => r === 'MANAGER' || r === 'ADMIN')) {
    // E-04: only a Branch Manager or Administrator configures a corporate account
    fail(403, 'FORBIDDEN', 'accountType');
  }
  return createCustomerRecord(u, b);
}

export function updateCustomer(ctx: Ctx, id: string, b: Partial<T.Customer> & { corporate?: Partial<T.CorporateTerms> }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'ADMIN']);
  const c = state.customers.find((x) => x.id === id);
  if (!c) return fail(404, 'NOT_FOUND');
  const before = structuredClone(c);
  if (b.phone !== undefined) {
    const phone = normalisePhone(b.phone);
    if (!validPhone(phone)) fail(422, 'INVALID_PHONE', 'phone');
    if (state.customers.some((x) => x.phone === phone && x.id !== id)) fail(409, 'DUPLICATE_PHONE', 'phone');
    c.phone = phone;
  }
  if (b.name !== undefined) c.name = b.name;
  if (b.email !== undefined) c.email = b.email || undefined;
  if (b.address !== undefined) c.address = b.address || undefined;
  if (b.preferences) c.preferences = b.preferences;
  const corporateChange = b.accountType !== undefined || b.corporate !== undefined;
  if (corporateChange) {
    if (!u.roles.some((r) => r === 'MANAGER' || r === 'ADMIN')) fail(403, 'FORBIDDEN');
    if (b.accountType) c.accountType = b.accountType;
    if (c.accountType === 'CORPORATE') {
      const cur = c.corporate ?? {
        creditLimit: state.settings.billing.corporateDefaultLimit,
        termsDays: state.settings.billing.corporateTermsDays,
        billingCycle: 'MONTHLY' as const,
        runningBalance: 0,
      };
      const next = { ...cur, ...(b.corporate ?? {}) };
      if (!(next.creditLimit > 0)) fail(422, 'INVALID_CONFIG_VALUE', 'creditLimit');
      if (!(next.termsDays > 0)) fail(422, 'INVALID_CONFIG_VALUE', 'termsDays');
      c.corporate = next;
    }
  }
  audit(u, 'Customer', c.id, 'CUSTOMER_UPDATED', before, structuredClone(c), c.name);
  return c;
}

// ---------------- Pricing (E-01) ----------------
export function priceFor(categoryId: string, serviceTypeId: string) {
  const st = state.serviceTypes.find((s) => s.id === serviceTypeId);
  if (!st) return null;
  const key = st.pricing === 'PER_KG' ? '*' : categoryId;
  return state.prices.find((p) => p.serviceTypeId === serviceTypeId && p.categoryId === key)?.price ?? null;
}

export function computeInvoice(o: T.Order): T.Invoice {
  const s = state.settings;
  const lines: T.InvoiceLine[] = o.items.filter(ACTIVE_ITEM).map((i) => {
    const cat = state.categories.find((c) => c.id === i.categoryId)?.name ?? 'Item';
    const st = state.serviceTypes.find((x) => x.id === i.serviceTypeId);
    const qty = st?.pricing === 'PER_KG' ? `${i.weightKg} kg` : `× ${i.quantity}`;
    return { label: `${cat}, ${st?.name ?? ''} ${qty}${i.tag ? ` (${i.tag})` : ''}`, amount: i.lineTotal ?? 0 };
  });
  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0));
  let surcharge = 0;
  if (o.speed === 'EXPRESS') {
    surcharge = s.express.surchargeType === 'PERCENT' ? round2((subtotal * s.express.value) / 100) : s.express.value;
  }
  const adjustments = state.approvals
    .filter((a) => a.orderId === o.id && a.kind === 'ADJUSTMENT' && a.status === 'APPROVED')
    .map((a) => ({ label: `Price adjustment — ${a.reason}`, amount: -(a.amount ?? 0) }));
  const base = round2(subtotal + surcharge + adjustments.reduce((a, l) => a + l.amount, 0));
  const taxes = s.billing.taxes.map((t) => ({ label: `${t.name} (${t.ratePercent}%)`, amount: round2((base * t.ratePercent) / 100) }));
  const total = round2(base + taxes.reduce((a, t) => a + t.amount, 0));
  return {
    number: o.invoice?.number ?? '',
    issuedAt: o.invoice?.issuedAt ?? '',
    lines: [...lines, ...adjustments],
    subtotal,
    surcharge,
    taxes,
    total: Math.max(0, total),
  };
}

/** Recompute derived money fields and the workflow status (D-04: no manual status-setting). */
export function recompute(o: T.Order) {
  if (o.status === 'DRAFT') {
    o.invoice = computeInvoice(o);
  } else if (o.invoice) {
    // Invoice is frozen at finalisation; only approved adjustments change it afterwards (E-02 validation rule).
    const fresh = computeInvoice(o);
    o.invoice = { ...fresh, number: o.invoice.number, issuedAt: o.invoice.issuedAt };
  }
  const paid = round2(o.payments.filter((p) => p.kind === 'PAYMENT').reduce((a, p) => a + p.amount, 0));
  const refunded = round2(o.payments.filter((p) => p.kind === 'REFUND').reduce((a, p) => a + p.amount, 0));
  o.amountPaid = round2(paid - refunded);
  o.refunded = refunded;
  const total = o.invoice?.total ?? 0;
  o.balance = o.status === 'CANCELLED' ? 0 : Math.max(0, round2(total - o.amountPaid));
  o.paymentState = o.onAccount ? 'ON_ACCOUNT' : o.balance <= 0 && total > 0 ? 'PAID' : o.amountPaid > 0 ? 'PARTIAL' : 'UNPAID';

  const fixed: T.OrderStatus[] = ['DRAFT', 'CANCELLED', 'UNCLAIMED_DISPOSED', 'COLLECTED', 'DELIVERED', 'OUT_FOR_DELIVERY'];
  if (fixed.includes(o.status)) return o;
  const items = o.items.filter(ACTIVE_ITEM);
  const st = items.map((i) => i.status);
  const before = o.status;
  if (items.length && st.every((s) => s === 'PACKAGED')) o.status = o.deliveryFlag ? 'PACKAGED' : 'READY_FOR_PICKUP';
  else if (st.includes('QC_FAILED')) o.status = 'QC_FAILED';
  else if (items.length && st.every((s) => s === 'QC_PASSED' || s === 'PACKAGED')) o.status = 'QC_PASSED';
  else if (st.some((s) => ['IN_PROCESSING', 'PROCESSING_COMPLETE', 'REWORK', 'QC_PASSED'].includes(s))) o.status = 'IN_PROCESSING';
  else if (st.includes('IN_SORTING')) o.status = 'IN_SORTING';
  else o.status = 'RECEIVED';
  if (before !== o.status) audit(null, 'Order', o.id, `STATUS_${o.status}`, { status: before }, { status: o.status }, o.orderNo);
  return o;
}

// ---------------- Orders ----------------
function customerOf(o: T.Order) {
  return o.customerId ? state.customers.find((c) => c.id === o.customerId) : undefined;
}

export function contactOf(o: T.Order) {
  const c = customerOf(o);
  return { customerId: c?.id, name: o.customerName, phone: o.customerPhone, email: c?.email, optOutReminders: c?.optOutReminders };
}

export function createDraft(ctx: Ctx, b: { customerId?: string; guest?: { name?: string; phone: string }; bookingId?: string }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  return createDraftAs(u, b);
}

export function createDraftAs(u: StoredUser, b: { customerId?: string; guest?: { name?: string; phone: string }; bookingId?: string }) {
  let name = 'Guest';
  let phone = '';
  let address: string | undefined;
  let corporate = false;
  if (b.customerId) {
    const c = state.customers.find((x) => x.id === b.customerId);
    if (!c) return fail(404, 'NOT_FOUND');
    name = c.name;
    phone = c.phone;
    address = c.address;
    corporate = c.accountType === 'CORPORATE';
  } else {
    // A-01: a Guest still needs a valid phone number for status notifications
    phone = normalisePhone(b.guest?.phone ?? '');
    if (!validPhone(phone)) fail(422, 'INVALID_PHONE', 'phone');
    name = b.guest?.name?.trim() || 'Guest';
  }
  const o: T.Order = {
    id: uid('ord'),
    orderNo: nextNo('order', 'LDY-'),
    customerId: b.customerId,
    guest: b.customerId ? undefined : { name: b.guest?.name, phone },
    customerName: name,
    customerPhone: phone,
    status: 'DRAFT',
    speed: 'STANDARD',
    items: [],
    deliveryFlag: false,
    deliveryAddress: address,
    createdAt: iso(),
    createdBy: u.id,
    payments: [],
    amountPaid: 0,
    balance: 0,
    paymentState: 'UNPAID',
    onAccount: corporate,
    failedDeliveries: [],
    remindersSent: [],
    refunded: 0,
    bookingId: b.bookingId,
  };
  recompute(o);
  state.orders.push(o);
  audit(u, 'Order', o.id, 'ORDER_DRAFT_CREATED', undefined, { customer: name, phone }, o.orderNo);
  return o;
}

function draftOnly(o: T.Order) {
  if (o.status !== 'DRAFT') fail(409, 'ORDER_NOT_EDITABLE');
}

export function updateDraft(ctx: Ctx, id: string, b: { speed?: 'STANDARD' | 'EXPRESS'; deliveryFlag?: boolean; deliveryAddress?: string; onAccount?: boolean }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(id);
  draftOnly(o);
  const before = { speed: o.speed, deliveryFlag: o.deliveryFlag, deliveryAddress: o.deliveryAddress, onAccount: o.onAccount };
  if (b.speed) o.speed = b.speed;
  if (b.deliveryFlag !== undefined) o.deliveryFlag = b.deliveryFlag;
  if (b.deliveryAddress !== undefined) o.deliveryAddress = b.deliveryAddress;
  if (b.onAccount !== undefined) {
    const c = customerOf(o);
    if (b.onAccount && c?.accountType !== 'CORPORATE') fail(422, 'NOT_CORPORATE');
    o.onAccount = b.onAccount;
  }
  recompute(o);
  audit(u, 'Order', o.id, 'ORDER_DRAFT_UPDATED', before, { speed: o.speed, deliveryFlag: o.deliveryFlag, deliveryAddress: o.deliveryAddress, onAccount: o.onAccount }, o.orderNo);
  return o;
}

export function addItem(ctx: Ctx, id: string, b: {
  categoryId: string; serviceTypeId: string; quantity: number; weightKg?: number; colour: T.Colour; fabric: T.Fabric; instructions?: string;
  flags?: { type: T.FlagType; note?: string; photo?: string }[];
}) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(id);
  draftOnly(o);
  if (!b.serviceTypeId) fail(422, 'INCOMPLETE_ORDER', 'serviceTypeId');
  const st = state.serviceTypes.find((s) => s.id === b.serviceTypeId);
  if (!st) return fail(422, 'INCOMPLETE_ORDER', 'serviceTypeId');
  if (st.pricing === 'PER_ITEM' && !b.categoryId) fail(422, 'REQUIRED', 'categoryId');
  if (st.pricing === 'PER_KG' && !(Number(b.weightKg) > 0)) fail(422, 'WEIGHT_REQUIRED', 'weightKg');
  if (st.pricing === 'PER_ITEM' && !(Number(b.quantity) >= 1)) fail(422, 'QUANTITY_REQUIRED', 'quantity');
  const price = priceFor(b.categoryId, b.serviceTypeId);
  if (price === null) fail(422, 'NO_PRICE_CONFIGURED', 'categoryId'); // never priced at zero
  for (const f of b.flags ?? []) {
    if (f.type === 'DAMAGE' && !f.note?.trim() && !f.photo) fail(422, 'MISSING_DAMAGE_NOTE', 'flags');
  }
  const qty = st.pricing === 'PER_KG' ? 1 : Math.floor(b.quantity);
  const line = st.pricing === 'PER_KG' ? round2((price as number) * Number(b.weightKg)) : round2((price as number) * qty);
  const item: T.OrderItem = {
    id: uid('itm'),
    categoryId: st.pricing === 'PER_KG' ? b.categoryId || '*' : b.categoryId,
    serviceTypeId: b.serviceTypeId,
    quantity: qty,
    weightKg: st.pricing === 'PER_KG' ? Number(b.weightKg) : undefined,
    colour: b.colour ?? 'COLOURS',
    fabric: b.fabric ?? 'REGULAR',
    instructions: b.instructions?.trim() || undefined,
    flags: (b.flags ?? []).map((f) => ({ id: uid('flg'), type: f.type, note: f.note?.trim() || undefined, photo: f.photo, stage: 'INTAKE', by: u.name, at: iso() })),
    unitPrice: price,
    lineTotal: line,
    status: 'RECEIVED',
    stageLog: [],
    qc: [],
    reworkCount: 0,
    needsManagerReview: false,
    overrideApproved: false,
    checkedOff: false,
    qcRequired: true,
  };
  o.items.push(item);
  recompute(o);
  audit(u, 'Order', o.id, 'ITEM_ADDED', undefined, { item: item.id, serviceTypeId: item.serviceTypeId, categoryId: item.categoryId, line }, o.orderNo);
  return o;
}

export function removeItem(ctx: Ctx, id: string, itemId: string) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(id);
  draftOnly(o);
  const before = o.items.find((i) => i.id === itemId);
  o.items = o.items.filter((i) => i.id !== itemId);
  recompute(o);
  audit(u, 'Order', o.id, 'ITEM_REMOVED', before ? { item: before.id } : undefined, undefined, o.orderNo);
  return o;
}

function openTags() {
  const set = new Set<string>();
  for (const o of state.orders) if (isOpen(o)) for (const i of o.items) if (i.tag && ACTIVE_ITEM(i)) set.add(i.tag);
  return set;
}

function nextTag() {
  const inUse = openTags();
  // A-03: a tag number can be reused only once its order is closed; the counter wraps at 99999.
  for (let n = 0; n < 100000; n++) {
    state.counters.tag = ((state.counters.tag ?? 0) % 99999) + 1;
    const t = `T${String(state.counters.tag).padStart(5, '0')}`;
    if (!inUse.has(t)) return t;
  }
  return fail(409, 'TAG_IN_USE');
}

export function finalise(ctx: Ctx, id: string) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(id);
  draftOnly(o);
  if (!o.items.length || o.items.some((i) => !i.serviceTypeId)) fail(422, 'INCOMPLETE_ORDER');
  if (o.deliveryFlag && !o.deliveryAddress?.trim()) fail(422, 'DELIVERY_ADDRESS_REQUIRED', 'deliveryAddress');
  const invoice = computeInvoice(o);
  // E-04: corporate credit limit check
  if (o.onAccount) {
    const c = customerOf(o)!;
    const corp = c.corporate!;
    if (corp.runningBalance + invoice.total > corp.creditLimit && o.creditOverride !== 'APPROVED') {
      fail(409, 'CREDIT_LIMIT_EXCEEDED', undefined, {
        runningBalance: corp.runningBalance, creditLimit: corp.creditLimit, orderTotal: invoice.total, overrideStatus: o.creditOverride ?? null,
      });
    }
  }
  // A-02 / A-03: order number already assigned; tags, ready-by and invoice in the same action
  for (const i of o.items) i.tag = nextTag();
  const s = state.settings;
  const hours = o.speed === 'EXPRESS' ? s.sla.expressHours : s.sla.standardHours;
  o.expectedReadyBy = new Date(now().getTime() + hours * 3600_000).toISOString();
  o.finalisedAt = iso();
  o.status = 'RECEIVED';
  o.invoice = { ...invoice, number: nextNo('invoice', `INV-${now().getFullYear()}-`), issuedAt: iso() };
  if (o.onAccount) {
    const c = customerOf(o)!;
    c.corporate!.runningBalance = round2(c.corporate!.runningBalance + o.invoice.total);
  }
  recompute(o);
  audit(u, 'Order', o.id, 'ORDER_FINALISED', { status: 'DRAFT' }, {
    status: 'RECEIVED', tags: o.items.map((i) => i.tag), expectedReadyBy: o.expectedReadyBy, invoice: o.invoice.number, total: o.invoice.total,
  }, o.orderNo);
  if (o.bookingId) {
    const bk = state.bookings.find((b) => b.id === o.bookingId);
    if (bk) {
      bk.status = 'COMPLETED';
      bk.orderId = o.id;
      audit(u, 'Booking', bk.id, 'BOOKING_COMPLETED', undefined, { orderNo: o.orderNo }, bk.bookingNo);
    }
  }
  notifyCustomer('ORDER_RECEIVED', contactOf(o), {
    reference: o.orderNo,
    readyBy: new Date(o.expectedReadyBy).toLocaleString('en-GB', { timeZone: 'Africa/Accra' }),
    amount: `${s.organisation.currency} ${o.invoice.total.toFixed(2)}`,
  }, o.orderNo);
  return o;
}

// ---------------- Payments (E-02) ----------------
export function currentCashup(u: StoredUser) {
  let c = state.cashups.find((x) => x.officerId === u.id && x.status === 'OPEN');
  if (!c) {
    c = {
      id: uid('csh'),
      officerId: u.id,
      officerName: u.name,
      date: now().toISOString().slice(0, 10),
      openedAt: iso(),
      expected: { CASH: 0, CARD: 0, MOMO: 0 },
      status: 'OPEN',
      pendingReferences: 0,
    };
    state.cashups.push(c);
  }
  return c;
}

export function pay(ctx: Ctx, id: string, b: { amount: number; method: T.Payment['method']; reference?: string; tendered?: number }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(id);
  if (o.status === 'DRAFT' || o.status === 'CANCELLED' || o.status === 'UNCLAIMED_DISPOSED') fail(409, 'ORDER_NOT_PAYABLE');
  if (o.onAccount) fail(409, 'ORDER_ON_ACCOUNT');
  const amount = round2(Number(b.amount));
  if (!(amount > 0)) fail(422, 'INVALID_AMOUNT', 'amount');
  if (amount > o.balance + 0.001) fail(422, 'AMOUNT_EXCEEDS_BALANCE', 'amount', { balance: o.balance });
  if (!['CASH', 'CARD', 'MOMO'].includes(b.method)) fail(422, 'REQUIRED', 'method');
  if (b.method !== 'CASH' && !b.reference?.trim()) fail(422, 'PAYMENT_REFERENCE_REQUIRED', 'reference');
  if (b.method === 'CASH' && b.tendered !== undefined && b.tendered < amount) fail(422, 'TENDERED_TOO_LOW', 'tendered');
  const cash = currentCashup(u);
  const p: T.Payment & { cashupId: string } = {
    id: uid('pay'),
    orderId: o.id,
    amount,
    method: b.method,
    reference: b.reference?.trim() || undefined,
    tendered: b.method === 'CASH' ? b.tendered : undefined,
    at: iso(),
    by: u.id,
    byName: u.name,
    receiptNo: nextNo('receipt', `RCT-${now().getFullYear()}-`),
    kind: 'PAYMENT',
    cashupId: cash.id,
  };
  o.payments.push(p);
  recompute(o);
  audit(u, 'Payment', p.id, 'PAYMENT_CAPTURED', undefined, { order: o.orderNo, amount, method: p.method, reference: p.reference, receipt: p.receiptNo }, o.orderNo);
  audit(u, 'Order', o.id, 'PAYMENT_RECORDED', undefined, { amount, method: p.method, balance: o.balance }, o.orderNo);
  return { order: o, payment: p };
}

export function sendReceipt(ctx: Ctx, paymentId: string, b: { channel: 'SMS' | 'EMAIL' }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = state.orders.find((x) => x.payments.some((p) => p.id === paymentId));
  if (!o) return fail(404, 'NOT_FOUND');
  const p = o.payments.find((x) => x.id === paymentId)!;
  const contact = contactOf(o);
  const cur = state.settings.organisation.currency;
  const tpl = state.templates.find((t) => t.key === 'RECEIPT')!;
  const saved = { ...tpl.channels };
  tpl.channels = { inApp: false, email: b.channel === 'EMAIL', sms: b.channel === 'SMS' };
  notifyCustomer('RECEIPT', contact, { receiptNo: p.receiptNo, amount: `${cur} ${p.amount.toFixed(2)}`, reference: o.orderNo, balance: `${cur} ${o.balance.toFixed(2)}` }, o.orderNo);
  tpl.channels = saved;
  audit(u, 'Payment', p.id, `RECEIPT_SENT_${b.channel}`, undefined, undefined, o.orderNo);
}

// ---------------- Cancel (A-05) ----------------
export function cancel(ctx: Ctx, id: string, b: { reason: string; note?: string }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(id);
  if (!b.reason) fail(422, 'CANCEL_REASON_REQUIRED', 'reason');
  if (b.reason === 'OTHER' && !b.note?.trim()) fail(422, 'CANCEL_REASON_REQUIRED', 'note');
  const processingStarted = o.items.some((i) => !['RECEIVED', 'IN_SORTING', 'CANCELLED'].includes(i.status));
  if (processingStarted) fail(409, 'CANNOT_CANCEL_PROCESSING');
  if (!['RECEIVED', 'IN_SORTING'].includes(o.status)) fail(409, 'ORDER_NOT_CANCELLABLE');
  const before = o.status;
  // remove items from batches that have not started
  for (const b2 of state.batches) {
    if (b2.status === 'OPEN') b2.itemIds = b2.itemIds.filter((iid) => !o.items.some((i) => i.id === iid));
  }
  o.items.forEach((i) => {
    i.status = 'CANCELLED';
    i.batchId = undefined;
  }); // tags released (cancelled items no longer hold a tag number)
  o.status = 'CANCELLED';
  o.cancellation = { reason: b.reason, note: b.note, by: u.name, at: iso() };
  if (o.onAccount && o.invoice) {
    const c = customerOf(o);
    if (c?.corporate) c.corporate.runningBalance = round2(Math.max(0, c.corporate.runningBalance - o.invoice.total));
  }
  recompute(o);
  audit(u, 'Order', o.id, 'ORDER_CANCELLED', { status: before }, { status: 'CANCELLED', reason: b.reason, note: b.note }, o.orderNo);
  let refundRequest: T.ApprovalRequest | undefined;
  if (o.amountPaid > 0) {
    // the Front Desk Officer cannot pay this out directly — it waits for a Branch Manager (E-03)
    refundRequest = {
      id: uid('apr'),
      kind: 'REFUND',
      orderId: o.id,
      orderNo: o.orderNo,
      amount: o.amountPaid,
      method: o.payments.find((p) => p.kind === 'PAYMENT')?.method,
      reason: `Order cancelled — ${b.reason.replace(/_/g, ' ').toLowerCase()}${b.note ? `: ${b.note}` : ''}`,
      requestedBy: u.id,
      requestedByName: u.name,
      requestedAt: iso(),
      status: 'PENDING',
    };
    state.approvals.push(refundRequest);
    audit(u, 'Approval', refundRequest.id, 'REFUND_REQUESTED', undefined, { amount: refundRequest.amount }, o.orderNo);
    notifyStaff({ role: 'MANAGER' }, `Refund request for cancelled order ${o.orderNo}`, '/staff/approvals');
  }
  notifyCustomer('ORDER_CANCELLED', contactOf(o), { reference: o.orderNo, reason: b.reason.replace(/_/g, ' ').toLowerCase() }, o.orderNo);
  return o;
}

// ---------------- Collection (D-01) ----------------
export function collect(ctx: Ctx, id: string, b: { identityNote: string }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(id);
  if (o.status !== 'READY_FOR_PICKUP' && !(o.status === 'PACKAGED' && !o.deliveryFlag)) fail(409, 'ORDER_NOT_READY');
  if (!b.identityNote?.trim()) fail(422, 'IDENTITY_REQUIRED', 'identityNote');
  if (o.balance > 0 && !o.onAccount) fail(409, 'PAYMENT_OUTSTANDING', undefined, { balance: o.balance });
  o.status = 'COLLECTED';
  o.collectedAt = iso();
  o.items.forEach((i) => {
    if (i.status === 'PACKAGED') i.status = 'COLLECTED';
  }); // tags retired
  recompute(o);
  audit(u, 'Order', o.id, 'ORDER_COLLECTED', { status: 'READY_FOR_PICKUP' }, { status: 'COLLECTED', identityNote: b.identityNote }, o.orderNo);
  return o;
}

export function dispose(ctx: Ctx, id: string, b: { reason: string }) {
  const u = requireRole(ctx, ['MANAGER']);
  const o = findOrder(id);
  if (o.status !== 'READY_FOR_PICKUP' || !o.readyNotifiedAt) fail(409, 'ORDER_NOT_READY');
  const days = (now().getTime() - new Date(o.readyNotifiedAt!).getTime()) / 86400_000;
  if (days < state.settings.handover.disposalDays) fail(409, 'DISPOSAL_TOO_EARLY', undefined, { days: Math.floor(days), required: state.settings.handover.disposalDays });
  if (!b.reason?.trim()) fail(422, 'REQUIRED', 'reason');
  o.status = 'UNCLAIMED_DISPOSED';
  o.disposal = { reason: b.reason, by: u.name, at: iso() };
  audit(u, 'Order', o.id, 'ORDER_DISPOSED', { status: 'READY_FOR_PICKUP' }, { status: 'UNCLAIMED_DISPOSED', reason: b.reason }, o.orderNo);
  return o;
}

// ---------------- Lists, history, tracking (D-04) ----------------
export function listOrders(ctx: Ctx, q: Record<string, string>) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR', 'ATTENDANT']);
  const search = (q.search ?? '').trim().toLowerCase();
  let rows = state.orders.filter((o) => {
    if (q.status && q.status !== 'ALL') {
      if (q.status === 'OPEN' ? !isOpen(o) || o.status === 'DRAFT' : o.status !== q.status) return false;
    }
    if (q.payment && q.payment !== 'ALL' && o.paymentState !== q.payment) return false;
    if (q.delivery === 'DELIVERY' && !o.deliveryFlag) return false;
    if (q.delivery === 'PICKUP' && o.deliveryFlag) return false;
    if (q.from && o.createdAt.slice(0, 10) < q.from) return false;
    if (q.to && o.createdAt.slice(0, 10) > q.to) return false;
    if (search) {
      const hay = [o.orderNo, o.customerName, o.customerPhone, ...o.items.map((i) => i.tag ?? '')].join(' ').toLowerCase();
      if (!hay.includes(search.replace(/\s/g, '')) && !hay.includes(search)) return false;
    }
    return true;
  });
  const [key, dir] = (q.sort ?? 'createdAt:desc').split(':');
  rows = rows.sort((a, b) => {
    const av = String((a as unknown as Record<string, unknown>)[key] ?? '');
    const bv = String((b as unknown as Record<string, unknown>)[key] ?? '');
    const cmp = key === 'balance' ? a.balance - b.balance : av.localeCompare(bv);
    return dir === 'asc' ? cmp : -cmp;
  });
  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(100, Math.max(5, Number(q.pageSize ?? 20)));
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export function getOrder(ctx: Ctx, id: string) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR', 'ATTENDANT', 'RIDER']);
  return findOrder(id);
}

export function orderHistory(ctx: Ctx, id: string) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR', 'ADMIN']);
  const o = findOrder(id);
  const itemIds = new Set(o.items.map((i) => i.id));
  const paymentIds = new Set(o.payments.map((p) => p.id));
  // F-02: the trail for an order can be reconstructed from its own record alone
  return state.audit.filter(
    (e) =>
      e.entityId === o.id ||
      e.entityRef === o.orderNo ||
      itemIds.has(e.entityId) ||
      paymentIds.has(e.entityId),
  );
}

const TIMELINE_LABELS: Record<string, string> = {
  ORDER_FINALISED: 'Order received at the counter',
  STATUS_IN_SORTING: 'Sorting started',
  STATUS_IN_PROCESSING: 'Processing started',
  STATUS_QC_PASSED: 'Quality check passed',
  STATUS_QC_FAILED: 'Quality check — item sent back for attention',
  ORDER_PACKAGED: 'Packed',
  READY_NOTIFICATION_SENT: 'Ready, customer notified',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERY_FAILED: 'Delivery attempt failed — will be rescheduled',
  ORDER_DELIVERED: 'Delivered',
  ORDER_COLLECTED: 'Collected',
  ORDER_CANCELLED: 'Cancelled',
  ORDER_DISPOSED: 'Unclaimed — disposed',
  PAYMENT_RECORDED: 'Payment received',
};

export function customerTimeline(o: T.Order): T.TimelineEntry[] {
  return state.audit
    .filter((e) => (e.entityId === o.id || e.entityRef === o.orderNo) && e.entityType === 'Order' && TIMELINE_LABELS[e.action])
    .map((e) => ({ at: e.at, label: TIMELINE_LABELS[e.action] }));
}

export function trackingView(o: T.Order): T.TrackingView {
  return {
    orderNo: o.orderNo,
    status: o.status,
    expectedReadyBy: o.expectedReadyBy,
    deliveryFlag: o.deliveryFlag,
    shelf: o.status === 'READY_FOR_PICKUP' ? o.shelf : undefined,
    timeline: customerTimeline(o),
  };
}

// Public lookup: order number only (D8 / OQ5). Minimal view, no personal data. The real API must rate-limit.
const trackHits: number[] = [];
export function track(_ctx: Ctx, q: { orderNo?: string }) {
  const t = Date.now();
  while (trackHits.length && t - trackHits[0] > 60_000) trackHits.shift();
  if (trackHits.length >= 30) fail(429, 'TOO_MANY_REQUESTS');
  trackHits.push(t);
  const no = (q.orderNo ?? '').trim().toUpperCase();
  if (!no) return fail(422, 'REQUIRED', 'orderNo');
  const o = state.orders.find((x) => x.orderNo.toUpperCase() === no && x.status !== 'DRAFT');
  if (!o) return fail(404, 'TRACK_NOT_FOUND', 'orderNo');
  return [trackingView(o)];
}

export function requestCreditOverride(ctx: Ctx, id: string, b: { reason: string }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(id);
  if (!o.onAccount || o.status !== 'DRAFT') fail(409, 'NOT_CORPORATE');
  if (!b.reason?.trim()) fail(422, 'REQUIRED', 'reason');
  if (state.approvals.some((a) => a.orderId === o.id && a.kind === 'CREDIT_OVERRIDE' && a.status === 'PENDING')) fail(409, 'ALREADY_REQUESTED');
  const inv = computeInvoice(o);
  const a: T.ApprovalRequest = {
    id: uid('apr'),
    kind: 'CREDIT_OVERRIDE',
    orderId: o.id,
    orderNo: o.orderNo,
    amount: inv.total,
    reason: b.reason,
    requestedBy: u.id,
    requestedByName: u.name,
    requestedAt: iso(),
    status: 'PENDING',
  };
  state.approvals.push(a);
  o.creditOverride = 'PENDING';
  audit(u, 'Approval', a.id, 'CREDIT_OVERRIDE_REQUESTED', undefined, { amount: a.amount, reason: a.reason }, o.orderNo);
  notifyStaff({ role: 'MANAGER' }, `Credit-limit override requested for ${o.orderNo}`, '/staff/approvals');
  return a;
}

export function getPayment(ctx: Ctx, id: string) {
  const u = requireUser(ctx);
  const o = state.orders.find((x) => x.payments.some((p) => p.id === id));
  if (!o) return fail(404, 'NOT_FOUND');
  const isStaff = u.roles.some((r) => ['FRONT_DESK', 'MANAGER', 'AUDITOR'].includes(r));
  if (!isStaff && u.customerId !== o.customerId) fail(404, 'NOT_FOUND');
  return { order: o, payment: o.payments.find((p) => p.id === id)! };
}

export function printableOrder(ctx: Ctx, id: string) {
  const u = requireUser(ctx);
  const o = findOrder(id);
  const isStaff = u.roles.some((r) => ['FRONT_DESK', 'MANAGER', 'AUDITOR', 'ATTENDANT'].includes(r));
  if (!isStaff && u.customerId !== o.customerId) fail(404, 'NOT_FOUND');
  return o;
}

export { requireUser };
