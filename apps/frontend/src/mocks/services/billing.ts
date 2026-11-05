// E-03 Refunds & adjustments, E-04 Corporate accounts, E-05 Daily cash-up; SoD rules SRS §2.4 / NFR-SEC2
import type * as T from '@ldy/api-client';
import { state, fail, uid, iso, now, audit, nextNo, round2, requireRole, findOrder, notifyStaff, type Ctx } from '../store';
import { recompute, currentCashup, contactOf } from './orders';
import { notifyCustomer } from './notifications';

export function listApprovals(ctx: Ctx, status?: string) {
  requireRole(ctx, ['MANAGER', 'AUDITOR', 'FRONT_DESK']);
  return state.approvals.filter((a) => !status || a.status === status).slice().reverse();
}

function refundable(o: T.Order) {
  const pending = state.approvals
    .filter((a) => a.orderId === o.id && a.kind === 'REFUND' && a.status === 'PENDING')
    .reduce((s, a) => s + (a.amount ?? 0), 0);
  return round2(o.amountPaid - pending);
}

export function requestRefund(ctx: Ctx, b: { orderId: string; amount: number; reason: string; kind: 'REFUND' | 'ADJUSTMENT'; damageReportId?: string }) {
  // Front Desk may raise a request; only a Branch Manager authorises it (E-03).
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const o = findOrder(b.orderId);
  const amount = round2(Number(b.amount));
  if (!(amount > 0)) fail(422, 'INVALID_AMOUNT', 'amount');
  if (!b.reason?.trim()) fail(422, 'REASON_REQUIRED', 'reason');
  if (b.kind === 'REFUND' && amount > refundable(o)) fail(422, 'REFUND_EXCEEDS_PAYMENT', 'amount', { paid: o.amountPaid });
  if (b.kind === 'ADJUSTMENT' && amount > (o.invoice?.total ?? 0)) fail(422, 'ADJUSTMENT_EXCEEDS_TOTAL', 'amount');
  const a: T.ApprovalRequest = {
    id: uid('apr'),
    kind: b.kind,
    orderId: o.id,
    orderNo: o.orderNo,
    amount,
    method: o.payments.filter((p) => p.kind === 'PAYMENT').sort((x, y) => y.amount - x.amount)[0]?.method,
    reason: b.reason.trim(),
    damageReportId: b.damageReportId,
    requestedBy: u.id,
    requestedByName: u.name,
    requestedAt: iso(),
    status: 'PENDING',
  };
  state.approvals.push(a);
  audit(u, 'Approval', a.id, `${b.kind}_REQUESTED`, undefined, { amount, reason: a.reason, damageReportId: a.damageReportId }, o.orderNo);
  notifyStaff({ role: 'MANAGER' }, `${b.kind === 'REFUND' ? 'Refund' : 'Price adjustment'} of ${amount.toFixed(2)} requested on ${o.orderNo}`, '/staff/approvals');
  return a;
}

