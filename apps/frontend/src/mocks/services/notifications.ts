// SRS-LDY-F-05 Notification management (stubbed channels — SRS §2.7, §4.3)
import type * as T from '@ldy/api-client';
import { state, uid, iso, fail, requireRole, audit, type Ctx } from '../store';

export const DEFAULT_TEMPLATES: T.NotificationTemplate[] = [
  {
    key: 'ORDER_RECEIVED',
    name: 'Order received',
    body: 'Hi {name}, we have received order {reference}. Expected ready by {readyBy}. Total {amount}.',
    placeholders: ['name', 'reference', 'readyBy', 'amount'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'READY_FOR_PICKUP',
    name: 'Ready for pickup',
    body: 'Hi {name}, order {reference} is ready. Collect it from shelf {shelf}. Balance due: {balance}.',
    placeholders: ['name', 'reference', 'shelf', 'balance'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'PACKED_FOR_DELIVERY',
    name: 'Packed for delivery',
    body: 'Hi {name}, order {reference} is packed and will be scheduled for delivery.',
    placeholders: ['name', 'reference'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'UNCOLLECTED_REMINDER',
    name: 'Uncollected reminder',
    body: 'Hi {name}, order {reference} has been ready for {days} days. Please collect it. Unclaimed items may be disposed of after {disposalDays} days.',
    placeholders: ['name', 'reference', 'days', 'disposalDays'],
    channels: { inApp: true, email: true, sms: false },
    essential: false,
  },
  {
    key: 'OUT_FOR_DELIVERY',
    name: 'Out for delivery',
    body: 'Hi {name}, order {reference} is out for delivery ({window}).',
    placeholders: ['name', 'reference', 'window'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'DELIVERY_STATUS',
    name: 'Delivery status',
    body: 'Hi {name}, delivery of order {reference}: {outcome}.',
    placeholders: ['name', 'reference', 'outcome'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'ORDER_CANCELLED',
    name: 'Order cancelled',
    body: 'Hi {name}, order {reference} has been cancelled. Reason: {reason}.',
    placeholders: ['name', 'reference', 'reason'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'DAMAGE_NOTICE',
    name: 'Damage / loss notice',
    body: '{message}',
    placeholders: ['message', 'name', 'reference'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'RECEIPT',
    name: 'Payment receipt',
    body: 'Receipt {receiptNo}: {amount} received for order {reference}. Balance: {balance}.',
    placeholders: ['receiptNo', 'amount', 'reference', 'balance'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'BOOKING_CONFIRMED',
    name: 'Booking confirmed',
    body: 'Hi {name}, your {kind} booking {reference} is confirmed for {date} at {slot}.',
    placeholders: ['name', 'kind', 'reference', 'date', 'slot'],
    channels: { inApp: true, email: true, sms: false },
    essential: true,
  },
  {
    key: 'PASSWORD_RESET',
    name: 'Password reset code',
    body: 'Your LDY password reset code is {code}. It expires in 15 minutes and can be used once.',
    placeholders: ['code'],
    channels: { inApp: false, email: true, sms: true },
    essential: true,
  },
];

function render(body: string, vars: Record<string, string>) {
  return body.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/** Queue a customer-facing message on every enabled channel and write the delivery log. */
export function notifyCustomer(
  templateKey: string,
  customer: { customerId?: string; name: string; phone: string; email?: string; optOutReminders?: boolean },
  vars: Record<string, string>,
  reference?: string,
) {
  const tpl = state.templates.find((t) => t.key === templateKey);
  if (!tpl) return;
  if (!tpl.essential && customer.optOutReminders) return; // F-05 opt-out of non-essential messages
  const message = render(tpl.body, { name: customer.name, ...vars });
  const log = (channel: T.NotificationLogEntry['channel'], recipient: string, ok: boolean) => {
    state.notificationLog.push({
      id: uid('nlog'),
      template: tpl.key,
      channel,
      recipient,
      reference,
      message,
      // stubbed provider: retried automatically up to 3 times before being marked Failed
      status: ok ? 'SENT' : 'FAILED',
      attempts: ok ? 1 : 3,
      at: iso(),
    });
  };
  if (tpl.channels.inApp && customer.customerId) {
    state.inApp.push({ id: uid('ntf'), audience: { customerId: customer.customerId }, text: message, at: iso(), read: false });
    log('IN_APP', customer.name, true);
  }
  if (tpl.channels.email) log('EMAIL', customer.email ?? '(no email on file)', Boolean(customer.email));
  if (tpl.channels.sms) log('SMS', customer.phone, true);
}

export function listTemplates(ctx: Ctx) {
  requireRole(ctx, ['ADMIN']);
  return state.templates;
}

export function updateTemplate(ctx: Ctx, key: string, body: { body?: string; channels?: T.NotificationTemplate['channels'] }) {
  const u = requireRole(ctx, ['ADMIN']);
  const tpl = state.templates.find((t) => t.key === key);
  if (!tpl) return fail(404, 'NOT_FOUND');
  const before = { body: tpl.body, channels: { ...tpl.channels } };
  if (body.body !== undefined) {
    const used = [...body.body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const unknown = used.find((p) => !tpl.placeholders.includes(p));
    if (unknown) fail(422, 'UNKNOWN_PLACEHOLDER', 'body', { placeholder: `{${unknown}}` });
    if (!body.body.trim()) fail(422, 'REQUIRED', 'body');
    tpl.body = body.body;
  }
  if (body.channels) tpl.channels = { ...body.channels };
  audit(u, 'NotificationTemplate', key, 'TEMPLATE_UPDATED', before, { body: tpl.body, channels: tpl.channels });
  return tpl;
}

export function listLog(ctx: Ctx) {
  requireRole(ctx, ['ADMIN', 'MANAGER']);
  return [...state.notificationLog].reverse().slice(0, 300);
}

export function retryLog(ctx: Ctx, id: string) {
  requireRole(ctx, ['ADMIN', 'MANAGER']);
  const e = state.notificationLog.find((x) => x.id === id);
  if (!e) return fail(404, 'NOT_FOUND');
  e.attempts += 1;
  // the stub can only "send" an email if an address exists
  e.status = e.channel === 'EMAIL' && e.recipient.startsWith('(') ? 'FAILED' : 'SENT';
  e.at = iso();
  return e;
}

export function myNotifications(ctx: Ctx) {
  const u = ctx.user;
  if (!u) return fail(401, 'UNAUTHENTICATED');
  return state.inApp
    .filter(
      (n) =>
        n.audience.userId === u.id ||
        (n.audience.role && u.roles.includes(n.audience.role)) ||
        (n.audience.customerId && n.audience.customerId === u.customerId),
    )
    .slice(-50)
    .reverse()
    .map(({ audience: _a, ...rest }) => rest);
}

export function markRead(ctx: Ctx) {
  const ids = new Set(myNotifications(ctx).map((n) => n.id));
  state.inApp.forEach((n) => {
    if (ids.has(n.id)) n.read = true;
  });
}
