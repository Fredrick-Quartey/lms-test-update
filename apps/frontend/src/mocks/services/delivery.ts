// D-02 Delivery scheduling & dispatch, D-03 Proof of delivery, A-06 Online pickup / drop-off booking
import type * as T from '@ldy/api-client';
import { state, fail, uid, iso, now, audit, nextNo, requireRole, requireUser, findOrder, todayStr, notifyStaff, type Ctx } from '../store';
import { recompute, contactOf, createDraftAs } from './orders';
import { notifyCustomer } from './notifications';

const DISPATCH: T.Role[] = ['FRONT_DESK', 'MANAGER'];

function findRoute(id: string) {
  const r = state.routes.find((x) => x.id === id || x.routeNo === id);
  if (!r) return fail(404, 'NOT_FOUND');
  return r;
}

export function listRoutes(ctx: Ctx, date?: string) {
  requireRole(ctx, [...DISPATCH, 'AUDITOR']);
  return state.routes.filter((r) => !date || r.date === date).slice().reverse();
}

export function deliveryQueue(ctx: Ctx) {
  requireRole(ctx, DISPATCH);
  // packaged delivery orders not yet on a planned/departed route (includes failed deliveries returned to the queue)
  return state.orders.filter((o) => o.status === 'PACKAGED' && o.deliveryFlag && !o.routeId);
}

export function createRoute(ctx: Ctx, b: { date: string; window: string; riderId?: string }) {
  const u = requireRole(ctx, DISPATCH);
  if (!b.date) fail(422, 'REQUIRED', 'date');
  if (!b.window?.trim()) fail(422, 'REQUIRED', 'window');
  const rider = b.riderId ? state.users.find((x) => x.id === b.riderId && x.roles.includes('RIDER')) : undefined;
  const r: T.Route = {
    id: uid('rte'),
    routeNo: nextNo('route', 'R-', 4),
    riderId: rider?.id,
    riderName: rider?.name,
    date: b.date,
    window: b.window.trim(),
    orderIds: [],
    bookingIds: [],
    capacity: state.settings.handover.routeCapacity,
    status: 'PLANNED',
  };
  state.routes.push(r);
  audit(u, 'Route', r.id, 'ROUTE_CREATED', undefined, { date: r.date, window: r.window, rider: r.riderName, capacity: r.capacity }, r.routeNo);
  return r;
}

export function assignRouteRider(ctx: Ctx, id: string, b: { riderId: string }) {
  const u = requireRole(ctx, DISPATCH);
  const r = findRoute(id);
  if (r.status !== 'PLANNED') fail(409, 'ROUTE_ALREADY_DEPARTED');
  const rider = state.users.find((x) => x.id === b.riderId && x.roles.includes('RIDER') && x.status === 'ACTIVE');
  if (!rider) return fail(422, 'REQUIRED', 'riderId');
  const before = r.riderName;
  r.riderId = rider.id;
  r.riderName = rider.name;
  audit(u, 'Route', r.id, 'RIDER_ASSIGNED', { rider: before }, { rider: rider.name }, r.routeNo);
  return r;
}

export function addOrderToRoute(ctx: Ctx, id: string, b: { orderId: string }) {
  const u = requireRole(ctx, DISPATCH);
  const r = findRoute(id);
  if (r.status !== 'PLANNED') fail(409, 'ROUTE_ALREADY_DEPARTED');
  const o = findOrder(b.orderId);
  if (r.orderIds.includes(o.id)) return r;
  if (o.status !== 'PACKAGED' || !o.deliveryFlag) fail(409, 'ORDER_NOT_READY');
  if (o.routeId) fail(409, 'ORDER_ALREADY_ON_ROUTE');
  if (r.orderIds.length >= r.capacity) fail(409, 'ROUTE_AT_CAPACITY', undefined, { capacity: r.capacity });
  r.orderIds.push(o.id);
  o.routeId = r.id;
  audit(u, 'Route', r.id, 'ORDER_ADDED_TO_ROUTE', undefined, { order: o.orderNo, count: r.orderIds.length }, r.routeNo);
  audit(u, 'Order', o.id, 'SCHEDULED_FOR_DELIVERY', undefined, { route: r.routeNo, window: r.window, date: r.date }, o.orderNo);
  return r;
}

