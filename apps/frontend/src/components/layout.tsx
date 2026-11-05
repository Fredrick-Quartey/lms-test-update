/**
 * App shells (REDESIGN §4). Staff: sidebar with sign-out at the bottom, header with role-scoped search,
 * notifications and the signed-in user + active role (§4.1), a drawer or bottom nav on phones.
 * Customer portal: slim header and a bottom nav on phones. Every manual sign-out is confirmed (D10).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, Bell as BellIcon, Briefcase, Building2, CalendarClock, ClipboardCheck, ClipboardList, Cog, Gauge,
  History, Home as HomeIcon, Inbox, LayoutGrid, LogOut, Menu, PackageCheck, PlusCircle, ScanLine, Search, Send,
  ShoppingBag, Truck, Upload, User, UserCog, Wallet, WashingMachine, WifiOff, X,
} from 'lucide-react';
import { api, type Role, type SearchResults } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { BOTTOM_NAV_ROLES, HOME_FOR, navFor } from '@/auth/permissions';
import { dateTime, organisation } from '@/lib/format';
import { useSettings } from '@/config/settings';
import { Avatar, ConfirmDialog, Popover, Ticket } from './ui';

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${light ? 'text-white' : 'text-navy'}`}>
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? '#ffffff' : '#1846c8'} />
        <rect x="8" y="6" width="16" height="2.6" rx="1.3" fill={light ? '#1846c8' : '#ffffff'} />
        <circle cx="16" cy="18" r="7" fill="none" stroke={light ? '#1846c8' : '#ffffff'} strokeWidth="2.4" />
        <path d="M11.6 19.2c1.4 1.3 3 1.3 4.4 0s3-1.3 4.4 0" fill="none" stroke="#19a7b8" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {!compact && <span className="text-xl tracking-tight">LDY</span>}
    </span>
  );
}

function SkipLink() {
  const { t } = useTranslation();
  return (
    <a href="#main" className="sr-only z-50 rounded-[8px] bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
      {t('app.skip')}
    </a>
  );
}

// ---------------- Guards ----------------
export function RequireStaff() {
  const { user, isStaff, lastSignOut } = useAuth();
  const loc = useLocation();
  if (!user || !isStaff) return <Navigate to="/staff/login" replace state={{ from: loc.pathname, reason: lastSignOut }} />;
  return <Outlet />;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { activeRole } = useAuth();
  if (!activeRole || !roles.includes(activeRole)) {
    return (
      <div className="panel max-w-xl p-5">
        <h1 className="section-title">This page is not part of your current role</h1>
        <p className="muted mt-1">Switch to a role that has access, or go back to your home page.</p>
        {activeRole && (
          <Link to={HOME_FOR[activeRole]} className="btn mt-3">
            Go to my home page
          </Link>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

export function RequireCustomer() {
  const { user, lastSignOut } = useAuth();
  if (!user || !user.roles.includes('CUSTOMER')) return <Navigate to="/login" replace state={{ reason: lastSignOut }} />;
  return <Outlet />;
}

// ---------------- Sign-out with confirmation (D10). The idle timeout signs out without asking. ----------------
export function useSignOutConfirm() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const dialog = (
    <ConfirmDialog
      open={open}
      title={t('session.confirmTitle')}
      message={t('session.confirmText')}
      cancelLabel={t('session.confirmNo')}
      confirmLabel={t('session.confirmYes')}
      tone="danger"
      onCancel={() => setOpen(false)}
      onConfirm={() => {
        setOpen(false);
        signOut('manual');
      }}
    />
  );
  return { ask: () => setOpen(true), dialog };
}

// ---------------- Offline banner (transparency, §12.2) ----------------
function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="alert" className="no-print sticky top-0 z-50 flex items-center justify-center gap-2 bg-danger px-4 py-2 text-sm font-semibold text-white">
      <WifiOff size={16} aria-hidden /> {t('session.offline')}
    </div>
  );
}

// ---------------- Notifications (closes on outside click, Esc and route change: D12) ----------------
export function Bell({ light }: { light?: boolean }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['me', 'notifications'], queryFn: api.notifications.mine, refetchInterval: 20_000 });
  const read = useMutation({ mutationFn: api.notifications.markRead, onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'notifications'] }) });
  const unread = q.data?.filter((n) => !n.read).length ?? 0;
  return (
    <Popover
      width="w-80 sm:w-96"
      trigger={({ toggle, open, ...a }) => (
        <button
          {...a}
          className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full ${light ? 'text-white hover:bg-white/10' : 'text-navy hover:bg-mist'}`}
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          onClick={() => {
            toggle();
            if (!open && unread) read.mutate();
          }}
        >
          <BellIcon size={22} aria-hidden />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-[18px] text-white">{unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <p className="px-2 pb-2 pt-1 font-bold">Notifications</p>
          {!q.data?.length && <p className="muted p-3 text-sm">You're all caught up.</p>}
          {q.data?.map((n) => (
            <button
              key={n.id}
              className="block w-full rounded-[10px] p-2.5 text-left text-sm hover:bg-mist"
              onClick={() => {
                close();
                if (n.link) nav(n.link);
              }}
            >
              <span className={n.read ? '' : 'font-semibold'}>{n.text}</span>
              <span className="block text-xs text-slate">{dateTime(n.at)}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

// ---------------- Global search (role-scoped on the server, D14) ----------------
function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}

type Hit = { key: string; to: string; label: ReactNode; sub?: string };

function hitsFor(r: SearchResults | undefined, role: Role | null): { group: string; items: Hit[] }[] {
  if (!r) return [];
  const floor = role === 'ATTENDANT';
  return [
    { group: 'Customers', items: r.customers.map((c) => ({ key: c.id, to: `/staff/orders?search=${encodeURIComponent(c.name)}`, label: c.name, sub: `${c.phoneMasked}${c.accountType === 'CORPORATE' ? ', corporate' : ''}` })) },
    { group: 'Orders', items: r.orders.map((o) => ({ key: o.id, to: floor ? `/staff/orders/${o.id}` : `/staff/orders/${o.id}`, label: <Ticket>{o.orderNo}</Ticket>, sub: [o.customerName, o.status.replace(/_/g, ' ').toLowerCase()].filter(Boolean).join(', ') })) },
    { group: 'Tags', items: r.tags.map((t) => ({ key: t.tag, to: floor ? `/staff/scan?tag=${t.tag}` : `/staff/orders/${t.orderId}`, label: <Ticket>{t.tag}</Ticket>, sub: `${t.orderNo}, ${t.status.replace(/_/g, ' ').toLowerCase()}` })) },
    { group: 'Staff', items: r.users.map((u) => ({ key: u.id, to: '/staff/users', label: u.name, sub: u.username })) },
  ].filter((g) => g.items.length);
}

function GlobalSearch({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const { t } = useTranslation();
  const { activeRole } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const term = useDebounced(q.trim());
  const res = useQuery({ queryKey: ['search', term, activeRole], queryFn: () => api.search(term), enabled: term.length >= 2 });
  const groups = hitsFor(res.data, activeRole);
  const flat = groups.flatMap((g) => g.items);
  const box = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  const go = (h: Hit) => {
    setOpen(false);
    setQ('');
    onDone?.();
    nav(h.to);
  };
  let idx = -1;
  return (
    <div ref={box} className="relative w-full">
      <label htmlFor="global-search" className="sr-only">{t('search.placeholder')}</label>
      <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
      <input
        id="global-search"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open && term.length >= 2}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        className="input min-h-11 rounded-full border-transparent bg-mist pl-10 focus:bg-white"
        placeholder={t('search.placeholder')}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(flat.length - 1, a + 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          }
          if (e.key === 'Enter' && flat[active]) go(flat[active]);
        }}
      />
      {open && term.length >= 2 && (
        <div id="global-search-results" role="listbox" className="sheet-in raised absolute left-0 right-0 z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-[16px] border border-line bg-white p-2">
          {res.isFetching && !res.data && <p className="muted p-3 text-sm">Searching…</p>}
          {res.data && !flat.length && <p className="muted p-3 text-sm">{t('search.none')}</p>}
          {groups.map((g) => (
            <div key={g.group} className="mb-1">
              <p className="px-2.5 pb-1 pt-2 text-xs font-semibold text-slate">{g.group}</p>
              {g.items.map((h) => {
                idx += 1;
                const i = idx;
                return (
                  <button key={h.key} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(h)} className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 text-left text-sm ${i === active ? 'bg-sky' : ''}`}>
                    <span className="font-semibold">{h.label}</span>
                    {h.sub && <span className="truncate text-xs text-slate">{h.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Nav icons ----------------
const ICON: Record<string, ReactNode> = {
  inbox: <Inbox size={20} />, overview: <Gauge size={20} />, reports: <BarChart3 size={20} />, orders: <ClipboardList size={20} />,
  counter: <PlusCircle size={20} />, collection: <ShoppingBag size={20} />, work: <LayoutGrid size={20} />, scan: <ScanLine size={20} />,
  batches: <WashingMachine size={20} />, machines: <Cog size={20} />, bookings: <CalendarClock size={20} />, dispatch: <Send size={20} />,
  rider: <Truck size={20} />, approvals: <ClipboardCheck size={20} />, cashup: <Wallet size={20} />, corporate: <Building2 size={20} />,
  audit: <History size={20} />, users: <UserCog size={20} />, settings: <Cog size={20} />, notifications: <BellIcon size={20} />, import: <Upload size={20} />,
};

function RoleSwitcher({ dark }: { dark?: boolean }) {
  const { t } = useTranslation();
  const { user, activeRole, setActiveRole } = useAuth();
  const nav = useNavigate();
  const roles = (user?.roles ?? []).filter((r) => r !== 'CUSTOMER');
  if (roles.length <= 1) return null;
  return (
    <label className="block text-sm">
      <span className={`mb-1 block text-xs ${dark ? 'text-white/70' : 'text-slate'}`}>{t('session.activeRole')}</span>
      <select
        className={`input min-h-10 py-1.5 text-sm ${dark ? 'border-white/20 bg-white/10 text-white [&>option]:text-navy' : ''}`}
        value={activeRole ?? ''}
        onChange={(e) => {
          const r = e.target.value as Role;
          setActiveRole(r);
          nav(HOME_FOR[r]);
        }}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {t(`roles.${r}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------- Staff shell ----------------
export function StaffShell() {
  const { t } = useTranslation();
  const { user, activeRole } = useAuth();
  const settings = useSettings();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const signout = useSignOutConfirm();
  const items = navFor(activeRole, settings.data?.features);
  const bottom = activeRole ? BOTTOM_NAV_ROLES.includes(activeRole) : false;
  const canSearch = activeRole !== 'RIDER';
  useEffect(() => {
    setDrawer(false);
    setMobileSearch(false);
  }, [loc.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const links = (
    <ul className="space-y-0.5">
      {items.map((n) => (
        <li key={n.to}>
          <NavLink
            to={n.to}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[0.95rem] font-semibold transition-colors ${isActive ? 'bg-white text-blue-dark' : 'text-white/80 hover:bg-white/10 hover:text-white'}`
            }
          >
            <span aria-hidden>{ICON[n.key]}</span>
            {t(`nav.${n.key}`)}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  const sidebarFooter = (
    <div className="mt-4 space-y-3 border-t border-white/15 pt-4">
      <div className="flex items-center gap-3">
        <Avatar name={user?.name} size={40} />
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold text-white">{user?.name}</p>
          <p className="truncate text-white/70">{activeRole && t(`roles.${activeRole}`)}</p>
        </div>
      </div>
      <RoleSwitcher dark />
      <button className="flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 font-semibold text-white/85 hover:bg-white/10 hover:text-white" onClick={signout.ask}>
        <LogOut size={20} aria-hidden /> {t('action.signOut')}
      </button>
    </div>
  );

  return (
    <div className={`min-h-screen lg:grid lg:grid-cols-[16rem_1fr] lg:bg-[linear-gradient(to_right,var(--color-blue-dark)_16rem,transparent_16rem)] ${bottom ? 'has-bottom-nav lg:[&_main]:pb-8' : ''}`}>
      <SkipLink />
      {/* Sidebar (≥ 1024 px) */}
      <aside className="no-print hidden bg-blue-dark lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:p-4">
        <Link to={activeRole ? HOME_FOR[activeRole] : '/staff'} className="mb-6 px-2 pt-1">
          <Logo light />
        </Link>
        <nav aria-label="Main" className="-mx-1 flex-1 overflow-y-auto px-1">
          {links}
        </nav>
        {sidebarFooter}
      </aside>

      <div className="min-w-0">
        <OfflineBanner />
        <header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-3 sm:px-5 lg:px-8">
            {!bottom && (
              <button className="btn-ghost h-11 w-11 px-0 lg:hidden" aria-expanded={drawer} aria-controls="staff-drawer" aria-label="Open menu" onClick={() => setDrawer(true)}>
                <Menu size={22} aria-hidden />
              </button>
            )}
            <Link to={activeRole ? HOME_FOR[activeRole] : '/staff'} className="lg:hidden" aria-label="Home">
              <Logo />
            </Link>
            {canSearch && (
              <div className="mx-auto hidden w-full max-w-xl md:block">
                <GlobalSearch />
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 md:ml-0">
              {canSearch && (
                <button className="btn-ghost h-11 w-11 px-0 md:hidden" aria-label="Search" onClick={() => setMobileSearch((s) => !s)}>
                  <Search size={22} aria-hidden />
                </button>
              )}
              <Bell />
              {/* §4.1: signed-in user and active role on every screen */}
              <Link to="/staff/me" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 hover:bg-mist sm:pr-3" aria-label={`${user?.name}, ${activeRole ? t(`roles.${activeRole}`) : ''}. Open my account`}>
                <Avatar name={user?.name} />
                <span className="hidden text-left text-sm leading-tight sm:block">
                  <span className="block font-semibold">{user?.name}</span>
                  <span className="block text-slate">{activeRole && t(`roles.${activeRole}`)}</span>
                </span>
              </Link>
            </div>
          </div>
          {mobileSearch && (
            <div className="border-t border-line p-3 md:hidden">
              <GlobalSearch autoFocus onDone={() => setMobileSearch(false)} />
            </div>
          )}
        </header>

        {/* Drawer for roles without a bottom nav (phones and tablets) */}
        {drawer && (
          <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button className="absolute inset-0 bg-navy/45" aria-label="Close menu" onClick={() => setDrawer(false)} />
            <div id="staff-drawer" className="sheet-in absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col overflow-y-auto bg-blue-dark p-4">
              <div className="mb-5 flex items-center justify-between">
                <Logo light />
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10" aria-label="Close menu" onClick={() => setDrawer(false)}>
                  <X size={22} aria-hidden />
                </button>
              </div>
              <nav aria-label="Main" className="flex-1">{links}</nav>
              {sidebarFooter}
            </div>
          </div>
        )}

        <main id="main" className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <Outlet />
        </main>

        {bottom && activeRole && <StaffBottomNav role={activeRole} />}
      </div>
      {signout.dialog}
    </div>
  );
}

