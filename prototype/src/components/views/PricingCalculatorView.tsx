import React, { useState } from 'react';
import { Calculator, Check, Sparkles, Download, ArrowRight, ShieldCheck } from 'lucide-react';

const PLANS = [
  { id: 'starter', name: 'Logistics Starter', basePrice: 149, desc: 'CRM + Quotations + Basic Tracking + Invoices & UAE VAT' },
  { id: 'os', name: 'Logistics OS', basePrice: 599, desc: 'Full FCL/LCL/Air/Road + Customs Desk + Job Costing + Customer Portal' },
  { id: 'osai', name: 'Logistics OS + AI', basePrice: 799, desc: 'OS + AI Document Intelligence + AI Customer Service Bot + Margin Coach' },
  { id: 'enterprise', name: 'Enterprise Cluster', basePrice: 1499, desc: 'Dedicated cloud container + custom ERP integrations + guaranteed SLA' },
];

const MODULE_ADDONS = [
  { id: 'acc', name: 'Accounting General Ledger & Bank Rec', price: 79 },
  { id: 'hrms', name: 'HRMS & Employee Visa Monitoring', price: 99 },
  { id: 'wps', name: 'MOHRE WPS Payroll & SIF Generator', price: 79 },
  { id: 'wms', name: 'Warehouse & Cross-Dock WMS', price: 99 },
  { id: 'whatsapp', name: 'WhatsApp Business API Automated Push', price: 129 },
  { id: 'einvoice', name: 'Accredited ASP eInvoicing Direct Bridge', price: 59 },
  { id: 'portal', name: 'Branded White-Label Shipper Portal', price: 89 },
];

const AI_ADDONS = [
  { id: 'ai-doc', name: 'AI Document Intelligence (BL/AWB OCR)', price: 119 },
  { id: 'ai-exec', name: 'AI Executive Daily Briefing', price: 99 },
  { id: 'ai-sales', name: 'AI Sales Inbound Quote Drafter', price: 79 },
  { id: 'ai-ops', name: 'AI Operations Demurrage Predictor', price: 89 },
  { id: 'ai-fin', name: 'AI Finance Discrepancy Hunter', price: 79 },
  { id: 'ai-cs', name: 'AI WhatsApp Customer Bot 24/7', price: 79 },
];

