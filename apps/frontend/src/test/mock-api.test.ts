// Business-rule tests against the mock API. Each test name carries the SRS acceptance criterion it covers.
// When the FastAPI backend is live, the same cases become the integration checklist (Manual Phase Five).
import { beforeEach, describe, expect, it } from 'vitest';
import { dispatch } from '@/mocks/router';
import { resetDb } from '@/mocks/seed';
import { state } from '@/mocks/store';

type Body = { code?: string } & Record<string, unknown>;
function call(method: string, path: string, body?: unknown, token?: string, query: Record<string, string> = {}) {
  const r = dispatch(method, path, query, body, token ?? null);
  return { status: r.status, body: (r.body ?? {}) as Body };
}
function login(username: string, portal: 'staff' | 'customer' = 'staff') {
  const r = call('POST', '/auth/login', { username, password: 'Password123!', portal });
  expect(r.status).toBe(200);
  return r.body.token as string;
}

beforeEach(() => resetDb());

describe('seed', () => {
  it('loads synthetic demo data with an audit trail', () => {
    expect(state.orders.length).toBeGreaterThan(10);
    expect(state.audit.length).toBeGreaterThan(50);
  });
});

describe('F-04 sign-in and accounts', () => {
  it('F-04 AC1: locks after 5 wrong passwords and refuses even the correct password', () => {
    for (let i = 0; i < 4; i++) expect(call('POST', '/auth/login', { username: 'frontdesk@ldy.test', password: 'nope', portal: 'staff' }).status).toBe(401);
    const fifth = call('POST', '/auth/login', { username: 'frontdesk@ldy.test', password: 'nope', portal: 'staff' });
    expect(fifth.body.code).toBe('ACCOUNT_LOCKED');
    const right = call('POST', '/auth/login', { username: 'frontdesk@ldy.test', password: 'Password123!', portal: 'staff' });
    expect(right.body.code).toBe('ACCOUNT_LOCKED');
  });
  it('F-04 AC2: a deactivated user loses their session immediately', () => {
    const fdTok = login('frontdesk@ldy.test');
    const admin = login('admin@ldy.test');
    expect(call('POST', '/users/u_fd/deactivate', {}, admin).status).toBe(200);
    expect(call('GET', '/auth/me', undefined, fdTok).status).toBe(401);
  });
  it('F-04: the last active administrator cannot be deactivated', () => {
    const admin = login('admin@ldy.test');
    expect(call('POST', '/users/u_admin/deactivate', {}, admin).body.code).toBe('LAST_ADMINISTRATOR');
  });
  it('F-04: a Front Desk + Manager role pair needs a recorded justification', () => {
    const admin = login('admin@ldy.test');
    expect(call('PATCH', '/users/u_fd', { roles: ['FRONT_DESK', 'MANAGER'] }, admin).body.code).toBe('SOD_JUSTIFICATION_REQUIRED');
    expect(call('PATCH', '/users/u_fd', { roles: ['FRONT_DESK', 'MANAGER'], sodJustification: 'Owner runs the counter' }, admin).status).toBe(200);
  });
});

