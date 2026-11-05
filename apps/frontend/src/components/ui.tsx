/**
 * Shared UI components (REDESIGN_PROMPT §3.5). Restyled to the new design system; the original
 * exports are kept so every screen continues to work, and the new pieces are added below them.
 */
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ItemStatus, OrderStatus, PaymentState } from '@ldy/api-client';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Info, X, XCircle } from 'lucide-react';
import { errorMessage } from '@/lib/errors';
import { money } from '@/lib/format';

// ---------------- Page structure ----------------
/** Page title, optional intro, actions and a Back link to the parent list (REDESIGN §4, D11). */
export function PageHeader({ title, intro, actions, back }: {
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="mb-5">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-blue hover:underline">
          <ArrowLeft size={18} aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h1 className="page-title">{title}</h1>
          {intro && <p className="muted mt-1">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Section({ title, children, aside, className = '' }: { title?: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={`panel p-4 sm:p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="section-title">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------------- Feedback ----------------
type Tone = 'info' | 'success' | 'warning' | 'error';
const toneClass: Record<Tone, string> = {
  info: 'border-blue/25 bg-sky text-navy',
  success: 'border-success/30 bg-success-wash text-navy',
  warning: 'border-warning/30 bg-warning-wash text-navy',
  error: 'border-danger/30 bg-danger-wash text-navy',
};
const toneIcon: Record<Tone, ReactNode> = {
  info: <Info size={18} className="text-blue" aria-hidden />,
  success: <CheckCircle2 size={18} className="text-success" aria-hidden />,
  warning: <AlertTriangle size={18} className="text-warning" aria-hidden />,
  error: <XCircle size={18} className="text-danger" aria-hidden />,
};

export function Alert({ tone = 'info', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-[12px] border px-3.5 py-3 text-sm ${toneClass[tone]}`}>
      <span className="mt-0.5 shrink-0">{toneIcon[tone]}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Transparency (§12.2): errors are never swallowed; offer a retry where it makes sense. */
export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <Alert tone="error">
      {errorMessage(error)}
      {onRetry && (
        <button type="button" className="btn-link ml-2" onClick={onRetry}>
          Try again
        </button>
      )}
    </Alert>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-[8px] bg-line/70 ${className}`} />;
}

/** Skeleton loaders instead of blank screens (§12.1). */
export function Loading({ label, rows = 3 }: { label?: string; rows?: number }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 py-2" role="status" aria-live="polite">
      <span className="sr-only">{label ?? t('state.loading')}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="panel space-y-2 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function Empty({ children, action, icon }: { children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[16px] border border-dashed border-line bg-white px-4 py-10 text-center">
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky text-blue">{icon}</div>}
      <p className="muted">{children ?? t('state.empty')}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Loading / error / empty / success: Manual Phase Three step 9. */
export function QueryState<T>({ q, empty, isEmpty, children }: {
  q: UseQueryResult<T>;
  empty?: ReactNode;
  isEmpty?: (d: T) => boolean;
  children: (d: T) => ReactNode;
}) {
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorAlert error={q.error} onRetry={() => void q.refetch()} />;
  if (isEmpty?.(q.data)) return <Empty>{empty}</Empty>;
  return <>{children(q.data)}</>;
}

// ---------------- Toasts: every action ends with a confirmation (§12.2) ----------------
interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
}
const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastMsg[]>([]);
  const push = useCallback((text: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), tone === 'error' ? 8000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-3 top-3 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:right-4 sm:top-4 sm:w-96 sm:items-end">
        {list.map((m) => (
          <div key={m.id} className={`sheet-in raised pointer-events-auto flex w-full items-start gap-2.5 rounded-[12px] border px-3.5 py-3 text-sm ${toneClass[m.tone]}`}>
            <span className="mt-0.5 shrink-0">{toneIcon[m.tone]}</span>
            <span className="min-w-0 flex-1">{m.text}</span>
            <button className="shrink-0 text-slate hover:text-navy" aria-label="Dismiss" onClick={() => setList((l) => l.filter((x) => x.id !== m.id))}>
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------- Form fields ----------------
export function Field({ label, error, hint, children, id, required, icon }: {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
  id?: string;
  required?: boolean;
  icon?: ReactNode;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = [error ? `${fid}-err` : '', hint ? `${fid}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={fid} className="label">
        {icon && <span className="text-slate" aria-hidden>{icon}</span>}
        {label}
        {required && <span className="text-danger" aria-hidden>*</span>}
      </label>
      {children({ id: fid, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${fid}-hint`} className="hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fid}-err`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Segmented choice (Standard / Express, payment method…). */
export function Segmented<V extends string>({ label, options, value, onChange }: {
  label: string;
  options: { value: V; label: ReactNode }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className={`btn flex-1 cursor-pointer ${value === o.value ? 'border-blue bg-sky text-blue-dark' : ''}`}>
            <input type="radio" className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------- Status badges (colour + text, never colour alone) ----------------
const ORDER_TONE: Record<OrderStatus, string> = {
  DRAFT: 'bg-mist text-slate border-line',
  RECEIVED: 'bg-white text-navy border-navy/25',
  IN_SORTING: 'bg-sky text-blue-dark border-blue/25',
  IN_PROCESSING: 'bg-sky text-blue-dark border-blue/25',
  QC_PASSED: 'bg-success-wash text-success border-success/30',
  QC_FAILED: 'bg-danger-wash text-danger border-danger/30',
  PACKAGED: 'bg-warning-wash text-warning border-warning/30',
  READY_FOR_PICKUP: 'bg-tag text-navy border-warning/40',
  OUT_FOR_DELIVERY: 'bg-tag text-navy border-warning/40',
  COLLECTED: 'bg-success-wash text-success border-success/30',
  DELIVERED: 'bg-success-wash text-success border-success/30',
  PAID: 'bg-success-wash text-success border-success/30',
  RESOLVED: 'bg-success-wash text-success border-success/30',
  CANCELLED: 'bg-mist text-slate border-line line-through',
  UNCLAIMED_DISPOSED: 'bg-mist text-slate border-line',
};

const chip = 'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation('status');
  return <span className={`${chip} ${ORDER_TONE[status]}`}>{t(`order.${status}`)}</span>;
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const { t } = useTranslation('status');
  const tone =
    status === 'QC_FAILED' || status === 'DISCARDED'
      ? 'bg-danger-wash text-danger border-danger/30'
      : status === 'QC_PASSED' || status === 'PACKAGED' || status === 'COLLECTED' || status === 'DELIVERED'
        ? 'bg-success-wash text-success border-success/30'
        : status === 'REWORK'
          ? 'bg-warning-wash text-warning border-warning/30'
          : 'bg-sky text-blue-dark border-blue/25';
  return <span className={`${chip} ${tone}`}>{t(`item.${status}`)}</span>;
}

/** D16: the balance due on an order is always visible (never behind the eye toggle). */
export function PaymentBadge({ state, balance }: { state: PaymentState; balance?: number }) {
  const { t } = useTranslation('status');
  const tone =
    state === 'PAID' ? 'bg-success-wash text-success border-success/30' : state === 'ON_ACCOUNT' ? 'bg-sky text-blue-dark border-blue/25' : 'bg-danger-wash text-danger border-danger/30';
  return (
    <span className={`${chip} ${tone}`}>
      {t(`payment.${state}`)}
      {balance !== undefined && balance > 0 && state !== 'ON_ACCOUNT' ? `: ${money(balance)} due` : ''}
    </span>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'info' }) {
  const map = {
    neutral: 'bg-mist text-slate border-line',
    good: 'bg-success-wash text-success border-success/30',
    bad: 'bg-danger-wash text-danger border-danger/30',
    warn: 'bg-warning-wash text-warning border-warning/30',
    info: 'bg-sky text-blue-dark border-blue/25',
  };
  return <span className={`${chip} ${map[tone]}`}>{children}</span>;
}

/** Signature element: tag, order and booking numbers as manila ticket stubs. */
export function Ticket({ children, size = 'sm' }: { children: ReactNode; size?: 'sm' | 'lg' }) {
  return <span className={`ticket ${size === 'lg' ? 'px-3 py-1 text-2xl sm:text-3xl' : ''}`}>{children}</span>;
}

// ---------------- Modal: centred on desktop, bottom sheet on phones ----------------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop closes
      }}
      aria-labelledby="modal-title"
      className={`mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[24px] border-0 bg-white p-0 text-navy backdrop:bg-navy/45 sm:m-auto sm:w-[calc(100%-2rem)] sm:rounded-[24px] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
    >
      {open && (
        <div className="sheet-in p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
          <div aria-hidden className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-lg font-bold">
              {title}
            </h2>
            <button className="-mr-2 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate hover:bg-mist hover:text-navy" aria-label="Close" onClick={onClose}>
              <X size={20} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Yes / No confirmation (sign-out and other deliberate actions). Destructive action on the right. */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, tone = 'primary' }: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-slate">{message}</p>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button className="btn" onClick={onCancel} autoFocus>
          {cancelLabel}
        </button>
        <button className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Popover that closes on outside click, Esc and route change (D12). */
export function Popover({ trigger, children, align = 'right', width = 'w-80' }: {
  trigger: (p: { open: boolean; toggle: () => void; 'aria-expanded': boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), 'aria-expanded': open })}
      {open && (
        <div className={`sheet-in raised absolute z-40 mt-2 max-h-[70vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[16px] border border-line bg-white p-2 text-navy ${width} ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ---------------- Tabs (a select on phones) ----------------
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <>
      <label className="mb-4 block sm:hidden">
        <span className="sr-only">Section</span>
        <select className="input" value={value} onChange={(e) => onChange(e.target.value as K)}>
          {tabs.map((tb) => (
            <option key={tb.key} value={tb.key}>
              {tb.label}
              {tb.count !== undefined ? ` (${tb.count})` : ''}
            </option>
          ))}
        </select>
      </label>
      <div role="tablist" className="mb-5 hidden max-w-full gap-1 overflow-x-auto rounded-[14px] bg-white p-1 ring-1 ring-line sm:inline-flex">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={value === tb.key}
            onClick={() => onChange(tb.key)}
            className={`whitespace-nowrap rounded-[10px] px-3.5 py-2 text-sm font-semibold transition-colors ${value === tb.key ? 'bg-blue text-white' : 'text-slate hover:bg-mist hover:text-navy'}`}
          >
            {tb.label}
            {tb.count !== undefined && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${value === tb.key ? 'bg-white/20' : 'bg-mist'}`}>{tb.count}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------- Money visibility (D16: revenue hidden by default on every visit) ----------------
const MoneyCtx = createContext<{ visible: boolean; toggle: () => void }>({ visible: false, toggle: () => {} });
export function MoneyVisibility({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return <MoneyCtx.Provider value={{ visible, toggle: () => setVisible((v) => !v) }}>{children}</MoneyCtx.Provider>;
}
export const useMoneyVisible = () => useContext(MoneyCtx);

export function EyeToggle() {
  const { visible, toggle } = useMoneyVisible();
  return (
    <button type="button" className="btn-ghost min-h-10 text-sm" aria-pressed={visible} onClick={toggle}>
      {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      {visible ? 'Hide amounts' : 'Show amounts'}
    </button>
  );
}

export function HiddenValue({ children }: { children: ReactNode }) {
  const { visible } = useMoneyVisible();
  return visible ? <>{children}</> : <span aria-label="Hidden. Use Show amounts to reveal.">••••</span>;
}

export function StatCard({ label, value, note, hideable, icon }: { label: string; value: ReactNode; note?: ReactNode; hideable?: boolean; icon?: ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate">{label}</p>
        {icon && <span className="text-aqua" aria-hidden>{icon}</span>}
      </div>
      <p className="tabular mt-1.5 text-2xl font-bold">{hideable ? <HiddenValue>{value}</HiddenValue> : value}</p>
      {note && <p className="mt-0.5 text-sm text-slate">{hideable ? <HiddenValue>{note}</HiddenValue> : note}</p>}
    </div>
  );
}
/** Kept for older screens. */
export const Stat = StatCard;

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------- Big action (one main button, sticky on phones) ----------------
export function BigActionButton({ children, tone = 'primary', sticky = true, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'success' | 'danger'; sticky?: boolean }) {
  const toneCls = tone === 'success' ? 'bg-success hover:brightness-110' : tone === 'danger' ? 'bg-danger hover:brightness-110' : 'bg-blue hover:bg-blue-dark';
  const btn = (
    <button
      {...rest}
      className={`flex min-h-16 w-full items-center justify-center gap-2 rounded-[16px] px-5 text-lg font-bold text-white shadow-[0_8px_20px_-10px_rgb(24_70_200/.6)] transition-[filter,background-color] disabled:cursor-not-allowed disabled:opacity-60 ${toneCls} ${className}`}
    >
      {children}
    </button>
  );
  if (!sticky) return btn;
  return (
    <div className="sticky-action sticky z-20 -mx-1 mt-4 bg-gradient-to-t from-mist via-mist/95 to-transparent px-1 pb-2 pt-4">
      {btn}
    </div>
  );
}

// ---------------- Avatar (initials only; photo upload is OQ19) ----------------
export function Avatar({ name, size = 36 }: { name?: string; size?: number }) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue to-aqua font-bold text-white"
    >
      {initials}
    </span>
  );
}

// ---------------- Stepper ----------------
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < current ? 'bg-success text-white' : i === current ? 'bg-blue text-white' : 'bg-line text-slate'}`}>
            {i < current ? '✓' : i + 1}
          </span>
          <span className={`hidden text-sm sm:inline ${i === current ? 'font-semibold' : 'text-slate'}`}>{s}</span>
          {i < steps.length - 1 && <span aria-hidden className={`h-0.5 flex-1 rounded-[8px] ${i < current ? 'bg-success' : 'bg-line'}`} />}
        </li>
      ))}
    </ol>
  );
}

function Wrap({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  if (to.startsWith('#')) return <a href={to} className={className}>{children}</a>;
  return <Link to={to} className={className}>{children}</Link>;
}

/** Task tile used on role home screens (D25). */
export function TaskTile({ to, title, note, icon, count, tone = 'blue' }: { to: string; title: string; note?: ReactNode; icon: ReactNode; count?: number; tone?: 'blue' | 'aqua' | 'warn' }) {
  const toneCls = tone === 'warn' ? 'bg-warning-wash text-warning' : tone === 'aqua' ? 'bg-aqua/12 text-aqua' : 'bg-sky text-blue';
  return (
    <Wrap to={to} className="panel group flex items-center gap-4 p-4 transition-colors hover:border-blue/50 sm:p-5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${toneCls}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold group-hover:text-blue">{title}</span>
        {note && <span className="block text-sm text-slate">{note}</span>}
      </span>
      {count !== undefined && <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${count > 0 ? 'bg-blue text-white' : 'bg-mist text-slate'}`}>{count}</span>}
    </Wrap>
  );
}
