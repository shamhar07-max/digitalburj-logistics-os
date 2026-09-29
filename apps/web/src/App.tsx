import { lazy, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';
import { useSession, useCan } from './store/session';
import { homeFor } from './nav';
import Layout from './Layout';
import { Toaster, Skeleton, Empty } from './ui/kit';
import { Lock } from 'lucide-react';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Shipments = lazy(() => import('./pages/Shipments'));
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetail'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Quotes = lazy(() => import('./pages/Quotes'));
const QuoteBuilder = lazy(() => import('./pages/QuoteBuilder'));
const Customers = lazy(() => import('./pages/Customers'));
const Customs = lazy(() => import('./pages/Customs'));
const Dispatch = lazy(() => import('./pages/Dispatch'));
const DriverApp = lazy(() => import('./pages/DriverApp'));
const WarehousePage = lazy(() => import('./pages/Warehouse'));
const Rates = lazy(() => import('./pages/Rates'));
const Procurement = lazy(() => import('./pages/Procurement'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Invoices = lazy(() => import('./pages/Invoices'));
const JobCosting = lazy(() => import('./pages/JobCosting'));
const Vat = lazy(() => import('./pages/Vat'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Hrms = lazy(() => import('./pages/Hrms'));
const Payroll = lazy(() => import('./pages/Payroll'));
const Projects = lazy(() => import('./pages/Projects'));
const AiAgents = lazy(() => import('./pages/AiAgents'));
const DocIntel = lazy(() => import('./pages/DocIntel'));
const Documents = lazy(() => import('./pages/Documents'));
const Automation = lazy(() => import('./pages/Automation'));
const Reports = lazy(() => import('./pages/Reports'));
const Inbox = lazy(() => import('./pages/Inbox'));
const WhatsApp = lazy(() => import('./pages/WhatsApp'));
const Growth = lazy(() => import('./pages/Growth'));
const Academy = lazy(() => import('./pages/Academy'));
const Talent = lazy(() => import('./pages/Talent'));
const PortalAdmin = lazy(() => import('./pages/PortalAdmin'));
const Permissions = lazy(() => import('./pages/Permissions'));
const Velocity = lazy(() => import('./pages/Velocity'));
const Tools = lazy(() => import('./pages/Tools'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Settings = lazy(() => import('./pages/Settings'));
const Portal = lazy(() => import('./pages/Portal'));
const PublicTrack = lazy(() => import('./pages/PublicTrack'));
const PublicRequest = lazy(() => import('./pages/PublicRequest'));

/** Loads the session (/auth/me) once; redirects to login when unauthenticated. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { accessToken, setMe, logout } = useSession();
  const loc = useLocation();
  const [ready, setReady] = useState(false);
  const me = useQuery({ queryKey: ['me', accessToken], queryFn: () => api.get('/auth/me'), enabled: !!accessToken, retry: false, staleTime: 5 * 60_000 });
  useEffect(() => {
    if (me.data) { setMe(me.data); setReady(true); }
    if (me.error) logout();
  }, [me.data, me.error]);
  if (!accessToken) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!ready) return <div style={{ padding: 40, maxWidth: 520, margin: '10vh auto' }}><Skeleton rows={4} /></div>;
  return <>{children}</>;
}

function Guard({ module, children }: { module: string; children: ReactNode }) {
  const can = useCan();
  const role = useSession((s) => s.user?.baseRole);
  if (!can(module, 'r')) return <Navigate to={homeFor(role)} replace />;
  return <>{children}</>;
}

function StaffHome() {
  const role = useSession((s) => s.user?.baseRole);
  const can = useCan();
  if (role === 'driver') return <Navigate to="/driver" replace />;
  if (role === 'customer' || role === 'partner') return <Navigate to="/portal" replace />;
  return can('dashboard', 'r') ? <Dashboard /> : <Empty icon={<Lock />} title="Welcome" text="Your role does not include a dashboard. Use the menu to open your workspace." />;
}

const G = (module: string, el: ReactNode) => <Guard module={module}>{el}</Guard>;

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login mode="login" />} />
        <Route path="/register" element={<Login mode="register" />} />
        <Route path="/forgot" element={<Login mode="forgot" />} />
        <Route path="/reset-password" element={<Login mode="reset" />} />
        <Route path="/track/:token" element={<PublicTrack />} />
        <Route path="/request/:slug" element={<PublicRequest />} />
        <Route path="/driver" element={<RequireAuth><Guard module="dispatch"><DriverApp /></Guard></RequireAuth>} />
        <Route path="/portal/*" element={<RequireAuth><Portal /></RequireAuth>} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<StaffHome />} />
          <Route path="shipments" element={G('shipments', <Shipments />)} />
          <Route path="shipments/:id" element={G('shipments', <ShipmentDetail />)} />
          <Route path="pipeline" element={G('pipeline', <Pipeline />)} />
          <Route path="quotes" element={G('quotes', <Quotes />)} />
          <Route path="quotes/new" element={G('quotes', <QuoteBuilder />)} />
          <Route path="quotes/:id" element={G('quotes', <QuoteBuilder />)} />
          <Route path="customers" element={G('customers', <Customers />)} />
          <Route path="customs" element={G('customs', <Customs />)} />
          <Route path="dispatch" element={G('dispatch', <Dispatch />)} />
          <Route path="warehouse" element={G('warehouse', <WarehousePage />)} />
          <Route path="rates" element={G('rates', <Rates />)} />
          <Route path="procurement" element={G('procurement', <Procurement />)} />
          <Route path="accounting" element={G('accounting', <Accounting />)} />
          <Route path="invoices" element={G('invoices', <Invoices />)} />
          <Route path="jobcosting" element={G('costs', <JobCosting />)} />
          <Route path="velocity" element={G('reports', <Velocity />)} />
          <Route path="compliance" element={G('documents', <Compliance />)} />
          <Route path="tools" element={G('shipments', <Tools />)} />
          <Route path="vat" element={G('vat', <Vat />)} />
          <Route path="approvals" element={G('approvals', <Approvals />)} />
          <Route path="hrms" element={G('hrms', <Hrms />)} />
          <Route path="payroll" element={G('payroll', <Payroll />)} />
          <Route path="projects" element={G('projects', <Projects />)} />
          <Route path="ai" element={G('ai', <AiAgents />)} />
          <Route path="docintel" element={G('docintel', <DocIntel />)} />
          <Route path="documents" element={G('documents', <Documents />)} />
          <Route path="automation" element={G('automation', <Automation />)} />
          <Route path="reports" element={G('reports', <Reports />)} />
          <Route path="inbox" element={G('inbox', <Inbox />)} />
          <Route path="whatsapp" element={G('whatsapp', <WhatsApp />)} />
          <Route path="growth" element={G('growth', <Growth />)} />
          <Route path="academy" element={G('academy', <Academy />)} />
          <Route path="talent" element={G('talent', <Talent />)} />
          <Route path="portal-admin" element={G('customers', <PortalAdmin />)} />
          <Route path="permissions" element={G('permissions', <Permissions />)} />
          <Route path="settings" element={G('settings', <Settings />)} />
          <Route path="*" element={<Empty title="Page not found" text="That page does not exist or you do not have access." />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}