describe('Intake → handover journey', () => {
  it('A-02, A-03, E-01, E-02, B-01, B-02, C-01, C-03, D-01, F-02: walk-in order end to end', () => {
    const fd = login('frontdesk@ldy.test');
    const att = login('attendant@ldy.test');
    const att2 = login('attendant2@ldy.test');
    let r = call('POST', '/orders', { guest: { name: 'Test', phone: '0244555666' } }, fd);
    expect(r.status).toBe(201);
    const id = r.body.id as string;
    expect(call('POST', `/orders/${id}/finalise`, {}, fd).body.code).toBe('INCOMPLETE_ORDER'); // A-02 AC2
    expect(call('POST', `/orders/${id}/items`, { categoryId: 'cat_suit', serviceTypeId: 'svc_wi', quantity: 1, colour: 'DARKS', fabric: 'REGULAR' }, fd).body.code).toBe('NO_PRICE_CONFIGURED'); // E-01 AC2
    r = call('POST', `/orders/${id}/items`, { categoryId: 'cat_shirt', serviceTypeId: 'svc_wi', quantity: 2, colour: 'WHITES', fabric: 'REGULAR' }, fd);
    expect(r.body.balance).toBe(30); // E-01 AC1
    r = call('POST', `/orders/${id}/finalise`, {}, fd);
    const o = r.body as unknown as { status: string; items: { tag: string; id: string }[]; expectedReadyBy: string; invoice: { number: string } };
    expect(o.status).toBe('RECEIVED');
    expect(o.items[0].tag).toMatch(/^T\d{5}$/); // A-03 AC1
    expect(o.expectedReadyBy).toBeTruthy();
    expect(o.invoice.number).toMatch(/^INV-/); // E-02 AC1
    expect(call('POST', `/orders/${id}/payments`, { amount: 30, method: 'CARD' }, fd).body.code).toBe('PAYMENT_REFERENCE_REQUIRED');
    expect(call('POST', `/orders/${id}/payments`, { amount: 10, method: 'CASH', tendered: 20 }, fd).status).toBe(200);
    const tag = o.items[0].tag;
    const dc = call('POST', '/batches', { serviceTypeId: 'svc_dc', fabric: 'REGULAR' }, att).body;
    const bad = call('POST', `/batches/${dc.id}/items`, { tag }, att);
    expect(bad.body.code).toBe('INCOMPATIBLE_BATCH'); // B-01 AC2
    expect(JSON.stringify(bad.body)).toContain('service type');
    const b = call('POST', '/batches', { serviceTypeId: 'svc_wi', colour: 'WHITES', fabric: 'REGULAR' }, att).body;
    expect(call('POST', `/batches/${b.id}/items`, { tag }, att).status).toBe(200); // B-01 AC1
    expect((call('POST', `/batches/${b.id}/items`, { tag }, att).body.itemIds as string[]).length).toBe(1); // NFR-R2
    expect(call('POST', `/batches/${b.id}/stage/complete`, {}, att).body.code).toBe('STAGE_OUT_OF_SEQUENCE');
    // D20: every stage has its own Start and Finish
    for (let i = 0; i < 2; i++) {
      call('POST', `/batches/${b.id}/stage/start`, {}, att);
      call('POST', `/batches/${b.id}/stage/complete`, {}, att);
    }
    call('POST', `/batches/${b.id}/stage/start`, {}, att);
    expect(call('POST', `/batches/${b.id}/stage/complete`, {}, att).body.status).toBe('PROCESSING_COMPLETE'); // B-02 AC1
    expect(call('POST', `/orders/${id}/manifest/check`, { tag, shelf: 'A-1' }, att).body.code).toBe('QC_NOT_PASSED'); // C-01
    const q = call('POST', `/items/${o.items[0].id}/qc`, { outcome: 'PASS' }, att2).body as unknown as { item: { status: string } };
    expect(q.item.status).toBe('QC_PASSED'); // C-01 AC1
    const packed = call('POST', `/orders/${id}/manifest/check`, { tag, shelf: 'A-1' }, att).body;
    expect(packed.status).toBe('READY_FOR_PICKUP'); // C-03 AC1 + D-01 AC1
    const orderNo = state.orders.find((x) => x.id === id)!.orderNo;
    expect(state.notificationLog.filter((n) => n.template === 'READY_FOR_PICKUP' && n.reference === orderNo && n.channel === 'EMAIL').length).toBe(1);
    expect(call('POST', `/orders/${id}/collect`, { identityNote: 'ok' }, fd).body.code).toBe('PAYMENT_OUTSTANDING'); // D-01 AC2
    call('POST', `/orders/${id}/payments`, { amount: 20, method: 'MOMO', reference: 'X1' }, fd);
    expect(call('POST', `/orders/${id}/collect`, { identityNote: 'ok' }, fd).body.status).toBe('COLLECTED');
    const hist = call('GET', `/orders/${id}/history`, undefined, login('auditor@ldy.test')).body as unknown as { action: string }[];
    const actions = hist.map((h) => h.action);
    for (const a of ['ORDER_DRAFT_CREATED', 'ORDER_FINALISED', 'STATUS_IN_SORTING', 'STATUS_IN_PROCESSING', 'STATUS_QC_PASSED', 'ORDER_PACKAGED', 'ORDER_COLLECTED'])
      expect(actions).toContain(a); // F-02 AC2
  });

  it('A-05 AC2: cancelling a paid order raises a refund request instead of paying out', () => {
    const fd = login('frontdesk@ldy.test');
    const o = state.orders.find((x) => x.status === 'RECEIVED' && x.amountPaid > 0)!;
    const r = call('POST', `/orders/${o.id}/cancel`, { reason: 'CUSTOMER_REQUEST' }, fd);
    expect(r.body.status).toBe('CANCELLED');
    expect(state.approvals.some((a) => a.orderId === o.id && a.kind === 'REFUND' && a.status === 'PENDING')).toBe(true);
  });

  it('A-05: an order with items in processing cannot be cancelled', () => {
    const fd = login('frontdesk@ldy.test');
    const o = state.orders.find((x) => x.status === 'IN_PROCESSING')!;
    expect(call('POST', `/orders/${o.id}/cancel`, { reason: 'CUSTOMER_REQUEST' }, fd).body.code).toBe('CANNOT_CANCEL_PROCESSING');
  });

  it('B-04 AC2: an item past the rework limit goes to manager review', () => {
    const att = login('attendant@ldy.test');
    const item = state.orders.flatMap((o) => o.items).find((i) => i.status === 'QC_FAILED')!;
    item.reworkCount = 2;
    expect(call('POST', `/items/${item.id}/rework`, { stage: 'Wash', reason: 'Still stained' }, att).body.code).toBe('REWORK_LIMIT_REACHED');
    expect(state.approvals.some((a) => a.kind === 'REWORK_REVIEW' && a.itemId === item.id)).toBe(true);
  });

  it('C-01: with Independent QC on, the finisher cannot record QC', () => {
    const att = login('attendant@ldy.test');
    state.settings.qc.independent = true;
    const item = state.orders.flatMap((o) => o.items).find((i) => i.status === 'PROCESSING_COMPLETE')!;
    expect(call('POST', `/items/${item.id}/qc`, { outcome: 'PASS' }, att).body.code).toBe('INDEPENDENT_QC_REQUIRED');
    expect(call('POST', `/items/${item.id}/qc`, { outcome: 'PASS' }, login('attendant2@ldy.test')).status).toBe(200);
  });
});

