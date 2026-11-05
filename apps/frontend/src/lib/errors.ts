import { ApiError } from '@ldy/api-client';
import i18n from '@/app/i18n';
import { money } from './format';

/** Map a server error code to the exact SRS wording (locales/en/errors.json). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const d = { ...(err.details ?? {}) } as Record<string, unknown>;
    if (typeof d.amount === 'number') d.amount = money(d.amount);
    if (typeof d.balance === 'number') d.balance = money(d.balance);
    if (Array.isArray(d.missing)) d.missing = d.missing.join(', ');
    const key = `errors:${err.code}`;
    if (i18n.exists(key)) {
      let msg = i18n.t(key, d as Record<string, string>);
      // B-01 AC2: name the mismatch; C-03 AC2: name the missing item(s)
      if (err.code === 'INCOMPATIBLE_BATCH' && d.mismatch) msg += ` (${String(d.mismatch)})`;
      if (err.code === 'INCOMPLETE_MANIFEST' && d.missing) msg += ` Missing: ${String(d.missing)}.`;
      if (err.code === 'QC_NOT_PASSED' && Array.isArray(err.details?.tags)) msg += ` Waiting on: ${(err.details!.tags as string[]).join(', ')}.`;
      return msg;
    }
    return i18n.t(err.status >= 500 ? 'errors:SERVER_ERROR' : 'errors:SERVER_ERROR');
  }
  return i18n.t('errors:SERVER_ERROR');
}

export function errorField(err: unknown): string | undefined {
  return err instanceof ApiError ? err.field : undefined;
}

export function errorCode(err: unknown): string | undefined {
  return err instanceof ApiError ? err.code : undefined;
}

/** Look up a catalogue message by code for client-side validation (same wording as the server). */
export function msg(code: string, vars?: Record<string, string | number>) {
  return i18n.t(`errors:${code}`, vars);
}
