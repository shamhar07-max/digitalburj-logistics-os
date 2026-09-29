import React, { useState } from 'react';
import {
  Ship,
  TrendingUp,
  AlertTriangle,
  Clock,
  DollarSign,
  ShieldCheck,
  ArrowUpRight,
  FileCheck2,
  Calendar,
  Sparkles,
  HelpCircle,
  Truck,
  CheckCircle2,
  PhoneCall,
  Calculator,
  BookOpen,
  Info,
  ChevronRight,
  ExternalLink,
  StickyNote as StickyNoteIcon,
  Plus,
  Trash2,
  MessageSquare,
  Pin,
  Zap,
} from 'lucide-react';
import { RoleType, Shipment, Quote } from '../../types';
import { PLAIN_LOGISTICS_GLOSSARY, BRANCHES, INITIAL_APPROVALS } from '../../data/mockData';
import { ModalHub } from '../ModalHub';
import { VELOCITY_RECORDS } from '../../data/velocityData';
import { TARGET_MINUTES, compareModes, fmtMinutes, measure } from '../../utils/velocity';
import {
  OperationalDrilldownModal,
  DrilldownMetricType,
} from '../modals/OperationalDrilldownModal';

interface StickyNoteItem {
  id: string;
  branchId: string;
  text: string;
  author: string;
  priority: 'normal' | 'urgent' | 'info';
  timestamp: string;
}

const INITIAL_STICKY_NOTES: StickyNoteItem[] = [
  {
    id: 'note-1',
    branchId: 'DXB',
    text: 'Customs amendment for DB-1048 submitted at JAFZA Gate 4 counter. Broker Hassan is waiting at the counter with the physical seal.',
    author: 'Maya Al Rashid',
    priority: 'urgent',
    timestamp: 'Today 10:20 AM',
  },
  {
    id: 'note-2',
    branchId: 'DXB',
    text: 'Terminal 2 crane maintenance expected tonight 22:00–02:00. Please schedule all container gate-ins before 21:30.',
    author: 'Ravi Nair (Dispatch)',
    priority: 'normal',
    timestamp: 'Today 09:15 AM',
  },
  {
    id: 'note-3',
    branchId: 'DXB',
    text: 'Al Faris Trading accounting promised payment for INV-3389 before Thursday to restore full credit line.',
    author: 'Fatima Zayed (Finance)',
    priority: 'info',
    timestamp: 'Yesterday 04:30 PM',
  },
  {
    id: 'note-4',
    branchId: 'AUH',
    text: 'Khalifa Port container gate weighbridge queue is 25 mins today due to terminal software upgrade.',
    author: 'Mohammed (Abu Dhabi Ops)',
    priority: 'normal',
    timestamp: 'Today 08:45 AM',
  },
  {
    id: 'note-5',
    branchId: 'AUH',
    text: 'Musaffah steel dispatch for DB-1050 successfully cleared gate-out and loaded on vessel.',
    author: 'Omar Khalifa',
    priority: 'info',
    timestamp: 'Yesterday 02:00 PM',
  },
  {
    id: 'note-6',
    branchId: 'SHJ',
    text: 'Sharjah Customs transit permit for Oman border trucks requires updated driver Emirates ID copy.',
    author: 'Ali Hassan (Driver Lead)',
    priority: 'urgent',
    timestamp: 'Today 11:00 AM',
  },
];

const VELOCITY = compareModes(measure(VELOCITY_RECORDS).valid);

