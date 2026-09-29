import React, { useState } from 'react';
import {
  X,
  Ship,
  Clock,
  FileText,
  ShieldAlert,
  Truck,
  DollarSign,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Share2,
  Download,
  Sparkles,
  Award,
  Fuel,
  Compass,
  Check,
} from 'lucide-react';
import { Shipment, RoleType } from '../../types';

interface ShipmentDetailModalProps {
  shipment: Shipment | null;
  onClose: () => void;
  currentRole: RoleType;
  onApproveAction?: (actionText: string) => void;
}

export const ShipmentDetailModal: React.FC<ShipmentDetailModalProps> = ({
  shipment,
  onClose,
  currentRole,
  onApproveAction,
}) => {
  const [activeTab, setActiveTab] = useState<
    'timeline' | 'cargo' | 'legs' | 'documents' | 'customs' | 'transport' | 'charges' | 'conversations' | 'carrier_recommendation'
  >('timeline');
  const [assignedCarrier, setAssignedCarrier] = useState<string>(shipment?.carrier || '');
  const [carrierAssignedSuccess, setCarrierAssignedSuccess] = useState<string | null>(null);

  if (!shipment) return null;

  const canSeeBuyCost = currentRole === 'owner' || currentRole === 'finance' || currentRole === 'manager';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#09192D] text-white">
              <Ship className="h-5 w-5 text-[#E8472B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-slate-950 text-lg">{shipment.jobNo}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    shipment.status === 'customs_hold'
                      ? 'bg-rose-100 text-rose-800'
                      : shipment.status === 'billing_ready'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {shipment.status.replace('_', ' ')}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    shipment.health === 'risk'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : shipment.health === 'warn'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  ● {shipment.health.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {shipment.customer} · {shipment.service} ({shipment.origin} → {shipment.destination})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert(`Public tracking link generated: https://db-track.ae/s/${shipment.jobNo}?token=exp98124`)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              title="Share public no-login tracking link"
            >
              <Share2 className="h-3.5 w-3.5 text-[#E8472B]" />
              <span>Share Tracking Link</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 border-b border-slate-100 bg-white px-6 py-2.5 text-xs divide-x divide-slate-100">
          <div className="px-2">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">ETA</div>
            <div className="font-bold text-slate-800">{shipment.eta}</div>
          </div>
          <div className="px-2">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Free Time Clock</div>
            <div className={`font-bold ${shipment.freeTimeEnds.includes('left') ? 'text-rose-600' : 'text-slate-800'}`}>
              {shipment.freeTimeEnds}
            </div>
          </div>
          <div className="px-2">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Sell Revenue</div>
            <div className="font-mono font-bold text-slate-900">AED {shipment.revenue.toLocaleString()}</div>
          </div>
          <div className="px-2">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Gross Margin</div>
            <div className="font-mono font-bold text-emerald-600">
              {canSeeBuyCost ? `${shipment.margin}% (AED ${(shipment.revenue - shipment.cost).toLocaleString()})` : '● Protected'}
            </div>
          </div>
          <div className="px-2">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Ops Lead</div>
            <div className="font-bold text-slate-800">{shipment.owner}</div>
          </div>
        </div>

        {/* Predictive Warning Banner (if any) */}
        {shipment.predictiveRisk && (
          <div className="flex items-start gap-2.5 bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-tight">
              <strong>Predictive Risk Flag:</strong> {shipment.predictiveRisk}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-6 gap-2 scrollbar-none">
          {[
            { id: 'timeline', label: 'Timeline & Milestones' },
            { id: 'cargo', label: 'Cargo Specs' },
            { id: 'legs', label: 'Multi-Legs' },
            { id: 'documents', label: 'Documents (OCR)' },
            { id: 'customs', label: 'Customs Desk' },
            { id: 'transport', label: 'Transport / Driver' },
            { id: 'carrier_recommendation', label: 'AI Carrier Match' },
            { id: 'charges', label: 'Job Costing Charges' },
            { id: 'conversations', label: 'WhatsApp Thread' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`py-2.5 px-3 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                activeTab === t.id
                  ? 'border-[#E8472B] text-[#E8472B] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Real-Time Milestone Chain</span>
                <span className="text-[11px] text-slate-400">Events synced from Dubai Trade & Carrier EDI</span>
              </div>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {shipment.milestones.map((m, idx) => (
                  <div key={m.id} className="relative">
                    <div
                      className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center ${
                        m.status === 'completed'
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : m.status === 'warning'
                          ? 'border-rose-500 bg-rose-500 text-white'
                          : m.status === 'in_progress'
                          ? 'border-blue-500 bg-blue-500 text-white ring-4 ring-blue-100'
                          : 'border-slate-300'
                      }`}
                    >
                      {m.status === 'completed' && <CheckCircle2 className="h-2.5 w-2.5" />}
                      {m.status === 'warning' && <AlertTriangle className="h-2.5 w-2.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <span>{m.title}</span>
                        <span className="text-[10px] text-slate-400">({m.timestamp})</span>
                      </div>
                      <div className="text-slate-500 text-[11.5px] mt-0.5">Location: {m.location}</div>
                      {m.notes && (
                        <div className="mt-1 rounded-md bg-rose-50 p-2 text-rose-800 text-[11px] font-medium border border-rose-100">
                          {m.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'cargo' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-slate-50/50">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">Transport Equipment</h4>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Container / Unit:</span>
                  <span className="font-mono font-bold text-slate-900">{shipment.containerOrAwb}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Seal Number:</span>
                  <span className="font-mono font-bold text-slate-900">{shipment.sealNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Weight & Packaging:</span>
                  <span className="font-bold text-slate-900">{shipment.piecesWeight}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Master Bill of Lading:</span>
                  <span className="font-mono font-bold text-slate-900">MAEU2291847</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-slate-50/50">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">Routing & Carrier</h4>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Ocean Carrier:</span>
                  <span className="font-bold text-slate-900">{shipment.carrier}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Vessel & Voyage:</span>
                  <span className="font-bold text-slate-900">{shipment.vesselFlight || 'Direct'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Discharge Terminal:</span>
                  <span className="font-bold text-slate-900">Jebel Ali Terminal 2 (AEJEA)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Incoterm:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">CIF Dubai</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Attached Shipping Documents & OCR AI Confidence Scores
                </span>
                <button className="flex items-center gap-1 rounded bg-[#E8472B] px-2.5 py-1 text-xs font-bold text-white">
                  <Upload className="h-3 w-3" />
                  <span>Upload Document</span>
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Document Name</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">OCR Confidence</th>
                      <th className="p-2.5">Source</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shipment.documents.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold text-slate-900">{d.name}</td>
                        <td className="p-2.5">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-600">
                            {d.type}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              d.status === 'verified'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.status === 'mismatch'
                                ? 'bg-rose-100 text-rose-800 font-extrabold'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {d.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {d.confidenceScore ? (
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono font-bold text-[10.5px] ${
                                d.confidenceScore >= 0.9
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {(d.confidenceScore * 100).toFixed(0)}% AI Score
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-500 capitalize">{d.source.replace('_', ' ')}</td>
                        <td className="p-2.5 text-right">
                          <button className="text-[#E8472B] font-bold hover:underline">View / Inspect</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'customs' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-rose-600" />
                    <span className="font-bold text-sm text-rose-950">Active Dubai Customs Hold Flag</span>
                  </div>
                  <span className="rounded bg-rose-200 px-2 py-0.5 font-bold text-[10px] text-rose-900">Signoff Required</span>
                </div>
                <p className="text-xs text-rose-900 leading-relaxed">
                  <strong>Reason:</strong> Certificate of Origin declared HS Code 8471.49 whereas commercial invoice specifies 8471.30 (Portable computer processing units). Duty exemption approval is currently stalled until an authorized manager signs off on the amended Chamber declaration.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      if (onApproveAction) onApproveAction('Customs Hold Signoff');
                      alert('Customs Hold released with manager electronic sign-off.');
                    }}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition"
                  >
                    Authorize & Sign Off Customs Release
                  </button>
                  <button className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800">
                    Contact Broker Al Noor (+971 4 881 9900)
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2">Document Checklist for UAE Clearance</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Commercial Invoice with TRN & Chamber Stamp', checked: true },
                    { label: 'Original Bill of Lading (Telex release verified)', checked: true },
                    { label: 'Packing List Matching Pallet Count (24 pallets)', checked: true },
                    { label: 'Original Chamber Certificate of Origin', checked: false },
                    { label: 'Dubai Customs Duty Exemption Approval', checked: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center text-white ${
                          item.checked ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        {item.checked && <CheckCircle2 className="h-3 w-3" />}
                      </div>
                      <span className={item.checked ? 'text-slate-800 font-medium' : 'text-slate-500 font-medium'}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'charges' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Job Costing Ledger Lines
                </span>
                {!canSeeBuyCost && (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                    Buy cost & margins protected for role: {currentRole}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Charge Code</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Payer</th>
                      {canSeeBuyCost && <th className="p-2.5 text-right">Carrier Buy (AED)</th>}
                      <th className="p-2.5 text-right">Customer Sell (AED)</th>
                      {canSeeBuyCost && <th className="p-2.5 text-right">Profit (AED)</th>}
                      {canSeeBuyCost && <th className="p-2.5 text-right">Margin %</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { code: 'FRT-SEA-IMP', desc: 'Ocean Freight Shenzhen to JEA (40HC)', payer: 'Customer', buy: 28400, sell: 36200 },
                      { code: 'THC-DEST', desc: 'Destination Terminal Handling Charge', payer: 'Customer', buy: 3800, sell: 4600 },
                      { code: 'DOC-FEE', desc: 'Electronic Delivery Order & Manifest', payer: 'Customer', buy: 450, sell: 700 },
                      { code: 'CUSTOMS-DEC', desc: 'Customs Clearance & Inspection Fee', payer: 'Customer', buy: 950, sell: 1200 },
                      { code: 'TRN-DELIVERY', desc: 'Inland Transport Jebel Ali to Al Quoz', payer: 'Customer', buy: 2600, sell: 3400 },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-slate-800">{row.code}</td>
                        <td className="p-2.5 text-slate-700">{row.desc}</td>
                        <td className="p-2.5 text-slate-500">{row.payer}</td>
                        {canSeeBuyCost && <td className="p-2.5 text-right font-mono">{row.buy.toLocaleString()}</td>}
                        <td className="p-2.5 text-right font-mono font-bold">{row.sell.toLocaleString()}</td>
                        {canSeeBuyCost && (
                          <td className="p-2.5 text-right font-mono text-emerald-600 font-bold">
                            {(row.sell - row.buy).toLocaleString()}
                          </td>
                        )}
                        {canSeeBuyCost && (
                          <td className="p-2.5 text-right font-mono text-emerald-600 font-bold">
                            {(((row.sell - row.buy) / row.sell) * 100).toFixed(1)}%
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="p-2.5 uppercase tracking-wider text-[10px] text-slate-500">
                        Job Totals
                      </td>
                      {canSeeBuyCost && <td className="p-2.5 text-right font-mono">AED 36,200</td>}
                      <td className="p-2.5 text-right font-mono font-black text-slate-950">AED 48,500</td>
                      {canSeeBuyCost && <td className="p-2.5 text-right font-mono text-emerald-700 font-black">AED 12,300</td>}
                      {canSeeBuyCost && <td className="p-2.5 text-right font-mono text-emerald-700 font-black">25.4%</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'conversations' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Unified WhatsApp & Customer Chat Thread
                </div>
                <div className="space-y-2">
                  <div className="flex flex-col items-start">
                    <div className="rounded-2xl rounded-bl-xs bg-white p-3 text-xs shadow-2xs border border-slate-200 text-slate-800 max-w-[80%]">
                      Hello Maya, could you update us on container MSKU-8842190? Free time at Jebel Ali expires soon!
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 px-1">Customer (Khalid) · 10:14 AM</span>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="rounded-2xl rounded-br-xs bg-[#E8472B] p-3 text-xs text-white shadow-2xs max-w-[80%]">
                      Good morning Khalid. Dubai Customs had flagged a minor HS mismatch on the COO. Our broker Al Noor has submitted the amended letter. We expect customs gate release by 14:00 today.
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 px-1">Maya Al Rashid (AI Drafted) · 10:16 AM</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex gap-2">
                  <input
                    type="text"
                    placeholder="Type WhatsApp response to customer..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden focus:border-[#E8472B]"
                  />
                  <button className="rounded-lg bg-[#E8472B] px-4 py-2 text-xs font-bold text-white">
                    Send via WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AI-Driven Carrier Recommendation Engine */}
          {activeTab === 'carrier_recommendation' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Top Engine Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-4 text-white shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E8472B] text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-extrabold text-sm text-white">
                      AI Carrier Recommendation & Compliance Engine
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9.5px] font-bold text-emerald-300">
                      Live Fuel Surcharge & Transit Performance
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Analyzing lane: <strong>{shipment.origin} ({shipment.originPortCode || 'POL'}) → {shipment.destination} ({shipment.destPortCode || 'POD'})</strong> under <strong>{shipment.mode}</strong> execution.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Currently Assigned</span>
                    <span className="font-mono text-xs font-bold text-amber-300">{assignedCarrier}</span>
                  </div>
                </div>
              </div>

              {carrierAssignedSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold">{carrierAssignedSuccess}</span>
                  </div>
                  <button onClick={() => setCarrierAssignedSuccess(null)} className="text-emerald-700 font-bold">✕</button>
                </div>
              )}

              {/* Dynamic Carrier Recommendations based on Mode */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Ranked Carrier Options ({shipment.mode})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Bunker fuel index benchmark updated 2 hrs ago
                  </span>
                </div>

                {/* SEA FREIGHT MODE */}
                {(shipment.mode === 'Sea FCL' || shipment.mode === 'Sea LCL') && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Carrier 1: Maersk Line */}
                    <div className="rounded-2xl border-2 border-emerald-500/80 bg-white p-4 shadow-xs relative flex flex-col justify-between space-y-3">
                      <div className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-white shadow-xs">
                        ★ Top AI Recommended
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">Maersk Line</strong>
                          <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Score 98.4/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Service: AE-ME1 Direct Express</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Base Freight:</span>
                          <span className="font-mono font-bold">AED 3,850</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge (BAF):</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">+14.2% (AED 546)</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Landed Buy:</span>
                          <span className="font-mono text-emerald-700">AED 4,396</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">17 days (96.4% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Demurrage Free Days:</span>
                          <strong className="text-slate-900">14 Days at Jebel Ali</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Customs EDI Manifest:</span>
                          <span className="text-emerald-700 font-bold">✓ Direct Mirsal II API</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('Maersk Line (AE-ME1)');
                          setCarrierAssignedSuccess('Maersk Line assigned! Fuel surcharge locked at 14.2% with 14 port free days.');
                        }}
                        className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                      >
                        Assign Maersk Line
                      </button>
                    </div>

                    {/* Carrier 2: CMA CGM */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">CMA CGM</strong>
                          <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            Score 94.1/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Service: FAL3 Asia-Gulf Express</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Base Freight:</span>
                          <span className="font-mono font-bold">AED 3,600</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge (BAF):</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">+15.6% (AED 561)</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Landed Buy:</span>
                          <span className="font-mono text-blue-700">AED 4,161</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">19 days (90.8% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Demurrage Free Days:</span>
                          <strong className="text-slate-900">10 Days at Jebel Ali</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Customs EDI Manifest:</span>
                          <span className="text-emerald-700 font-bold">✓ Direct Mirsal II API</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('CMA CGM (FAL3)');
                          setCarrierAssignedSuccess('CMA CGM assigned! Lowest base freight selected.');
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Assign CMA CGM
                      </button>
                    </div>

                    {/* Carrier 3: Hapag-Lloyd */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">Hapag-Lloyd</strong>
                          <span className="font-mono font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                            Score 95.0/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Service: AGX Arabian Gulf Express</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Base Freight:</span>
                          <span className="font-mono font-bold">AED 4,050</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge (BAF):</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">+13.8% (AED 558)</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Landed Buy:</span>
                          <span className="font-mono text-purple-700">AED 4,608</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">16 days (97.0% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Demurrage Free Days:</span>
                          <strong className="text-slate-900">14 Days at Jebel Ali</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Customs EDI Manifest:</span>
                          <span className="text-emerald-700 font-bold">✓ Direct Mirsal II API</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('Hapag-Lloyd (AGX)');
                          setCarrierAssignedSuccess('Hapag-Lloyd assigned! Fastest transit time (16 days).');
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Assign Hapag-Lloyd
                      </button>
                    </div>
                  </div>
                )}

                {/* AIRFREIGHT MODE */}
                {shipment.mode === 'Air' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Carrier 1: Emirates SkyCargo */}
                    <div className="rounded-2xl border-2 border-emerald-500/80 bg-white p-4 shadow-xs relative flex flex-col justify-between space-y-3">
                      <div className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-white shadow-xs">
                        ★ Top AI Recommended
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">Emirates SkyCargo</strong>
                          <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Score 98.8/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Direct Boeing 777-F / A380 Bellyhold</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Base Air Rate:</span>
                          <span className="font-mono font-bold">AED 14.20 / kg</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge (FSC):</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">AED 2.80 / kg</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Landed Rate:</span>
                          <span className="font-mono text-emerald-700">AED 17.00 / kg</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">1.5 days (98.7% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Cold-Chain Pharma:</span>
                          <strong className="text-slate-900">Pharma Cool (+15°C to +25°C)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Airport Clearance:</span>
                          <span className="text-emerald-700 font-bold">✓ DXB / DWC Fast Track</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('Emirates SkyCargo (EK-Cargo)');
                          setCarrierAssignedSuccess('Emirates SkyCargo assigned! 98.7% on-time performance confirmed.');
                        }}
                        className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                      >
                        Assign Emirates SkyCargo
                      </button>
                    </div>

                    {/* Carrier 2: Qatar Airways Cargo */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">Qatar Airways Cargo</strong>
                          <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            Score 93.5/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Hub Connect via Hamad Intl</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Base Air Rate:</span>
                          <span className="font-mono font-bold">AED 12.80 / kg</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge (FSC):</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">AED 3.10 / kg</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Landed Rate:</span>
                          <span className="font-mono text-blue-700">AED 15.90 / kg</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">2.0 days (94.2% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Airport Clearance:</span>
                          <span className="text-emerald-700 font-bold">✓ DXB Gateway</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('Qatar Airways Cargo (QR-Cargo)');
                          setCarrierAssignedSuccess('Qatar Airways Cargo assigned! Most economical air rate.');
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Assign Qatar Cargo
                      </button>
                    </div>

                    {/* Carrier 3: flydubai Cargo */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">flydubai Cargo</strong>
                          <span className="font-mono font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                            Score 91.0/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Regional GCC Dedicated Bellyhold</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Base Air Rate:</span>
                          <span className="font-mono font-bold">AED 11.90 / kg</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge (FSC):</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">AED 2.60 / kg</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Landed Rate:</span>
                          <span className="font-mono text-purple-700">AED 14.50 / kg</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">1.0 day (92.0% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Airport Clearance:</span>
                          <span className="text-emerald-700 font-bold">✓ DXB Terminal 2</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('flydubai Cargo (FZ-Cargo)');
                          setCarrierAssignedSuccess('flydubai Cargo assigned! Same-day regional GCC transfer.');
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Assign flydubai Cargo
                      </button>
                    </div>
                  </div>
                )}

                {/* ROAD GCC MODE */}
                {(shipment.mode === 'Road GCC' || shipment.mode === 'Rail') && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Carrier 1: DigitalBurj Internal Fleet */}
                    <div className="rounded-2xl border-2 border-emerald-500/80 bg-white p-4 shadow-xs relative flex flex-col justify-between space-y-3">
                      <div className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-white shadow-xs">
                        ★ Top AI Recommended
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">DigitalBurj Internal Fleet</strong>
                          <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Score 99.2/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Mercedes Actros 6x4 Heavy Lowbed</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Internal Haul Rate:</span>
                          <span className="font-mono font-bold">AED 2,800</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge:</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">+8.5% (AED 238)</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Fleet Cost:</span>
                          <span className="font-mono text-emerald-700">AED 3,038</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">12 hours (99.4% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>GPS Telematics:</span>
                          <strong className="text-emerald-700">✓ Live Continuous Tracking</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Statutory Compliance:</span>
                          <span className="text-emerald-700 font-bold">✓ Mulkiya & Civil Defense</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('DigitalBurj Fleet (Actros 3340)');
                          setCarrierAssignedSuccess('Internal Fleet assigned! Asset utilization maximized.');
                        }}
                        className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                      >
                        Assign Internal Fleet
                      </button>
                    </div>

                    {/* Carrier 2: Al Faris Heavy Transport */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">Al Faris Heavy Haulage</strong>
                          <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            Score 94.0/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Multi-Axle Heavy Lowbed Trailer</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Spot Haul Rate:</span>
                          <span className="font-mono font-bold">AED 3,100</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge:</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">+9.2% (AED 285)</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Cost:</span>
                          <span className="font-mono text-blue-700">AED 3,385</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">14 hours (95.8% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Border Clearance:</span>
                          <span className="text-emerald-700 font-bold">✓ Khatmat Malaha Fast Track</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('Al Faris Heavy Transport');
                          setCarrierAssignedSuccess('Al Faris Heavy Transport assigned.');
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Assign Al Faris
                      </button>
                    </div>

                    {/* Carrier 3: Oman Overland Transit */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-black text-slate-900">Oman Overland Transit</strong>
                          <span className="font-mono font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                            Score 89.5/100
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">Cross-Border GCC Hauler</div>
                      </div>

                      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Spot Haul Rate:</span>
                          <span className="font-mono font-bold">AED 2,650</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Fuel className="h-3 w-3 text-amber-600" />
                            <span>Fuel Surcharge:</span>
                          </span>
                          <span className="font-mono font-bold text-amber-700">+10.5% (AED 278)</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                          <span>Total Cost:</span>
                          <span className="font-mono text-purple-700">AED 2,928</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Historical Transit Time:</span>
                          <strong className="text-slate-900">18 hours (91.2% on-time)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Border Clearance:</span>
                          <span className="text-slate-600 font-bold">Standard Queue</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setAssignedCarrier('Oman Overland Transit');
                          setCarrierAssignedSuccess('Oman Overland Transit assigned.');
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Assign Oman Transit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5">
          <span className="text-xs text-slate-500">Job ID: {shipment.id} · Branch: Dubai HQ</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Close Shipment Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
