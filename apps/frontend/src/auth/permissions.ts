/**
 * SRS Appendix A — Role–Permission Matrix, expressed as UI permissions.
 * Used ONLY to decide what to show (NFR-U2). The server enforces every rule (NFR-SEC5).
 */
import type { Role } from '@ldy/api-client';

export type Action =
  | 'customer.create'
  | 'order.create'
  | 'order.cancel'
  | 'order.view'
  | 'floor.work'
  | 'qc.record'
  | 'damage.report'
  | 'damage.resolve'
  | 'package'
  | 'delivery.schedule'
  | 'delivery.record'
  | 'payment.capture'
  | 'collection.confirm'
  | 'refund.request'
  | 'approve'
  | 'cashup.close'
  | 'cashup.reconcile'
  | 'track.own'
  | 'config.pricing'
  | 'config.all'
  | 'users.manage'
  | 'audit.view'
  | 'reports.view'
  | 'corporate.configure'
  | 'item.discard'
  | 'machine.maintenance'
  | 'bookings.manage';

const MATRIX: Record<Role, Action[]> = {
  CUSTOMER: ['track.own'],
  FRONT_DESK: [
    'customer.create', 'order.create', 'order.cancel', 'order.view', 'delivery.schedule', 'payment.capture',
    'collection.confirm', 'refund.request', 'cashup.close', 'bookings.manage', 'reports.view',
  ],
  ATTENDANT: ['floor.work', 'qc.record', 'damage.report', 'package'],
  RIDER: ['delivery.record'],
  MANAGER: [
    'customer.create', 'order.create', 'order.cancel', 'order.view', 'floor.work', 'qc.record', 'damage.report', 'damage.resolve',
    'package', 'delivery.schedule', 'payment.capture', 'collection.confirm', 'refund.request', 'approve', 'cashup.close',
    'cashup.reconcile', 'config.pricing', 'audit.view', 'reports.view', 'corporate.configure', 'item.discard',
    'machine.maintenance', 'bookings.manage',
  ],
  ADMIN: ['config.pricing', 'config.all', 'users.manage', 'audit.view', 'corporate.configure', 'machine.maintenance'],
  AUDITOR: ['order.view', 'audit.view', 'reports.view'], // view only — no create/approve/edit controls render
};

export function can(role: Role | null | undefined, action: Action) {
  return Boolean(role && MATRIX[role]?.includes(action));
}

export interface NavItem {
  to: string;
  key: string; // i18n key under nav.*
  /** Feature switch that can hide a COULD item for the Release 1 demo (D28). */
  feature?: 'bookings' | 'corporate';
}

const ITEMS: Record<string, NavItem> = {
  inbox: { to: '/staff/inbox', key: 'inbox' },
  overview: { to: '/staff/overview', key: 'overview' },
  reports: { to: '/staff/reports', key: 'reports' },
  orders: { to: '/staff/orders', key: 'orders' },
  counter: { to: '/staff/counter', key: 'counter' },
  collection: { to: '/staff/collection', key: 'collection' },
  work: { to: '/staff/work', key: 'work' },
  scan: { to: '/staff/scan', key: 'scan' },
  batches: { to: '/staff/batches', key: 'batches' },
  machines: { to: '/staff/machines', key: 'machines' },
  bookings: { to: '/staff/bookings', key: 'bookings', feature: 'bookings' },
  dispatch: { to: '/staff/dispatch', key: 'dispatch' },
  rider: { to: '/staff/rider', key: 'rider' },
  approvals: { to: '/staff/approvals', key: 'approvals' },
  cashup: { to: '/staff/cashup', key: 'cashup' },
  corporate: { to: '/staff/corporate', key: 'corporate', feature: 'corporate' },
  audit: { to: '/staff/audit', key: 'audit' },
  users: { to: '/staff/users', key: 'users' },
  settings: { to: '/staff/settings', key: 'settings' },
  notifications: { to: '/staff/notifications', key: 'notifications' },
  import: { to: '/staff/import', key: 'import' },
};

/** Navigation order per role (REDESIGN §1.2, §10): the role's task home first. */
const ORDER: Record<Role, string[]> = {
  CUSTOMER: [],
  FRONT_DESK: ['overview', 'orders', 'counter', 'collection', 'bookings', 'dispatch', 'cashup', 'corporate'],
  ATTENDANT: ['work', 'scan', 'batches', 'machines'],
  RIDER: ['rider'],
  MANAGER: ['inbox', 'reports', 'orders', 'counter', 'collection', 'work', 'batches', 'machines', 'bookings', 'dispatch', 'approvals', 'cashup', 'corporate', 'audit', 'settings'],
  ADMIN: ['settings', 'users', 'machines', 'notifications', 'import', 'audit'],
  AUDITOR: ['audit', 'reports', 'orders', 'batches', 'approvals', 'cashup', 'corporate'],
};

/** Kept for compatibility with older imports. */
export const STAFF_NAV: NavItem[] = Object.values(ITEMS);

export const HOME_FOR: Record<Role, string> = {
  CUSTOMER: '/me/orders',
  FRONT_DESK: '/staff/overview',
  ATTENDANT: '/staff/work',
  RIDER: '/staff/rider',
  MANAGER: '/staff/inbox',
  ADMIN: '/staff/settings',
  AUDITOR: '/staff/audit',
};

export function navFor(role: Role | null | undefined, features?: { bookings: boolean; corporate: boolean }) {
  if (!role) return [];
  return ORDER[role].map((k) => ITEMS[k]).filter((n) => !n.feature || !features || features[n.feature] !== false);
}

/** Roles that get a bottom navigation bar on phones (REDESIGN §4). */
export const BOTTOM_NAV_ROLES: Role[] = ['ATTENDANT', 'RIDER'];
