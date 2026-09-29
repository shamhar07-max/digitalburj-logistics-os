import React from 'react';
import {
  LayoutDashboard,
  Ship,
  FileText,
  TrendingUp,
  FileCheck2,
  ShieldCheck,
  Receipt,
  DollarSign,
  Scale,
  Percent,
  FileCode,
  CreditCard,
  Users,
  Smartphone,
  Building2,
  Sparkles,
  Inbox,
  CheckCircle,
  ExternalLink,
  BookOpen,
  GitCommit,
  Settings,
  Archive,
  Layers,
  Calculator,
  Compass,
  Truck,
  Zap,
} from 'lucide-react';
import { RoleType } from '../types';

export type ViewType =
  | 'dashboard'
  | 'shipments'
  | 'fleet'
  | 'quotes'
  | 'internalquote'
  | 'pipeline'
  | 'customs'
  | 'complianceaudit'
  | 'invoices'
  | 'receipts'
  | 'bills'
  | 'jobcosting'
  | 'finance'
  | 'vat'
  | 'einvoice'
  | 'velocity'
  | 'payroll'
  | 'hrms'
  | 'driverapp'
  | 'warehouse'
  | 'docintel'
  | 'docstatus'
  | 'partners'
  | 'lifecycle'
  | 'settings'
  | 'utilities'
  | 'inbox'
  | 'approvals'
  | 'customerportal';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  currentRole: RoleType;
  pendingApprovals: number;
}

