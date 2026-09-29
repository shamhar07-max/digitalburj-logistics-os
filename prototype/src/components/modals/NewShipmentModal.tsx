import React, { useState } from 'react';
import { X, Ship, Plane, Truck, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { Shipment, TransportMode } from '../../types';

interface NewShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddShipment: (newShipment: Shipment) => void;
  isSimpleMode: boolean;
  onToggleMode: () => void;
}

export const NewShipmentModal: React.FC<NewShipmentModalProps> = ({
  isOpen,
  onClose,
  onAddShipment,
  isSimpleMode,
  onToggleMode,
}) => {
  const [customer, setCustomer] = useState('Al Faris Trading LLC');
  const [service, setService] = useState('Sea FCL Import');
  const [mode, setMode] = useState<TransportMode>('Sea FCL');
  const [origin, setOrigin] = useState('Shenzhen (CNSZX)');
  const [destination, setDestination] = useState('Jebel Ali Port, Dubai (AEJEA)');
  const [revenue, setRevenue] = useState(38500);
  const [cost, setCost] = useState(29200);

  // Full Mode Fields
  const [containerNo, setContainerNo] = useState('MSKU-7712904');
  const [vesselFlight, setVesselFlight] = useState('CMA CGM VOLTAIRE / 112E');
  const [sealNo, setSealNo] = useState('SL-449102');
  const [incoterm, setIncoterm] = useState('CIF Dubai');
  const [commodity, setCommodity] = useState('Automotive spare parts & sensors');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const marginCalc = Number((((revenue - cost) / revenue) * 100).toFixed(1));
    const randomId = `DB-${Math.floor(1053 + Math.random() * 200)}`;

    const newShip: Shipment = {
      id: `job-${Date.now()}`,
      jobNo: randomId,
      customer,
      shipper: 'Overseas Supplier Export Ltd',
      consignee: customer,
      service,
      mode,
      direction: 'Import',
      origin,
      originPortCode: origin.includes('(') ? origin.split('(')[1].replace(')', '') : 'CNSZX',
      destination,
      destPortCode: destination.includes('(') ? destination.split('(')[1].replace(')', '') : 'AEJEA',
      status: 'booked',
      health: 'ok',
      eta: 'In 12 days',
      etd: 'Today',
      freeTimeEnds: '5 days from discharge',
      carrier: mode.includes('Sea') ? 'Maersk Line' : mode === 'Air' ? 'Emirates SkyCargo' : 'Falcon Transport',
      vesselFlight,
      containerOrAwb: containerNo,
      sealNo,
      piecesWeight: '1 × 40HC · 19,400 kg',
      revenue: Number(revenue),
      cost: Number(cost),
      margin: marginCalc,
      owner: 'Maya Al Rashid',
      progressPercent: 15,
      branch: 'DXB',
      milestones: [
        { id: `m-${Date.now()}`, title: 'Shipment Created & Carrier Booked', location: origin, timestamp: 'Just now', status: 'completed', verifiedBy: 'Staff' },
        { id: `m-${Date.now() + 1}`, title: 'Container Gate-In & Customs Export', location: origin, timestamp: 'Scheduled in 24h', status: 'pending' },
        { id: `m-${Date.now() + 2}`, title: 'Vessel Departure', location: origin, timestamp: 'Pending', status: 'pending' },
        { id: `m-${Date.now() + 3}`, title: 'Jebel Ali Import Clearance', location: destination, timestamp: 'Pending', status: 'pending' },
      ],
      documents: [
        { id: `d-${Date.now()}`, name: 'Booking Confirmation.pdf', type: 'BL', status: 'verified', version: 'v1.0', uploadedAt: 'Today', confidenceScore: 1.0, source: 'staff' },
      ],
    };

    onAddShipment(newShip);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-lg">Book New Shipment</h3>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${isSimpleMode ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                {isSimpleMode ? 'Simple 5-Field Mode' : 'Full Enterprise Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-500">Fast 15-minute time-to-first-shipment design</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMode}
              className="text-xs font-semibold text-slate-600 underline hover:text-[#E8472B] transition"
            >
              Switch to {isSimpleMode ? 'Full Enterprise Mode' : 'Simple Mode'}
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Transport Mode</label>
            <div className="grid grid-cols-4 gap-2">
              {(['Sea FCL', 'Sea LCL', 'Air', 'Road GCC'] as TransportMode[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setService(`${m} Import`);
                  }}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-xs font-bold transition ${
                    mode === m ? 'border-[#E8472B] bg-[#E8472B]/10 text-[#E8472B] shadow-xs' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m.includes('Sea') ? <Ship className="h-4 w-4 mb-1" /> : m === 'Air' ? <Plane className="h-4 w-4 mb-1" /> : <Truck className="h-4 w-4 mb-1" />}
                  <span>{m}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Simple 5-Field Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Consignee</label>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Service Level</label>
              <input
                type="text"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Port / Origin</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Port / Destination</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sell Revenue (AED)</label>
              <input
                type="number"
                value={revenue}
                onChange={(e) => setRevenue(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Buy Cost (AED)</label>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Full Mode Extra Fields */}
          {!isSimpleMode && (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#C98B53]">Advanced Enterprise Details</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Container / AWB #</label>
                  <input
                    type="text"
                    value={containerNo}
                    onChange={(e) => setContainerNo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vessel / Voyage / Flight</label>
                  <input
                    type="text"
                    value={vesselFlight}
                    onChange={(e) => setVesselFlight(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Seal Number</label>
                  <input
                    type="text"
                    value={sealNo}
                    onChange={(e) => setSealNo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Incoterm 2020</label>
                  <select
                    value={incoterm}
                    onChange={(e) => setIncoterm(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
                  >
                    <option>CIF Dubai (Cost, Insurance & Freight)</option>
                    <option>FOB (Free on Board)</option>
                    <option>EXW (Ex Works)</option>
                    <option>DAP (Delivered at Place)</option>
                    <option>DDP (Delivered Duty Paid)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Commodity Classification</label>
                  <input
                    type="text"
                    value={commodity}
                    onChange={(e) => setCommodity(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-[#E8472B] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Margin Preview Pill */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
            <span className="font-semibold text-slate-600">Expected Gross Profit:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900">AED {(revenue - cost).toLocaleString()}</span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                {(((revenue - cost) / revenue) * 100).toFixed(1)}% Margin
              </span>
            </div>
          </div>

          {/* Submit Buttons */}
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
              <Check className="h-4 w-4" />
              <span>Confirm & Dispatch Shipment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