interface DashboardViewProps {
  currentRole: RoleType;
  currentBranch: string;
  shipments: Shipment[];
  quotes: Quote[];
  pendingApprovalsCount: number;
  onSelectShipment: (shipment: Shipment) => void;
  onOpenExplainModal: (label: string, value: string, formula: string, records: any[]) => void;
  onNavigateView: (viewName: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentRole,
  currentBranch,
  shipments,
  quotes,
  pendingApprovalsCount,
  onSelectShipment,
  onOpenExplainModal,
  onNavigateView,
}) => {
  const [showDemurrageCalc, setShowDemurrageCalc] = useState(false);
  const [calcContainerType, setCalcContainerType] = useState<'20ft' | '40ft' | 'reefer'>('40ft');
  const [calcDaysDelayed, setCalcDaysDelayed] = useState<number>(3);
  const [showGlossary, setShowGlossary] = useState(false);
  const [drilldownModal, setDrilldownModal] = useState<{
    isOpen: boolean;
    type: DrilldownMetricType;
  }>({
    isOpen: false,
    type: 'shipments',
  });

  // Quick Notes per-branch state
  const [stickyNotes, setStickyNotes] = useState<StickyNoteItem[]>(INITIAL_STICKY_NOTES);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePriority, setNewNotePriority] = useState<'normal' | 'urgent' | 'info'>('normal');

  const atRiskShipments = shipments.filter((s) => s.health === 'risk' || s.status === 'customs_hold');
  const currentMarginAverage = 26.4;

  // Filter notes strictly for current branch (or all if currentBranch === 'ALL')
  const branchNotes = stickyNotes.filter(
    (n) => currentBranch === 'ALL' || n.branchId === currentBranch
  );

  const activeBranchName =
    BRANCHES.find((b) => b.id === currentBranch)?.name.split('(')[0] || 'Dubai HQ';

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const newNote: StickyNoteItem = {
      id: `note-${Date.now()}`,
      branchId: currentBranch === 'ALL' ? 'DXB' : currentBranch,
      text: newNoteText.trim(),
      author: 'You (Team Member)',
      priority: newNotePriority,
      timestamp: 'Just now',
    };

    setStickyNotes([newNote, ...stickyNotes]);
    setNewNoteText('');
  };

  const handleDeleteNote = (id: string) => {
    setStickyNotes(stickyNotes.filter((n) => n.id !== id));
  };

  // 7-day Operational Velocity Data
  const shipmentsTrendData = [11, 12, 14, 13, 15, 14, 15]; // +25% trend
  const approvalsTrendData = [1, 3, 2, 4, 3, 5, pendingApprovalsCount]; // velocity trend

  const renderSparkline = (data: number[], color: string, width = 84, height = 30) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1);
    const points = data
      .map((val, i) => {
        const x = i * step;
        const y = height - ((val - min) / range) * (height - 8) - 4;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible shrink-0">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {data.map((val, i) => {
          const x = i * step;
          const y = height - ((val - min) / range) * (height - 8) - 4;
          if (i === data.length - 1) {
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3.5"
                fill={color}
                className="animate-pulse"
              />
            );
          }
          return null;
        })}
      </svg>
    );
  };

  const calculateDemurrage = (type: '20ft' | '40ft' | 'reefer', days: number) => {
    const ratePerDay = type === '20ft' ? 180 : type === '40ft' ? 320 : 550;
    return days * ratePerDay;
  };

  const handleExplainUnbilled = () => {
    onOpenExplainModal(
      'Money Waiting to be Invoiced',
      'AED 92,000',
      'Completed shipments with signed proof of delivery (POD) that are ready to bill right now',
      [
        {
          recordRef: 'DB-1050',
          description: 'Emirates Steel export to Mumbai delivered & signed',
          amount: 'AED 92,000',
          updatedAt: 'Yesterday 14:00',
          category: 'FCL Sea Export',
        },
      ]
    );
  };

  const handleExplainAtRisk = () => {
    onOpenExplainModal(
      'Potential Port Delay Penalties',
      'AED 2,450 / day if delayed',
      'Daily storage fees charged by shipping line/port if cargo stays past free days',
      [
        {
          recordRef: 'DB-1048',
          description:
            'Container MSKU-8842190 customs hold at Jebel Ali Terminal 2 (14 hours of free time left)',
          amount: 'AED 1,450/day penalty',
          updatedAt: 'Today 10:45',
          category: 'Port Storage',
        },
        {
          recordRef: 'DB-1052',
          description:
            'Truck driver waiting at customer warehouse for 3h 20m (free waiting was 2 hours)',
          amount: 'AED 450 detention charge',
          updatedAt: 'Today 16:30',
          category: 'Truck Waiting Fee',
        },
      ]
    );
  };

  const handleExplainMargin = () => {
    onOpenExplainModal(
      'Our Profit Percentage (Gross Margin)',
      `${currentMarginAverage}%`,
      '((What customer pays us - What shipping lines & truckers charge us) ÷ What customer pays us) × 100',
      [
        {
          recordRef: 'DB-1050',
          description:
            'Emirates Steel Mumbai (Customer pays 92k, Carrier costs 64.1k)',
          amount: '30.3% Profit',
          updatedAt: 'Yesterday',
          category: 'Sea Export',
        },
        {
          recordRef: 'DB-1048',
          description:
            'Al Faris Trading (Customer pays 48.5k, Carrier costs 36.2k)',
          amount: '25.4% Profit',
          updatedAt: 'Today',
          category: 'Sea Import',
        },
        {
          recordRef: 'DB-1051',
          description: 'Zayed Foods (Customer pays 12.75k, Carrier costs 9.1k)',
          amount: '28.6% Profit',
          updatedAt: '26 Sep',
          category: 'Sea LCL',
        },
      ]
    );
  };

  return (
    <div className="space-y-6">
      {/* Friendly Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              {activeBranchName} · Daily Operations
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
              UAE VAT & Customs Connected
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1 capitalize">
            {currentRole === 'owner'
              ? 'Owner Daily Overview'
              : `${currentRole} Daily Work Dashboard`}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Everything your team needs to handle today — organized simply, with clear deadlines and no confusing jargon.
          </p>
        </div>

        {/* Quick Help & Action Triggers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Compliance Audit Button */}
          <button
            onClick={() => onNavigateView('complianceaudit')}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 shadow-2xs"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Compliance Audit (86%)</span>
          </button>

          {/* Port Fee Calculator Button */}
          <button
            onClick={() => setShowDemurrageCalc(!showDemurrageCalc)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Calculator className="h-4 w-4 text-[#E8472B]" />
            <span>Port Fee Calculator</span>
          </button>

          {/* Glossary Helper */}
          <button
            onClick={() => setShowGlossary(!showGlossary)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <BookOpen className="h-4 w-4 text-blue-600" />
            <span>Shipping Terms</span>
          </button>
        </div>
      </div>

      {/* Expandable Port Demurrage Cost Calculator */}
      {showDemurrageCalc && (
        <div className="rounded-2xl border border-[#E8472B]/30 bg-gradient-to-r from-orange-50/70 to-white p-5 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-orange-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#E8472B]" />
              <h3 className="font-extrabold text-sm text-slate-900">
                Port Delay Fee (Demurrage) Calculator — Jebel Ali Port Rates
              </h3>
            </div>
            <button
              onClick={() => setShowDemurrageCalc(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Close ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Container Size / Type:
              </label>
              <select
                value={calcContainerType}
                onChange={(e) => setCalcContainerType(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium focus:outline-hidden"
              >
                <option value="20ft">20ft Standard Container (AED 180/day)</option>
                <option value="40ft">40ft High Cube Container (AED 320/day)</option>
                <option value="reefer">40ft Reefer Chilled/Frozen (AED 550/day)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Days Cargo Delayed Past Free Time:
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={calcDaysDelayed}
                onChange={(e) =>
                  setCalcDaysDelayed(Math.max(1, Number(e.target.value)))
                }
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="rounded-xl border border-rose-200 bg-white p-3 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase">
                Estimated Port Penalty Fee:
              </span>
              <span className="text-xl font-black text-rose-700 font-mono mt-0.5">
                AED {calculateDemurrage(calcContainerType, calcDaysDelayed).toLocaleString()}
              </span>
              <span className="text-[10.5px] text-slate-400">
                Avoid by clearing customs before free days end
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Simple Terms Glossary */}
      {showGlossary && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-700" />
              <h3 className="font-extrabold text-sm text-slate-900">
                Simple Guide for Staff: Common Shipping Terms in Plain Words
              </h3>
            </div>
            <button
              onClick={() => setShowGlossary(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Close ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {Object.entries(PLAIN_LOGISTICS_GLOSSARY).map(([term, data]) => (
              <div
                key={term}
                className="rounded-xl border border-blue-100 bg-white p-3 space-y-1"
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{term}</span>
                  <span className="text-[10.5px] font-semibold text-blue-700 bg-blue-50 px-1.5 rounded">
                    {data.plain}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{data.tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Clear Everyday Summary Cards — Interactive Clicks Trigger Contributing Records Drilldown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Shipments + 7-Day Velocity Sparkline */}
        <div
          onClick={() => setDrilldownModal({ isOpen: true, type: 'shipments' })}
          className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#E8472B]/60 hover:shadow-md cursor-pointer flex flex-col justify-between"
          title="Click to view all live contributing shipment records"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold uppercase tracking-wider text-[10px]">
                Active Shipments Moving
              </span>
              <Ship className="h-4 w-4 text-blue-600" />
            </div>

            {/* Metric + 7-Day Sparkline Chart */}
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <div className="text-3xl font-black text-slate-950 group-hover:text-blue-700 transition">
                {shipments.length} Active
              </div>
              <div className="flex flex-col items-end">
                {renderSparkline(shipmentsTrendData, '#1D6FE0')}
                <span className="text-[9.5px] font-bold text-blue-600 mt-0.5 font-mono">
                  +18% 7d velocity
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-1">
              Cargo moving by Sea, Air, and GCC Road trucks
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-blue-600">
            <span className="flex items-center gap-1 group-hover:underline">
              <span>Inspect {shipments.length} contributing records</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateView('shipments');
              }}
              className="text-slate-400 hover:text-blue-700 hover:underline flex items-center gap-0.5 text-[10.5px]"
            >
              <span>Tower</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Card 2: Pending Approvals + 7-Day Sparkline */}
        <div
          onClick={() => setDrilldownModal({ isOpen: true, type: 'approvals' })}
          className="group rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/40 to-white p-5 shadow-xs transition hover:border-amber-400 hover:shadow-md cursor-pointer flex flex-col justify-between"
          title="Click to view all pending approvals blocking operations"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800">
                Pending Approvals
              </span>
              <Clock className="h-4 w-4 text-amber-700" />
            </div>

            {/* Metric + 7-Day Sparkline Chart */}
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <div className="text-3xl font-black text-amber-800 group-hover:text-amber-900 transition">
                {pendingApprovalsCount} Waiting
              </div>
              <div className="flex flex-col items-end">
                {renderSparkline(approvalsTrendData, '#D97706')}
                <span className="text-[9.5px] font-bold text-amber-700 mt-0.5 font-mono">
                  3.8h avg turnaround
                </span>
              </div>
            </div>

            <p className="text-xs text-amber-900 mt-1">
              Margin overrides & customs release sign-offs
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between text-[11px] font-bold text-amber-700">
            <span className="flex items-center gap-1 group-hover:underline">
              <span>Inspect {pendingApprovalsCount} waiting requests</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateView('approvals');
              }}
              className="text-amber-600/70 hover:text-amber-900 hover:underline flex items-center gap-0.5 text-[10.5px]"
            >
              <span>Queue</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Ready to Invoice */}
        <div
          onClick={() => setDrilldownModal({ isOpen: true, type: 'unbilled' })}
          className="group rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/40 to-white p-5 shadow-xs transition hover:border-purple-400 hover:shadow-md cursor-pointer flex flex-col justify-between"
          title="Click to view contributing completed cargo with signed delivery receipts"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold uppercase tracking-wider text-[10px] text-purple-700">
                Ready to Invoice
              </span>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-950 font-mono group-hover:text-purple-700 transition">
              AED 92,000
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Delivered cargo with signed customer delivery proof
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-purple-100 flex items-center justify-between text-[11px] font-bold text-purple-700">
            <span className="group-hover:underline">Inspect unbilled records</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateView('invoices');
              }}
              className="text-purple-500/70 hover:text-purple-900 hover:underline flex items-center gap-0.5 text-[10.5px]"
            >
              <span>Invoices</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Card 4: Our Profit Margin */}
        <div
          onClick={() => setDrilldownModal({ isOpen: true, type: 'margin' })}
          className="group rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white p-5 shadow-xs transition hover:border-emerald-400 hover:shadow-md cursor-pointer flex flex-col justify-between"
          title="Click to view per-shipment revenue vs cost margin breakdown"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-700">
                Average Profit Margin
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-3xl font-black text-emerald-700 font-mono group-hover:text-emerald-800 transition">
              {currentMarginAverage}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Above our minimum required floor of 18%
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between text-[11px] font-bold text-emerald-700">
            <span className="group-hover:underline">Inspect per-job margin P&L</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateView('jobcosting');
              }}
              className="text-emerald-600/70 hover:text-emerald-900 hover:underline flex items-center gap-0.5 text-[10.5px]"
            >
              <span>Costing</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Operational Velocity Quick Indicator */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-slate-900">
                Operational Velocity: Quote Accepted → Document Generation
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  VELOCITY.all.avg > TARGET_MINUTES ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {fmtMinutes(VELOCITY.all.avg)} Mins Avg (Target &lt; {TARGET_MINUTES}m)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Turnaround by mode — Sea ({fmtMinutes(VELOCITY.byMode.Sea.avg)}m), Air ({fmtMinutes(VELOCITY.byMode.Air.avg)}m) and Road ({fmtMinutes(VELOCITY.byMode.Road.avg)}m) — to
              identify mode-specific bottlenecks.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateView('velocity')}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-xs self-start sm:self-auto"
        >
          <span>Inspect Bottleneck Report</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* QUICK NOTES SECTION — Per-Branch Sticky Notes for Staff */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/60 via-yellow-50/30 to-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs">
              <StickyNoteIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-900">
                  Quick Notes & Branch Sticky Board
                </h3>
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  {activeBranchName} Only
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Short operational handover notes for your branch team. Visible strictly to staff logged into{' '}
                <strong className="text-slate-900">{activeBranchName}</strong>.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-800">
            {branchNotes.length} note{branchNotes.length === 1 ? '' : 's'} on board
          </span>
        </div>

        {/* Input Bar to post a new note */}
        <form
          onSubmit={handleAddNote}
          className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2 rounded-xl border border-amber-200 shadow-2xs"
        >
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder={`Leave a quick note for ${activeBranchName} staff (e.g. "Gate 4 customs counter closed at 16:00 today")...`}
            className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <select
              value={newNotePriority}
              onChange={(e) => setNewNotePriority(e.target.value as any)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="info">Info</option>
            </select>
            <button
              type="submit"
              disabled={!newNoteText.trim()}
              className="flex items-center gap-1 rounded-lg bg-[#E8472B] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#D13B20] transition disabled:opacity-40 shrink-0 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Post Note</span>
            </button>
          </div>
        </form>

        {/* Sticky Notes Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {branchNotes.map((note) => (
            <div
              key={note.id}
              className={`rounded-xl border p-3.5 shadow-2xs text-xs space-y-2 relative transition hover:shadow-xs ${
                note.priority === 'urgent'
                  ? 'border-rose-200 bg-rose-50/70 text-rose-950'
                  : note.priority === 'info'
                  ? 'border-blue-200 bg-blue-50/70 text-blue-950'
                  : 'border-yellow-200 bg-yellow-50/80 text-yellow-950'
              }`}
            >
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1 font-bold">
                  <Pin className="h-3 w-3 shrink-0 text-amber-700" />
                  <span className="uppercase tracking-wider">
                    {note.priority === 'urgent'
                      ? '⚠️ Urgent Notice'
                      : note.priority === 'info'
                      ? 'ℹ️ Operational Info'
                      : '📌 Branch Note'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-medium">{note.timestamp}</span>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-white/80 transition"
                    title="Remove note"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <p className="text-[11.5px] leading-relaxed font-medium">
                {note.text}
              </p>

              <div className="text-[10px] text-slate-500 font-semibold pt-1 border-t border-black/5 flex justify-between items-center">
                <span>By: {note.author}</span>
                <span className="rounded bg-white/70 px-1.5 py-0.2 font-mono">
                  {note.branchId}
                </span>
              </div>
            </div>
          ))}

          {branchNotes.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-slate-400 border border-dashed border-amber-200 rounded-xl bg-white/50">
              No sticky notes posted for {activeBranchName} yet. Type a message above to post for your branch colleagues.
            </div>
          )}
        </div>
      </div>

      {/* Modal Hub — Sea / Air / Road swimlanes replace the generic shipment list */}
      <ModalHub shipments={shipments} onSelectShipment={onSelectShipment} onNavigateView={onNavigateView} />

      {/* Urgent tasks & regulatory shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Urgent Tasks */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-sm text-slate-900">
                Urgent Tasks For Your Team
              </h4>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                2 Critical Today
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 space-y-1">
                <div className="flex items-center justify-between font-bold text-rose-950">
                  <span>1. Resolve Customs Hold (DB-1048)</span>
                  <span className="text-[10px] text-rose-700">Due 11:00 AM</span>
                </div>
                <p className="text-[11px] text-rose-900 leading-relaxed">
                  Call customs broker Hassan to submit the amended Chamber of Commerce origin letter before port free time runs out.
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => onNavigateView('customs')}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-[10.5px] font-bold text-white"
                  >
                    Open Customs Desk
                  </button>
                  <button
                    onClick={() => onNavigateView('complianceaudit')}
                    className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[10.5px] font-bold text-rose-800 hover:bg-rose-50"
                  >
                    Check Audit
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-1">
                <div className="flex items-center justify-between font-bold text-purple-950">
                  <span>2. Bill Completed Cargo (DB-1050)</span>
                  <span className="text-[10px] text-purple-700">Ready Now</span>
                </div>
                <p className="text-[11px] text-purple-900 leading-relaxed">
                  Emirates Steel delivery was signed yesterday. Send invoice for AED 92,000 to initiate payment.
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => onNavigateView('invoices')}
                    className="rounded-lg bg-purple-700 px-2.5 py-1 text-[10.5px] font-bold text-white"
                  >
                    Generate Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access to Key Individual Features */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs text-xs">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Quick Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigateView('complianceaudit')}
                className="flex flex-col items-start rounded-xl border border-slate-200 p-2.5 hover:border-emerald-500 hover:bg-emerald-50/40 transition text-left"
              >
                <span className="font-bold text-slate-900">Compliance</span>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  Scorecard (86%)
                </span>
              </button>
              <button
                onClick={() => onNavigateView('driverapp')}
                className="flex flex-col items-start rounded-xl border border-slate-200 p-2.5 hover:border-[#E8472B] hover:bg-slate-50 transition text-left"
              >
                <span className="font-bold text-slate-900">Driver</span>
                <span className="text-[10px] text-slate-500">Sign on glass</span>
              </button>
              <button
                onClick={() => onNavigateView('vat')}
                className="flex flex-col items-start rounded-xl border border-slate-200 p-2.5 hover:border-[#E8472B] hover:bg-slate-50 transition text-left"
              >
                <span className="font-bold text-slate-900">UAE VAT</span>
                <span className="text-[10px] text-slate-500">Return 201</span>
              </button>
              <button
                onClick={() => onNavigateView('payroll')}
                className="flex flex-col items-start rounded-xl border border-slate-200 p-2.5 hover:border-[#E8472B] hover:bg-slate-50 transition text-left"
              >
                <span className="font-bold text-slate-900">WPS SIF</span>
                <span className="text-[10px] text-slate-500">Download file</span>
              </button>
            </div>
          </div>
      </div>

      {/* Transparent Contributing Records Modal for Operational Metrics */}
      <OperationalDrilldownModal
        isOpen={drilldownModal.isOpen}
        onClose={() => setDrilldownModal((prev) => ({ ...prev, isOpen: false }))}
        metricType={drilldownModal.type}
        shipments={shipments}
        approvals={INITIAL_APPROVALS}
        onSelectShipment={onSelectShipment}
        onNavigateView={onNavigateView}
      />
    </div>
  );
};
