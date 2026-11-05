// NFR-C2: currency, date format and time zone come from configuration (defaults GHS, DD/MM/YYYY, Africa/Accra).
import { formatInTimeZone } from 'date-fns-tz';
import type { Settings } from '@ldy/api-client';

let org: Settings['organisation'] = {
  name: 'LDY Laundry',
  address: '',
  phone: '',
  tin: '',
  currency: 'GHS',
  dateFormat: 'dd/MM/yyyy',
  timeZone: 'Africa/Accra',
};

export function setOrganisation(o: Settings['organisation']) {
  org = o;
}
export function organisation() {
  return org;
}

export function money(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: org.currency, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${org.currency} ${n.toFixed(2)}`;
  }
}

export function date(isoString?: string | null) {
  if (!isoString) return '—';
  return formatInTimeZone(new Date(isoString), org.timeZone, org.dateFormat);
}

export function dateTime(isoString?: string | null) {
  if (!isoString) return '—';
  return formatInTimeZone(new Date(isoString), org.timeZone, `${org.dateFormat} HH:mm`);
}

export function time(isoString?: string | null) {
  if (!isoString) return '—';
  return formatInTimeZone(new Date(isoString), org.timeZone, 'HH:mm');
}

/** Today's date in the configured time zone, as YYYY-MM-DD. */
export function todayISO(offsetDays = 0) {
  return formatInTimeZone(new Date(Date.now() + offsetDays * 86400_000), org.timeZone, 'yyyy-MM-dd');
}

export function relativeHours(isoString?: string) {
  if (!isoString) return '';
  const h = (Date.now() - new Date(isoString).getTime()) / 3600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

/** §3.11 privacy: mask phone numbers in lists where the full number isn't needed. */
export function maskPhone(p?: string) {
  if (!p) return '—';
  return p.length > 6 ? `${p.slice(0, 3)} ••• ${p.slice(-4)}` : p;
}

export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Format a YYYY-MM-DD calendar date (bookings, cash-up days) in the configured format. */
export function day(ymd?: string | null) {
  if (!ymd) return '—';
  return formatInTimeZone(new Date(`${ymd}T12:00:00Z`), org.timeZone, org.dateFormat);
}