export function removeOrderFromRoute(ctx: Ctx, id: string, orderId: string) {
  const u = requireRole(ctx, DISPATCH);
  const r = findRoute(id);
  if (r.status !== 'PLANNED') fail(409, 'ROUTE_ALREADY_DEPARTED');
  const o = findOrder(orderId);
  r.orderIds = r.orderIds.filter((x) => x !== o.id);
  o.routeId = undefined;
  audit(u, 'Route', r.id, 'ORDER_REMOVED_FROM_ROUTE', { order: o.orderNo }, undefined, r.routeNo);
  return r;
}

export function addBookingToRoute(ctx: Ctx, id: string, b: { bookingId: string }) {
  const u = requireRole(ctx, DISPATCH);
  const r = findRoute(id);
  const bk = state.bookings.find((x) => x.id === b.bookingId);
  if (!bk || bk.kind !== 'PICKUP' || bk.status !== 'CONFIRMED') return fail(409, 'BOOKING_NOT_PICKUP');
  if (!r.riderId) fail(422, 'ROUTE_NO_RIDER');
  if (!r.bookingIds.includes(bk.id)) r.bookingIds.push(bk.id);
  bk.riderId = r.riderId;
  bk.riderName = r.riderName;
  audit(u, 'Booking', bk.id, 'PICKUP_ASSIGNED', undefined, { route: r.routeNo, rider: r.riderName }, bk.bookingNo);
  return r;
}

export function departRoute(ctx: Ctx, id: string) {
  const u = requireRole(ctx, DISPATCH);
  const r = findRoute(id);
  if (r.status !== 'PLANNED') fail(409, 'ROUTE_ALREADY_DEPARTED');
  if (!r.riderId) fail(422, 'ROUTE_NO_RIDER');
  if (!r.orderIds.length) fail(422, 'ROUTE_EMPTY');
  r.status = 'DEPARTED';
  for (const oid of r.orderIds) {
    const o = findOrder(oid);
    o.status = 'OUT_FOR_DELIVERY';
    audit(u, 'Order', o.id, 'OUT_FOR_DELIVERY', { status: 'PACKAGED' }, { status: 'OUT_FOR_DELIVERY', route: r.routeNo, rider: r.riderName }, o.orderNo);
    notifyCustomer('OUT_FOR_DELIVERY', contactOf(o), { reference: o.orderNo, window: `${r.date} ${r.window}` }, o.orderNo);
  }
  audit(u, 'Route', r.id, 'ROUTE_DEPARTED', { status: 'PLANNED' }, { status: 'DEPARTED' }, r.routeNo);
  return r;
}

export function riderJobs(ctx: Ctx): T.RiderJob[] {
  const u = requireRole(ctx, ['RIDER']);
  const jobs: T.RiderJob[] = [];
  for (const r of state.routes.filter((x) => x.riderId === u.id && x.status === 'DEPARTED')) {
    for (const oid of r.orderIds) {
      const o = state.orders.find((x) => x.id === oid);
      if (o && o.status === 'OUT_FOR_DELIVERY') jobs.push({ kind: 'DELIVER', routeId: r.id, routeNo: r.routeNo, window: r.window, order: o });
    }
  }
  for (const b of state.bookings.filter((x) => x.riderId === u.id && x.kind === 'PICKUP' && x.status === 'CONFIRMED')) {
    jobs.push({ kind: 'COLLECT', booking: b, window: b.slot });
  }
  return jobs;
}

