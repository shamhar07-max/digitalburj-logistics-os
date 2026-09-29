import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Bell,
  Sparkles,
  CheckCircle2,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  UserCheck,
  ShieldCheck,
  Globe2,
  AlertCircle,
  RotateCcw,
  X,
  ArrowRight,
  Pin,
  MapPin,
  History,
  Moon,
  Sun,
} from 'lucide-react';
import { RoleType } from '../types';
import { BRANCHES } from '../data/mockData';

interface HeaderProps {
  currentRole: RoleType;
  onRoleChange: (role: RoleType) => void;
  currentBranch: string;
  onBranchChange: (branchId: string) => void;
  isSimpleMode: boolean;
  onToggleMode: () => void;
  onOpenNewModal: () => void;
  onOpenSearch: () => void;
  onOpenAiDrawer: () => void;
  onOpenApprovals: () => void;
  pendingApprovalsCount: number;
  onOpenActivityAudit?: () => void;
  auditEventsCount?: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const ROLE_LABELS: Record<RoleType, { title: string; color: string; badge: string }> = {
  owner: { title: 'Owner Command Center', color: 'bg-amber-600', badge: 'Full Company Oversight' },
  manager: { title: 'Logistics Manager', color: 'bg-blue-600', badge: 'Approvals & Lane P&L' },
  sales: { title: 'Sales Workspace', color: 'bg-emerald-600', badge: 'Quotes & CRM Pipeline' },
  ops: { title: 'Operations Control Tower', color: 'bg-indigo-600', badge: 'Execution & Milestones' },
  customs: { title: 'Customs Desk', color: 'bg-rose-600', badge: 'Declarations & Holds' },
  finance: { title: 'Finance & Job Costing', color: 'bg-purple-600', badge: 'P&L, VAT & eInvoicing' },
  dispatch: { title: 'Fleet Dispatcher', color: 'bg-cyan-600', badge: 'Trucks & Trips' },
  driver: { title: 'Driver Mobile App', color: 'bg-orange-600', badge: 'Assigned Trips & POD' },
  warehouse: { title: 'Warehouse WMS', color: 'bg-teal-600', badge: 'Bins & Consolidation' },
  hr: { title: 'HR & WPS Payroll', color: 'bg-pink-600', badge: 'Visas & MOHRE SIF' },
  customer: { title: 'Customer Portal', color: 'bg-sky-600', badge: 'External Shipper Portal' },
  partner: { title: 'Partner & Carrier Portal', color: 'bg-violet-600', badge: 'Carrier Updates' },
  admin: { title: 'Organization Admin', color: 'bg-slate-700', badge: 'RBAC & Master Settings' },
};

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  currentBranch,
  onBranchChange,
  isSimpleMode,
  onToggleMode,
  onOpenNewModal,
  onOpenSearch,
  onOpenAiDrawer,
  onOpenApprovals,
  pendingApprovalsCount,
  onOpenActivityAudit,
  auditEventsCount,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  // Branch Switch Confirmation Dialog & Toast States
  const [pendingBranchId, setPendingBranchId] = useState<string | null>(null);
  const [showBranchConfirmDialog, setShowBranchConfirmDialog] = useState(false);
  const [branchSwitchToast, setBranchSwitchToast] = useState<{
    message: string;
    prevBranchId: string;
    newBranchName: string;
  } | null>(null);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (branchSwitchToast) {
      const timer = setTimeout(() => {
        setBranchSwitchToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [branchSwitchToast]);

  const selectedBranch = BRANCHES.find((b) => b.id === currentBranch) || BRANCHES[0];
  const pendingBranch = BRANCHES.find((b) => b.id === pendingBranchId) || BRANCHES[0];
  const roleMeta = ROLE_LABELS[currentRole];

  const handleBranchSelect = (targetBranchId: string) => {
    setShowBranchMenu(false);
    if (targetBranchId === currentBranch) return;
    setPendingBranchId(targetBranchId);
    setShowBranchConfirmDialog(true);
  };

  const handleConfirmBranchSwitch = () => {
    if (!pendingBranchId) return;
    const prev = currentBranch;
    const target = BRANCHES.find((b) => b.id === pendingBranchId);
    onBranchChange(pendingBranchId);
    setShowBranchConfirmDialog(false);
    setPendingBranchId(null);

    setBranchSwitchToast({
      message: `Active branch switched to ${target?.name.split('(')[0] || pendingBranchId}.`,
      prevBranchId: prev,
      newBranchName: target?.name.split('(')[0] || pendingBranchId,
    });
  };

  const handleUndoBranch = () => {
    if (branchSwitchToast?.prevBranchId) {
      onBranchChange(branchSwitchToast.prevBranchId);
      setBranchSwitchToast(null);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 shadow-xs md:px-6">
        {/* Left: Organization & Branch Switcher */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => {
                setShowBranchMenu(!showBranchMenu);
                setShowRoleMenu(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2A2B] text-white">
                <Building2 className="h-4 w-4 text-[#E8472B]" />
              </div>
              <div>
                <div className="flex items-center gap-1 font-bold text-slate-900">
                  <span>{selectedBranch.name.split('(')[0]}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </div>
                <div className="text-[10px] text-slate-500">
                  TRN: {selectedBranch.trn.slice(0, 10)}... · {selectedBranch.currency}
                </div>
              </div>
            </button>

            {showBranchMenu && (
              <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Operating Branch
                </div>
                {BRANCHES.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleBranchSelect(b.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      currentBranch === b.id
                        ? 'bg-[#E8472B]/10 font-bold text-[#E8472B]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div>{b.name}</div>
                      <div className="text-[10px] text-slate-400">TRN: {b.trn}</div>
                    </div>
                    {currentBranch === b.id && <span className="text-xs font-bold text-[#E8472B]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Global Search Bar (Trigger) */}
          <div className="hidden lg:block">
            <button
              onClick={onOpenSearch}
              className="flex w-72 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-400 transition hover:border-[#E8472B]/40 hover:bg-white"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span>Ask or search anything...</span>
              </div>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Simple vs Full Mode Toggle */}
          <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold text-slate-600">
            <button
              onClick={onToggleMode}
              className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                isSimpleMode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Simple Mode
            </button>
            <button
              onClick={onToggleMode}
              className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                !isSimpleMode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Full Enterprise
            </button>
          </div>

          {/* AI Copilots Drawer Trigger */}
          <button
            onClick={onOpenAiDrawer}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-700 transition hover:bg-purple-100 hover:shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            <span className="hidden md:inline">8 AI Agents</span>
          </button>

          {/* Global Activity Audit Log */}
          {onOpenActivityAudit && (
            <button
              onClick={onOpenActivityAudit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:border-indigo-300"
              title="Global Compliance Activity Audit Log"
            >
              <History className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden lg:inline text-[11px]">Audit</span>
              {auditEventsCount !== undefined && auditEventsCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[9.5px] font-mono font-bold text-indigo-800">
                  {auditEventsCount}
                </span>
              )}
            </button>
          )}

          {/* Night-Shift Dark Mode Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
              title={isDarkMode ? 'Switch to Standard Day Mode' : 'Switch to Night-Shift Operations Dark Mode (Reduced Eye Strain)'}
            >
              {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>
          )}

          {/* Approvals Bell */}
          <button
            onClick={onOpenApprovals}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            title="Universal Approval Queue"
          >
            <Bell className="h-4 w-4" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E8472B] text-[9px] font-extrabold text-white">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          {/* Quick Action (+ New) */}
          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-1 rounded-lg bg-[#E8472B] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#D13B20] active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Action</span>
          </button>

          {/* Role Switcher Atlas Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowRoleMenu(!showRoleMenu);
                setShowBranchMenu(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 transition hover:bg-slate-50"
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-md font-bold text-white text-[11px] ${roleMeta.color}`}
              >
                {currentRole.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden text-left xl:block">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                  <span>{roleMeta.title}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </div>
                <div className="text-[10px] text-slate-500">{roleMeta.badge}</div>
              </div>
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl z-50">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Live Role Atlas Switcher
                  </span>
                  <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-semibold">
                    Instant RBAC Preview
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto py-1">
                  {(Object.keys(ROLE_LABELS) as RoleType[]).map((r) => {
                    const m = ROLE_LABELS[r];
                    const active = currentRole === r;
                    return (
                      <button
                        key={r}
                        onClick={() => {
                          onRoleChange(r);
                          setShowRoleMenu(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                          active
                            ? 'bg-slate-100 font-bold text-slate-950'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded font-bold text-white text-[10px] ${m.color}`}
                        >
                          {r.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-width-0">
                          <div className="truncate font-semibold">{m.title}</div>
                          <div className="text-[10px] text-slate-400">{m.badge}</div>
                        </div>
                        {active && <CheckCircle2 className="h-3.5 w-3.5 text-[#E8472B]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Subtle Branch Switch Confirmation Dialog */}
      {showBranchConfirmDialog && pendingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-[#E8472B]">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Switch Operating Branch?
                </h3>
                <p className="text-xs text-slate-500">
                  Confirm workspace and data context shift
                </p>
              </div>
            </div>

            {/* Context Transition Preview Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between font-medium text-slate-600">
                <span className="text-[10.5px] uppercase font-bold text-slate-400">Current Context:</span>
                <span className="font-bold text-slate-800">{selectedBranch.name.split('(')[0]}</span>
              </div>
              <div className="flex items-center justify-center text-slate-400">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between font-medium text-slate-600 bg-white p-2 rounded-xl border border-orange-100">
                <span className="text-[10.5px] uppercase font-bold text-[#E8472B]">New Operating Branch:</span>
                <span className="font-black text-slate-950">{pendingBranch.name}</span>
              </div>
            </div>

            {/* Crucial Data Context Changes Note */}
            <div className="space-y-2 rounded-xl bg-amber-50/80 p-3 border border-amber-200/80 text-[11.5px] text-amber-900 leading-snug">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                <span>Operational Data Context Shifts:</span>
              </div>
              <ul className="space-y-1 pl-5 list-disc text-amber-900">
                <li>
                  <strong>Quick Notes:</strong> Team sticky notes on the dashboard are partitioned per branch. Your view will switch to {pendingBranch.name.split('(')[0]} team notes.
                </li>
                <li>
                  <strong>Customs & Ports:</strong> Local terminal clearance priorities and gates will switch to {pendingBranch.id === 'AUH' ? 'Khalifa Port & Musaffah' : pendingBranch.id === 'SHJ' ? 'Port Khalid & Northern Border' : 'Jebel Ali & Dubai Cargo City'} gates.
                </li>
                <li>
                  <strong>Legal Invoicing TRN:</strong> Documentation will reference TRN {pendingBranch.trn}.
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowBranchConfirmDialog(false);
                  setPendingBranchId(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBranchSwitch}
                className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
              >
                <span>Confirm & Switch Context</span>
                <CheckCircle2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Confirmation Toast Banner */}
      {branchSwitchToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#09192D] px-4 py-3 text-white shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-xs">
            <div className="font-bold text-white">Branch Context Updated</div>
            <div className="text-slate-300 text-[11px]">{branchSwitchToast.message}</div>
          </div>
          <button
            onClick={handleUndoBranch}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/20 transition ml-1"
          >
            <RotateCcw className="h-3 w-3 text-slate-300" />
            <span>Undo</span>
          </button>
          <button
            onClick={() => setBranchSwitchToast(null)}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
