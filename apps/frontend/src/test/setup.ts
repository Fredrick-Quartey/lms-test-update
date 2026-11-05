import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { configureClient } from '@ldy/api-client';
import { server } from '@/mocks/node';
import { resetDb } from '@/mocks/seed';
import '@/app/i18n';

// jsdom has no <dialog> methods yet; give it the behaviour browsers have.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
}

// Node's fetch needs an absolute URL; MSW intercepts it the same way the browser worker does.
configureClient({ baseUrl: 'http://localhost/api/v1' });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  resetDb();
  sessionStorage.clear();
});

afterEach(() => cleanup());
afterAll(() => server.close());
