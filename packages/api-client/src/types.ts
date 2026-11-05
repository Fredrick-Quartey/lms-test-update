/**
 * Shared LDY domain types — mirror SRS §5.1 (Key Data Entities) and §2.5 (Status Matrix).
 * These are hand-written for now. When the FastAPI backend publishes its OpenAPI spec,
 * generate types with `openapi-typescript` and reconcile any field-name differences here.
 */

// ---------- Roles (SRS §2.3) ----------
export type Role =
  | 'CUSTOMER'
  | 'FRONT_DESK'
  | 'ATTENDANT'
  | 'RIDER'
  | 'MANAGER'
  | 'ADMIN'
  | 'AUDITOR';

export const STAFF_ROLES: Role[] = ['FRONT_DESK', 'ATTENDANT', 'RIDER', 'MANAGER', 'ADMIN', 'AUDITOR'];

// ---------- Statuses (SRS §2.5) ----------
export type OrderStatus =
  | 'DRAFT'
  | 'RECEIVED'
  | 'IN_SORTING'
  | 'IN_PROCESSING'
  | 'QC_PASSED'
  | 'QC_FAILED'
  | 'PACKAGED'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'COLLECTED'
  | 'DELIVERED'
  | 'PAID'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'UNCLAIMED_DISPOSED';

export type ItemStatus =
  | 'RECEIVED'
  | 'IN_SORTING'
  | 'IN_PROCESSING'
  | 'PROCESSING_COMPLETE'
  | 'QC_PASSED'
  | 'QC_FAILED'
  | 'REWORK'
  | 'PACKAGED'
  | 'COLLECTED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'DISCARDED';

export type PaymentState = 'UNPAID' | 'PARTIAL' | 'PAID' | 'ON_ACCOUNT';

export type BatchStatus = 'OPEN' | 'IN_PROCESSING' | 'PROCESSING_COMPLETE' | 'CANCELLED';

// ---------- Users (F-04) ----------
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DEACTIVATED';

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  roles: Role[];
  status: UserStatus;
  mfaEnabled: boolean;
  lastSignInAt?: string;
  lockedUntil?: string;
  customerId?: string; // set for customer-portal accounts
  sodJustification?: string;
}

export interface Session {
  token: string;
  user: User;
  mfaRequired?: boolean;
}

// ---------- Customers (A-01, E-04) ----------
export interface Preferences {
  starch: boolean;
  softener: boolean;
  finish: 'HANGER' | 'FOLD';
}

export interface CorporateTerms {
  creditLimit: number;
  termsDays: number;
  billingCycle: 'MONTHLY';
  runningBalance: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  preferences: Preferences;
  accountType: 'INDIVIDUAL' | 'CORPORATE';
  corporate?: CorporateTerms;
  optOutReminders: boolean;
  createdAt: string;
}

// ---------- Catalogue & config (E-01, F-03) ----------
export interface ServiceType {
  id: string;
  name: string;
  pricing: 'PER_ITEM' | 'PER_KG';
  stages: string[]; // B-02 configured sequence
  active: boolean;
}

export interface ItemCategory {
  id: string;
  name: string;
}

export interface PriceEntry {
  id: string;
  categoryId: string; // '*' for weight-based service types
  serviceTypeId: string;
  price: number; // per item, or per kg for PER_KG services
}

export type Colour = 'WHITES' | 'COLOURS' | 'DARKS';
export type Fabric = 'REGULAR' | 'DELICATE';

export interface Machine {
  id: string;
  name: string;
  type: 'WASHER' | 'DRYER' | 'PRESS' | 'STATION';
  status: 'AVAILABLE' | 'IN_USE' | 'UNDER_MAINTENANCE';
  currentBatchId?: string;
  minutesInUse: number;
}

export interface Tax {
  name: string;
  ratePercent: number;
}

