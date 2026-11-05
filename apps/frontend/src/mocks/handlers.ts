import { http, HttpResponse, delay } from 'msw';
import { dispatch } from './router';
import { initDb } from './seed';
import { state } from './store';

let ready = false;
function ensureDb() {
  if (!ready || !state) {
    initDb();
    ready = true;
  }
}

/** One catch-all handler: every /api/v1/* request is routed by the mock route table. */
export const handlers = [
  http.all(/\/api\/v1\/.*/, async ({ request }) => {
    ensureDb();
    const url = new URL(request.url);
    const path = url.pathname.replace(/^.*\/api\/v1/, '');
    const query = Object.fromEntries(url.searchParams.entries());
    let body: unknown = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    }
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (import.meta.env.MODE !== 'test') await delay(120); // feel of a real network
    const res = dispatch(request.method, path, query, body, token);
    if (res.status === 204) return new HttpResponse(null, { status: 204 });
    return HttpResponse.json(res.body as Record<string, unknown>, { status: res.status });
  }),
];