describe('SoD and approvals (SRS §2.4)', () => {
  it('E-03 AC2: Front Desk cannot approve a refund; a manager who did not take payment can', () => {
    const fd = login('frontdesk@ldy.test');
    const mgr = login('manager@ldy.test');
    const pending = state.approvals.find((a) => a.kind === 'REFUND' && a.status === 'PENDING')!;
    expect(call('POST', `/approvals/${pending.id}/decide`, { decision: 'APPROVE', note: 'x' }, fd).status).toBe(403);
    expect(call('POST', `/approvals/${pending.id}/decide`, { decision: 'APPROVE', note: 'Goodwill' }, mgr).body.status).toBe('APPROVED');
  });
  it('E-03: refund cannot exceed the amount paid', () => {
    const fd = login('frontdesk@ldy.test');
    const o = state.orders.find((x) => x.paymentState === 'PAID')!;
    expect(call('POST', '/refunds', { orderId: o.id, amount: o.amountPaid + 1, reason: 'x', kind: 'REFUND' }, fd).body.code).toBe('REFUND_EXCEEDS_PAYMENT');
  });
  it('E-05 AC2: a flagged cash-up is reconciled by a manager, not the officer', () => {
    const flagged = state.cashups.find((c) => c.status === 'FLAGGED')!;
    expect(flagged).toBeTruthy();
    expect(call('POST', `/cashups/${flagged.id}/reconcile`, { explanation: 'x' }, login('frontdesk@ldy.test')).status).toBe(403);
    expect(call('POST', `/cashups/${flagged.id}/reconcile`, { explanation: 'Counted twice' }, login('manager@ldy.test')).body.status).toBe('RECONCILED');
  });
});

describe('D-02 / D-03 delivery', () => {
  it('D-03 AC2 and D-02 AC2: no Delivered without proof; a failure returns the order to the queue', () => {
    const fd = login('frontdesk@ldy.test');
    const rider = login('rider@ldy.test');
    const queue = call('GET', '/routes/queue', undefined, fd).body as unknown as { id: string }[];
    expect(queue.length).toBeGreaterThan(0);
    const route = call('POST', '/routes', { date: '2026-10-25', window: '10:00–12:00', riderId: 'u_rider' }, fd).body;
    call('POST', `/routes/${route.id}/orders`, { orderId: queue[0].id }, fd);
    call('POST', `/routes/${route.id}/depart`, {}, fd);
    expect(call('POST', `/orders/${queue[0].id}/delivery-outcome`, { outcome: 'DELIVERED', recipientName: 'X' }, rider).body.code).toBe('POD_REQUIRED');
    expect(call('POST', `/orders/${queue[0].id}/delivery-outcome`, { outcome: 'FAILED', reason: 'Nobody home' }, rider).body.status).toBe('PACKAGED');
    expect((call('GET', '/routes/queue', undefined, fd).body as unknown as { id: string }[]).some((o) => o.id === queue[0].id)).toBe(true);
  });
  it('D-02: a route at capacity refuses another order', () => {
    const fd = login('frontdesk@ldy.test');
    state.settings.handover.routeCapacity = 1;
    const first = state.orders.find((o) => o.status === 'PACKAGED' && o.deliveryFlag)!;
    const route = call('POST', '/routes', { date: '2026-10-25', window: 'AM', riderId: 'u_rider' }, fd).body;
    call('POST', `/routes/${route.id}/orders`, { orderId: first.id }, fd);
    const clone = structuredClone(first);
    clone.id = 'ord_clone';
    clone.orderNo = 'LDY-CLONE';
    clone.routeId = undefined;
    state.orders.push(clone);
    expect(call('POST', `/routes/${route.id}/orders`, { orderId: 'ord_clone' }, fd).body.code).toBe('ROUTE_AT_CAPACITY');
  });
});

