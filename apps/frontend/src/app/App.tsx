import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@ldy/api-client';
import { AuthProvider, useAuth } from '@/auth/session';
import { HOME_FOR } from '@/auth/permissions';
import { PortalShell, RequireCustomer, RequireRole, RequireStaff, StaffShell } from '@/components/layout';
import { Loading, ToastProvider } from '@/components/ui';
import { ErrorBoundary } from './ErrorBoundary';
import type { Role } from '@ldy/api-client';

// Route-level code splitting keeps the first load small on 3G (NFR-U3).
const p = <T extends Record<string, unknown>>(f: () => Promise<T>, name: keyof T) =>
  lazy(() => f().then((m) => ({ default: m[name] as React.ComponentType })));

const StaffLogin = p(() => import('@/features/auth/Login'), 'StaffLogin');
const CustomerLogin = p(() => import('@/features/auth/Login'), 'CustomerLogin');
const StaffForgot = p(() => import('@/features/auth/Login'), 'StaffForgot');
const CustomerForgot = p(() => import('@/features/auth/Login'), 'CustomerForgot');
const Home = p(() => import('@/features/portal/Home'), 'Home');
const Track = p(() => import('@/features/portal/Track'), 'Track');
const Signup = p(() => import('@/features/portal/Signup'), 'Signup');
const MyOrders = p(() => import('@/features/portal/MyOrders'), 'MyOrders');
const MyOrder = p(() => import('@/features/portal/MyOrders'), 'MyOrder');
const Book = p(() => import('@/features/portal/Book'), 'Book');
const Profile = p(() => import('@/features/portal/Profile'), 'Profile');
const Counter = p(() => import('@/features/counter/Counter'), 'Counter');
const Collection = p(() => import('@/features/counter/Collection'), 'Collection');
const Orders = p(() => import('@/features/orders/Orders'), 'Orders');
const OrderDetail = p(() => import('@/features/orders/OrderDetail'), 'OrderDetail');
const Scan = p(() => import('@/features/floor/Scan'), 'Scan');
const Batches = p(() => import('@/features/floor/Batches'), 'Batches');
const BatchDetail = p(() => import('@/features/floor/Batches'), 'BatchDetail');
const Machines = p(() => import('@/features/floor/Machines'), 'Machines');
const Bookings = p(() => import('@/features/dispatch/Bookings'), 'Bookings');
const Dispatch = p(() => import('@/features/dispatch/Dispatch'), 'Dispatch');
const RiderJobs = p(() => import('@/features/dispatch/RiderJobs'), 'RiderJobs');
const Inbox = p(() => import('@/features/manager/Inbox'), 'Inbox');
const Approvals = p(() => import('@/features/manager/Approvals'), 'Approvals');
const Cashup = p(() => import('@/features/billing/Cashup'), 'Cashup');
const Corporate = p(() => import('@/features/billing/Corporate'), 'Corporate');
const Reports = p(() => import('@/features/reports/Reports'), 'Reports');
const Audit = p(() => import('@/features/reports/Audit'), 'Audit');
const Users = p(() => import('@/features/admin/Users'), 'Users');
const Settings = p(() => import('@/features/admin/Settings'), 'Settings');
const Notifications = p(() => import('@/features/admin/Notifications'), 'Notifications');
const Import = p(() => import('@/features/admin/Import'), 'Import');
const Print = p(() => import('@/features/print/Print'), 'Print');
const Overview = p(() => import('@/features/frontdesk/Overview'), 'Overview');
const MyWork = p(() => import('@/features/floor/MyWork'), 'MyWork');
const Check = p(() => import('@/features/floor/Check'), 'Check');
const Pack = p(() => import('@/features/floor/Pack'), 'Pack');
const Me = p(() => import('@/features/staff/Me'), 'Me');
const Alerts = p(() => import('@/features/staff/Me'), 'Alerts');
const Welcome = p(() => import('@/features/portal/Welcome'), 'Welcome');
const PrivacyPage = p(() => import('@/features/portal/PrivacyNotice'), 'PrivacyPage');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, err) => !(err instanceof ApiError && err.status > 0 && err.status < 500) && n < 2,
      refetchOnWindowFocus: true,
    },
  },
});

function StaffHome() {
  const { activeRole } = useAuth();
  return <Navigate to={activeRole ? HOME_FOR[activeRole] : '/staff/login'} replace />;
}

