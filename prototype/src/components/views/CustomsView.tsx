import React, { useState } from 'react';
import {
  FileCheck2,
  Search,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Building,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { CustomsDeclaration } from '../../types';
import { INITIAL_CUSTOMS } from '../../data/mockData';

interface CustomsViewProps {
  onNavigateToCompliance?: () => void;
}

export const CustomsView: React.FC<CustomsViewProps> = ({ onNavigateToCompliance }) => {
  const [declarations, setDeclarations] = useState<CustomsDeclaration[]>(INITIAL_CUSTOMS);
  const [searchHs, setSearchHs] = useState('');
  const [selectedCase, setSelectedCase] = useState<CustomsDeclaration>(declarations[0]);

  const handleSignoff = (caseId: string) => {
    setDeclarations((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              status: 'cleared',
              managerSignoffRequired: false,
              managerSignedBy: 'Maya Al Rashid (Operations Lead)',
              checklist: c.checklist.map((item) => ({ ...item, complete: true })),
            }
          : c
      )
    );
    alert('Manager Signoff approved. Customs declaration cleared for gate-out.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Clearance Desk</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
              Dubai Customs & Mirsal II
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Customs Declarations & Holds</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Declaration status, auto-generated checklists, HS code AI lookup, and mandatory manager signoff on hold release.
          </p>
        </div>

        {onNavigateToCompliance && (
          <button
            onClick={onNavigateToCompliance}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 shadow-2xs"
          >
            <span>Full Compliance & Regulatory Audit →</span>
          </button>
        )}
      </div>

      {/* Grid: Cases and HS AI Lookup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Active Customs Cases */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-800">
              <span>Active Customs Declarations ({declarations.length})</span>
              <span className="text-[10px] text-slate-400">Synced with Dubai Trade / Mirsal II</span>
            </div>

            <div className="divide-y divide-slate-100">
              {declarations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCase(c)}
                  className={`p-4 transition cursor-pointer ${
                    selectedCase.id === c.id ? 'bg-slate-50 border-l-4 border-l-[#E8472B]' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 font-mono font-bold text-xs text-slate-900">
                      <span>{c.caseNo}</span>
                      <span className="text-slate-400">· Ref: {c.declarationRef}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        c.status === 'hold' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {c.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{c.regime}</span>
                      <span className="text-slate-400"> · Port: {c.port} · Broker: {c.brokerName}</span>
                    </div>
                    <span className="font-mono text-slate-600 font-bold">HS {c.hsCode}</span>
                  </div>

                  {c.holdReason && (
                    <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
                      <div className="font-bold flex items-center gap-1.5 mb-0.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                        <span>Hold Reason:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">{c.holdReason}</p>
                      {c.managerSignoffRequired && (
                        <div className="mt-2 flex items-center justify-between border-t border-rose-200/60 pt-2">
                          <span className="text-[10px] font-bold text-rose-700">Manager Electronic Sign-Off Required</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSignoff(c.id);
                            }}
                            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700 transition"
                          >
                            Sign Off & Release Hold
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right (1 col): Selected Case Checklist & HS Search */}
        <div className="space-y-4">
          {/* Document Checklist for Selected Case */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">Document Checklist</h4>
              <span className="text-[10px] text-slate-400 font-mono">{selectedCase.caseNo}</span>
            </div>
            <div className="space-y-2">
              {selectedCase.checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 p-2.5 text-xs bg-slate-50/50"
                >
                  <span className="text-slate-700 font-medium">{item.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.complete ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.complete ? 'VERIFIED' : 'MISSING'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI HS Code Classifier */}
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/60 to-white p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-purple-600" />
              <h4 className="font-bold text-sm text-slate-900">AI HS Code Lookup</h4>
            </div>
            <p className="text-[11.5px] text-slate-600 leading-relaxed">
              Describe cargo in plain language to get tariff classification under GCC Unified Customs Tariff.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                value={searchHs}
                onChange={(e) => setSearchHs(e.target.value)}
                placeholder="e.g. Lithium ion vehicle batteries..."
                className="w-full rounded-xl border border-purple-200 p-2 text-xs focus:outline-hidden focus:border-purple-500 bg-white"
              />
              <button
                onClick={() => alert('Proposed HS Code 8507.60 (Lithium-ion accumulators) with 5% standard GCC import duty and 5% UAE VAT. AI suggestion saved for review.')}
                className="w-full rounded-xl bg-purple-600 py-1.5 text-xs font-bold text-white hover:bg-purple-700 transition"
              >
                Classify & Check Duty Rate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
