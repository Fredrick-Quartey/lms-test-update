import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { configureClient } from '@ldy/api-client';
import './index.css';
import '@/app/i18n';
import { App } from '@/app/App';

configureClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1' });

async function start() {
  // Manual Phase Three step 10: realistic mocks until the FastAPI endpoints are announced ready.
  if (import.meta.env.VITE_USE_MOCKS !== 'false') {
    const { worker } = await import('@/mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