function BottomNavBar({ items }: { items: { to: string; label: string; icon: ReactNode; end?: boolean }[] }) {
  return (
    <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => (
          <li key={it.to}>
            <NavLink end={it.end} to={it.to} className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-blue' : 'text-slate'}`}>
              {({ isActive }) => (
                <>
                  <span aria-hidden className={`flex h-8 w-14 items-center justify-center rounded-full ${isActive ? 'bg-sky' : ''}`}>{it.icon}</span>
                  {it.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** REDESIGN §4 / §9 / §11: attendant and rider get at most 4 big bottom tabs on phones. */
function StaffBottomNav({ role }: { role: Role }) {
  const { t } = useTranslation();
  const items =
    role === 'ATTENDANT'
      ? [
          { to: '/staff/work', label: t('nav.work'), icon: <LayoutGrid size={22} /> },
          { to: '/staff/scan', label: t('nav.scan'), icon: <ScanLine size={22} /> },
          { to: '/staff/alerts', label: t('nav.alerts'), icon: <BellIcon size={22} /> },
          { to: '/staff/me', label: t('nav.me'), icon: <User size={22} /> },
        ]
      : [
          { to: '/staff/rider', label: t('nav.rider'), icon: <Truck size={22} /> },
          { to: '/staff/alerts', label: t('nav.alerts'), icon: <BellIcon size={22} /> },
          { to: '/staff/me', label: t('nav.me'), icon: <User size={22} /> },
        ];
  return <BottomNavBar items={items} />;
}

// ---------------- Customer portal shell (mobile first) ----------------
export function PortalShell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCustomer = Boolean(user?.roles.includes('CUSTOMER'));
  const settings = useSettings();
  const signout = useSignOutConfirm();
  const bookingsOn = settings.data?.features?.bookings !== false;
  const link = ({ isActive }: { isActive: boolean }) => `rounded-full px-3.5 py-2 text-sm font-semibold ${isActive ? 'bg-sky text-blue-dark' : 'text-slate hover:text-navy'}`;
  return (
    <div className={`min-h-screen ${isCustomer ? 'has-bottom-nav sm:[&_main]:pb-8' : ''}`}>
      <SkipLink />
      <OfflineBanner />
      <header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2 px-4">
          <Link to={isCustomer ? '/me/orders' : '/'} aria-label="Home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="ml-auto flex items-center gap-1">
            {isCustomer ? (
              <>
                <span className="hidden items-center gap-1 sm:flex">
                  <NavLink to="/me/orders" className={link}>{t('nav.myOrders')}</NavLink>
                  {bookingsOn && <NavLink to="/me/book" className={link}>{t('nav.book')}</NavLink>}
                  <NavLink to="/track" className={link}>{t('nav.track')}</NavLink>
                </span>
                <Bell />
                <Popover
                  width="w-64"
                  trigger={({ toggle, ...a }) => (
                    <button {...a} onClick={toggle} className="rounded-full p-1 hover:bg-mist" aria-label={`${user?.name}. Account menu`}>
                      <Avatar name={user?.name} />
                    </button>
                  )}
                >
                  {(close) => (
                    <div className="text-sm">
                      <p className="px-2.5 pb-2 pt-1 font-semibold">{user?.name}</p>
                      <Link to="/me/profile" onClick={close} className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 hover:bg-mist"><User size={18} aria-hidden /> {t('nav.profile')}</Link>
                      <Link to="/" onClick={close} className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 hover:bg-mist"><HomeIcon size={18} aria-hidden /> {t('nav.home')}</Link>
                      <button onClick={() => { close(); signout.ask(); }} className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-danger hover:bg-danger-wash"><LogOut size={18} aria-hidden /> {t('action.signOut')}</button>
                    </div>
                  )}
                </Popover>
              </>
            ) : (
              <>
                <NavLink to="/track" className={link}>{t('nav.track')}</NavLink>
                <Link to="/login" className="btn-primary min-h-10 rounded-full px-4 text-sm">{t('action.signIn')}</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-4xl px-4 pb-8 text-sm text-slate">
        <p>© LDY. {organisation().name}</p>
      </footer>
      {isCustomer && (
        <span className="sm:hidden">
          <BottomNavBar
            items={[
              { to: '/me/orders', label: t('nav.myOrders'), icon: <ClipboardList size={22} /> },
              ...(bookingsOn ? [{ to: '/me/book', label: t('nav.book'), icon: <CalendarClock size={22} /> }] : []),
              { to: '/track', label: t('nav.track'), icon: <Search size={22} /> },
              { to: '/me/profile', label: t('nav.me'), icon: <User size={22} /> },
            ]}
          />
        </span>
      )}
      {signout.dialog}
    </div>
  );
}

/** Icons reused by role home screens. */
export const Icons = { Briefcase, PackageCheck, PlusCircle, ShoppingBag, Inbox, WashingMachine, ScanLine, ClipboardCheck, Truck, Wallet };
