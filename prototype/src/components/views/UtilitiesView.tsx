import React, { useState } from 'react';
import {
  Calculator,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Scale,
  FileCheck2,
  Box,
  Ship,
  Plane,
  Truck,
  RotateCcw,
  CheckCircle2,
  Check,
  Layers,
  Sparkles,
  ArrowRight,
  Download,
} from 'lucide-react';
import { CustomsDepositRefund } from '../../types';
import { INITIAL_CUSTOMS_DEPOSITS } from '../../data/mockData';

export const UtilitiesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'volumetric' | 'demurrage' | 'deposits' | 'inspection'>('volumetric');

  // Tool 1: Volumetric Calculator State
  const [lengthCm, setLengthCm] = useState<number>(120);
  const [widthCm, setWidthCm] = useState<number>(80);
  const [heightCm, setHeightCm] = useState<number>(160);
  const [packagesCount, setPackagesCount] = useState<number>(4);
  const [grossWeightKg, setGrossWeightKg] = useState<number>(480);

  // Calculations
  const singleCbm = (lengthCm * widthCm * heightCm) / 1000000;
  const totalCbm = Math.round(singleCbm * packagesCount * 1000) / 1000;
  const airVolumetricWeightIata = Math.round((totalCbm * 167) * 10) / 10; // 1 CBM = 167 kg (1:6000)
  const airVolumetricWeightCourier = Math.round((totalCbm * 200) * 10) / 10; // 1 CBM = 200 kg (1:5000)
  const roadGccChargeable = Math.round((totalCbm * 333) * 10) / 10; // 1 CBM = 333 kg (1:3000)
  const seaLclWm = Math.max(totalCbm, grossWeightKg / 1000); // 1 CBM = 1000 kg

  const airChargeable = Math.max(grossWeightKg, airVolumetricWeightIata);
  const isAirVolumetric = airVolumetricWeightIata > grossWeightKg;

  // Tool 2: Demurrage Radar Containers
  const demurrageTrackers = [
    {
      containerNo: 'MSKU-8842190',
      jobNo: 'DB-1048',
      terminal: 'DP World Jebel Ali Terminal 2',
      vesselArrival: '26 Sep 2026',
      totalFreeDays: 14,
      daysElapsed: 4,
      daysRemaining: 10,
      dailyRateAfterFree: 320,
      status: 'safe',
    },
    {
      containerNo: 'TGHU-9921441',
      jobNo: 'DB-1041',
      terminal: 'Khalifa Port Abu Dhabi',
      vesselArrival: '23 Sep 2026',
      totalFreeDays: 7,
      daysElapsed: 6,
      daysRemaining: 1,
      dailyRateAfterFree: 180,
      status: 'urgent',
    },
    {
      containerNo: 'CMAU-4401920',
      jobNo: 'DB-1039',
      terminal: 'Port Khalid Sharjah',
      vesselArrival: '18 Sep 2026',
      totalFreeDays: 7,
      daysElapsed: 11,
      daysRemaining: -4, // 4 days over free time!
      dailyRateAfterFree: 350,
      status: 'incurring_charges',
    },
  ];

  // Tool 3: Customs Deposits State
  const [deposits, setDeposits] = useState<CustomsDepositRefund[]>(INITIAL_CUSTOMS_DEPOSITS);

  // Tool 4: Container Gate EIR Inspection Checklist
  const [eirChecklist, setEirChecklist] = useState([
    { label: 'Container Floor Wood Intact & Clean (No oil stains)', checked: true },
    { label: 'Light-Leak Test: Internal Inspection (No pinholes or roof gaps)', checked: true },
    { label: 'High Security Bottle / Bolt Seal Verified (Seal # MSC-990142)', checked: true },
    { label: 'Door Gaskets & Lock Rods Operational & Lubricated', checked: true },
    { label: 'No Hazardous Residue or Odor from Previous Cargo', checked: true },
    { label: 'CSC Safety Plate & Max Payload Weight Verified', checked: true },
  ]);

  const handleToggleCheck = (index: number) => {
    const updated = [...eirChecklist];
    updated[index].checked = !updated[index].checked;
    setEirChecklist(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Operations · Daily Toolkit & Compliance Radars
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800">
              Freight Utilities
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Freight Operations & Miscellaneous Tools
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Essential operational utilities: Air/Sea volumetric weight calculators, port demurrage free-time radar, Dubai Customs deposit refund tracker, and EIR equipment inspection.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
        {[
          { id: 'volumetric', label: 'Volumetric & CBM Calculator', icon: <Scale className="h-4 w-4" /> },
          { id: 'demurrage', label: 'Demurrage & Free Time Radar', icon: <Clock className="h-4 w-4" /> },
          { id: 'deposits', label: 'Customs Duty Deposit Refunds', icon: <FileCheck2 className="h-4 w-4" /> },
          { id: 'inspection', label: 'Container EIR & Seal Checklist', icon: <ShieldCheck className="h-4 w-4" /> },
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

      {/* TOOL 1: Volumetric & CBM Calculator */}
      {activeTab === 'volumetric' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900">
                Cargo Package Dimensions & Weight
              </h3>
              <p className="text-xs text-slate-500">
                Enter pallet or carton measurements in centimeters (cm).
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Length (cm)</label>
                  <input
                    type="number"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Width (cm)</label>
                  <input
                    type="number"
                    value={widthCm}
                    onChange={(e) => setWidthCm(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Packages / Pallets</label>
                  <input
                    type="number"
                    value={packagesCount}
                    onChange={(e) => setPackagesCount(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Actual Gross Weight (kg)</label>
                  <input
                    type="number"
                    value={grossWeightKg}
                    onChange={(e) => setGrossWeightKg(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLengthCm(120);
                    setWidthCm(80);
                    setHeightCm(160);
                    setPackagesCount(4);
                    setGrossWeightKg(480);
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset to Standard Euro Pallet (120x80x160)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Comparison Grid */}
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900">
                Calculated Volume & Multi-Modal Chargeable Weights
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                  isAirVolumetric
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-blue-100 text-blue-900'
                }`}
              >
                {isAirVolumetric ? 'VOLUMETRIC CARGO (LIGHT & BULKY)' : 'DENSE CARGO (CHARGED BY GROSS KG)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Total Volume */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Cubic Volume</span>
                <div className="text-3xl font-black font-mono text-slate-950">
                  {totalCbm} <span className="text-lg font-bold text-slate-500">CBM (m³)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {packagesCount} package(s) × {singleCbm.toFixed(3)} CBM each
                </p>
              </div>

              {/* Air Chargeable */}
              <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-sky-800">Airfreight Chargeable Weight</span>
                  <Plane className="h-4 w-4 text-sky-600" />
                </div>
                <div className="text-3xl font-black font-mono text-sky-950">
                  {airChargeable} <span className="text-lg font-bold text-sky-700">kg</span>
                </div>
                <p className="text-[11px] text-sky-800">
                  IATA 1:6000 ratio = {airVolumetricWeightIata} kg vs {grossWeightKg} kg actual
                </p>
              </div>

              {/* Sea Freight LCL */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-blue-800">Sea LCL Freight Weight/Measure</span>
                  <Ship className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black font-mono text-blue-950">
                  {seaLclWm} <span className="text-sm font-bold text-blue-700">Revenue Tons (W/M)</span>
                </div>
                <p className="text-[11px] text-blue-700">
                  Higher of volume ({totalCbm} m³) or metric tons ({(grossWeightKg / 1000).toFixed(2)} MT)
                </p>
              </div>

              {/* Road GCC Haulage */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">GCC Road Haulage Chargeable</span>
                  <Truck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-950">
                  {Math.max(grossWeightKg, roadGccChargeable)} <span className="text-sm font-bold text-emerald-700">kg</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  GCC road ratio (1:3000) = {roadGccChargeable} kg
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOOL 2: Demurrage & Free Time Radar */}
      {activeTab === 'demurrage' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Live UAE Port Container Demurrage Radar
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time countdown of container free days at Jebel Ali, Khalifa Port, and Port Khalid to eliminate penalty fees.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                DP World Terminal Connected
              </span>
            </div>

            <div className="space-y-3">
              {demurrageTrackers.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl border p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    item.status === 'incurring_charges'
                      ? 'border-rose-300 bg-rose-50/40'
                      : item.status === 'urgent'
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-slate-900">
                        {item.containerNo}
                      </span>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {item.jobNo}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          item.status === 'incurring_charges'
                            ? 'bg-rose-600 text-white animate-pulse'
                            : item.status === 'urgent'
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.status === 'incurring_charges'
                          ? 'DEMURRAGE INCURRING'
                          : item.status === 'urgent'
                          ? 'EXPIRING IN 24H'
                          : 'SAFE FREE PERIOD'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 font-medium">
                      {item.terminal} · Vessel Discharged: {item.vesselArrival}
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Standard Port Rate: AED {item.dailyRateAfterFree}/day past free days
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-bold uppercase text-slate-400">
                        Free Time Status
                      </div>
                      <div className={`text-lg font-black font-mono ${
                        item.daysRemaining < 0
                          ? 'text-rose-700'
                          : item.daysRemaining <= 1
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        {item.daysRemaining < 0
                          ? `${Math.abs(item.daysRemaining)} Days Overdue (-AED ${Math.abs(item.daysRemaining) * item.dailyRateAfterFree})`
                          : `${item.daysRemaining} of ${item.totalFreeDays} Days Left`}
                      </div>
                    </div>

                    <button
                      onClick={() => alert(`Priority customs release request sent to broker for container ${item.containerNo}`)}
                      className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-[#E8472B] transition"
                    >
                      Expedite Gate-Out
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOOL 3: Customs Duty Deposit Refunds */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Dubai Customs Standing Deposits & Re-Export Refunds
                </h3>
                <p className="text-xs text-slate-500">
                  Track 5% customs guarantee deposits paid on Transit and Re-Export shipments until exit certificates are verified for cash refund.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Refund Total</span>
                <span className="text-lg font-black font-mono text-emerald-700">
                  AED {deposits.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                  <tr>
                    <th className="p-3.5">Declaration Ref</th>
                    <th className="p-3.5">Shipment Job</th>
                    <th className="p-3.5">Deposit Type</th>
                    <th className="p-3.5">Deposit Amount</th>
                    <th className="p-3.5">Exit Proof Status</th>
                    <th className="p-3.5">Refund Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-bold text-slate-900">{dep.declarationRef}</td>
                      <td className="p-3.5 font-mono font-bold text-blue-700">{dep.jobNo}</td>
                      <td className="p-3.5 font-semibold text-slate-800">{dep.depositType}</td>
                      <td className="p-3.5 font-mono font-black text-slate-900">AED {dep.amount.toLocaleString()}</td>
                      <td className="p-3.5">
                        {dep.proofSubmitted ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Exit Bill Attached</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-700">
                            Awaiting Exit Certificate
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          dep.refundStatus === 'refund_approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : dep.refundStatus === 'submitted_to_customs'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {dep.refundStatus.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => alert(`Refund claim voucher for ${dep.declarationRef} generated for Dubai Customs Financial Dept.`)}
                          className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                        >
                          Claim Refund
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TOOL 4: Container Seal & EIR Inspection Checklist */}
      {activeTab === 'inspection' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Container Seal & Equipment Interchange Receipt (EIR) Checklist
              </h3>
              <p className="text-xs text-slate-500">
                Mandatory physical condition inspection prior to container gate-out at terminal.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
              Container: MSKU-8842190
            </span>
          </div>

          <div className="space-y-2.5">
            {eirChecklist.map((item, idx) => (
              <label
                key={idx}
                className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition text-xs font-medium text-slate-800"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggleCheck(idx)}
                  className="h-4 w-4 rounded border-slate-300 text-[#E8472B] focus:ring-[#E8472B]"
                />
                <span className={item.checked ? 'text-slate-900 font-bold' : 'text-slate-500'}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => alert('Official Equipment Interchange Receipt (EIR) certified and signed by inspector.')}
              className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
            >
              <Check className="h-4 w-4" />
              <span>Certify EIR & Issue Gate Out Pass</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