export interface Settings {
  organisation: {
    name: string;
    address: string;
    phone: string;
    tin: string;
    currency: string;
    dateFormat: string;
    timeZone: string;
  };
  sla: { standardHours: number; expressHours: number };
  express: { surchargeType: 'PERCENT' | 'FIXED'; value: number };
  stageAlertHours: number;
  reworkLimit: number;
  qc: { mode: 'ALL' | 'SAMPLE'; samplePercent: number; independent: boolean };
  batching: { separateColours: boolean; separateDelicates: boolean };
  handover: {
    reminderDays: number[];
    managerFlagDays: number;
    disposalDays: number;
    routeCapacity: number;
    paymentPolicy: 'AT_DROPOFF' | 'AT_COLLECTION' | 'EITHER';
  };
  billing: {
    taxes: Tax[];
    liabilityTerms: string;
    cashupTolerance: number;
    corporateDefaultLimit: number;
    corporateTermsDays: number;
  };
  bookings: {
    openHour: number;
    closeHour: number;
    slotMinutes: number;
    maxPerSlot: number;
    cancelCutoffHours: number;
  };
  security: { idleTimeoutMinutes: number; lockoutAttempts: number; lockoutMinutes: number };
  /** D28: switches for COULD features so the supervisor can hide them for the Release 1 demo. */
  features: { bookings: boolean; corporate: boolean };
}

export interface Catalogue {
  serviceTypes: ServiceType[];
  categories: ItemCategory[];
  prices: PriceEntry[];
}

// ---------- Orders & items (A-02, A-03, A-04) ----------
export type FlagType = 'STAIN' | 'DAMAGE' | 'DELICATE' | 'NO_STARCH' | 'COLOUR_RUN_RISK' | 'OTHER';

export interface ItemFlag {
  id: string;
  type: FlagType;
  note?: string;
  photo?: string; // data URL in mocks; upload URL in production
  stage: string; // where it was raised: INTAKE / SORTING / QC ...
  by: string;
  at: string;
}

export interface StageLogEntry {
  stage: string;
  batchId: string;
  startedAt?: string;
  completedAt?: string;
  startedBy?: string;
  completedBy?: string;
  rework: boolean;
}

export interface QcRecord {
  outcome: 'PASS' | 'FAIL' | 'REWORK';
  reason?: string;
  by: string;
  byName: string;
  at: string;
}

export interface OrderItem {
  id: string;
  tag?: string;
  categoryId: string;
  serviceTypeId: string;
  quantity: number;
  weightKg?: number;
  colour: Colour;
  fabric: Fabric;
  instructions?: string;
  flags: ItemFlag[];
  unitPrice: number | null;
  lineTotal: number | null;
  status: ItemStatus;
  batchId?: string;
  stageLog: StageLogEntry[];
  qc: QcRecord[];
  reworkCount: number;
  needsManagerReview: boolean;
  overrideApproved: boolean;
  checkedOff: boolean;
  lastStageCompletedBy?: string;
  reworkStage?: string; // B-04: stage the item must re-enter
  qcRequired: boolean; // C-01: false when QC mode is SAMPLE and the item was not sampled
}

export interface InvoiceLine {
  label: string;
  amount: number;
}

export interface Invoice {
  number: string;
  issuedAt: string;
  lines: InvoiceLine[];
  subtotal: number;
  surcharge: number;
  taxes: InvoiceLine[];
  total: number;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'MOMO';
  reference?: string;
  tendered?: number;
  at: string;
  by: string;
  byName: string;
  receiptNo: string;
  kind: 'PAYMENT' | 'REFUND';
}

export interface ProofOfDelivery {
  recipientName: string;
  signature?: string;
  photo?: string;
  at: string;
  by: string;
  byName: string;
}

