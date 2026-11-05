/**
 * Centralised HTTP client (Manual Phase Three, step 11).
 * - One base URL from the environment (VITE_API_BASE_URL, default /api/v1).
 * - Bearer token attached from the session store.
 * - Every non-2xx response becomes an ApiError carrying the server's error `code`,
 *   which the UI maps to the exact SRS wording (locales/en/errors.json).
 */

export interface ApiErrorBody {
  code: string;
  message?: string;
  field?: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  code: string;
  field?: string;
  details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? body.code);
    this.status = status;
    this.code = body.code;
    this.field = body.field;
    this.details = body.details;
  }
}

type TokenGetter = () => string | null;
type UnauthorisedHandler = (err: ApiError) => void;

let baseUrl = '/api/v1';
let getToken: TokenGetter = () => null;
let onUnauthorised: UnauthorisedHandler = () => {};

export function configureClient(opts: {
  baseUrl?: string;
  getToken?: TokenGetter;
  onUnauthorised?: UnauthorisedHandler;
}) {
  if (opts.baseUrl) baseUrl = opts.baseUrl.replace(/\/$/, '');
  if (opts.getToken) getToken = opts.getToken;
  if (opts.onUnauthorised) onUnauthorised = opts.onUnauthorised;
}

export function apiUrl(path: string) {
  return `${baseUrl}${path}`;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, query?: Query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(apiUrl(withQuery(path, query)), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR' });
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const errBody: ApiErrorBody =
      data && typeof data === 'object' && 'code' in (data as object)
        ? (data as ApiErrorBody)
        : { code: res.status >= 500 ? 'SERVER_ERROR' : `HTTP_${res.status}` };
    const err = new ApiError(res.status, errBody);
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorised(err);
    throw err;
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};
