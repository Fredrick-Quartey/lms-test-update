import { lazy, Suspense, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Camera, ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dateTime } from '@/lib/format';
import type { TimelineEntry } from '@ldy/api-client';

/**
 * A-03 / NFR-P2 / §4.2: scan-first input. A USB/Bluetooth scanner acts as a keyboard ("wedge"):
 * it types the code quickly and presses Enter, so a plain form handles it. Typing works the same way,
 * and the camera button reads Code 39 / QR tags with the phone camera (lazy-loaded).
 */
export function ScanInput({ onScan, label, placeholder = 'Scan or type a tag, e.g. T00012', busy, autoFocus = true, buttonLabel = 'Look up', id, camera = true }: {
  onScan: (code: string) => void;
  label: string;
  placeholder?: string;
  busy?: boolean;
  autoFocus?: boolean;
  buttonLabel?: string;
  id?: string;
  camera?: boolean;
}) {
  const [v, setV] = useState('');
  const [cam, setCam] = useState(false);
  const auto = useId();
  const fid = id ?? `scan-${auto}`;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Don't pop the phone keyboard open on touch devices; focus only where a scanner/keyboard is likely.
    if (autoFocus && window.matchMedia?.('(pointer: fine)').matches) ref.current?.focus();
  }, [autoFocus]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = v.trim().toUpperCase();
    if (!code) return;
    onScan(code);
    setV('');
    ref.current?.focus();
  };
  return (
    <>
      <form onSubmit={submit} className="flex gap-2" role="search">
        <label htmlFor={fid} className="sr-only">
          {label}
        </label>
        <div className="relative min-w-0 flex-1">
          <ScanLine size={20} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
          <input
            id={fid}
            ref={ref}
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            autoCapitalize="characters"
            enterKeyHint="go"
            className="input scan-input pl-11 text-lg font-semibold tracking-wide"
          />
        </div>
        {camera && (
          <button type="button" className="btn shrink-0 px-3" onClick={() => setCam(true)} aria-label="Scan with camera">
            <Camera size={20} aria-hidden />
            <span className="hidden md:inline">Camera</span>
          </button>
        )}
        <button className="btn-primary shrink-0 px-4" disabled={busy || !v.trim()}>
          <span className="hidden sm:inline">{buttonLabel}</span>
          <ArrowRight size={20} aria-hidden className="sm:hidden" />
          <span className="sr-only sm:hidden">{buttonLabel}</span>
        </button>
      </form>
      {cam && (
        <Suspense fallback={null}>
          <CameraScanner
            onClose={() => setCam(false)}
            onResult={(code) => {
              setCam(false);
              onScan(code.trim().toUpperCase());
            }}
          />
        </Suspense>
      )}
    </>
  );
}
/** REDESIGN §3.5 name for the same component. */
export const ScanField = ScanInput;

const CameraScanner = lazy(() => import('./CameraScanner'));

/** D-03: signature capture on a canvas (works with finger, stylus or mouse). */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = 160 * ratio;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#12313b';
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  return (
    <div>
      <canvas
        ref={ref}
        aria-label="Signature area — sign with your finger or a stylus"
        role="img"
        className="h-40 w-full touch-none rounded-[12px] border border-dashed border-navy/40 bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext('2d')!;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          if (!hasInk) setHasInk(true);
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          if (hasInk) onChange(e.currentTarget.toDataURL('image/png'));
        }}
      />
      <div className="mt-1 flex justify-between text-sm">
        <span className="muted">{hasInk ? 'Signature captured' : 'Sign inside the box'}</span>
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            const c = ref.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            setHasInk(false);
            onChange(null);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

/** Photo from camera or file, compressed client-side before upload (NFR-U3: 3G friendly). */
export function PhotoInput({ label, value, onChange, id }: { label: string; value?: string | null; onChange: (dataUrl: string | null) => void; id?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id ?? 'photo'}>
        {label}
      </label>
      <input
        id={id ?? 'photo'}
        type="file"
        accept="image/*"
        capture="environment"
        className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-[12px] file:border file:border-line file:bg-white file:px-3 file:font-semibold"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return onChange(null);
          setBusy(true);
          try {
            onChange(await compress(f));
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <p className="hint">Preparing photo…</p>}
      {value && <img src={value} alt="Selected photo preview" className="mt-2 max-h-40 rounded-[12px] border border-line" />}
    </div>
  );
}

async function compress(file: File, max = 1024, quality = 0.7): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Chronological history (D-04). */
export function Timeline({ entries, empty }: { entries: (TimelineEntry & { detail?: ReactNode })[]; empty?: string }) {
  if (!entries.length) return <p className="muted text-sm">{empty ?? 'No events yet.'}</p>;
  return (
    <ol className="relative ml-2 border-l-2 border-line">
      {entries.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative mb-3 pl-5 last:mb-0">
          <span aria-hidden className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${i === entries.length - 1 ? 'bg-blue' : 'bg-navy/40'}`} />
          <p className="font-semibold leading-tight">{e.label}</p>
          <p className="text-sm text-slate">
            {dateTime(e.at)}
            {e.actor ? `, ${e.actor}` : ''}
          </p>
          {e.detail && <div className="mt-0.5 text-sm">{e.detail}</div>}
        </li>
      ))}
    </ol>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-2 text-sm">
      <span className="muted">
        {total === 0 ? 'No results' : `${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)} of ${total}`}
      </span>
      <div className="flex gap-2">
        <button className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('action.previous')}
        </button>
        <button className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t('action.next')}
        </button>
      </div>
    </nav>
  );
}

export function SortHeader({ label, field, sort, onSort }: { label: string; field: string; sort: string; onSort: (s: string) => void }) {
  const [f, dir] = sort.split(':');
  const active = f === field;
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className="font-semibold hover:text-navy" onClick={() => onSort(`${field}:${active && dir === 'desc' ? 'asc' : 'desc'}`)}>
        {label}
        <span aria-hidden className="ml-1 text-xs">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}
