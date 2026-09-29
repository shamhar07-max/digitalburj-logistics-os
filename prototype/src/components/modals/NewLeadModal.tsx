import React, { useState } from 'react';
import { X, TrendingUp, DollarSign, ArrowRight, User, Mail, Phone, Calendar, Ship, Plane, Truck } from 'lucide-react';
import { Deal, TransportMode } from '../../types';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDeal: (deal: Deal) => void;
}

export const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  onAddDeal,
}) => {
  const [customer, setCustomer] = useState('');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState(45000);
  const [lane, setLane] = useState('Shanghai (CNSHA) → Jebel Ali (AEJEA)');
  const [mode, setMode] = useState<TransportMode>('Sea FCL');
  const [priority, setPriority] = useState<'hot' | 'warm' | 'cold'>('hot');
  const [owner, setOwner] = useState('Sara Menon');
  const [closesDate, setClosesDate] = useState('In 10 days');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.trim() || !title.trim()) return;

    const newDeal: Deal = {
      id: `deal-${Date.now()}`,
      title: title.trim(),
      customer: customer.trim(),
      value: Number(value),
      stage: 'rfq',
      priority,
      owner,
      closesDate,
      lane,
      mode,
    };

    onAddDeal(newDeal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Log New Sales Lead / RFQ Inquiry
              </h2>
              <p className="text-xs text-slate-500">
                Record new freight opportunity from WhatsApp, email, or direct customer call.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer / Shipper Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Al Habtoor Motors LLC"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#E8472B]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Opportunity Title / Cargo Summary *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 5 × 40HC Auto Parts Import from Ningbo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#E8472B]/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estimated Deal Value (AED)
              </label>
              <input
                type="number"
                step={1000}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold font-mono text-slate-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Priority / Buying Urgency
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium focus:outline-hidden"
              >
                <option value="hot">🔥 Hot (Immediate booking this week)</option>
                <option value="warm">⚡ Warm (Quotes required within 48h)</option>
                <option value="cold">❄️ Cold (Budgetary quarterly inquiry)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Transport Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium focus:outline-hidden"
              >
                <option value="Sea FCL">Sea FCL (Full Container)</option>
                <option value="Sea LCL">Sea LCL (Shared Container)</option>
                <option value="Air">Air Freight</option>
                <option value="Road GCC">Road GCC Cross-Border</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Trade Lane (Origin → Destination)
              </label>
              <input
                type="text"
                value={lane}
                onChange={(e) => setLane(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assigned Sales Rep
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium focus:outline-hidden"
              >
                <option value="Sara Menon">Sara Menon (Key Accounts)</option>
                <option value="Ravi Nair">Ravi Nair (Commercial Lead)</option>
                <option value="Omar Khalifa">Omar Khalifa (Trade Rep)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Expected Decision Date
              </label>
              <input
                type="text"
                value={closesDate}
                onChange={(e) => setClosesDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95"
            >
              <span>Add to Sales Pipeline</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