export const PricingCalculatorView: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]); // Logistics OS default
  const [userCount, setUserCount] = useState(10);
  const [selectedModules, setSelectedModules] = useState<string[]>(['acc', 'wps', 'einvoice']);
  const [selectedAI, setSelectedAI] = useState<string[]>(['ai-doc', 'ai-exec', 'ai-sales']);
  const [isAnnual, setIsAnnual] = useState(true);

  const basePrice = selectedPlan.basePrice;
  const userOverageCost = userCount > 5 ? (userCount - 5) * 15 : 0;
  const modulesCost = selectedModules.reduce((acc, mId) => {
    const item = MODULE_ADDONS.find((m) => m.id === mId);
    return acc + (item ? item.price : 0);
  }, 0);
  const aiCost = selectedAI.reduce((acc, aId) => {
    const item = AI_ADDONS.find((a) => a.id === aId);
    return acc + (item ? item.price : 0);
  }, 0);

  const rawMonthlyTotal = basePrice + userOverageCost + modulesCost + aiCost;
  const finalMonthlyTotal = isAnnual ? Math.round(rawMonthlyTotal * 0.8) : rawMonthlyTotal;
  const annualTotal = finalMonthlyTotal * 12;

  const toggleModule = (id: string) => {
    setSelectedModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const toggleAI = (id: string) => {
    setSelectedAI((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Transparent Pricing</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              SME-Appropriate Floor
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Modular Pricing Calculator</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent self-serve pricing. No opaque demo gatekeeping. Compare your real monthly cost.
          </p>
        </div>

        {/* Annual Discount Switcher */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            onClick={() => setIsAnnual(false)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              !isAnnual ? 'bg-[#09192D] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
              isAnnual ? 'bg-[#E8472B] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Annual Prepay</span>
            <span className="bg-white/20 text-white rounded px-1 text-[10px]">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Main Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Configuration Choices */}
        <div className="lg:col-span-2 space-y-5">
          {/* 1. Base Plan */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900">1. Select Core Plan Tier</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`rounded-xl border p-3.5 cursor-pointer transition text-left flex flex-col justify-between ${
                    selectedPlan.id === plan.id
                      ? 'border-[#E8472B] bg-[#E8472B]/5 shadow-xs ring-1 ring-[#E8472B]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{plan.name}</span>
                      <span className="font-mono font-bold text-xs text-[#E8472B]">AED {plan.basePrice}/mo</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{plan.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Team Size Slider */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900">2. Active Team Members (Seats)</h3>
              <span className="font-mono text-base font-extrabold text-slate-950">{userCount} Users</span>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={userCount}
              onChange={(e) => setUserCount(Number(e.target.value))}
              className="w-full accent-[#E8472B] h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>First 5 users included in base plan</span>
              <span>Additional users: AED 15/user/mo (vs $100–400 on GoFreight)</span>
            </div>
          </div>

          {/* 3. Addon Modules */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900">3. Business OS Modules</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {MODULE_ADDONS.map((mod) => {
                const checked = selectedModules.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition ${
                      checked ? 'border-blue-400 bg-blue-50/50 text-blue-950' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-semibold text-[11.5px]">{mod.name}</span>
                    <span className="font-mono font-bold text-[11px]">+AED {mod.price}/mo</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. AI Agents */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900">4. Department-Wide AI Copilots</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {AI_ADDONS.map((ai) => {
                const checked = selectedAI.includes(ai.id);
                return (
                  <div
                    key={ai.id}
                    onClick={() => toggleAI(ai.id)}
                    className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition ${
                      checked ? 'border-purple-400 bg-purple-50/50 text-purple-950' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-semibold text-[11.5px]">{ai.name}</span>
                    <span className="font-mono font-bold text-[11px]">+AED {ai.price}/mo</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right (1 col): Live Estimate Summary Card */}
        <div className="rounded-2xl border border-slate-800 bg-[#09192D] p-6 text-white shadow-xl flex flex-col justify-between space-y-6 h-fit sticky top-20">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-xs uppercase tracking-wider text-[#C98B53]">Live Quote Summary</span>
              <span className="rounded bg-[#E8472B] px-2 py-0.5 text-[10px] font-black uppercase text-white">
                {isAnnual ? 'Annual -20%' : 'Monthly Plan'}
              </span>
            </div>

            <div className="py-4 space-y-3 text-xs divide-y divide-slate-800/80">
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Plan: {selectedPlan.name}</span>
                <span className="font-mono font-bold">AED {basePrice}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">Users ({userCount} total, 5 free)</span>
                <span className="font-mono font-bold">AED {userOverageCost}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">Modules ({selectedModules.length} selected)</span>
                <span className="font-mono font-bold">AED {modulesCost}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">AI Agents ({selectedAI.length} copilots)</span>
                <span className="font-mono font-bold">AED {aiCost}</span>
              </div>
            </div>

            {/* Total Price Callout */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-4 mt-2 text-center">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Monthly Investment</div>
              <div className="text-3xl font-black text-[#E8472B] mt-1 font-mono">
                AED {finalMonthlyTotal.toLocaleString()}
                <span className="text-xs text-slate-400 font-normal"> / mo</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                {isAnnual ? `Billed annually at AED ${annualTotal.toLocaleString()}` : 'Billed month-to-month, cancel anytime'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => alert(`Custom quote for AED ${finalMonthlyTotal}/mo downloaded and sent to email.`)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#E8472B] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Download Detailed Quotation PDF</span>
            </button>
            <p className="text-[10.5px] text-slate-400 text-center leading-tight">
              Compare this with CargoWise ($1,500+ onboarding + per-shipment fees) or GoFreight ($3,000+/mo for 10 users).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