interface NavItem {
  id: ViewType;
  label: string; // Single simple word
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

interface NavGroup {
  category: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  currentRole,
  pendingApprovals,
}) => {
  // Navigation organized strictly by usage: Operations, Leads & Sales, Accounting, Staff & HR, Management & Admin
  const navGroups: NavGroup[] = [
    {
      category: 'Operations',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: <LayoutDashboard className="h-4 w-4 text-orange-400" />,
        },
        {
          id: 'shipments',
          label: 'Shipments',
          icon: <Ship className="h-4 w-4 text-blue-400" />,
          badge: '5',
          badgeColor: 'bg-blue-500/20 text-blue-300',
        },
        {
          id: 'fleet',
          label: 'Fleet',
          icon: <Truck className="h-4 w-4 text-emerald-400" />,
          badge: '5 Trucks',
          badgeColor: 'bg-emerald-500/20 text-emerald-300',
        },
        {
          id: 'customs',
          label: 'Customs',
          icon: <FileCheck2 className="h-4 w-4 text-rose-400" />,
          badge: '1 Hold',
          badgeColor: 'bg-rose-500/20 text-rose-300',
        },
        {
          id: 'complianceaudit',
          label: 'Compliance',
          icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
          badge: '86%',
          badgeColor: 'bg-emerald-500/20 text-emerald-300',
        },
        {
          id: 'driverapp',
          label: 'Driver',
          icon: <Smartphone className="h-4 w-4 text-orange-400" />,
          badge: 'POD',
          badgeColor: 'bg-orange-500/20 text-orange-300',
        },
        {
          id: 'warehouse',
          label: 'Warehouse',
          icon: <Building2 className="h-4 w-4 text-sky-400" />,
          badge: 'WMS',
          badgeColor: 'bg-sky-500/20 text-sky-300',
        },
        {
          id: 'docstatus',
          label: 'Documents',
          icon: <FileText className="h-4 w-4 text-amber-400" />,
          badge: 'e-DO',
          badgeColor: 'bg-amber-500/20 text-amber-300',
        },
        {
          id: 'utilities',
          label: 'Utilities',
          icon: <Calculator className="h-4 w-4 text-teal-400" />,
          badge: 'Radar',
          badgeColor: 'bg-teal-500/20 text-teal-300',
        },
      ],
    },
    {
      category: 'Leads & Sales',
      items: [
        {
          id: 'pipeline',
          label: 'Pipeline',
          icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
          badge: '7 Deals',
          badgeColor: 'bg-emerald-500/20 text-emerald-300',
        },
        {
          id: 'quotes',
          label: 'Quotes',
          icon: <FileText className="h-4 w-4 text-amber-400" />,
          badge: '4',
          badgeColor: 'bg-amber-500/20 text-amber-300',
        },
        {
          id: 'internalquote',
          label: 'Internal',
          icon: <Scale className="h-4 w-4 text-purple-400" />,
          badge: 'Tariff',
          badgeColor: 'bg-purple-500/20 text-purple-300',
        },
        {
          id: 'partners',
          label: 'Partners',
          icon: <Users className="h-4 w-4 text-indigo-400" />,
          badge: '10',
          badgeColor: 'bg-indigo-500/20 text-indigo-300',
        },
        {
          id: 'customerportal',
          label: 'Portal',
          icon: <ExternalLink className="h-4 w-4 text-cyan-400" />,
        },
      ],
    },
    {
      category: 'Accounting',
      items: [
        {
          id: 'invoices',
          label: 'Invoices',
          icon: <Receipt className="h-4 w-4 text-purple-400" />,
        },
        {
          id: 'receipts',
          label: 'Receipts',
          icon: <CreditCard className="h-4 w-4 text-emerald-400" />,
          badge: 'Cashier',
          badgeColor: 'bg-emerald-500/20 text-emerald-300',
        },
        {
          id: 'bills',
          label: 'Bills',
          icon: <FileText className="h-4 w-4 text-rose-400" />,
          badge: '1 Var',
          badgeColor: 'bg-rose-500/20 text-rose-300',
        },
        {
          id: 'jobcosting',
          label: 'Costing',
          icon: <DollarSign className="h-4 w-4 text-teal-400" />,
        },
        {
          id: 'finance',
          label: 'Finance',
          icon: <Scale className="h-4 w-4 text-indigo-400" />,
        },
        {
          id: 'vat',
          label: 'VAT',
          icon: <Percent className="h-4 w-4 text-amber-400" />,
          badge: '5%',
          badgeColor: 'bg-amber-500/20 text-amber-300',
        },
        {
          id: 'einvoice',
          label: 'eInvoicing',
          icon: <FileCode className="h-4 w-4 text-violet-400" />,
          badge: 'ASP',
          badgeColor: 'bg-violet-500/20 text-violet-300',
        },
        {
          id: 'velocity',
          label: 'Velocity',
          icon: <Zap className="h-4 w-4 text-orange-400" />,
          badge: 'By mode',
          badgeColor: 'bg-orange-500/20 text-orange-300',
        },
      ],
    },
    {
      category: 'Staff & HR',
      items: [
        {
          id: 'hrms',
          label: 'Staff',
          icon: <Users className="h-4 w-4 text-pink-400" />,
          badge: '6',
          badgeColor: 'bg-slate-800 text-slate-300',
        },
        {
          id: 'payroll',
          label: 'Payroll',
          icon: <CreditCard className="h-4 w-4 text-emerald-400" />,
          badge: 'SIF',
          badgeColor: 'bg-emerald-500/20 text-emerald-300',
        },
      ],
    },
    {
      category: 'Management & Admin',
      items: [
        {
          id: 'lifecycle',
          label: 'Lifecycle',
          icon: <GitCommit className="h-4 w-4 text-emerald-400" />,
          badge: '10-Step',
          badgeColor: 'bg-emerald-500/20 text-emerald-300',
        },
        {
          id: 'approvals',
          label: 'Approvals',
          icon: <CheckCircle className="h-4 w-4 text-amber-400" />,
          badge: pendingApprovals > 0 ? `${pendingApprovals}` : undefined,
          badgeColor: 'bg-[#E8472B] text-white',
        },
        {
          id: 'docintel',
          label: 'Intelligence',
          icon: <Sparkles className="h-4 w-4 text-fuchsia-400" />,
          badge: 'OCR',
          badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300',
        },
        {
          id: 'inbox',
          label: 'Messages',
          icon: <Inbox className="h-4 w-4 text-teal-400" />,
          badge: '3',
          badgeColor: 'bg-teal-500/20 text-teal-300',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings className="h-4 w-4 text-slate-400" />,
          badge: 'Admin',
          badgeColor: 'bg-slate-800 text-slate-300',
        },
      ],
    },
  ];

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-800 bg-[#09192D] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800/80 px-4 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8472B] to-[#F05A3E] font-black text-white shadow-md shadow-[#E8472B]/20">
          DB
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-black tracking-tight text-white">
            <span>DigitalBurj</span>
            <span className="rounded bg-[#C98B53]/20 px-1 py-0.5 text-[9px] font-bold text-[#C98B53]">OS</span>
          </div>
          <div className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400">Logistics & Trade</div>
        </div>
      </div>

      {/* Role Context Bar */}
      <div className="border-b border-slate-800/60 bg-slate-900/50 px-4 py-2 text-[11px] shrink-0">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[9px]">Logged In Role</span>
          <span className="capitalize font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
            {currentRole}
          </span>
        </div>
      </div>

      {/* Navigation List - Grouped by Usage, Detailed One Below One, Single Simple Word */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 text-xs scrollbar-thin scrollbar-thumb-slate-800">
        {navGroups.map((group) => (
          <div key={group.category} className="space-y-1">
            <div className="px-3 pb-1 text-[9.5px] font-bold uppercase tracking-widest text-slate-400">
              {group.category}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectView(item.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 font-medium transition ${
                      isActive
                        ? 'bg-[#E8472B] text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span className="text-[13px]">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono ${
                          isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer System Status */}
      <div className="border-t border-slate-800 p-3 text-[11px] text-slate-400 bg-slate-950/60 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-glow"></span>
            <span className="font-semibold text-slate-200">Dubai HQ Connected</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Mirsal II Live</span>
        </div>
      </div>
    </aside>
  );
};