const R = (roles: Role[], el: ReactNode) => <RequireRole roles={roles}>{el}</RequireRole>;

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<div className="p-6"><Loading /></div>}>
                <Routes>
                  {/* Public pages with their own full-width layouts (home, sign-in portals) */}
                  <Route index element={<Home />} />
                  <Route path="signup" element={<Signup />} />
                  <Route path="login" element={<CustomerLogin />} />
                  <Route path="forgot" element={<CustomerForgot />} />
                  {/* Public + customer portal */}
                  <Route element={<PortalShell />}>
                    <Route path="track" element={<Track />} />
                    <Route path="privacy" element={<PrivacyPage />} />
                    <Route path="me" element={<RequireCustomer />}>
                      <Route index element={<Navigate to="orders" replace />} />
                      <Route path="welcome" element={<Welcome />} />
                      <Route path="orders" element={<MyOrders />} />
                      <Route path="orders/:id" element={<MyOrder />} />
                      <Route path="book" element={<Book />} />
                      <Route path="profile" element={<Profile />} />
                    </Route>
                  </Route>

                  {/* Staff */}
                  <Route path="staff/login" element={<StaffLogin />} />
                  <Route path="staff/forgot" element={<StaffForgot />} />
                  <Route path="print/:kind/:id" element={<Print />} />
                  <Route path="staff" element={<RequireStaff />}>
                    <Route element={<StaffShell />}>
                      <Route index element={<StaffHome />} />
                      <Route path="overview" element={R(['FRONT_DESK'], <Overview />)} />
                      <Route path="me" element={<Me />} />
                      <Route path="alerts" element={<Alerts />} />
                      <Route path="work" element={R(['ATTENDANT', 'MANAGER'], <MyWork />)} />
                      <Route path="check" element={R(['ATTENDANT', 'MANAGER'], <Check />)} />
                      <Route path="pack/:orderId" element={R(['ATTENDANT', 'MANAGER'], <Pack />)} />
                      <Route path="counter" element={R(['FRONT_DESK', 'MANAGER'], <Counter />)} />
                      <Route path="counter/:orderId" element={R(['FRONT_DESK', 'MANAGER'], <Counter />)} />
                      <Route path="collection" element={R(['FRONT_DESK', 'MANAGER'], <Collection />)} />
                      <Route path="orders" element={R(['FRONT_DESK', 'MANAGER', 'AUDITOR'], <Orders />)} />
                      <Route path="orders/:id" element={R(['FRONT_DESK', 'MANAGER', 'AUDITOR', 'ATTENDANT'], <OrderDetail />)} />
                      <Route path="scan" element={R(['ATTENDANT', 'MANAGER'], <Scan />)} />
                      <Route path="batches" element={R(['ATTENDANT', 'MANAGER', 'AUDITOR'], <Batches />)} />
                      <Route path="batches/:id" element={R(['ATTENDANT', 'MANAGER', 'AUDITOR'], <BatchDetail />)} />
                      <Route path="machines" element={R(['ATTENDANT', 'MANAGER', 'ADMIN'], <Machines />)} />
                      <Route path="bookings" element={R(['FRONT_DESK', 'MANAGER'], <Bookings />)} />
                      <Route path="dispatch" element={R(['FRONT_DESK', 'MANAGER'], <Dispatch />)} />
                      <Route path="rider" element={R(['RIDER'], <RiderJobs />)} />
                      <Route path="inbox" element={R(['MANAGER'], <Inbox />)} />
                      <Route path="approvals" element={R(['MANAGER', 'AUDITOR'], <Approvals />)} />
                      <Route path="cashup" element={R(['FRONT_DESK', 'MANAGER', 'AUDITOR'], <Cashup />)} />
                      <Route path="corporate" element={R(['FRONT_DESK', 'MANAGER', 'AUDITOR'], <Corporate />)} />
                      <Route path="reports" element={R(['MANAGER', 'AUDITOR', 'FRONT_DESK'], <Reports />)} />
                      <Route path="audit" element={R(['MANAGER', 'ADMIN', 'AUDITOR'], <Audit />)} />
                      <Route path="users" element={R(['ADMIN'], <Users />)} />
                      <Route path="settings" element={R(['ADMIN', 'MANAGER'], <Settings />)} />
                      <Route path="notifications" element={R(['ADMIN'], <Notifications />)} />
                      <Route path="import" element={R(['ADMIN'], <Import />)} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  const { activeRole } = useAuth();
  return (
    <main id="main" className="mx-auto max-w-xl p-8">
      <h1 className="page-title">Page not found</h1>
      <p className="muted mt-2">Check the address, or go back.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {activeRole && <a href={HOME_FOR[activeRole]} className="btn-primary">Go to my home page</a>}
        <a href="/" className="btn">Go to the start</a>
      </div>
    </main>
  );
}