export function decide(ctx: Ctx, id: string, b: { decision: 'APPROVE' | 'REJECT'; note: string }) {
  const u = requireRole(ctx, ['MANAGER']);
  const a = state.approvals.find((x) => x.id === id);
  if (!a) return fail(404, 'NOT_FOUND');
  if (a.status !== 'PENDING') fail(409, 'ALREADY_DECIDED');
  if (!b.note?.trim()) fail(422, 'REASON_REQUIRED', 'note');
  // Maker-checker: the person who raised the request can never approve it.
  if (a.requestedBy === u.id) fail(403, 'SOD_SAME_PERSON');
  const o = findOrder(a.orderId);

  if (b.decision === 'APPROVE') {
    if (a.kind === 'REFUND' || a.kind === 'ADJUSTMENT') {
      // SRS §2.4: a user who captured payment on this order cannot authorise its refund or adjustment
      if (o.payments.some((p) => p.kind === 'PAYMENT' && p.by === u.id)) fail(403, 'SOD_PAYMENT_CAPTURER');
    }
    if (a.kind === 'REFUND') {
      if ((a.amount ?? 0) > round2(o.amountPaid)) fail(422, 'REFUND_EXCEEDS_PAYMENT', 'amount', { paid: o.amountPaid });
      const cash = currentCashup(u);
      const p: T.Payment & { cashupId: string } = {
        id: uid('pay'),
        orderId: o.id,
        amount: a.amount!,
        method: a.method ?? 'CASH', // recorded against the original method; cash is a cash-out
        at: iso(),
        by: u.id,
        byName: u.name,
        receiptNo: nextNo('receipt', `RFD-${now().getFullYear()}-`),
        kind: 'REFUND',
        cashupId: cash.id,
      };
      o.payments.push(p);
      audit(u, 'Payment', p.id, 'REFUND_PAID', undefined, { amount: p.amount, method: p.method, approval: a.id }, o.orderNo);
    }
    if (a.kind === 'QC_OVERRIDE' || a.kind === 'REWORK_REVIEW') {
      const item = o.items.find((i) => i.id === a.itemId);
      if (item) {
        item.needsManagerReview = false;
        if (a.kind === 'QC_OVERRIDE') {
          item.overrideApproved = true;
          item.status = 'QC_PASSED';
          item.qc.push({ outcome: 'PASS', reason: `Manager override: ${b.note}`, by: u.id, byName: u.name, at: iso() });
        } else {
          // one more rework allowed past the limit
          item.overrideApproved = true;
        }
      }
    }
    if (a.kind === 'CREDIT_OVERRIDE') o.creditOverride = 'APPROVED';
  } else if (a.kind === 'CREDIT_OVERRIDE') o.creditOverride = 'REJECTED';

  a.status = b.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  a.decidedBy = u.id;
  a.decidedByName = u.name;
  a.decidedAt = iso();
  a.decisionNote = b.note.trim();
  recompute(o);
  audit(u, 'Approval', a.id, `${a.kind}_${a.status}`, { status: 'PENDING' }, { status: a.status, note: a.decisionNote, amount: a.amount }, o.orderNo);
  notifyStaff({ userId: a.requestedBy }, `${a.kind.replace(/_/g, ' ').toLowerCase()} on ${o.orderNo} was ${a.status.toLowerCase()} by ${u.name}`);
  if (a.kind === 'REFUND' && a.status === 'APPROVED') {
    const cur = state.settings.organisation.currency;
    notifyCustomer('RECEIPT', contactOf(o), { receiptNo: 'Refund', amount: `${cur} ${a.amount!.toFixed(2)} refunded`, reference: o.orderNo, balance: `${cur} ${o.balance.toFixed(2)}` }, o.orderNo);
  }
  return a;
}

// ---------------- Cash-up (E-05) ----------------
function sessionPayments(c: T.Cashup) {
  const all: (T.Payment & { cashupId?: string })[] = state.orders.flatMap((o) => o.payments as (T.Payment & { cashupId?: string })[]);
  return all.filter((p) => p.cashupId === c.id);
}

function expectedFor(c: T.Cashup): T.MethodTotals {
  const t: T.MethodTotals = { CASH: 0, CARD: 0, MOMO: 0 };
  for (const p of sessionPayments(c)) t[p.method] = round2(t[p.method] + (p.kind === 'PAYMENT' ? p.amount : -p.amount));
  // corporate statement payments captured in this session
  for (const s of state.statements as (T.Statement & { payments?: { amount: number; method: T.Payment['method']; cashupId: string }[] })[]) {
    for (const p of s.payments ?? []) if (p.cashupId === c.id) t[p.method] = round2(t[p.method] + p.amount);
  }
  return t;
}

