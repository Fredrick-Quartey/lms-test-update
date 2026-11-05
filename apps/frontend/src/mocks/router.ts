/**
 * Route table for the mock API. Each entry mirrors one endpoint in docs/API_CONTRACT.md.
 * When the FastAPI service implements an endpoint, this table is the checklist for parity.
 */
import { state, persist, MockError, type Ctx } from './store';
import * as auth from './services/auth';
import * as cfg from './services/config';
import * as ord from './services/orders';
import * as flr from './services/floor';
import * as dlv from './services/delivery';
import * as bil from './services/billing';
import * as rep from './services/reports';
import * as ntf from './services/notifications';
import { resetDb, advanceClock } from './seed';

type Handler = (ctx: Ctx, p: Record<string, string>, q: Record<string, string>, body: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

const routes: [string, string, Handler][] = [
  // auth (F-04)
  ['POST', '/auth/login', (c, _p, _q, b) => auth.login(c, b)],
  ['POST', '/auth/mfa/verify', (c, _p, _q, b) => auth.verifyMfa(c, b)],
  ['GET', '/auth/me', (c) => auth.me(c)],
  ['POST', '/auth/logout', (c) => auth.logout(c)],
  ['POST', '/auth/password/forgot', (c, _p, _q, b) => auth.forgot(c, b)],
  ['POST', '/auth/password/reset', (c, _p, _q, b) => auth.reset(c, b)],
  // users
  ['GET', '/users', (c) => auth.listUsers(c)],
  ['POST', '/users', (c, _p, _q, b) => auth.createUser(c, b)],
  ['PATCH', '/users/:id', (c, p, _q, b) => auth.updateUser(c, p.id, b)],
  ['POST', '/users/:id/deactivate', (c, p) => auth.deactivateUser(c, p.id)],
  ['POST', '/users/:id/reactivate', (c, p) => auth.reactivateUser(c, p.id)],
  ['POST', '/users/:id/unlock', (c, p) => auth.unlockUser(c, p.id)],
  ['POST', '/users/:id/password-reset', (c, p) => auth.sendReset(c, p.id)],
  ['GET', '/riders', (c) => auth.riders(c)],
  // configuration (F-03, E-01, B-03)
  ['GET', '/settings', (c) => cfg.getSettings(c)],
  ['GET', '/public/settings', () => cfg.publicSettings()],
  ['PATCH', '/settings', (c, _p, _q, b) => cfg.updateSettings(c, b)],
  ['GET', '/catalogue', (c) => cfg.getCatalogue(c)],
  ['GET', '/public/catalogue', () => cfg.publicCatalogue()],
  ['POST', '/price-list', (c, _p, _q, b) => cfg.upsertPrice(c, b)],
  ['DELETE', '/price-list/:id', (c, p) => cfg.deletePrice(c, p.id)],
  ['POST', '/service-types', (c, _p, _q, b) => cfg.upsertServiceType(c, b)],
  ['POST', '/categories', (c, _p, _q, b) => cfg.addCategory(c, b)],
  ['GET', '/machines', (c) => cfg.listMachines(c)],
  ['POST', '/machines', (c, _p, _q, b) => cfg.createMachine(c, b)],
  ['PATCH', '/machines/:id', (c, p, _q, b) => cfg.setMachineStatus(c, p.id, b)],
  // customers (A-01)
  ['GET', '/customers', (c, _p, q) => ord.searchCustomers(c, q.q)],
  ['POST', '/customers', (c, _p, _q, b) => ord.createCustomer(c, b)],
  ['GET', '/customers/:id', (c, p) => ord.getCustomer(c, p.id)],
  ['PATCH', '/customers/:id', (c, p, _q, b) => ord.updateCustomer(c, p.id, b)],
  // orders (A-02..A-05, E-02, D-01, D-04)
  ['GET', '/orders', (c, _p, q) => ord.listOrders(c, q)],
  ['POST', '/orders', (c, _p, _q, b) => ord.createDraft(c, b)],
  ['GET', '/orders/:id', (c, p) => ord.getOrder(c, p.id)],
  ['PATCH', '/orders/:id', (c, p, _q, b) => ord.updateDraft(c, p.id, b)],
  ['GET', '/orders/:id/history', (c, p) => ord.orderHistory(c, p.id)],
  ['POST', '/orders/:id/items', (c, p, _q, b) => ord.addItem(c, p.id, b)],
  ['DELETE', '/orders/:id/items/:itemId', (c, p) => ord.removeItem(c, p.id, p.itemId)],
  ['POST', '/orders/:id/finalise', (c, p) => ord.finalise(c, p.id)],
  ['POST', '/orders/:id/cancel', (c, p, _q, b) => ord.cancel(c, p.id, b)],
  ['POST', '/orders/:id/collect', (c, p, _q, b) => ord.collect(c, p.id, b)],
  ['POST', '/orders/:id/dispose', (c, p, _q, b) => ord.dispose(c, p.id, b)],
  ['POST', '/orders/:id/payments', (c, p, _q, b) => ord.pay(c, p.id, b)],
  ['POST', '/orders/:id/credit-override', (c, p, _q, b) => ord.requestCreditOverride(c, p.id, b)],
  ['POST', '/payments/:id/send', (c, p, _q, b) => ord.sendReceipt(c, p.id, b)],
  ['GET', '/track', (c, _p, q) => ord.track(c, q)],
  ['GET', '/payments/:id', (c, p) => ord.getPayment(c, p.id)],
  ['GET', '/print/orders/:id', (c, p) => ord.printableOrder(c, p.id)],
  ['GET', '/statements/:id', (c, p) => bil.getStatement(c, p.id)],
  // floor (A-03, A-04, B, C)
  ['GET', '/search', (c, _p, q) => rep.search(c, q.q)],
  ['POST', '/loads/scan', (c, _p, _q, b) => flr.scanIntoLoad(c, b)],
  ['GET', '/floor/queue', (c) => flr.floorQueue(c)],
  ['GET', '/tags/:tag', (c, p) => flr.scan(c, p.tag)],
  ['POST', '/tags/:tag/reprint', (c, p) => flr.reprint(c, p.tag)],
  ['POST', '/items/:id/flags', (c, p, _q, b) => flr.addFlag(c, p.id, b)],
  ['POST', '/items/:id/qc', (c, p, _q, b) => flr.qc(c, p.id, b)],
  ['POST', '/items/:id/rework', (c, p, _q, b) => flr.rework(c, p.id, b)],
  ['POST', '/items/:id/qc-override', (c, p, _q, b) => flr.requestQcOverride(c, p.id, b)],
  ['POST', '/items/:id/discard', (c, p, _q, b) => flr.discard(c, p.id, b)],
  ['GET', '/batches', (c, _p, q) => flr.listBatches(c, q.status)],
  ['POST', '/batches', (c, _p, _q, b) => flr.createBatch(c, b)],
  ['GET', '/batches/:id', (c, p) => flr.getBatch(c, p.id)],
  ['POST', '/batches/:id/items', (c, p, _q, b) => flr.addToBatch(c, p.id, b)],
  ['DELETE', '/batches/:id/items/:itemId', (c, p) => flr.removeFromBatch(c, p.id, p.itemId)],
  ['POST', '/batches/:id/machine', (c, p, _q, b) => flr.assignMachine(c, p.id, b)],
  ['POST', '/batches/:id/stage/start', (c, p) => flr.startStage(c, p.id)],
  ['POST', '/batches/:id/stage/complete', (c, p) => flr.completeStage(c, p.id)],
  ['GET', '/damage-reports', (c, _p, q) => flr.listDamage(c, q.status)],
  ['POST', '/damage-reports', (c, _p, _q, b) => flr.createDamage(c, b)],
  ['POST', '/damage-reports/:id/resolve', (c, p, _q, b) => flr.resolveDamage(c, p.id, b)],
  ['GET', '/orders/:id/manifest', (c, p) => flr.manifest(c, p.id)],
  ['POST', '/orders/:id/manifest/check', (c, p, _q, b) => flr.checkManifest(c, p.id, b)],
  ['POST', '/orders/:id/package', (c, p, _q, b) => flr.finalisePackage(c, p.id, b)],
  // delivery (D-02, D-03)
  ['GET', '/routes', (c, _p, q) => dlv.listRoutes(c, q.date)],
  ['GET', '/routes/queue', (c) => dlv.deliveryQueue(c)],
  ['POST', '/routes', (c, _p, _q, b) => dlv.createRoute(c, b)],
  ['POST', '/routes/:id/rider', (c, p, _q, b) => dlv.assignRouteRider(c, p.id, b)],
  ['POST', '/routes/:id/orders', (c, p, _q, b) => dlv.addOrderToRoute(c, p.id, b)],
  ['DELETE', '/routes/:id/orders/:orderId', (c, p) => dlv.removeOrderFromRoute(c, p.id, p.orderId)],
  ['POST', '/routes/:id/bookings', (c, p, _q, b) => dlv.addBookingToRoute(c, p.id, b)],
  ['POST', '/routes/:id/depart', (c, p) => dlv.departRoute(c, p.id)],
  ['GET', '/rider/jobs', (c) => dlv.riderJobs(c)],
  ['POST', '/orders/:id/delivery-outcome', (c, p, _q, b) => dlv.deliveryOutcome(c, p.id, b)],
  // bookings (A-06)
  ['GET', '/bookings/slots', (c, _p, q) => dlv.getSlots(c, q.date)],
  ['POST', '/bookings', (c, _p, _q, b) => dlv.createBooking(c, b)],
  ['GET', '/bookings', (c, _p, q) => dlv.schedule(c, q.date)],
  ['POST', '/bookings/:id/cancel', (c, p) => dlv.cancelBooking(c, p.id)],
  ['POST', '/bookings/:id/assign-rider', (c, p, _q, b) => dlv.assignBookingRider(c, p.id, b)],
  ['POST', '/bookings/:id/collected', (c, p) => dlv.bookingCollected(c, p.id)],
  ['POST', '/bookings/:id/convert', (c, p) => dlv.convertBooking(c, p.id)],
  ['GET', '/portal/bookings', (c) => dlv.myBookings(c)],
  // billing (E-03..E-05)
  ['GET', '/approvals', (c, _p, q) => bil.listApprovals(c, q.status)],
  ['POST', '/refunds', (c, _p, _q, b) => bil.requestRefund(c, b)],
  ['POST', '/approvals/:id/decide', (c, p, _q, b) => bil.decide(c, p.id, b)],
  ['GET', '/cashups/current', (c) => bil.currentCashupView(c)],
  ['GET', '/cashups', (c) => bil.listCashups(c)],
  ['POST', '/cashups/:id/close', (c, p, _q, b) => bil.closeCashup(c, p.id, b)],
  ['POST', '/cashups/:id/reconcile', (c, p, _q, b) => bil.reconcileCashup(c, p.id, b)],
  ['GET', '/cashups/:id/report', (c, p) => bil.cashupReport(c, p.id)],
  ['GET', '/corporate-accounts', (c) => bil.listCorporate(c)],
  ['GET', '/corporate-accounts/:id/orders', (c, p) => bil.corporateOrders(c, p.id)],
  ['GET', '/corporate-accounts/:id/statements', (c, p) => bil.listStatements(c, p.id)],
  ['POST', '/corporate-accounts/:id/statements', (c, p, _q, b) => bil.generateStatement(c, p.id, b)],
  ['POST', '/statements/:id/payments', (c, p, _q, b) => bil.payStatement(c, p.id, b)],
  // portal
  ['POST', '/portal/register', (c, _p, _q, b) => rep.register(c, b)],
  ['GET', '/portal/me', (c) => rep.portalMe(c)],
  ['PATCH', '/portal/me', (c, _p, _q, b) => rep.portalUpdate(c, b)],
  ['GET', '/portal/orders', (c) => rep.portalOrders(c)],
  ['GET', '/portal/orders/export', (c) => rep.portalExport(c)],
  ['GET', '/portal/orders/:id', (c, p) => rep.portalOrder(c, p.id)],
  // manager, reports, audit (F-01, F-02)
  ['GET', '/manager/inbox', (c) => rep.inbox(c)],
  ['GET', '/reports/dashboard', (c, _p, q) => rep.dashboard(c, q.from, q.to)],
  ['POST', '/reports/:type/export', (c, p, _q, b) => rep.exportReport(c, p.type, b)],
  ['GET', '/audit-events', (c, _p, q) => rep.listAudit(c, q)],
  ['PATCH', '/audit-events/:id', () => rep.auditImmutable()],
  ['PUT', '/audit-events/:id', () => rep.auditImmutable()],
  ['DELETE', '/audit-events/:id', () => rep.auditImmutable()],
  // notifications (F-05)
  ['GET', '/notification-templates', (c) => ntf.listTemplates(c)],
  ['PATCH', '/notification-templates/:key', (c, p, _q, b) => ntf.updateTemplate(c, p.key, b)],
  ['GET', '/notification-log', (c) => ntf.listLog(c)],
  ['POST', '/notification-log/:id/retry', (c, p) => ntf.retryLog(c, p.id)],
  ['GET', '/me/notifications', (c) => ntf.myNotifications(c)],
  ['POST', '/me/notifications/read', (c) => ntf.markRead(c)],
  // import (F-06)
  ['GET', '/imports', (c) => rep.listImports(c)],
  ['GET', '/imports/templates/:type', (c, p) => rep.importTemplate(c, p.type as never)],
  ['POST', '/imports', (c, _p, _q, b) => rep.validateImport(c, b)],
  ['POST', '/imports/:id/commit', (c, p, _q, b) => rep.commitImport(c, p.id, b)],
  // dev helpers (mock only)
  ['POST', '/__dev/reset', () => resetDb()],
  ['POST', '/__dev/advance-clock', (_c, _p, _q, b) => advanceClock(Number(b.hours ?? 0))],
];

const compiled = routes.map(([method, pattern, handler]) => {
  const keys: string[] = [];
  const re = new RegExp(
    '^' + pattern.replace(/:(\w+)/g, (_, k: string) => {
      keys.push(k);
      return '([^/]+)';
    }) + '$',
  );
  return { method, re, keys, handler };
});

export interface MockResponse {
  status: number;
  body?: unknown;
}

export function dispatch(method: string, path: string, query: Record<string, string>, body: unknown, token: string | null): MockResponse {
  const sess = token ? state.sessions[token] : undefined;
  const user = sess && !sess.mfaPending ? state.users.find((u) => u.id === sess.userId) ?? null : null;
  const ctx: Ctx = { user: user && user.status !== 'DEACTIVATED' ? user : null, token: token ?? undefined };
  if (token && sess && user?.status === 'DEACTIVATED') delete state.sessions[token];
  for (const r of compiled) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    try {
      rep.tick();
      const result = r.handler(ctx, params, query, body ?? {});
      if (method !== 'GET') persist();
      return result === undefined ? { status: 204 } : { status: method === 'POST' && /\/(orders|customers|users|batches|routes|bookings|refunds|damage-reports)$/.test(path) ? 201 : 200, body: result };
    } catch (e) {
      if (e instanceof MockError) {
        if (method !== 'GET') persist(); // some rules record state before refusing (e.g. lockout counter)
        return { status: e.status, body: { code: e.code, field: e.field, details: e.details } };
      }
      console.error('[mock api]', e);
      return { status: 500, body: { code: 'SERVER_ERROR' } };
    }
  }
  return { status: 404, body: { code: 'NOT_FOUND' } };
}