describe('Customer portal', () => {
  it('D-04 AC1 and F-01 AC2: a customer sees and exports only their own orders', () => {
    const tok = login('0244123456', 'customer');
    const mine = call('GET', '/portal/orders', undefined, tok).body as unknown as { customerName: string }[];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((o) => o.customerName === 'Ama Serwaa')).toBe(true);
    const other = state.orders.find((o) => o.customerName === 'Esi Mensah')!;
    expect(call('GET', `/portal/orders/${other.id}`, undefined, tok).status).toBe(404);
    expect(call('GET', '/portal/orders/export', undefined, tok).body.csv).not.toContain('Esi');
  });
  it('A-06 AC1: a full slot is refused and alternatives are offered', () => {
    const tok = login('0244123456', 'customer');
    const full = state.bookings.find((b) => b.slot === '09:00')!;
    const r = call('POST', '/bookings', { serviceTypeId: 'svc_wi', kind: 'DROPOFF', date: full.date, slot: '09:00' }, tok);
    expect(r.body.code).toBe('SLOT_FULL');
    expect(((r.body.details as { alternatives: string[] }).alternatives).length).toBeGreaterThan(0);
  });
  it('D-04 / D8: public tracking works with the order number alone and shows no personal data', () => {
    const o = state.orders.find((x) => x.status === 'READY_FOR_PICKUP')!;
    expect(call('GET', '/track', undefined, undefined, { orderNo: 'LDY-999999' }).status).toBe(404);
    const ok = call('GET', '/track', undefined, undefined, { orderNo: o.orderNo });
    expect(ok.status).toBe(200);
    expect(JSON.stringify(ok.body)).not.toContain(o.customerName); // no personal data in the public view
  });
});

describe('F-02 / F-03 / F-05 / F-06', () => {
  it('F-02 AC1: audit records cannot be edited', () => {
    expect(call('PATCH', `/audit-events/${state.audit[0].id}`, {}, login('manager@ldy.test')).body.code).toBe('AUDIT_IMMUTABLE');
  });
  it('F-03 AC2: a negative price is refused and the old value stays', () => {
    const admin = login('admin@ldy.test');
    const before = state.prices[0].price;
    const r = call('POST', '/price-list', { categoryId: state.prices[0].categoryId, serviceTypeId: state.prices[0].serviceTypeId, price: -5 }, admin);
    expect(r.body.code).toBe('INVALID_CONFIG_VALUE');
    expect(state.prices[0].price).toBe(before);
  });
  it('F-03 AC1: changing an SLA does not alter orders already in progress', () => {
    const o = state.orders.find((x) => x.status === 'RECEIVED')!;
    const before = o.expectedReadyBy;
    call('PATCH', '/settings', { sla: { standardHours: 72, expressHours: 24 } }, login('admin@ldy.test'));
    expect(o.expectedReadyBy).toBe(before);
  });
  it('F-05: a template with an unknown placeholder is refused', () => {
    const r = call('PATCH', '/notification-templates/READY_FOR_PICKUP', { body: 'Hi {nickname}' }, login('admin@ldy.test'));
    expect(r.body.code).toBe('UNKNOWN_PLACEHOLDER');
  });
  it('F-06 AC1: a file with an invalid row commits nothing until the admin chooses', () => {
    const admin = login('admin@ldy.test');
    const csv = 'name,phone,email,address,account_type,credit_limit\nKofi A,0244999888,,,INDIVIDUAL,\nDup,0244123456,,,INDIVIDUAL,';
    const v = call('POST', '/imports', { type: 'customers', fileName: 'c.csv', csv }, admin).body;
    expect(v.rowsRejected).toBe(1);
    const before = state.customers.length;
    expect(call('POST', `/imports/${v.id}/commit`, { mode: 'ALL' }, admin).body.code).toBe('IMPORT_VALIDATION_FAILED');
    expect(state.customers.length).toBe(before);
    expect(call('POST', `/imports/${v.id}/commit`, { mode: 'VALID_ONLY' }, admin).body.rowsCommitted).toBe(1);
  });
});