function view(c: T.Cashup): T.Cashup {
  if (c.status === 'OPEN') {
    c.expected = expectedFor(c);
    c.pendingReferences = sessionPayments(c).filter((p) => p.method !== 'CASH' && p.kind === 'PAYMENT' && !p.reference).length;
  }
  return c;
}

export function currentCashupView(ctx: Ctx) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  return view(currentCashup(u));
}

export function listCashups(ctx: Ctx) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR']);
  const isReviewer = u.roles.some((r) => r === 'MANAGER' || r === 'AUDITOR');
  return state.cashups.filter((c) => isReviewer || c.officerId === u.id).map(view).slice().reverse();
}

export function closeCashup(ctx: Ctx, id: string, b: { counted: T.MethodTotals }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const c = state.cashups.find((x) => x.id === id);
  if (!c) return fail(404, 'NOT_FOUND');
  if (c.officerId !== u.id) fail(403, 'FORBIDDEN');
  if (c.status !== 'OPEN') fail(409, 'CASHUP_ALREADY_CLOSED');
  view(c);
  if (c.pendingReferences > 0) fail(409, 'CASHUP_PENDING_REFERENCES', undefined, { count: c.pendingReferences });
  const counted = b.counted;
  for (const k of ['CASH', 'CARD', 'MOMO'] as const) {
    if (typeof counted?.[k] !== 'number' || counted[k] < 0 || Number.isNaN(counted[k])) fail(422, 'INVALID_AMOUNT', `counted.${k}`);
  }
  const variance: T.MethodTotals = {
    CASH: round2(counted.CASH - c.expected.CASH),
    CARD: round2(counted.CARD - c.expected.CARD),
    MOMO: round2(counted.MOMO - c.expected.MOMO),
  };
  const tol = state.settings.billing.cashupTolerance;
  const over = (['CASH', 'CARD', 'MOMO'] as const).some((k) => Math.abs(variance[k]) > tol);
  c.counted = counted;
  c.variance = variance;
  c.closedAt = iso();
  c.status = over ? 'FLAGGED' : 'BALANCED';
  audit(u, 'Cashup', c.id, `CASHUP_${c.status}`, { status: 'OPEN' }, { expected: c.expected, counted, variance, status: c.status }, c.date);
  if (over) notifyStaff({ role: 'MANAGER' }, `Cash-up by ${u.name} (${c.date}) has a variance above tolerance`, '/staff/cashup');
  return c;
}

export function reconcileCashup(ctx: Ctx, id: string, b: { explanation: string }) {
  const u = requireRole(ctx, ['MANAGER']);
  const c = state.cashups.find((x) => x.id === id);
  if (!c) return fail(404, 'NOT_FOUND');
  if (c.officerId === u.id) fail(403, 'SOD_CASHUP_CLOSER'); // the officer who closed it cannot reconcile it
  if (c.status !== 'FLAGGED') fail(409, 'CASHUP_NOT_FLAGGED');
  if (!b.explanation?.trim()) fail(422, 'REASON_REQUIRED', 'explanation');
  c.status = 'RECONCILED';
  c.reviewedBy = u.id;
  c.reviewedByName = u.name;
  c.explanation = b.explanation.trim();
  audit(u, 'Cashup', c.id, 'CASHUP_RECONCILED', { status: 'FLAGGED' }, { status: 'RECONCILED', explanation: c.explanation }, c.date);
  return c;
}

export function cashupReport(ctx: Ctx, id: string): T.CashupReport {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR']);
  const c = state.cashups.find((x) => x.id === id);
  if (!c) return fail(404, 'NOT_FOUND');
  const ps = sessionPayments(view(c));
  const day = c.date;
  return {
    cashup: c,
    payments: ps.filter((p) => p.kind === 'PAYMENT'),
    refunds: ps.filter((p) => p.kind === 'REFUND'),
    adjustments: state.approvals.filter((a) => a.kind === 'ADJUSTMENT' && a.status === 'APPROVED' && a.decidedAt?.slice(0, 10) === day),
  };
}

