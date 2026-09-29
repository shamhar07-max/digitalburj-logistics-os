import React, { useState } from 'react';
import {
  Settings,
  Building2,
  ShieldCheck,
  CreditCard,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Key,
  Globe2,
  FileCheck2,
  Lock,
  Database,
  History,
  Check,
  Moon,
  Sun,
  Eye,
  Sparkles,
} from 'lucide-react';
import { AuditLogEntry } from '../../types';
import { INITIAL_AUDIT_LOGS } from '../../data/mockData';

interface SettingsViewProps {
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'banking' | 'currencies' | 'rbac' | 'audit' | 'theme'>('profile');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [auditSearch, setAuditSearch] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Company Profile State
  const [companyName, setCompanyName] = useState('DigitalBurj Logistics FZ-LLC');
  const [trn, setTrn] = useState('100234567800003');
  const [tradeLicense, setTradeLicense] = useState('CN-1092881');
  const [customsCode, setCustomsCode] = useState('DXB-88219');
  const [jafzaLease, setJafzaLease] = useState('JAFZA-WH-04-12');
  const [operatingCurrency, setOperatingCurrency] = useState('AED');

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.recordRef.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.module.toLowerCase().includes(auditSearch.toLowerCase())
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Administration · Organization Setup
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800">
              Master Admin Mode
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Company Settings & Master Controls
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure legal entity profile, Dubai Customs code, corporate bank accounts, currency rates, and review immutable audit trails.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-800 animate-in fade-in">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
        {[
          { id: 'profile', label: 'Company Profile & Licenses', icon: <Building2 className="h-4 w-4" /> },
          { id: 'banking', label: 'Bank Accounts & Payouts', icon: <CreditCard className="h-4 w-4" /> },
          { id: 'currencies', label: 'Currencies & Pegs', icon: <DollarSign className="h-4 w-4" /> },
          { id: 'rbac', label: 'Role Permissions (RBAC)', icon: <Lock className="h-4 w-4" /> },
          { id: 'audit', label: `System Audit Log (${auditLogs.length})`, icon: <History className="h-4 w-4" /> },
          { id: 'theme', label: isDarkMode ? 'Night-Shift Active' : 'Night-Shift Theme', icon: isDarkMode ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-500" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold transition ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Company Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-extrabold text-sm text-slate-900">
              UAE Registered Legal Entity & Authority Credentials
            </h3>
            <p className="text-xs text-slate-500">
              These details appear on customer invoices, export manifests, and Mirsal II customs declarations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Company Legal Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">UAE Federal Tax Authority (FTA) TRN</label>
              <input
                type="text"
                value={trn}
                onChange={(e) => setTrn(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dubai Trade License Number</label>
              <input
                type="text"
                value={tradeLicense}
                onChange={(e) => setTradeLicense(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dubai Customs Importer/Exporter Code</label>
              <input
                type="text"
                value={customsCode}
                onChange={(e) => setCustomsCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">JAFZA Freezone Warehouse Lease ID</label>
              <input
                type="text"
                value={jafzaLease}
                onChange={(e) => setJafzaLease(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Primary Operating Currency</label>
              <select
                value={operatingCurrency}
                onChange={(e) => setOperatingCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-bold text-slate-900 focus:outline-hidden"
              >
                <option value="AED">AED — United Arab Emirates Dirham</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
            >
              <Check className="h-4 w-4" />
              <span>Save Organization Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Banking & Bank Accounts */}
      {activeTab === 'banking' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900">
                Designated Company Bank Accounts
              </h3>
              <p className="text-xs text-slate-500">
                Printed on sales invoices for customer wire transfers and used for MOHRE WPS payroll salary routing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-black text-slate-900 text-sm">Emirates NBD (Primary AED)</div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    WPS SALARY ACTIVE
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-600">
                  <div>Account: 010244991001</div>
                  <div>IBAN: AE22 0260 0001 0244 9910 01</div>
                  <div>Swift: EBBKAEAD</div>
                  <div>Branch: Jebel Ali Corporate Centre</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-black text-slate-900 text-sm">First Abu Dhabi Bank (USD Trade)</div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    OCEAN FREIGHT WIRE
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-600">
                  <div>Account: 088410299011</div>
                  <div>IBAN: AE44 0300 0008 8410 2990 11</div>
                  <div>Swift: FABKAEAD</div>
                  <div>Branch: Khalifa Port Branch</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Currencies & Fixed Peg */}
      {activeTab === 'currencies' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900">
              Exchange Rates & UAE Central Bank Fixed Peg
            </h3>
            <p className="text-xs text-slate-500">
              Standardized FX rates for converting international ocean bills (USD) to AED local VAT invoicing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">USD / AED (Official Central Bank Peg)</span>
              <div className="text-2xl font-black font-mono text-slate-900">3.6725</div>
              <span className="text-[10.5px] text-emerald-700 font-semibold">Fixed UAE Currency Peg</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">EUR / AED (European Trade)</span>
              <div className="text-2xl font-black font-mono text-slate-900">3.9850</div>
              <span className="text-[10.5px] text-slate-500">Daily spot average</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">SAR / AED (GCC Land Transport)</span>
              <div className="text-2xl font-black font-mono text-slate-900">0.9790</div>
              <span className="text-[10.5px] text-slate-500">GCC Customs Tariff standard</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RBAC Roles */}
      {activeTab === 'rbac' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900">
              Role-Based Access Control (RBAC) Permissions Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Enforce least-privilege security across sales reps, drivers, operations, and customs brokers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Role Title</th>
                  <th className="p-3">Quotations & Pricing</th>
                  <th className="p-3">Shipment Execution</th>
                  <th className="p-3">Customs Holds</th>
                  <th className="p-3">VAT & Accounting</th>
                  <th className="p-3">WPS SIF Payroll</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { title: 'Company Owner', quotes: 'Full / Override', ops: 'Full Access', customs: 'Full Access', fin: 'Full Access', hr: 'Full Access' },
                  { title: 'Commercial Manager', quotes: 'Approve <18%', ops: 'View Only', customs: 'View Only', fin: 'P&L Reports', hr: 'No Access' },
                  { title: 'Operations Controller', quotes: 'Costing View', ops: 'Full Milestone Control', customs: 'Filing Access', fin: 'POD Validate', hr: 'No Access' },
                  { title: 'Customs Broker', quotes: 'No Access', ops: 'Documentation Only', customs: 'Signoff & Mirsal II', fin: 'Duty Post', hr: 'No Access' },
                  { title: 'Haulage Driver', quotes: 'No Access', ops: 'Assigned Trips Only', customs: 'Gate Pass Scan', fin: 'No Access', hr: 'My Salary Slip' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{row.title}</td>
                    <td className="p-3 font-medium text-slate-700">{row.quotes}</td>
                    <td className="p-3 font-medium text-slate-700">{row.ops}</td>
                    <td className="p-3 font-medium text-slate-700">{row.customs}</td>
                    <td className="p-3 font-medium text-slate-700">{row.fin}</td>
                    <td className="p-3 font-medium text-slate-700">{row.hr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Audit Log */}
      {activeTab === 'audit' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Immutable System Activity & Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                Every booking update, approval override, and document upload is logged with timestamp and author.
              </p>
            </div>

            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs hover:bg-white transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 bg-slate-200/80 px-2 py-0.5 rounded text-[10.5px]">
                      {log.module}
                    </span>
                    <span className="font-mono font-bold text-blue-700">{log.recordRef}</span>
                    <span className="font-semibold text-slate-800">{log.action}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{log.details}</div>
                  <div className="text-[10.5px] text-slate-400">
                    Logged by <strong className="text-slate-700">{log.user}</strong>
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  {log.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Night-Shift Operations Theme (Dark Mode) */}
      {activeTab === 'theme' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
                  Interface Ergonomics · CSS Variable Engine
                </span>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800">
                  Night-Shift Mode
                </span>
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mt-1">
                Global Operations Dark Mode & High-Contrast Palette
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Uses CSS variables to adjust the entire UI color palette, improving visibility and reducing eye strain for night-shift operations staff monitoring port gate queues and 24/7 flight arrivals.
              </p>
            </div>

            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold transition shadow-xs ${
                  isDarkMode
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{isDarkMode ? 'Switch to Standard Day Mode' : 'Activate Night-Shift Dark Mode'}</span>
              </button>
            )}
          </div>

          {/* Theme Palette Swatch Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Standard Day Swatch */}
            <div
              onClick={isDarkMode ? onToggleDarkMode : undefined}
              className={`rounded-2xl border p-4 transition cursor-pointer space-y-3 ${
                !isDarkMode
                  ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span className="font-extrabold text-sm text-slate-900">Standard Day Palette</span>
                </div>
                {!isDarkMode && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    CURRENT ACTIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Crisp slate background (#F8FAFC) optimized for day-shift daylight office ambient conditions.
              </p>
              <div className="flex gap-1.5 pt-1">
                <div className="h-6 w-12 rounded bg-[#F8FAFC] border border-slate-300" title="--color-bg-app"></div>
                <div className="h-6 w-12 rounded bg-[#FFFFFF] border border-slate-300" title="--color-bg-surface"></div>
                <div className="h-6 w-12 rounded bg-[#0F172A]" title="--color-text-main"></div>
                <div className="h-6 w-12 rounded bg-[#E8472B]" title="--color-brand"></div>
              </div>
            </div>

            {/* Night-Shift Operations Swatch */}
            <div
              onClick={!isDarkMode ? onToggleDarkMode : undefined}
              className={`rounded-2xl border p-4 transition cursor-pointer space-y-3 ${
                isDarkMode
                  ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'border-slate-200 bg-slate-900 text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-400" />
                  <span className={`font-extrabold text-sm ${isDarkMode ? 'text-slate-900' : 'text-white'}`}>
                    Night-Shift Dark Operations
                  </span>
                </div>
                {isDarkMode && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    CURRENT ACTIVE
                  </span>
                )}
              </div>
              <p className={`text-[11px] leading-snug ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>
                Deep navy tone palette (#09111E) with high-contrast text to protect melatonin and eliminate terminal glare.
              </p>
              <div className="flex gap-1.5 pt-1">
                <div className="h-6 w-12 rounded bg-[#09111E] border border-slate-700" title="--color-bg-app"></div>
                <div className="h-6 w-12 rounded bg-[#10192A] border border-slate-700" title="--color-bg-surface"></div>
                <div className="h-6 w-12 rounded bg-[#F8FAFC]" title="--color-text-main"></div>
                <div className="h-6 w-12 rounded bg-[#F05A3E]" title="--color-brand"></div>
              </div>
            </div>
          </div>

          {/* Operational Benefits Explanation */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-indigo-600" />
              <span>CSS Variable Driven Architecture:</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11.5px] text-slate-600">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <strong className="block text-slate-900">Zero Inversion Glitches</strong>
                Tokens dynamically map to CSS variables without breaking chart canvases or signature pads.
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <strong className="block text-slate-900">High Container Legibility</strong>
                Monospace container and seal numbers render in high-contrast cyan and amber.
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <strong className="block text-slate-900">Instant Local Persistence</strong>
                Theme preference automatically persists across browser refreshes via localStorage.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