describe('Redesign round 1 rules', () => {
  it('D20: finishing washing does not start drying; Start drying records its own time', () => {
    const att = login('attendant@ldy.test');
    const item = state.orders.flatMap((o) => o.items).find((i) => i.status === 'RECEIVED')!;
    const r = call('POST', '/loads/scan', { tag: item.tag }, att).body as unknown as { batch: { id: string } };
    const id = r.batch.id;
    call('POST', `/batches/${id}/stage/start`, {}, att);
    const afterFinish = call('POST', `/batches/${id}/stage/complete`, {}, att).body as unknown as { currentStageIndex: number; stages: { startedAt?: string; completedAt?: string }[] };
    expect(afterFinish.stages[0].completedAt).toBeTruthy();
    expect(afterFinish.currentStageIndex).toBe(1);
    expect(afterFinish.stages[1].startedAt).toBeUndefined();
    expect(call('POST', `/batches/${id}/stage/complete`, {}, att).body.code).toBe('STAGE_OUT_OF_SEQUENCE');
    const started = call('POST', `/batches/${id}/stage/start`, {}, att).body as unknown as { stages: { startedAt?: string }[] };
    expect(started.stages[1].startedAt).toBeTruthy();
  });

  it('D27: a scan joins a compatible open load or creates one, and never mixes incompatible items', () => {
    const att = login('attendant@ldy.test');
    const items = state.orders.flatMap((o) => o.items).filter((i) => i.status === 'RECEIVED');
    const results = items.map((i) => call('POST', '/loads/scan', { tag: i.tag }, att).body as unknown as { batch: { id: string }; created: boolean });
    expect(results.some((r) => r.created)).toBe(true);
    for (const b of state.batches.filter((x) => x.status === 'OPEN')) {
      const members = state.orders.flatMap((o) => o.items).filter((i) => b.itemIds.includes(i.id));
      expect(new Set(members.map((m) => `${m.serviceTypeId}|${m.colour}|${m.fabric}`)).size).toBeLessThanOrEqual(1);
    }
    const again = call('POST', '/loads/scan', { tag: items[0].tag }, att).body as unknown as { alreadyIn: boolean };
    expect(again.alreadyIn).toBe(true); // NFR-R2
  });

  it('D14: global search is role-scoped; the attendant never receives names or phone numbers', () => {
    const att = call('GET', '/search', undefined, login('attendant@ldy.test'), { q: 'LDY' }).body as unknown as { customers: unknown[]; orders: { customerName?: string }[] };
    expect(att.customers).toHaveLength(0);
    expect(att.orders.length).toBeGreaterThan(0);
    expect(att.orders.every((o) => o.customerName === undefined)).toBe(true);
    expect(JSON.stringify(att)).not.toMatch(/02\d{8}/);
    const fd = call('GET', '/search', undefined, login('frontdesk@ldy.test'), { q: 'Ama' }).body as unknown as { customers: { phoneMasked: string }[] };
    expect(fd.customers[0].phoneMasked).toContain('•••');
  });

  it('D8 / OQ5: public tracking takes the order number only and returns no personal data', () => {
    const o = state.orders.find((x) => x.status !== 'DRAFT')!;
    const r = call('GET', '/track', undefined, undefined, { orderNo: o.orderNo.toLowerCase() });
    expect(r.status).toBe(200);
    const text = JSON.stringify(r.body);
    expect(text).toContain(o.orderNo);
    expect(text).not.toMatch(/customerName|phone|address|total|balance/i);
    expect(call('GET', '/track', undefined, undefined, { phone: '0244123456' }).body.code).toBe('REQUIRED');
  });

  it('D28: only the Admin can switch Bookings and Corporate off', () => {
    const features = { bookings: false, corporate: true };
    expect(call('PATCH', '/settings', { features }, login('manager@ldy.test')).status).toBe(403);
    const r = call('PATCH', '/settings', { features }, login('admin@ldy.test'));
    expect(r.status).toBe(200);
    expect((call('GET', '/public/settings').body as unknown as { features: typeof features }).features.bookings).toBe(false);
  });

  it('OQ16: self sign-up requires a pickup and delivery address', () => {
    const r = call('POST', '/portal/register', { name: 'Kofi Test', phone: '0244777888', password: 'LongEnough123', consent: true, address: '' });
    expect(r.body.code).toBe('ADDRESS_REQUIRED');
  });
});
