/**
 * Synthetic demo data (SRS §2.7 — never real customer data).
 * Seeding drives the same service functions the API uses, with a moved clock,
 * so every seeded record has a consistent audit trail.
 */
import type * as T from '@ldy/api-client';
import { DB_VERSION, setState, state, setSeedNow, persist, loadPersisted, clearPersisted, audit, type Db, type StoredUser, type Ctx } from './store';
import { DEFAULT_SETTINGS } from './services/config';
import { DEFAULT_TEMPLATES } from './services/notifications';
import * as ord from './services/orders';
import * as flr from './services/floor';
import * as dlv from './services/delivery';
import * as bil from './services/billing';

export const DEMO_PASSWORD = 'Password123!';

function user(id: string, name: string, username: string, roles: T.Role[], extra: Partial<StoredUser> = {}): StoredUser {
  return { id, name, username, email: username.includes('@') ? username : undefined, roles, status: 'ACTIVE', mfaEnabled: false, password: DEMO_PASSWORD, failedAttempts: 0, ...extra };
}

function emptyDb(): Db {
  return {
    version: DB_VERSION,
    clockOffsetMs: 0,
    counters: {},
    users: [
      user('u_admin', 'Kwame Mensah', 'admin@ldy.test', ['ADMIN'], { phone: '0244000001' }),
      user('u_mgr', 'Efua Boateng', 'manager@ldy.test', ['MANAGER'], { phone: '0244000002' }),
      user('u_mgr2', 'Kofi Ansah', 'manager2@ldy.test', ['MANAGER'], { phone: '0244000009' }),
      user('u_fd', 'Akosua Owusu', 'frontdesk@ldy.test', ['FRONT_DESK'], { phone: '0244000003' }),
      user('u_att', 'Yaw Asante', 'attendant@ldy.test', ['ATTENDANT'], { phone: '0244000004' }),
      user('u_att2', 'Adwoa Darko', 'attendant2@ldy.test', ['ATTENDANT'], { phone: '0244000005' }),
      user('u_rider', 'Kojo Appiah', 'rider@ldy.test', ['RIDER'], { phone: '0244000006' }),
      user('u_aud', 'Abena Ofori', 'auditor@ldy.test', ['AUDITOR'], { phone: '0244000007' }),
      user('u_multi', 'Nana Agyeman', 'counter2@ldy.test', ['FRONT_DESK', 'ATTENDANT'], { phone: '0244000008' }),
    ],
    sessions: {},
    resetCodes: {},
    settings: structuredClone(DEFAULT_SETTINGS),
    serviceTypes: [
      { id: 'svc_wi', name: 'Wash & Iron', pricing: 'PER_ITEM', stages: ['Wash', 'Dry', 'Iron'], active: true },
      { id: 'svc_dc', name: 'Dry Clean', pricing: 'PER_ITEM', stages: ['Solvent Clean', 'Press'], active: true },
      { id: 'svc_io', name: 'Iron Only', pricing: 'PER_ITEM', stages: ['Iron'], active: true },
      { id: 'svc_wf', name: 'Wash & Fold (per kg)', pricing: 'PER_KG', stages: ['Wash', 'Dry', 'Fold'], active: true },
    ],
    categories: [
      { id: 'cat_shirt', name: 'Shirt' },
      { id: 'cat_trousers', name: 'Trousers' },
      { id: 'cat_dress', name: 'Dress' },
      { id: 'cat_suit', name: 'Suit (2-piece)' },
      { id: 'cat_bedsheet', name: 'Bedsheet' },
      { id: 'cat_duvet', name: 'Duvet' },
      { id: 'cat_trad', name: 'Traditional wear (kaba & slit)' },
    ],
    prices: [
      ['cat_shirt', 'svc_wi', 15], ['cat_shirt', 'svc_dc', 30], ['cat_shirt', 'svc_io', 8],
      ['cat_trousers', 'svc_wi', 18], ['cat_trousers', 'svc_dc', 35], ['cat_trousers', 'svc_io', 10],
      ['cat_dress', 'svc_wi', 20], ['cat_dress', 'svc_dc', 40], ['cat_dress', 'svc_io', 12],
      // Suit + Wash & Iron is deliberately NOT priced so "No Price Configured" (E-01) can be demonstrated
      ['cat_suit', 'svc_dc', 80], ['cat_suit', 'svc_io', 25],
      ['cat_bedsheet', 'svc_wi', 20], ['cat_bedsheet', 'svc_io', 10],
      ['cat_duvet', 'svc_wi', 60], ['cat_duvet', 'svc_dc', 90],
      ['cat_trad', 'svc_wi', 25], ['cat_trad', 'svc_dc', 45], ['cat_trad', 'svc_io', 12],
      ['*', 'svc_wf', 12],
    ].map(([c, s, p], i) => ({ id: `prc_${i}`, categoryId: c as string, serviceTypeId: s as string, price: p as number })),
    machines: [
      { id: 'm_w1', name: 'Washer 1', type: 'WASHER', status: 'AVAILABLE', minutesInUse: 0 },
      { id: 'm_w2', name: 'Washer 2', type: 'WASHER', status: 'UNDER_MAINTENANCE', minutesInUse: 0 },
      { id: 'm_w3', name: 'Washer 3', type: 'WASHER', status: 'AVAILABLE', minutesInUse: 0 },
      { id: 'm_d1', name: 'Dryer 1', type: 'DRYER', status: 'AVAILABLE', minutesInUse: 0 },
      { id: 'm_p1', name: 'Steam Press 1', type: 'PRESS', status: 'AVAILABLE', minutesInUse: 0 },
      { id: 'm_s1', name: 'Ironing Station 1', type: 'STATION', status: 'AVAILABLE', minutesInUse: 0 },
      { id: 'm_dc', name: 'Dry-Clean Unit', type: 'WASHER', status: 'AVAILABLE', minutesInUse: 0 },
    ],
    customers: [],
    orders: [],
    batches: [],
    damage: [],
    routes: [],
    approvals: [],
    cashups: [],
    statements: [],
    bookings: [],
    audit: [],
    templates: structuredClone(DEFAULT_TEMPLATES),
    notificationLog: [],
    inApp: [],
    imports: [],
    alertedBatches: [],
  };
}

