// UI tests for SRS acceptance criteria, run against the same mock API the browser uses.
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@ldy/api-client';
import { StaffLogin } from '@/features/auth/Login';
import { Track } from '@/features/portal/Track';
import { StatusBadge } from '@/components/ui';
import { can } from '@/auth/permissions';
import { errorMessage } from '@/lib/errors';
import { renderApp } from './utils';
import { state } from '@/mocks/store';

describe('F-04 staff sign-in', () => {
  it('F-04 AC1: shows the exact lockout message after 5 wrong passwords', async () => {
    const user = userEvent.setup();
    renderApp(<StaffLogin />, { route: '/staff/login' });
    const name = screen.getByLabelText(/email or phone/i);
    const pass = screen.getByLabelText(/^password/i);
    await user.type(name, 'frontdesk@ldy.test');
    for (let i = 0; i < 5; i++) {
      await user.clear(pass);
      await user.type(pass, 'wrong-password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      await screen.findByRole('alert');
    }
    expect(await screen.findByText(/Too many unsuccessful sign-in attempts\. Your account is locked for 15 minutes\./)).toBeInTheDocument();
  });
});

describe('D-04 public tracking', () => {
  it('D-04 AC1 / D8: shows status and history from the order number alone, with no personal details', async () => {
    const user = userEvent.setup();
    const o = state.orders.find((x) => x.status === 'READY_FOR_PICKUP')!;
    renderApp(<Track />, { route: '/track' });
    await user.type(screen.getByLabelText(/order number/i), o.orderNo);
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^track$/i }));
    expect(await screen.findByText(/Order received at the counter/)).toBeInTheDocument();
    expect(screen.getAllByText('Ready for Pickup').length).toBeGreaterThan(0);
    expect(screen.queryByText(o.customerName)).not.toBeInTheDocument();
  });
});

describe('Shared UI rules', () => {
  it('§2.5: status badges carry text, not colour alone', () => {
    renderApp(<StatusBadge status="UNCLAIMED_DISPOSED" />);
    expect(screen.getByText('Unclaimed – Disposed')).toBeInTheDocument();
  });

  it('§4.1: server error codes map to the exact SRS wording, with placeholders filled', () => {
    expect(errorMessage(new ApiError(409, { code: 'PAYMENT_OUTSTANDING' }))).toBe(
      'This order cannot be marked Collected: payment is still outstanding. Process payment first, or apply a recorded credit exception.',
    );
    expect(errorMessage(new ApiError(409, { code: 'INCOMPLETE_MANIFEST', details: { missing: ['T00003'] } }))).toContain('Missing: T00003');
  });

  it('Appendix A: only a Branch Manager approves; the Auditor and Front Desk cannot', () => {
    expect(can('MANAGER', 'approve')).toBe(true);
    expect(can('FRONT_DESK', 'approve')).toBe(false);
    expect(can('AUDITOR', 'approve')).toBe(false);
    expect(can('RIDER', 'delivery.record')).toBe(true);
    expect(can('MANAGER', 'delivery.record')).toBe(false);
  });
});

describe('A-01 guest intake', () => {
  it('A-01: a guest without a valid phone number cannot start an order', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('ldy.token', JSON.stringify('x'));
    const { Counter } = await import('@/features/counter/Counter');
    renderApp(<Counter />, { route: '/staff/counter' });
    await user.click(screen.getByRole('button', { name: /serve as guest/i }));
    await user.type(screen.getByRole('textbox', { name: 'Phone number' }), '12345');
    await user.click(screen.getByRole('button', { name: /start guest order/i }));
    await waitFor(() => expect(screen.getByText(/Enter a valid Ghana phone number/)).toBeInTheDocument());
  });
});

// ---------------- Redesign round 1 (REDESIGN_PROMPT §15) ----------------
import { act, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '@/auth/session';
import { useSignOutConfirm, Bell } from '@/components/layout';
import { EyeToggle, MoneyVisibility, StatCard, PaymentBadge as PB } from '@/components/ui';
import { api } from '@ldy/api-client';

function SignedIn({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <p>signed out</p>;
}
function SignOutProbe() {
  const s = useSignOutConfirm();
  return (
    <SignedIn>
      <button onClick={s.ask}>Sign out</button>
      {s.dialog}
    </SignedIn>
  );
}
async function loginAs(username: string, portal: 'staff' | 'customer' = 'staff') {
  const session = await api.auth.login(username, 'Password123!', portal);
  sessionStorage.setItem('ldy.token', JSON.stringify(session.token));
  sessionStorage.setItem('ldy.user', JSON.stringify(session.user));
  sessionStorage.setItem('ldy.role', JSON.stringify(session.user.roles[0]));
  return session;
}

describe('Redesign round 1', () => {
  it('D10: sign-out asks first; "Stay signed in" keeps the session and "Sign out" ends it', async () => {
    await loginAs('frontdesk@ldy.test');
    const user = userEvent.setup();
    renderApp(<SignOutProbe />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('End your session?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(screen.queryByText('signed out')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    const dialogButtons = screen.getAllByRole('button', { name: 'Sign out' });
    await user.click(dialogButtons[dialogButtons.length - 1]);
    expect(await screen.findByText('signed out')).toBeInTheDocument();
  });

  it('NFR-SEC1: the idle timeout signs out on its own, without asking', async () => {
    await loginAs('frontdesk@ldy.test');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderApp(<SignOutProbe />);
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
      for (let m = 0; m < 16; m++) {
        await act(async () => {
          vi.advanceTimersByTime(60_000);
        });
      }
      expect(await screen.findByText('signed out')).toBeInTheDocument();
      expect(screen.queryByText('End your session?')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('D16: money shows •••• until the eye is pressed; the balance due is always visible', async () => {
    const user = userEvent.setup();
    renderApp(
      <MoneyVisibility>
        <EyeToggle />
        <StatCard label="Revenue received" value="GH₵ 120.00" hideable />
        <PB state="PARTIAL" balance={40} />
      </MoneyVisibility>,
    );
    expect(screen.getByText('••••')).toBeInTheDocument();
    expect(screen.queryByText('GH₵ 120.00')).not.toBeInTheDocument();
    expect(screen.getByText(/40\.00 due/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show amounts/i }));
    expect(screen.getByText('GH₵ 120.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide amounts/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('D12: the notification panel closes when you click anywhere else', async () => {
    await loginAs('manager@ldy.test');
    const user = userEvent.setup();
    renderApp(<><Bell /><p>elsewhere</p></>);
    await user.click(await screen.findByRole('button', { name: /notifications/i }));
    expect(await screen.findByText('Notifications', { selector: 'p' })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(screen.queryByText('Notifications', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('D5 / OQ16: sign-up step 2 needs an address and the consent box before Create account works', async () => {
    const { Signup } = await import('@/features/portal/Signup');
    const user = userEvent.setup();
    renderApp(<Routes><Route path="/signup" element={<Signup />} /><Route path="/me/welcome" element={<p>welcome page</p>} /></Routes>, { route: '/signup' });
    await user.type(screen.getByLabelText(/full name/i), 'Kofi Mensah');
    await user.type(screen.getByLabelText(/phone number/i), '0244777111');
    await user.type(screen.getByLabelText(/^password/i), 'LongEnough123');
    await user.type(screen.getByLabelText(/confirm password/i), 'LongEnough123');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const create = await screen.findByRole('button', { name: 'Create account' });
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText(/pickup and delivery address/i), 'House 4, Labone, near the school');
    expect(create).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(create).toBeEnabled();
    await act(async () => user.click(create));
    expect(await screen.findByText('welcome page')).toBeInTheDocument();
  });
});
