import React, { useState } from 'react';
import {
  History,
  X,
  Search,
  Filter,
  Download,
  ShieldCheck,
  AlertTriangle,
  Info,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Database,
  ArrowRight,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { AuditLogEntry, AuditActionType } from '../../types';

interface ActivityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLogEntry[];
}

export const ActivityAuditModal: React.FC<ActivityAuditModalProps> = ({
  isOpen,
  onClose,
  auditLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.recordRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.complianceReason && log.complianceReason.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedModule !== 'all' && log.module !== selectedModule) return false;
    if (selectedActionType !== 'all' && log.actionType !== selectedActionType) return false;
    if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) return false;

    return true;
  });

  const handleExportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Module', 'ActionType', 'RecordRef', 'User', 'Details', 'ComplianceReason', 'Severity'];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.module}"`,
      `"${l.actionType}"`,
      `"${l.recordRef}"`,
      `"${l.user}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.complianceReason || ''}"`,
      `"${l.severity}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DigitalBurj_Compliance_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-950">
                  Global Activity Audit & Compliance History Log
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  {auditLogs.length} Total Events
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Immutable chronological ledger of all data updates, status transitions, auto-generations, and deletions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Toolbar */}
        <div className="border-b border-slate-200 bg-white p-4 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by action, record #, user, reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
              {/* Module Filter */}
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white p-2 font-medium text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Modules</option>
                <option value="Shipments">Shipments</option>
                <option value="Sales RFQ">Sales RFQ</option>
                <option value="Booking">Booking</option>
                <option value="Customs">Customs</option>
                <option value="Finance">Finance</option>
                <option value="WMS">Warehouse</option>
                <option value="Admin">Admin</option>
              </select>

              {/* Action Type Filter */}
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white p-2 font-medium text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Action Types</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE_STATUS">STATUS CHANGE</option>
                <option value="UPDATE_DATA">DATA EDIT</option>
                <option value="AUTO_GENERATE">AUTO GENERATION</option>
                <option value="APPROVE">APPROVAL</option>
                <option value="OVERRIDE">OVERRIDE</option>
                <option value="DELETE">DELETION</option>
              </select>

              {/* Severity Filter */}
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white p-2 font-medium text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning / Override</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Log Table / Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <History className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="font-bold">No activity audit logs matching filters.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className={`rounded-2xl border transition overflow-hidden ${
                    log.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50/20'
                      : log.severity === 'critical'
                      ? 'border-rose-200 bg-rose-50/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-3">
                      <button className="mt-0.5 text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {log.recordRef}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              log.actionType === 'CREATE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.actionType === 'AUTO_GENERATE'
                                ? 'bg-purple-100 text-purple-800'
                                : log.actionType === 'OVERRIDE'
                                ? 'bg-rose-100 text-rose-800'
                                : log.actionType === 'APPROVE'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.actionType || 'LOG'}
                          </span>
                          <span className="font-bold text-xs text-slate-900">{log.action}</span>
                        </div>

                        <div className="text-xs text-slate-600 leading-snug">{log.details}</div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                          <span>User: <strong className="text-slate-700">{log.user}</strong></span>
                          <span>•</span>
                          <span>Module: <strong className="text-slate-700">{log.module}</strong></span>
                          {log.branch && (
                            <>
                              <span>•</span>
                              <span>Branch: {log.branch}</span>
                            </>
                          )}
                          {log.complianceReason && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500 italic">Mandate: {log.complianceReason}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 block">{log.timestamp}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                          log.severity === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : log.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {log.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Diff Inspector */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-3 animate-in fade-in duration-100">
                      <div className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500">
                        Detailed State Diffs & Audit Metadata
                      </div>

                      {log.diffs && log.diffs.length > 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                              <tr>
                                <th className="p-2.5">Field / Attribute</th>
                                <th className="p-2.5">Previous State</th>
                                <th className="p-2.5">New State</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {log.diffs.map((diff, i) => (
                                <tr key={i}>
                                  <td className="p-2.5 font-bold text-slate-700">{diff.field}</td>
                                  <td className="p-2.5 text-rose-600 bg-rose-50/30">
                                    {String(diff.oldValue ?? 'null')}
                                  </td>
                                  <td className="p-2.5 text-emerald-700 bg-emerald-50/30 font-bold">
                                    {String(diff.newValue ?? 'null')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">
                          No direct field diff values recorded for this system event.
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-mono pt-1">
                        <span>Audit Log ID: {log.id}</span>
                        <span>Immutable Audit Timestamp: {log.timestamp}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