export function deliveryOutcome(ctx: Ctx, orderId: string, b: { outcome: 'DELIVERED' | 'FAILED'; recipientName?: string; signature?: string; photo?: string; reason?: string }) {
  const u = requireRole(ctx, ['RIDER']); // Appendix A: only the Delivery Rider records delivery outcomes
  const o = findOrder(orderId);
  if (o.status !== 'OUT_FOR_DELIVERY') fail(409, 'ORDER_NOT_OUT_FOR_DELIVERY');
  const r = o.routeId ? state.routes.find((x) => x.id === o.routeId) : undefined;
  if (r && r.riderId !== u.id) fail(403, 'FORBIDDEN');
  if (b.outcome === 'DELIVERED') {
    if (!b.recipientName?.trim()) fail(422, 'RECIPIENT_REQUIRED', 'recipientName');
    if (!b.signature && !b.photo) fail(422, 'POD_REQUIRED', 'signature');
    o.pod = { recipientName: b.recipientName!.trim(), signature: b.signature, photo: b.photo, at: iso(), by: u.id, byName: u.name };
    o.status = 'DELIVERED';
    o.deliveredAt = iso();
    o.items.forEach((i) => {
      if (i.status === 'PACKAGED') i.status = 'DELIVERED';
    });
    audit(u, 'Order', o.id, 'ORDER_DELIVERED', { status: 'OUT_FOR_DELIVERY' }, { status: 'DELIVERED', recipient: o.pod.recipientName, pod: b.signature ? 'signature' : 'photo' }, o.orderNo);
    notifyCustomer('DELIVERY_STATUS', contactOf(o), { reference: o.orderNo, outcome: `delivered to ${o.pod.recipientName}` }, o.orderNo);
  } else {
    if (!b.reason?.trim()) fail(422, 'FAILURE_REASON_REQUIRED', 'reason');
    o.failedDeliveries.push({ reason: b.reason!.trim(), at: iso(), by: u.name });
    // D-02: a failed delivery returns to the ready-for-handover queue for rescheduling
    o.status = 'PACKAGED';
    o.routeId = undefined;
    audit(u, 'Order', o.id, 'DELIVERY_FAILED', { status: 'OUT_FOR_DELIVERY' }, { status: 'PACKAGED', reason: b.reason }, o.orderNo);
    notifyCustomer('DELIVERY_STATUS', contactOf(o), { reference: o.orderNo, outcome: `not completed (${b.reason!.trim()}) — we will reschedule` }, o.orderNo);
    notifyStaff({ role: 'FRONT_DESK' }, `Delivery failed for ${o.orderNo}: ${b.reason}`, '/staff/dispatch');
  }
  recompute(o);
  if (r && r.orderIds.every((oid) => state.orders.find((x) => x.id === oid)?.status !== 'OUT_FOR_DELIVERY')) {
    r.status = 'COMPLETED';
    audit(u, 'Route', r.id, 'ROUTE_COMPLETED', undefined, undefined, r.routeNo);
  }
  return o;
}

// ---------------- Bookings (A-06) ----------------
function slotsFor(date: string): T.Slot[] {
  const s = state.settings.bookings;
  const out: T.Slot[] = [];
  for (let m = s.openHour * 60; m + s.slotMinutes <= s.closeHour * 60; m += s.slotMinutes) {
    const slot = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const booked = state.bookings.filter((b) => b.date === date && b.slot === slot && b.status !== 'CANCELLED').length;
    out.push({ slot, booked, capacity: s.maxPerSlot, full: booked >= s.maxPerSlot });
  }
  return out;
}

function slotStart(date: string, slot: string) {
  return new Date(`${date}T${slot}:00Z`); // Africa/Accra = UTC+0
}

export function getSlots(_ctx: Ctx, date: string) {
  if (!date) return fail(422, 'REQUIRED', 'date');
  return slotsFor(date).map((s) => ({ ...s, full: s.full || slotStart(date, s.slot) < now() }));
}

export function createBooking(ctx: Ctx, b: { serviceTypeId: string; kind: 'PICKUP' | 'DROPOFF'; address?: string; date: string; slot: string }) {
  const u = requireRole(ctx, ['CUSTOMER']);
  const c = state.customers.find((x) => x.id === u.customerId);
  if (!c) return fail(404, 'NOT_FOUND');
  if (!state.serviceTypes.some((s) => s.id === b.serviceTypeId)) fail(422, 'REQUIRED', 'serviceTypeId');
  if (b.kind === 'PICKUP' && !b.address?.trim()) fail(422, 'REQUIRED', 'address');
  const slots = slotsFor(b.date);
  const target = slots.find((s) => s.slot === b.slot);
  if (!target) return fail(422, 'REQUIRED', 'slot');
  if (slotStart(b.date, b.slot) < now()) fail(422, 'SLOT_IN_PAST', 'slot');
  if (target.full) {
    const alternatives = slots.filter((s) => !s.full && slotStart(b.date, s.slot) > now()).map((s) => s.slot);
    fail(409, 'SLOT_FULL', 'slot', { alternatives });
  }
  const bk: T.Booking = {
    id: uid('bkg'),
    bookingNo: nextNo('booking', 'BK-', 5),
    customerId: c.id,
    customerName: c.name,
    customerPhone: c.phone,
    serviceTypeId: b.serviceTypeId,
    kind: b.kind,
    address: b.kind === 'PICKUP' ? b.address!.trim() : undefined,
    date: b.date,
    slot: b.slot,
    status: 'CONFIRMED',
    createdAt: iso(),
  };
  state.bookings.push(bk);
  audit(u, 'Booking', bk.id, 'BOOKING_CREATED', undefined, { kind: bk.kind, date: bk.date, slot: bk.slot }, bk.bookingNo);
  notifyCustomer('BOOKING_CONFIRMED', { customerId: c.id, name: c.name, phone: c.phone, email: c.email }, {
    kind: bk.kind === 'PICKUP' ? 'pickup' : 'drop-off', reference: bk.bookingNo, date: bk.date, slot: bk.slot,
  }, bk.bookingNo);
  notifyStaff({ role: 'FRONT_DESK' }, `New ${bk.kind.toLowerCase()} booking ${bk.bookingNo} for ${bk.date} ${bk.slot}`, '/staff/bookings');
  return bk;
}