// ---------------- Corporate (E-04) ----------------
export function listCorporate(ctx: Ctx) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR']);
  return state.customers.filter((c) => c.accountType === 'CORPORATE');
}

export function corporateOrders(ctx: Ctx, customerId: string) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR']);
  return state.orders.filter((o) => o.customerId === customerId && o.onAccount && o.status !== 'DRAFT').slice().reverse();
}

export function listStatements(ctx: Ctx, customerId: string) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR']);
  return state.statements.filter((s) => s.customerId === customerId).slice().reverse();
}

export function generateStatement(ctx: Ctx, customerId: string, b: { from: string; to: string }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const c = state.customers.find((x) => x.id === customerId && x.accountType === 'CORPORATE');
  if (!c) return fail(404, 'NOT_FOUND');
  if (!b.from || !b.to || b.from > b.to) fail(422, 'INVALID_PERIOD', 'from');
  const orders = state.orders.filter(
    (o) => o.customerId === c.id && o.onAccount && o.finalisedAt && o.status !== 'CANCELLED' &&
      o.finalisedAt.slice(0, 10) >= b.from && o.finalisedAt.slice(0, 10) <= b.to,
  );
  const s: T.Statement & { payments: { amount: number; method: T.Payment['method']; cashupId: string; at: string }[] } = {
    id: uid('stm'),
    customerId: c.id,
    customerName: c.name,
    periodFrom: b.from,
    periodTo: b.to,
    orders: orders.map((o) => ({ orderNo: o.orderNo, date: o.finalisedAt!, total: o.invoice?.total ?? 0 })),
    total: round2(orders.reduce((a, o) => a + (o.invoice?.total ?? 0), 0)),
    dueDate: new Date(new Date(`${b.to}T00:00:00Z`).getTime() + (c.corporate?.termsDays ?? 30) * 86400_000).toISOString().slice(0, 10),
    generatedAt: iso(),
    generatedBy: u.name,
    paid: 0,
    payments: [],
  };
  state.statements.push(s);
  audit(u, 'Statement', s.id, 'STATEMENT_GENERATED', undefined, { period: `${b.from}..${b.to}`, orders: s.orders.length, total: s.total }, c.name);
  return s;
}

export function payStatement(ctx: Ctx, id: string, b: { amount: number; method: T.Payment['method']; reference?: string }) {
  const u = requireRole(ctx, ['FRONT_DESK', 'MANAGER']);
  const s = state.statements.find((x) => x.id === id) as (T.Statement & { payments: { amount: number; method: T.Payment['method']; cashupId: string; at: string; reference?: string }[] }) | undefined;
  if (!s) return fail(404, 'NOT_FOUND');
  const amount = round2(Number(b.amount));
  if (!(amount > 0) || amount > round2(s.total - s.paid)) fail(422, 'INVALID_AMOUNT', 'amount');
  if (b.method !== 'CASH' && !b.reference?.trim()) fail(422, 'PAYMENT_REFERENCE_REQUIRED', 'reference');
  const cash = currentCashup(u);
  s.payments = s.payments ?? [];
  s.payments.push({ amount, method: b.method, cashupId: cash.id, at: iso(), reference: b.reference });
  s.paid = round2(s.paid + amount);
  const c = state.customers.find((x) => x.id === s.customerId);
  if (c?.corporate) c.corporate.runningBalance = round2(Math.max(0, c.corporate.runningBalance - amount));
  audit(u, 'Statement', s.id, 'STATEMENT_PAYMENT', undefined, { amount, method: b.method, reference: b.reference }, s.customerName);
  return s;
}

export function getStatement(ctx: Ctx, id: string) {
  requireRole(ctx, ['FRONT_DESK', 'MANAGER', 'AUDITOR']);
  const s = state.statements.find((x) => x.id === id);
  if (!s) return fail(404, 'NOT_FOUND');
  return s;
}
