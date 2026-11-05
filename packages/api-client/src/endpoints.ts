/**
 * Endpoint functions — the frontend's view of the API contract (FRONTEND_PROMPT §7).
 * Paths are a DRAFT to agree with the FastAPI developer; keep this file and
 * docs/API_CONTRACT.md in sync whenever either side changes.
 */
import { http } from './client';
import type * as T from './types';

export type NewItemInput = {
  categoryId: string;
  serviceTypeId: string;
  quantity: number;
  weightKg?: number;
  colour: T.Colour;
  fabric: T.Fabric;
  instructions?: string;
  flags?: { type: T.FlagType; note?: string; photo?: string }[];
};

export type CustomerInput = {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  preferences: T.Preferences;
  accountType?: 'INDIVIDUAL' | 'CORPORATE';
};

export const api = {
  // ---------- Auth (F-04) ----------
  auth: {
    login: (username: string, password: string, portal: 'staff' | 'customer') =>
      http.post<T.Session>('/auth/login', { username, password, portal }),
    verifyMfa: (token: string, code: string) => http.post<T.Session>('/auth/mfa/verify', { token, code }),
    me: () => http.get<T.User>('/auth/me'),
    logout: () => http.post<void>('/auth/logout'),
    forgot: (username: string) => http.post<{ sent: boolean; devCode?: string }>('/auth/password/forgot', { username }),
    reset: (username: string, code: string, newPassword: string) =>
      http.post<void>('/auth/password/reset', { username, code, newPassword }),
  },

  // ---------- Config (F-03, E-01) ----------
  settings: {
    get: () => http.get<T.Settings>('/settings'),
    update: (patch: Partial<T.Settings>) => http.patch<T.Settings>('/settings', patch),
  },
  catalogue: {
    get: () => http.get<T.Catalogue>('/catalogue'),
    upsertPrice: (p: Omit<T.PriceEntry, 'id'> & { id?: string }) => http.post<T.PriceEntry>('/price-list', p),
    deletePrice: (id: string) => http.del<void>(`/price-list/${id}`),
    upsertServiceType: (s: Omit<T.ServiceType, 'id'> & { id?: string }) => http.post<T.ServiceType>('/service-types', s),
    addCategory: (name: string) => http.post<T.ItemCategory>('/categories', { name }),
  },
  machines: {
    list: () => http.get<T.Machine[]>('/machines'),
    create: (m: { name: string; type: T.Machine['type'] }) => http.post<T.Machine>('/machines', m),
    setStatus: (id: string, status: T.Machine['status']) => http.patch<T.Machine>(`/machines/${id}`, { status }),
  },

  // ---------- Users (F-04) ----------
  users: {
    list: () => http.get<T.User[]>('/users'),
    create: (u: { name: string; username: string; email?: string; phone?: string; roles: T.Role[]; password: string; sodJustification?: string }) =>
      http.post<T.User>('/users', u),
    update: (id: string, u: { name?: string; roles?: T.Role[]; email?: string; phone?: string; sodJustification?: string; mfaEnabled?: boolean }) =>
      http.patch<T.User>(`/users/${id}`, u),
    deactivate: (id: string) => http.post<T.User>(`/users/${id}/deactivate`),
    reactivate: (id: string) => http.post<T.User>(`/users/${id}/reactivate`),
    unlock: (id: string) => http.post<T.User>(`/users/${id}/unlock`),
    sendReset: (id: string) => http.post<{ sent: boolean }>(`/users/${id}/password-reset`),
  },

  // ---------- Customers (A-01) ----------
  customers: {
    search: (q: string) => http.get<T.Customer[]>('/customers', { q }),
    get: (id: string) => http.get<T.Customer>(`/customers/${id}`),
    create: (c: CustomerInput) => http.post<T.Customer>('/customers', c),
    update: (id: string, c: Partial<CustomerInput> & { corporate?: Partial<T.CorporateTerms>; accountType?: 'INDIVIDUAL' | 'CORPORATE' }) =>
      http.patch<T.Customer>(`/customers/${id}`, c),
  },

  // ---------- Orders (A-02, A-03, A-05, D-04) ----------
  orders: {
    list: (q: { search?: string; status?: string; payment?: string; delivery?: string; from?: string; to?: string; page?: number; pageSize?: number; sort?: string }) =>
      http.get<T.Page<T.Order>>('/orders', q),
    get: (id: string) => http.get<T.Order>(`/orders/${id}`),
    history: (id: string) => http.get<T.AuditEvent[]>(`/orders/${id}/history`),
    createDraft: (d: { customerId?: string; guest?: { name?: string; phone: string }; bookingId?: string }) =>
      http.post<T.Order>('/orders', d),
    updateDraft: (id: string, d: { speed?: 'STANDARD' | 'EXPRESS'; deliveryFlag?: boolean; deliveryAddress?: string; onAccount?: boolean }) =>
      http.patch<T.Order>(`/orders/${id}`, d),
    addItem: (id: string, item: NewItemInput) => http.post<T.Order>(`/orders/${id}/items`, item),
    removeItem: (id: string, itemId: string) => http.del<T.Order>(`/orders/${id}/items/${itemId}`),
    finalise: (id: string) => http.post<T.Order>(`/orders/${id}/finalise`),
    cancel: (id: string, reason: string, note?: string) => http.post<T.Order>(`/orders/${id}/cancel`, { reason, note }),
    collect: (id: string, identityNote: string) => http.post<T.Order>(`/orders/${id}/collect`, { identityNote }),
    dispose: (id: string, reason: string) => http.post<T.Order>(`/orders/${id}/dispose`, { reason }),
    pay: (id: string, p: { amount: number; method: T.Payment['method']; reference?: string; tendered?: number }) =>
      http.post<{ order: T.Order; payment: T.Payment }>(`/orders/${id}/payments`, p),
    sendReceipt: (paymentId: string, channel: 'SMS' | 'EMAIL') => http.post<void>(`/payments/${paymentId}/send`, { channel }),
    requestCreditOverride: (id: string, reason: string) => http.post<T.ApprovalRequest>(`/orders/${id}/credit-override`, { reason }),
  },
  track: (q: { orderNo: string }) => http.get<T.TrackingView[]>('/track', q),
  search: (q: string) => http.get<T.SearchResults>('/search', { q }),
  print: {
    order: (id: string) => http.get<T.Order>(`/print/orders/${id}`),
    payment: (id: string) => http.get<{ order: T.Order; payment: T.Payment }>(`/payments/${id}`),
    statement: (id: string) => http.get<T.Statement>(`/statements/${id}`),
  },

  // ---------- Floor (A-03, A-04, B-01..B-04, C-01..C-03) ----------
  tags: {
    scan: (tag: string) => http.get<T.ScanResult>(`/tags/${encodeURIComponent(tag)}`),
    reprint: (tag: string) => http.post<{ tag: string; reprintedAt: string }>(`/tags/${encodeURIComponent(tag)}/reprint`),
  },
  items: {
    addFlag: (itemId: string, f: { type: T.FlagType; note?: string; photo?: string; stage: string }) =>
      http.post<T.OrderItem>(`/items/${itemId}/flags`, f),
    qc: (itemId: string, outcome: 'PASS' | 'FAIL', reason?: string) => http.post<T.ScanResult>(`/items/${itemId}/qc`, { outcome, reason }),
    rework: (itemId: string, stage: string, reason: string) => http.post<T.ScanResult>(`/items/${itemId}/rework`, { stage, reason }),
    requestOverride: (itemId: string, reason: string) => http.post<T.ApprovalRequest>(`/items/${itemId}/qc-override`, { reason }),
    discard: (itemId: string, reason: string) => http.post<T.ScanResult>(`/items/${itemId}/discard`, { reason }),
  },
  loads: {
    scan: (tag: string) => http.post<T.LoadScanResult>('/loads/scan', { tag }),
    queue: () => http.get<T.FloorQueue>('/floor/queue'),
  },
  batches: {
    list: (status?: string) => http.get<T.Batch[]>('/batches', { status }),
    get: (id: string) => http.get<T.Batch & { items: (T.OrderItem & { orderNo: string })[] }>(`/batches/${id}`),
    create: (b: { serviceTypeId: string; colour?: T.Colour; fabric: T.Fabric; isRework?: boolean; fromStage?: string }) => http.post<T.Batch>('/batches', b),
    addItem: (id: string, tag: string) => http.post<T.Batch>(`/batches/${id}/items`, { tag }),
    removeItem: (id: string, itemId: string) => http.del<T.Batch>(`/batches/${id}/items/${itemId}`),
    assignMachine: (id: string, machineId: string) => http.post<T.Batch>(`/batches/${id}/machine`, { machineId }),
    startStage: (id: string) => http.post<T.Batch>(`/batches/${id}/stage/start`),
    completeStage: (id: string) => http.post<T.Batch>(`/batches/${id}/stage/complete`),
  },
  damage: {
    list: (status?: string) => http.get<T.DamageReport[]>('/damage-reports', { status }),
    create: (d: { itemId: string; type: 'DAMAGE' | 'LOST'; description: string; photo?: string }) => http.post<T.DamageReport>('/damage-reports', d),
    resolve: (id: string, d: { resolution?: T.DamageResolution; note?: string; customerMessage: string }) =>
      http.post<T.DamageReport>(`/damage-reports/${id}/resolve`, d),
  },
  packing: {
    manifest: (orderId: string) => http.get<T.Order>(`/orders/${orderId}/manifest`),
    check: (orderId: string, tag: string, shelf?: string) => http.post<T.Order>(`/orders/${orderId}/manifest/check`, { tag, shelf }),
    finalise: (orderId: string, shelf: string) => http.post<T.Order>(`/orders/${orderId}/package`, { shelf }),
  },

  // ---------- Delivery (D-02, D-03) ----------
  routes: {
    list: (date?: string) => http.get<T.Route[]>('/routes', { date }),
    queue: () => http.get<T.Order[]>('/routes/queue'),
    create: (r: { date: string; window: string; riderId?: string }) => http.post<T.Route>('/routes', r),
    assignRider: (id: string, riderId: string) => http.post<T.Route>(`/routes/${id}/rider`, { riderId }),
    addOrder: (id: string, orderId: string) => http.post<T.Route>(`/routes/${id}/orders`, { orderId }),
    addBooking: (id: string, bookingId: string) => http.post<T.Route>(`/routes/${id}/bookings`, { bookingId }),
    removeOrder: (id: string, orderId: string) => http.del<T.Route>(`/routes/${id}/orders/${orderId}`),
    depart: (id: string) => http.post<T.Route>(`/routes/${id}/depart`),
  },
  rider: {
    jobs: () => http.get<T.RiderJob[]>('/rider/jobs'),
    deliveryOutcome: (orderId: string, d: { outcome: 'DELIVERED' | 'FAILED'; recipientName?: string; signature?: string; photo?: string; reason?: string }) =>
      http.post<T.Order>(`/orders/${orderId}/delivery-outcome`, d),
    collectBooking: (bookingId: string) => http.post<T.Booking>(`/bookings/${bookingId}/collected`),
  },
  riders: () => http.get<T.User[]>('/riders'),

  // ---------- Billing (E-02..E-05) ----------
  approvals: {
    list: (status?: string) => http.get<T.ApprovalRequest[]>('/approvals', { status }),
    requestRefund: (d: { orderId: string; amount: number; reason: string; kind: 'REFUND' | 'ADJUSTMENT'; damageReportId?: string }) =>
      http.post<T.ApprovalRequest>('/refunds', d),
    decide: (id: string, decision: 'APPROVE' | 'REJECT', note: string) => http.post<T.ApprovalRequest>(`/approvals/${id}/decide`, { decision, note }),
  },
  cashups: {
    current: () => http.get<T.Cashup>('/cashups/current'),
    list: () => http.get<T.Cashup[]>('/cashups'),
    close: (id: string, counted: T.MethodTotals) => http.post<T.Cashup>(`/cashups/${id}/close`, { counted }),
    reconcile: (id: string, explanation: string) => http.post<T.Cashup>(`/cashups/${id}/reconcile`, { explanation }),
    report: (id: string) => http.get<T.CashupReport>(`/cashups/${id}/report`),
  },
  corporate: {
    list: () => http.get<T.Customer[]>('/corporate-accounts'),
    orders: (customerId: string) => http.get<T.Order[]>(`/corporate-accounts/${customerId}/orders`),
    statements: (customerId: string) => http.get<T.Statement[]>(`/corporate-accounts/${customerId}/statements`),
    generateStatement: (customerId: string, from: string, to: string) =>
      http.post<T.Statement>(`/corporate-accounts/${customerId}/statements`, { from, to }),
    recordPayment: (statementId: string, amount: number, method: T.Payment['method'], reference?: string) =>
      http.post<T.Statement>(`/statements/${statementId}/payments`, { amount, method, reference }),
  },

  // ---------- Bookings (A-06) ----------
  bookings: {
    slots: (date: string) => http.get<T.Slot[]>('/bookings/slots', { date }),
    create: (b: { serviceTypeId: string; kind: 'PICKUP' | 'DROPOFF'; address?: string; date: string; slot: string }) =>
      http.post<T.Booking>('/bookings', b),
    mine: () => http.get<T.Booking[]>('/portal/bookings'),
    cancel: (id: string) => http.post<T.Booking>(`/bookings/${id}/cancel`),
    schedule: (date: string) => http.get<T.Booking[]>('/bookings', { date }),
    assignRider: (id: string, riderId: string) => http.post<T.Booking>(`/bookings/${id}/assign-rider`, { riderId }),
    convert: (id: string) => http.post<T.Order>(`/bookings/${id}/convert`),
  },

  // ---------- Customer portal ----------
  portal: {
    register: (d: { name: string; phone: string; email?: string; address: string; location?: { lat: number; lng: number; accuracy?: number }; preferences?: T.Preferences; password: string; consent: boolean }) =>
      http.post<T.Session>('/portal/register', d),
    me: () => http.get<T.Customer>('/portal/me'),
    updateMe: (d: Partial<T.Customer>) => http.patch<T.Customer>('/portal/me', d),
    orders: () => http.get<T.Order[]>('/portal/orders'),
    order: (id: string) => http.get<T.Order & { timeline: T.TimelineEntry[]; damage: T.DamageReport[] }>(`/portal/orders/${id}`),
    exportCsv: () => http.get<{ filename: string; csv: string }>('/portal/orders/export'),
  },

  // ---------- Manager, reports, audit (F-01, F-02) ----------
  inbox: () => http.get<T.InboxSummary>('/manager/inbox'),
  reports: {
    dashboard: (from: string, to: string) => http.get<T.DashboardData>('/reports/dashboard', { from, to }),
    export: (type: string, from: string, to: string) => http.post<{ filename: string; csv: string }>(`/reports/${type}/export`, { from, to }),
  },
  audit: {
    list: (q: { entity?: string; entityId?: string; user?: string; action?: string; from?: string; to?: string; page?: number; pageSize?: number }) =>
      http.get<T.Page<T.AuditEvent>>('/audit-events', q),
    attemptEdit: (id: string) => http.patch<void>(`/audit-events/${id}`, {}),
  },

  // ---------- Notifications (F-05) ----------
  notifications: {
    templates: () => http.get<T.NotificationTemplate[]>('/notification-templates'),
    updateTemplate: (key: string, d: { body?: string; channels?: T.NotificationTemplate['channels'] }) =>
      http.patch<T.NotificationTemplate>(`/notification-templates/${key}`, d),
    log: () => http.get<T.NotificationLogEntry[]>('/notification-log'),
    retry: (id: string) => http.post<T.NotificationLogEntry>(`/notification-log/${id}/retry`),
    mine: () => http.get<T.InAppNotification[]>('/me/notifications'),
    markRead: () => http.post<void>('/me/notifications/read'),
  },

  // ---------- Import (F-06) ----------
  imports: {
    list: () => http.get<T.ImportBatch[]>('/imports'),
    template: (type: T.ImportBatch['entityType']) => http.get<{ filename: string; csv: string }>(`/imports/templates/${type}`),
    validate: (type: T.ImportBatch['entityType'], fileName: string, csv: string) =>
      http.post<T.ImportBatch>('/imports', { type, fileName, csv }),
    commit: (id: string, mode: 'ALL' | 'VALID_ONLY') => http.post<T.ImportBatch>(`/imports/${id}/commit`, { mode }),
  },

  // ---------- Dev only ----------
  dev: {
    reset: () => http.post<void>('/__dev/reset'),
    clock: (hours: number) => http.post<{ now: string }>('/__dev/advance-clock', { hours }),
  },
};

export type Api = typeof api;
