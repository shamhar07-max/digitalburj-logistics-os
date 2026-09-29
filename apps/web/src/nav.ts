import {
  LayoutDashboard, Ship, Target, FileText, Users, ShieldCheck, Truck, Smartphone, Warehouse, Tags, ShoppingCart, BookOpen, Receipt, LineChart, Landmark, CheckSquare,
  UserCog, Wallet, FolderKanban, Bot, ScanText, Files, Zap, BarChart3, Inbox, MessageCircle, Rocket, GraduationCap, BadgeCheck, Globe, Lock, Settings, Gauge, Calculator, ClipboardCheck, type LucideIcon,
} from 'lucide-react';

export interface NavItem { to: string; module: string; label: string; key: string; icon: LucideIcon }
export interface NavSection { title: string; key: string; items: NavItem[] }

export const NAV: NavSection[] = [
  { title: 'Overview', key: 'nav.overview', items: [
    { to: '/', module: 'dashboard', key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/shipments', module: 'shipments', key: 'shipments', label: 'Shipments', icon: Ship },
    { to: '/pipeline', module: 'pipeline', key: 'pipeline', label: 'Sales Pipeline', icon: Target },
    { to: '/quotes', module: 'quotes', key: 'quotes', label: 'Quotations', icon: FileText },
    { to: '/customers', module: 'customers', key: 'customers', label: 'Customers', icon: Users },
  ] },
  { title: 'Operations', key: 'nav.operations', items: [
    { to: '/customs', module: 'customs', key: 'customs', label: 'Customs', icon: ShieldCheck },
    { to: '/dispatch', module: 'dispatch', key: 'dispatch', label: 'Dispatch & Fleet', icon: Truck },
    { to: '/driver', module: 'dispatch', key: 'driverapp', label: 'Driver App', icon: Smartphone },
    { to: '/warehouse', module: 'warehouse', key: 'warehouse', label: 'Warehouse', icon: Warehouse },
    { to: '/compliance', module: 'documents', key: 'compliance', label: 'Document Compliance', icon: ClipboardCheck },
    { to: '/tools', module: 'shipments', key: 'tools', label: 'Calculators', icon: Calculator },
    { to: '/rates', module: 'rates', key: 'rates', label: 'Rate Management', icon: Tags },
    { to: '/procurement', module: 'procurement', key: 'procurement', label: 'Procurement', icon: ShoppingCart },
  ] },
  { title: 'Finance', key: 'nav.finance', items: [
    { to: '/accounting', module: 'accounting', key: 'accounting', label: 'Accounting', icon: BookOpen },
    { to: '/invoices', module: 'invoices', key: 'invoices', label: 'Invoices', icon: Receipt },
    { to: '/jobcosting', module: 'costs', key: 'jobcosting', label: 'Job Costing', icon: LineChart },
    { to: '/velocity', module: 'reports', key: 'velocity', label: 'Operational Velocity', icon: Gauge },
    { to: '/vat', module: 'vat', key: 'vat', label: 'UAE VAT', icon: Landmark },
    { to: '/approvals', module: 'approvals', key: 'approvals', label: 'Approvals', icon: CheckSquare },
  ] },
  { title: 'People', key: 'nav.people', items: [
    { to: '/hrms', module: 'hrms', key: 'hrms', label: 'HRMS', icon: UserCog },
    { to: '/payroll', module: 'payroll', key: 'payroll', label: 'Payroll & WPS', icon: Wallet },
    { to: '/projects', module: 'projects', key: 'projects', label: 'Projects', icon: FolderKanban },
  ] },
  { title: 'Intelligence', key: 'nav.intelligence', items: [
    { to: '/ai', module: 'ai', key: 'ai', label: 'AI Agents', icon: Bot },
    { to: '/docintel', module: 'docintel', key: 'docintel', label: 'AI Doc Intel', icon: ScanText },
    { to: '/documents', module: 'documents', key: 'documents', label: 'Documents', icon: Files },
    { to: '/automation', module: 'automation', key: 'automation', label: 'Automation', icon: Zap },
    { to: '/reports', module: 'reports', key: 'reports', label: 'Reports', icon: BarChart3 },
  ] },
  { title: 'Communications', key: 'nav.comms', items: [
    { to: '/inbox', module: 'inbox', key: 'inbox', label: 'Unified Inbox', icon: Inbox },
    { to: '/whatsapp', module: 'whatsapp', key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  ] },
  { title: 'Growth', key: 'nav.growth', items: [
    { to: '/growth', module: 'growth', key: 'growth', label: 'Growth Platform', icon: Rocket },
    { to: '/academy', module: 'academy', key: 'academy', label: 'Academy', icon: GraduationCap },
    { to: '/talent', module: 'talent', key: 'talent', label: 'Verified Talent', icon: BadgeCheck },
  ] },
  { title: 'System', key: 'nav.system', items: [
    { to: '/portal-admin', module: 'customers', key: 'portal', label: 'Customer Portal', icon: Globe },
    { to: '/permissions', module: 'permissions', key: 'permissions', label: 'Permissions', icon: Lock },
    { to: '/settings', module: 'settings', key: 'settings', label: 'Settings', icon: Settings },
  ] },
];

export const homeFor = (baseRole?: string) => (baseRole === 'driver' ? '/driver' : baseRole === 'customer' || baseRole === 'partner' ? '/portal' : '/');
