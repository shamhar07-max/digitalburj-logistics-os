import React, { useState } from 'react';
import { X, Calculator, AlertTriangle, CheckCircle, FileText, Send, Sparkles } from 'lucide-react';
import { Quote, TransportMode } from '../../types';

interface NewQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuote: (newQuote: Quote) => void;
}

export const NewQuoteModal: React.FC<NewQuoteModalProps> = ({ isOpen, onClose, onAddQuote }) => {
  const [customer, setCustomer] = useState('Al Faris Trading LLC');
  const [lane, setLane] = useState('Jebel Ali (AEJEA) → Rotterdam (NLRTM)');
  const [mode, setMode] = useState<TransportMode>('Sea FCL');
  const [equipment, setEquipment] = useState('1 × 40HC');
  const [buyCost, setBuyCost] = useState(28400);
  const [sellPrice, setSellPrice] = useState(36200);
  const [sourceChannel, setSourceChannel] = useState<'WhatsApp' | 'Email' | 'Portal' | 'Direct Call'>('WhatsApp');

  if (!isOpen) return null;

  const marginFloor = 18.0;
  const currentMargin = sellPrice > 0 ? Number((((sellPrice - buyCost) / sellPrice) * 100).toFixed(1)) : 0;
  const isBelowFloor = currentMargin < marginFloor;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newQuoteObj: Quote = {
      id: `q-${Date.now()}`,
      quoteNo: `QT-${Math.floor(2385 + Math.random() * 50)}`,
      customer,
      lane,
      mode,
      validUntil: '15 Oct 2026',
      equipment,
      buyCost: Number(buyCost),
      sellPrice: Number(sellPrice),
      marginPercent: currentMargin,
      marginFloorPercent: marginFloor,
      status: isBelowFloor ? 'needs_approval' : 'approved',
      owner: 'Sara Menon',
      version: 'v1.0',
      sourceChannel,
      comparableHistory: {
        avgMarginOnLane: 22.4,
        similarQuotesCount: 18,
        winRatePercent: 68,
      },
    };

    onAddQuote(newQuoteObj);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A2A2B] text-white">
              <FileText className="h-5 w-5 text-[#E8472B]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Generate Freight Quotation</h3>
              <p className="text-xs text-slate-500">Includes real-time Margin Coach historical comparisons</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer</label>
              <select
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              >
                <option>Al Faris Trading LLC</option>
                <option>Nexa Pharma FZE</option>
                <option>Emirates Steel Industries PJSC</option>
                <option>Zayed Foods LLC</option>
                <option>Gulf Cement Industries</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inbound Channel</label>
              <select
                value={sourceChannel}
                onChange={(e) => setSourceChannel(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              >
                <option value="WhatsApp">WhatsApp Message</option>
                <option value="Email">Customer Email</option>
                <option value="Portal">Customer Portal</option>
                <option value="Direct Call">Direct Phone Call</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Lane (Origin → Destination)</label>
              <input
                type="text"
                value={lane}
                onChange={(e) => setLane(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as TransportMode)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              >
                <option value="Sea FCL">Sea FCL</option>
                <option value="Sea LCL">Sea LCL</option>
                <option value="Air">Air Express</option>
                <option value="Road GCC">Road GCC Cross-border</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Equipment / Unit</label>
              <input
                type="text"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Carrier Buy Cost (AED)</label>
              <input
                type="number"
                value={buyCost}
                onChange={(e) => setBuyCost(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer Sell Price (AED)</label>
              <input
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Margin Coach Component */}
          <div className={`rounded-xl border p-3.5 text-xs transition ${isBelowFloor ? 'border-amber-300 bg-amber-50/80 text-amber-950' : 'border-emerald-200 bg-emerald-50/60 text-emerald-950'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                {isBelowFloor ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle className="h-4 w-4 text-emerald-600" />}
                <span>Margin Coach Analysis: {currentMargin}% Gross Margin</span>
              </div>
              <span className="font-mono font-bold text-[11px]">Floor Target: {marginFloor}%</span>
            </div>

            <p className="text-[11.5px] leading-relaxed">
              {isBelowFloor ? (
                <>
                  <strong>Guardrail Alert:</strong> Proposed margin ({currentMargin}%) is below the policy floor ({marginFloor}%).
                  Historical benchmark: On this lane, 21 past quotes averaged <strong>22.4% margin</strong> with a <strong>68% win rate</strong>.
                  Submitting will request a one-click approval from the Logistics Manager without halting the workflow.
                </>
              ) : (
                <>
                  <strong>Healthy Margin:</strong> Rate yields AED {(sellPrice - buyCost).toLocaleString()} profit per unit. Competitor index predicts high win probability against market standard.
                </>
              )}
            </p>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-[#E8472B] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isBelowFloor ? 'Submit for Margin Approval' : 'Create & Send Quote'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