export interface Order {
  id: string;
  orderNo: string;
  customerId?: string;
  guest?: { name?: string; phone: string };
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  speed: 'STANDARD' | 'EXPRESS';
  items: OrderItem[];
  deliveryFlag: boolean;
  deliveryAddress?: string;
  expectedReadyBy?: string;
  createdAt: string;
  createdBy: string;
  finalisedAt?: string;
  invoice?: Invoice;
  payments: Payment[];
  amountPaid: number;
  balance: number;
  paymentState: PaymentState;
  onAccount: boolean;
  shelf?: string;
  readyNotifiedAt?: string;
  collectedAt?: string;
  deliveredAt?: string;
  pod?: ProofOfDelivery;
  cancellation?: { reason: string; note?: string; by: string; at: string };
  disposal?: { reason: string; by: string; at: string };
  bookingId?: string;
  routeId?: string;
  failedDeliveries: { reason: string; at: string; by: string }[];
  remindersSent: number[];
  refunded: number;
  creditOverride?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface TimelineEntry {
  at: string;
  label: string;
  actor?: string;
}

/** Public tracking view (D-04) — deliberately minimal (Act 843): no names, addresses or amounts. */
export interface TrackingView {
  orderNo: string;
  status: OrderStatus;
  expectedReadyBy?: string;
  deliveryFlag: boolean;
  shelf?: string;
  timeline: TimelineEntry[];
}

// ---------- Floor (B-01..B-04) ----------
export interface BatchStage {
  name: string;
  startedAt?: string;
  completedAt?: string;
  startedBy?: string;
  completedBy?: string;
}

export interface Batch {
  id: string;
  batchNo: string;
  serviceTypeId: string;
  colour?: Colour;
  fabric: Fabric;
  machineId?: string;
  attendantId: string;
  attendantName: string;
  itemIds: string[];
  status: BatchStatus;
  stages: BatchStage[];
  currentStageIndex: number;
  isRework: boolean;
  reworkStartIndex: number;
  createdAt: string;
  overdue: boolean;
}

export interface ScanResult {
  order: Order;
  item: OrderItem;
  batch?: Batch;
  nextAction:
    | 'SORT'
    | 'IN_BATCH'
    | 'QC'
    | 'AWAIT_QC_RESOLUTION'
    | 'PACK'
    | 'WAITING_FOR_OTHER_ITEMS'
    | 'PACKAGED'
    | 'CLOSED';
  qcRequired: boolean;
}

// ---------- Damage (C-02) ----------
export type DamageResolution = 'COMPENSATION' | 'DISCOUNT' | 'REPLACEMENT' | 'NO_FAULT';

export interface DamageReport {
  id: string;
  orderId: string;
  orderNo: string;
  itemId: string;
  tag?: string;
  type: 'DAMAGE' | 'LOST';
  description: string;
  photo?: string;
  intakeFlags: ItemFlag[];
  reportedBy: string;
  reportedByName: string;
  createdAt: string;
  status: 'OPEN' | 'CLOSED';
  resolution?: DamageResolution;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  customerMessage: string;
  customerMessageSent: boolean;
}

// ---------- Delivery (D-02, D-03) ----------
export interface Route {
  id: string;
  routeNo: string;
  riderId?: string;
  riderName?: string;
  date: string;
  window: string;
  orderIds: string[];
  bookingIds: string[];
  capacity: number;
  status: 'PLANNED' | 'DEPARTED' | 'COMPLETED';
}

export interface RiderJob {
  kind: 'DELIVER' | 'COLLECT';
  routeId?: string;
  routeNo?: string;
  window?: string;
  order?: Order;
  booking?: Booking;
}

// ---------- Billing (E-03, E-04, E-05) ----------
export interface ApprovalRequest {
  id: string;
  kind: 'REFUND' | 'ADJUSTMENT' | 'QC_OVERRIDE' | 'CREDIT_OVERRIDE' | 'REWORK_REVIEW';
  orderId: string;
  orderNo: string;
  itemId?: string;
  tag?: string;
  amount?: number;
  method?: Payment['method'];
  reason: string;
  damageReportId?: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export type MethodTotals = { CASH: number; CARD: number; MOMO: number };

export interface Cashup {
  id: string;
  officerId: string;
  officerName: string;
  date: string;
  openedAt: string;
  closedAt?: string;
  expected: MethodTotals;
  counted?: MethodTotals;
  variance?: MethodTotals;
  status: 'OPEN' | 'BALANCED' | 'FLAGGED' | 'RECONCILED';
  reviewedBy?: string;
  reviewedByName?: string;
  explanation?: string;
  pendingReferences: number;
}

export interface CashupReport {
  cashup: Cashup;
  payments: Payment[];
  refunds: Payment[];
  adjustments: ApprovalRequest[];
}

export interface Statement {
  id: string;
  customerId: string;
  customerName: string;
  periodFrom: string;
  periodTo: string;
  orders: { orderNo: string; date: string; total: number }[];
  total: number;
  dueDate: string;
  generatedAt: string;
  generatedBy: string;
  paid: number;
}

// ---------- Bookings (A-06) ----------
export interface Booking {
  id: string;
  bookingNo: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceTypeId: string;
  kind: 'PICKUP' | 'DROPOFF';
  address?: string;
  date: string; // YYYY-MM-DD
  slot: string; // HH:mm
  status: 'CONFIRMED' | 'COLLECTED' | 'CANCELLED' | 'COMPLETED';
  riderId?: string;
  riderName?: string;
  orderId?: string;
  createdAt: string;
}

export interface Slot {
  slot: string;
  booked: number;
  capacity: number;
  full: boolean;
}

// ---------- Audit, notifications, import (F-02, F-05, F-06) ----------
export interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  entityRef?: string;
  actorId: string;
  actorName: string;
  action: string;
  before?: unknown;
  after?: unknown;
  at: string;
}

export interface NotificationTemplate {
  key: string;
  name: string;
  body: string;
  placeholders: string[];
  channels: { inApp: boolean; email: boolean; sms: boolean };
  essential: boolean; // transactional/security — cannot be opted out of
}

export interface NotificationLogEntry {
  id: string;
  template: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  recipient: string;
  reference?: string;
  message: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  attempts: number;
  at: string;
}

export interface InAppNotification {
  id: string;
  text: string;
  link?: string;
  at: string;
  read: boolean;
}

export interface ImportRowResult {
  row: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ImportBatch {
  id: string;
  entityType: 'customers' | 'prices' | 'machines';
  fileName: string;
  rowsTotal: number;
  rowsValid: number;
  rowsRejected: number;
  rowsCommitted: number;
  rows: ImportRowResult[];
  status: 'VALIDATED' | 'COMMITTED';
  runBy: string;
  runAt: string;
}

// ---------- Manager inbox ----------
export interface InboxSummary {
  overdueBatches: Batch[];
  openDamage: DamageReport[];
  pendingApprovals: ApprovalRequest[];
  uncollected: Order[];
  disposable: Order[];
  flaggedCashups: Cashup[];
  failedNotifications: NotificationLogEntry[];
}

// ---------- Reports (F-01) ----------
export interface DashboardData {
  from: string;
  to: string;
  ordersReceived: number;
  ordersCompleted: number;
  revenue: number;
  refunds: number;
  avgTurnaroundHours: number | null;
  onTimeRate: number | null;
  damageRate: number;
  deliverySuccessRate: number | null;
  revenueByDay: { date: string; revenue: number }[];
  revenueByService: { service: string; revenue: number }[];
  machineUtilisation: { machine: string; percent: number }[];
  paymentsByMethod: MethodTotals;
  intakeToday: number;
  /** Average working time per stage (from Start/Finish taps, D20). */
  stageAverages: { stage: string; minutes: number; count: number }[];
}

// ---------- Paging ----------
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Global search (REDESIGN §4, role-scoped on the server) ----------
export interface SearchResults {
  customers: { id: string; name: string; phoneMasked: string; accountType: Customer['accountType'] }[];
  orders: { id: string; orderNo: string; status: OrderStatus; customerName?: string }[];
  tags: { tag: string; orderId: string; orderNo: string; status: ItemStatus }[];
  users: { id: string; name: string; username: string; roles: Role[] }[];
}

/** REDESIGN §9.2: scanning an item for sorting puts it into the right open load automatically. */
export interface LoadScanResult {
  batch: Batch;
  created: boolean;
  alreadyIn: boolean;
  tag: string;
}

/** Attendant "My work" queues (REDESIGN §9.1). No customer names or phone numbers. */
export interface FloorQueue {
  toSort: number;
  readyForCheck: { itemId: string; tag: string; orderId: string; orderNo: string; serviceTypeId: string; categoryId: string; quantity: number; weightKg?: number; flags: number; express: boolean }[];
  failed: { itemId: string; tag: string; orderId: string; orderNo: string; needsManagerReview: boolean }[];
  readyToPack: { orderId: string; orderNo: string; items: number; checked: number; express: boolean; delivery: boolean }[];
}