const H = 3600_000;
const D = 24 * H;

function seed() {
  const real = Date.now();
  const at = (msAgo: number) => setSeedNow(new Date(real - msAgo));
  const ctxOf = (id: string): Ctx => ({ user: state.users.find((u) => u.id === id)! });
  const fd = ctxOf('u_fd');
  const mgr = ctxOf('u_mgr');
  const mgr2 = ctxOf('u_mgr2');
  const att = ctxOf('u_att');
  const att2 = ctxOf('u_att2');
  const rider = ctxOf('u_rider');

  // ---- Customers (A-01) ----
  at(120 * D);
  const mk = (name: string, phone: string, email?: string, address?: string, accountType: 'INDIVIDUAL' | 'CORPORATE' = 'INDIVIDUAL') =>
    ord.createCustomerRecord(fd.user, { name, phone, email, address, accountType, preferences: { starch: name.length % 2 === 0, softener: true, finish: name.length % 3 ? 'HANGER' : 'FOLD' } });
  const ama = mk('Ama Serwaa', '0244123456', 'ama.serwaa@example.com', 'House 14, Ringway Estate, Osu');
  const kwesi = mk('Kwesi Boateng', '0554987654', undefined, 'Spintex Road, near Coca-Cola roundabout');
  const esi = mk('Esi Mensah', '0201112233', 'esi.mensah@example.com', 'Dzorwulu, Accra');
  const yaa = mk('Yaa Asantewaa', '0277334455', 'yaa@example.com', 'Adenta Housing Down');
  const fiifi = mk('Fiifi Quayson', '0509876543', undefined, 'Tema Community 11');
  const hotel = ord.createCustomerRecord(mgr.user, {
    name: 'Osu Grand Hotel Ltd (fictional)', phone: '0302123456', email: 'accounts@osugrand.example.com', address: 'Cantonments Road, Accra', accountType: 'CORPORATE',
  });
  // portal accounts for two customers
  state.users.push(user('u_cust_ama', 'Ama Serwaa', '0244123456', ['CUSTOMER'], { email: 'ama.serwaa@example.com', phone: '0244123456', customerId: ama.id }));
  state.users.push(user('u_cust_esi', 'Esi Mensah', '0201112233', ['CUSTOMER'], { email: 'esi.mensah@example.com', phone: '0201112233', customerId: esi.id }));

  type ItemSpec = [string, string, number, T.Colour?, T.Fabric?, string?, { type: T.FlagType; note?: string }[]?];
  const newOrder = (ctx: Ctx, customer: T.Customer | null, items: ItemSpec[], opts: { express?: boolean; delivery?: boolean; guest?: { name: string; phone: string }; onAccount?: boolean } = {}) => {
    let o = ord.createDraft(ctx, customer ? { customerId: customer.id } : { guest: opts.guest });
    if (opts.express || opts.delivery || opts.onAccount !== undefined)
      o = ord.updateDraft(ctx, o.id, {
        speed: opts.express ? 'EXPRESS' : 'STANDARD',
        deliveryFlag: Boolean(opts.delivery),
        deliveryAddress: customer?.address,
        onAccount: opts.onAccount,
      });
    for (const [cat, svc, qty, colour, fabric, instr, flags] of items) {
      ord.addItem(ctx, o.id, { categoryId: cat, serviceTypeId: svc, quantity: svc === 'svc_wf' ? 1 : qty, weightKg: svc === 'svc_wf' ? qty : undefined, colour: colour ?? 'COLOURS', fabric: fabric ?? 'REGULAR', instructions: instr, flags });
    }
    return ord.finalise(ctx, o.id);
  };
  const payFull = (ctx: Ctx, o: T.Order, method: T.Payment['method'] = 'CASH') =>
    ord.pay(ctx, o.id, { amount: o.balance, method, reference: method === 'CASH' ? undefined : `MP${Math.floor(Math.random() * 1e9)}`, tendered: method === 'CASH' ? Math.ceil(o.balance / 10) * 10 : undefined });

  /** Run an order all the way through the floor to Packaged. */
  const process = (o: T.Order, shelf: string, opts: { stop?: 'SORTED' | 'STAGE1' | 'PROCESSED' | 'QC' } = {}) => {
    const groups = new Map<string, T.OrderItem[]>();
    for (const i of findOrder(o.id).items) {
      const key = `${i.serviceTypeId}|${i.colour}|${i.fabric}`;
      groups.set(key, [...(groups.get(key) ?? []), i]);
    }
    for (const [key, items] of groups) {
      const [svc, colour, fabric] = key.split('|');
      const b = flr.createBatchAs(att.user!, { serviceTypeId: svc, colour: colour as T.Colour, fabric: fabric as T.Fabric });
      items.forEach((i) => flr.addToBatchAs(att.user!, b.id, i.tag!));
      if (opts.stop === 'SORTED') continue;
      const machine = state.machines.find((m) => m.status === 'AVAILABLE' && m.type === (svc === 'svc_dc' ? 'WASHER' : svc === 'svc_io' ? 'STATION' : 'WASHER'));
      if (machine) flr.assignMachineAs(att.user!, b.id, machine.id);
      flr.startStageAs(att.user!, b.id);
      if (opts.stop === 'STAGE1') continue;
      while (state.batches.find((x) => x.id === b.id)!.status !== 'PROCESSING_COMPLETE') {
        flr.startStageAs(att.user!, b.id);
        flr.completeStageAs(att.user!, b.id);
      }
    }
    if (opts.stop) return findOrder(o.id);
    for (const i of findOrder(o.id).items) if (i.status === 'PROCESSING_COMPLETE') flr.qcAs(att2.user!, i.id, { outcome: 'PASS' });
    if (opts.stop === 'QC') return findOrder(o.id);
    const ord2 = findOrder(o.id);
    ord2.items.forEach((i) => flr.checkManifestAs(att.user!, o.id, { tag: i.tag!, shelf }));
    return findOrder(o.id);
  };
  const findOrder = (id: string) => state.orders.find((x) => x.id === id)!;

  // 1) Collected 6 days ago (history + revenue)
  at(9 * D);
  const o1 = newOrder(fd, kwesi, [['cat_shirt', 'svc_wi', 5, 'WHITES'], ['cat_trousers', 'svc_wi', 2, 'DARKS']]);
  payFull(fd, o1, 'MOMO');
  at(8 * D);
  process(o1, 'A-01');
  at(6 * D);
  ord.collect(fd, o1.id, { identityNote: 'Phone number confirmed' });

  // 2) Delivered last week with proof of delivery — Ama (portal user)
  at(8 * D);
  const o2 = newOrder(fd, ama, [['cat_dress', 'svc_dc', 2, 'COLOURS', 'DELICATE', 'Silk lining — low heat'], ['cat_bedsheet', 'svc_wi', 2, 'WHITES']], { delivery: true });
  payFull(fd, o2, 'CARD');
  at(7 * D);
  process(o2, 'D-02');
  const r0 = dlv.createRoute(fd, { date: new Date(real - 7 * D).toISOString().slice(0, 10), window: '14:00–17:00', riderId: 'u_rider' });
  dlv.addOrderToRoute(fd, r0.id, { orderId: o2.id });
  dlv.departRoute(fd, r0.id);
  at(7 * D - 3 * H);
  dlv.deliveryOutcome(rider, o2.id, {
    outcome: 'DELIVERED',
    recipientName: 'Ama Serwaa',
    signature: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><path d="M10 60 C 40 10, 60 10, 80 50 S 130 70, 150 30 S 200 20, 230 55" stroke="#0b3b4a" stroke-width="3" fill="none"/></svg>'),
  });

  // 3) Ready for pickup 95 days ago — eligible for disposal (D-01)
  at(98 * D);
  const o3 = newOrder(fd, fiifi, [['cat_suit', 'svc_dc', 1, 'DARKS']]);
  at(95 * D);
  process(o3, 'Z-09');

  // 4) Ready 15 days ago — uncollected, reminders at 7 and 14 days, manager flag
  at(17 * D);
  const o4 = newOrder(fd, yaa, [['cat_trad', 'svc_wi', 3, 'COLOURS'], ['cat_shirt', 'svc_io', 4, 'COLOURS']]);
  ord.pay(fd, o4.id, { amount: 50, method: 'CASH', tendered: 50 });
  at(15 * D);
  process(o4, 'B-07');

  // 5) Ready for pickup 2 days ago, fully paid — collection demo
  at(4 * D);
  const o5 = newOrder(fd, esi, [['cat_shirt', 'svc_wi', 6, 'WHITES'], ['cat_duvet', 'svc_wi', 1, 'WHITES']], { express: true });
  payFull(fd, o5, 'MOMO');
  at(2 * D);
  process(o5, 'A-03');

  // 6) Ready for pickup, balance outstanding — "Payment Outstanding" demo (guest)
  at(3 * D);
  const o6 = newOrder(fd, null, [['cat_trousers', 'svc_dc', 2, 'DARKS'], ['cat_shirt', 'svc_dc', 2, 'COLOURS']], { guest: { name: 'Mr Owusu', phone: '0261234567' } });
  ord.pay(fd, o6.id, { amount: 40, method: 'MOMO', reference: 'MP556677889' });
  at(1 * D);
  process(o6, 'A-04');

  // 7) Delivery order packed today, waiting in the dispatch queue
  at(2 * D);
  const o7 = newOrder(fd, kwesi, [['*', 'svc_wf', 6.5, 'COLOURS']], { delivery: true });
  payFull(fd, o7, 'CASH');
  at(5 * H);
  process(o7, 'D-05');

  // 8) QC: processing complete, waiting for inspection (Ama)
  at(30 * H);
  const o8 = newOrder(fd, ama, [['cat_shirt', 'svc_wi', 3, 'WHITES'], ['cat_trousers', 'svc_wi', 2, 'WHITES', 'REGULAR', 'Crease front']]);
  ord.pay(fd, o8.id, { amount: 30, method: 'MOMO', reference: 'MP123450001' });
  at(26 * H);
  process(o8, '', { stop: 'PROCESSED' });

  // 9) QC failed item awaiting resolution + damage report
  at(28 * H);
  const o9 = newOrder(fd, yaa, [
    ['cat_dress', 'svc_wi', 1, 'COLOURS', 'DELICATE', 'Hand-finish the hem', [{ type: 'STAIN', note: 'Small oil stain on left sleeve at intake' }]],
    ['cat_bedsheet', 'svc_wi', 1, 'COLOURS', 'DELICATE'],
  ]);
  payFull(fd, o9, 'CASH');
  at(24 * H);
  process(o9, '', { stop: 'PROCESSED' });
  at(20 * H);
  const failed = findOrder(o9.id).items[0];
  flr.qcAs(att2.user!, failed.id, { outcome: 'FAIL', reason: 'Oil stain still visible after wash' });
  flr.createDamageAs(att2.user!, { itemId: failed.id, type: 'DAMAGE', description: 'Seam split along the hem (not noted at intake)' });

  // 10) In processing — washing started 5 h ago (over the 4 h alert threshold) (B-02)
  at(7 * H);
  const o10 = newOrder(fd, esi, [['cat_bedsheet', 'svc_wi', 4, 'WHITES'], ['cat_shirt', 'svc_wi', 2, 'WHITES']]);
  payFull(fd, o10, 'CARD');
  at(5 * H);
  process(o10, '', { stop: 'STAGE1' });

  // 11) Received this morning — ready to be sorted (walk-in guest)
  at(1 * H);
  const o11 = newOrder(fd, null, [['cat_shirt', 'svc_wi', 4, 'COLOURS'], ['cat_trousers', 'svc_wi', 1, 'DARKS'], ['cat_dress', 'svc_dc', 1, 'COLOURS', 'DELICATE', '', [{ type: 'DELICATE', note: 'Beaded front' }]]], {
    guest: { name: 'Ms Adjei', phone: '0249876501' },
  });
  payFull(fd, o11, 'CASH');

  // 12) Received, unpaid (pay at collection), express
  at(30 * 60_000);
  newOrder(fd, fiifi, [['cat_trad', 'svc_dc', 2, 'COLOURS', 'DELICATE']], { express: true });

  // 13) Corporate on-account orders (E-04)
  at(20 * D);
  const c1 = newOrder(mgr, hotel, [['cat_bedsheet', 'svc_wi', 40, 'WHITES'], ['cat_duvet', 'svc_wi', 6, 'WHITES']], { onAccount: true });
  at(19 * D);
  process(c1, 'C-01');
  ord.collect(fd, c1.id, { identityNote: 'Hotel driver, staff ID shown' });
  at(3 * D);
  const c2 = newOrder(mgr, hotel, [['cat_bedsheet', 'svc_wi', 30, 'WHITES']], { onAccount: true });
  process(c2, '', { stop: 'SORTED' });

  // 14) A pending refund request raised by the Front Desk (E-03)
  at(6 * D);
  bil.requestRefund(fd, { orderId: o1.id, amount: 15, reason: 'One shirt returned with a missing button — goodwill refund', kind: 'REFUND' });

  // 15) Cash-ups: yesterday's flagged session, closed by the Front Desk (E-05)
  at(30 * H);
  const yesterdayCash = state.cashups.find((c) => c.officerId === 'u_fd' && c.status === 'OPEN');
  if (yesterdayCash) {
    const view = bil.currentCashupView(fd);
    bil.closeCashup(fd, view.id, { counted: { CASH: Math.max(0, view.expected.CASH - 12), CARD: view.expected.CARD, MOMO: view.expected.MOMO } });
  }
  // the manager's earlier cash session was balanced
  const mgrCash = state.cashups.find((c) => c.officerId === 'u_mgr' && c.status === 'OPEN');
  if (mgrCash) {
    const v = bil.currentCashupView(mgr);
    bil.closeCashup(mgr, v.id, { counted: { ...v.expected } });
  }
  void mgr2;

  // 16) Bookings today (A-06): a pickup assigned to the rider, a drop-off, and a full slot
  at(2 * D);
  const today = new Date(real).toISOString().slice(0, 10);
  const tomorrow = new Date(real + D).toISOString().slice(0, 10);
  const asCust = (uid: string): Ctx => ({ user: state.users.find((u) => u.id === uid)! });
  const b1 = dlv.createBooking(asCust('u_cust_ama'), { serviceTypeId: 'svc_wi', kind: 'PICKUP', address: ama.address, date: tomorrow, slot: '10:00' });
  dlv.assignBookingRider(fd, b1.id, { riderId: 'u_rider' });
  dlv.createBooking(asCust('u_cust_esi'), { serviceTypeId: 'svc_dc', kind: 'DROPOFF', date: tomorrow, slot: '11:00' });
  for (let i = 0; i < state.settings.bookings.maxPerSlot; i++) {
    dlv.createBooking(asCust(i % 2 ? 'u_cust_esi' : 'u_cust_ama'), { serviceTypeId: 'svc_wi', kind: 'DROPOFF', date: tomorrow, slot: '09:00' });
  }
  void today;

  // realistic machine usage history for the utilisation report (seeded stages complete instantly)
  const usage: Record<string, number> = { m_w1: 9100, m_w3: 5200, m_d1: 7400, m_p1: 3900, m_s1: 4600, m_dc: 2800, m_w2: 600 };
  state.machines.forEach((m) => (m.minutesInUse += usage[m.id] ?? 0));

  setSeedNow(null);
  audit(null, 'System', 'seed', 'DEMO_DATA_LOADED', undefined, { orders: state.orders.length, customers: state.customers.length });
}

export function initDb() {
  const persisted = loadPersisted();
  if (persisted) {
    setState(persisted);
    return;
  }
  setState(emptyDb());
  seed();
  persist();
}

export function resetDb() {
  clearPersisted();
  setState(emptyDb());
  seed();
  persist();
}

/** Dev helper: move the mock clock forward to demonstrate time-based rules (alerts, reminders, disposal). */
export function advanceClock(hours: number) {
  state.clockOffsetMs += hours * 3600_000;
  return { now: new Date(Date.now() + state.clockOffsetMs).toISOString() };
}