export function myBookings(ctx: Ctx) {
  const u = requireRole(ctx, ['CUSTOMER']);
  return state.bookings.filter((b) => b.customerId === u.customerId).slice().reverse();
}

export function cancelBooking(ctx: Ctx, id: string) {
  const u = requireUser(ctx);
  const bk = state.bookings.find((b) => b.id === id);
  if (!bk) return fail(404, 'NOT_FOUND');
  const isOwner = u.customerId === bk.customerId;
  if (!isOwner && !u.roles.some((r) => DISPATCH.includes(r))) fail(403, 'FORBIDDEN');
  if (bk.status !== 'CONFIRMED') fail(409, 'BOOKING_NOT_CANCELLABLE');
  const cutoff = slotStart(bk.date, bk.slot).getTime() - state.settings.bookings.cancelCutoffHours * 3600_000;
  if (isOwner && now().getTime() > cutoff) fail(409, 'BOOKING_CUTOFF_PASSED', undefined, { hours: state.settings.bookings.cancelCutoffHours });
  bk.status = 'CANCELLED';
  audit(u, 'Booking', bk.id, 'BOOKING_CANCELLED', { status: 'CONFIRMED' }, { status: 'CANCELLED' }, bk.bookingNo);
  return bk;
}

export function schedule(ctx: Ctx, date?: string) {
  requireRole(ctx, [...DISPATCH, 'AUDITOR']);
  const d = date || todayStr();
  return state.bookings.filter((b) => b.date === d).sort((a, b) => a.slot.localeCompare(b.slot));
}

export function assignBookingRider(ctx: Ctx, id: string, b: { riderId: string }) {
  const u = requireRole(ctx, DISPATCH);
  const bk = state.bookings.find((x) => x.id === id);
  if (!bk) return fail(404, 'NOT_FOUND');
  if (bk.kind !== 'PICKUP' || bk.status !== 'CONFIRMED') fail(409, 'BOOKING_NOT_PICKUP');
  const rider = state.users.find((x) => x.id === b.riderId && x.roles.includes('RIDER') && x.status === 'ACTIVE');
  if (!rider) return fail(422, 'REQUIRED', 'riderId');
  bk.riderId = rider.id;
  bk.riderName = rider.name;
  audit(u, 'Booking', bk.id, 'PICKUP_ASSIGNED', undefined, { rider: rider.name }, bk.bookingNo);
  return bk;
}

export function bookingCollected(ctx: Ctx, id: string) {
  const u = requireRole(ctx, ['RIDER']);
  const bk = state.bookings.find((x) => x.id === id);
  if (!bk) return fail(404, 'NOT_FOUND');
  if (bk.riderId !== u.id) fail(403, 'FORBIDDEN');
  if (bk.status !== 'CONFIRMED') fail(409, 'BOOKING_NOT_PICKUP');
  bk.status = 'COLLECTED';
  audit(u, 'Booking', bk.id, 'PICKUP_COLLECTED', { status: 'CONFIRMED' }, { status: 'COLLECTED' }, bk.bookingNo);
  notifyStaff({ role: 'FRONT_DESK' }, `Rider collected pickup ${bk.bookingNo} — convert it to an order on arrival`, '/staff/bookings');
  return bk;
}

export function convertBooking(ctx: Ctx, id: string) {
  const u = requireRole(ctx, DISPATCH);
  const bk = state.bookings.find((x) => x.id === id);
  if (!bk) return fail(404, 'NOT_FOUND');
  if (bk.status === 'COMPLETED' || bk.status === 'CANCELLED') fail(409, 'BOOKING_NOT_CONVERTIBLE');
  const existing = state.orders.find((o) => o.bookingId === bk.id && o.status === 'DRAFT');
  if (existing) return existing;
  const o = createDraftAs(u, { customerId: bk.customerId, bookingId: bk.id });
  if (bk.kind === 'PICKUP') {
    o.deliveryAddress = bk.address;
  }
  recompute(o);
  audit(u, 'Booking', bk.id, 'BOOKING_CONVERTED_TO_DRAFT', undefined, { order: o.orderNo }, bk.bookingNo);
  return o;
}
