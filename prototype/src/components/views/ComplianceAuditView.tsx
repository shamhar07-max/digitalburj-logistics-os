import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  Download,
  RefreshCw,
  Share2,
  Send,
  Building,
  HelpCircle,
  FileCheck2,
  Lock,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { INITIAL_COMPLIANCE_AUDITS } from '../../data/mockData';
import { ComplianceAuditRecord } from '../../types';

export const ComplianceAuditView: React.FC = () => {
  const [audits, setAudits] = useState<ComplianceAuditRecord[]>(INITIAL_COMPLIANCE_AUDITS);
  const [selectedAudit, setSelectedAudit] = useState<ComplianceAuditRecord>(INITIAL_COMPLIANCE_AUDITS[0]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Overall Index calculations
  const totalShipments = audits.length;
  const compliantCount = audits.filter((a) => a.status === 'Fully Compliant').length;
  const actionNeededCount = audits.filter((a) => a.status === 'Action Needed').length;
  const criticalRiskCount = audits.filter((a) => a.status === 'Critical Risk').length;
  const averageScore = Math.round(audits.reduce((acc, a) => acc + a.complianceScore, 0) / totalShipments);

  const handleRefreshMirsal = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      alert('Real-time sync complete: Queried Dubai Trade Mirsal II API, Dubai Customs, and Abu Dhabi Ports gateway. 5 active shipments re-audited.');
    }, 600);
  };

  const handleAutoFix = (recordId: string, docIndex: number) => {
    setAudits((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordId) return rec;
        const updatedChecklist = [...rec.checklist];
        updatedChecklist[docIndex] = {
          ...updatedChecklist[docIndex],
          status: 'Verified',
          isStampedOrVerified: true,
          isPresent: true,
          penaltyRisk: undefined,
        };

        const verifiedCount = updatedChecklist.filter((c) => c.status === 'Verified').length;
        const newScore = Math.round((verifiedCount / updatedChecklist.length) * 100);

        return {
          ...rec,
          complianceScore: newScore,
          complianceGrade: newScore >= 90 ? 'A+' : newScore >= 80 ? 'A' : newScore >= 70 ? 'B' : 'C',
          status: newScore >= 90 ? 'Fully Compliant' : 'Action Needed',
          checklist: updatedChecklist,
          verifiedDocsCount: verifiedCount,
        };
      })
    );

    // Update selected audit if matching
    if (selectedAudit.id === recordId) {
      setSelectedAudit((prev) => {
        const updatedChecklist = [...prev.checklist];
        updatedChecklist[docIndex] = {
          ...updatedChecklist[docIndex],
          status: 'Verified',
          isStampedOrVerified: true,
          isPresent: true,
          penaltyRisk: undefined,
        };
        const verifiedCount = updatedChecklist.filter((c) => c.status === 'Verified').length;
        const newScore = Math.round((verifiedCount / updatedChecklist.length) * 100);
        return {
          ...prev,
          complianceScore: newScore,
          complianceGrade: newScore >= 90 ? 'A+' : 'Action Needed' as any,
          checklist: updatedChecklist,
        };
      });
    }

    alert('Document verification request sent & approved! Compliance Score updated.');
  };

  const filteredAudits = audits.filter((a) => {
    if (filterStatus === 'compliant' && a.status !== 'Fully Compliant') return false;
    if (filterStatus === 'action' && a.status !== 'Action Needed') return false;
    if (filterStatus === 'risk' && a.status !== 'Critical Risk') return false;

    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      a.jobNo.toLowerCase().includes(q) ||
      a.customer.toLowerCase().includes(q) ||
      a.declarationRef.toLowerCase().includes(q) ||
      a.portAuthority.toLowerCase().includes(q)
    );
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-700 bg-emerald-100 border-emerald-300';
    if (score >= 75) return 'text-blue-700 bg-blue-100 border-blue-300';
    if (score >= 60) return 'text-amber-700 bg-amber-100 border-amber-300';
    return 'text-rose-700 bg-rose-100 border-rose-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Regulatory Intelligence
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Dubai Trade Mirsal II Active
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Compliance & Regulatory Audit Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time verification of mandatory UAE shipping documentation, Customs declaration clearances, and automated visual Compliance Scores for every active shipment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefreshMirsal}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <RefreshCw className={`h-4 w-4 text-[#E8472B] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync Mirsal II Customs Feed</span>
          </button>

          <button
            onClick={() => alert('Full UAE Regulatory Compliance Audit Dossier exported as PDF.')}
            className="flex items-center gap-1.5 rounded-xl bg-[#09192D] px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 transition shadow-2xs"
          >
            <Download className="h-4 w-4 text-[#E8472B]" />
            <span>Export Audit Report</span>
          </button>
        </div>
      </div>

      {/* Top Compliance Index Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Health Gauge */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
              Fleet Compliance Index
            </span>
            <div className="text-3xl font-black text-slate-950 mt-1 font-mono">{averageScore}%</div>
            <span className="text-[11px] text-emerald-600 font-bold mt-1 block">Grade A- (Standard Compliant)</span>
          </div>
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-500 bg-emerald-50 text-emerald-800 font-black text-lg">
            {averageScore}%
          </div>
        </div>

        {/* Fully Compliant */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-800 block">
            Fully Cleared (Grade A/A+)
          </span>
          <div className="text-3xl font-black text-emerald-700 mt-1">{compliantCount} Shipments</div>
          <span className="text-[11px] text-emerald-600 font-medium">All mandatory docs & stamps valid</span>
        </div>

        {/* Needs Action */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white p-5 shadow-xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800 block">
            Action Needed (Grade B)
          </span>
          <div className="text-3xl font-black text-amber-700 mt-1">{actionNeededCount} Shipments</div>
          <span className="text-[11px] text-amber-700 font-medium">Missing signature or chamber red stamp</span>
        </div>

        {/* Critical Risk */}
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/50 to-white p-5 shadow-xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-rose-800 block">
            Critical Customs Hold
          </span>
          <div className="text-3xl font-black text-rose-700 mt-1">{criticalRiskCount} Shipment</div>
          <span className="text-[11px] text-rose-700 font-bold">Demurrage penalty risk: DB-1048</span>
        </div>
      </div>

      {/* Main Audit Grid: Left Master Table, Right Detailed Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Active Shipments Compliance Score Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* Table Filter Sub-bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-3.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5 font-bold">
                {[
                  { id: 'all', label: `All (${audits.length})` },
                  { id: 'compliant', label: `Compliant (${compliantCount})` },
                  { id: 'action', label: `Action Needed (${actionNeededCount})` },
                  { id: 'risk', label: `Critical Holds (${criticalRiskCount})` },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setFilterStatus(btn.id)}
                    className={`rounded-lg px-2.5 py-1 transition text-xs ${
                      filterStatus === btn.id
                        ? 'bg-[#09192D] text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter job, declaration #..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs focus:outline-hidden focus:border-[#E8472B]"
                />
              </div>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-100">
              {filteredAudits.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedAudit(item)}
                  className={`p-4 transition cursor-pointer flex items-center justify-between gap-4 ${
                    selectedAudit.id === item.id ? 'bg-slate-50 border-l-4 border-l-[#E8472B]' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Visual Score Badge */}
                    <div
                      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border font-black ${getScoreColor(
                        item.complianceScore
                      )}`}
                    >
                      <span className="text-sm font-mono leading-none">{item.complianceScore}%</span>
                      <span className="text-[9px] uppercase tracking-wider">{item.complianceGrade}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{item.jobNo}</span>
                        <span className="font-bold text-xs text-slate-800">{item.customer}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                          {item.mode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.lane} · Port: <strong className="text-slate-700">{item.portAuthority.split('/')[0]}</strong>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10.5px]">
                        <span className="text-slate-400">Declaration: <code className="text-slate-700 font-bold">{item.declarationRef}</code></span>
                        <span>·</span>
                        <span className="text-slate-600 font-medium">Docs: <strong>{item.verifiedDocsCount}</strong> of <strong>{item.mandatoryDocsTotal}</strong> Verified</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                        item.status === 'Fully Compliant'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'Action Needed'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block">{item.lastAuditCheck}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Regulatory Guidance Tip */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-950 flex items-start gap-2.5">
            <Building className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>UAE Customs Compliance Rule:</strong> Under UAE Federal Customs Authority regulations, goods arriving with unverified Certificates of Origin or commercial invoices lacking Chamber attestations are subject to Customs Holds and mandatory cash bank guarantees. DigitalBurj audits every active job in real-time to prevent terminal demurrage.
            </div>
          </div>
        </div>

        {/* Right (1 col): Selected Shipment Deep Dive Inspection */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Shipment Audit Dossier
                </span>
                <h3 className="font-extrabold text-base text-slate-900">{selectedAudit.jobNo}</h3>
                <div className="text-[11px] text-slate-500">{selectedAudit.customer}</div>
              </div>
              <div
                className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl border font-black ${getScoreColor(
                  selectedAudit.complianceScore
                )}`}
              >
                <span className="text-sm font-mono leading-none">{selectedAudit.complianceScore}%</span>
                <span className="text-[9px] uppercase tracking-wider">{selectedAudit.complianceGrade}</span>
              </div>
            </div>

            {/* Customs Status Callout */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Customs Clearance:</span>
                <span
                  className={`font-bold ${
                    selectedAudit.customsStatus.includes('Hold') ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {selectedAudit.customsStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Declaration Ref:</span>
                <span className="font-mono font-bold text-slate-800">{selectedAudit.declarationRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duty & Tax Status:</span>
                <span className="font-semibold text-slate-700">{selectedAudit.dutyPaidStatus}</span>
              </div>
            </div>

            {/* Mandatory Documentation Checklist */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <h4 className="font-bold text-slate-900 text-xs">Mandatory UAE Document Verification</h4>
                <span className="text-[11px] font-mono text-slate-400">
                  {selectedAudit.verifiedDocsCount} of {selectedAudit.mandatoryDocsTotal} Verified
                </span>
              </div>

              <div className="space-y-2">
                {selectedAudit.checklist.map((doc, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 text-xs space-y-1.5 transition ${
                      doc.status === 'Verified'
                        ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                        : doc.status === 'Mismatch'
                        ? 'border-rose-300 bg-rose-50/80 text-rose-950'
                        : 'border-amber-300 bg-amber-50/70 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        {doc.status === 'Verified' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        )}
                        <span>{doc.name}</span>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase ${
                          doc.status === 'Verified'
                            ? 'bg-emerald-200 text-emerald-900'
                            : doc.status === 'Mismatch'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>

                    <p className="text-[11px] opacity-80 leading-snug">{doc.description}</p>

                    {doc.penaltyRisk && (
                      <div className="text-[10.5px] font-bold text-rose-700 bg-white/70 p-1.5 rounded-lg border border-rose-200 mt-1">
                        ⚠️ Penalty Warning: {doc.penaltyRisk}
                      </div>
                    )}

                    {doc.status !== 'Verified' && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleAutoFix(selectedAudit.id, idx)}
                          className="rounded-lg bg-[#E8472B] px-2.5 py-1 text-[10.5px] font-bold text-white hover:bg-[#D13B20] transition active:scale-95"
                        >
                          Resolve & Mark Verified
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
              <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block">
                Auditor Action Recommendation:
              </span>
              <p className="text-[11.5px] text-slate-700 leading-relaxed font-medium">
                {selectedAudit.fixRecommendation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
