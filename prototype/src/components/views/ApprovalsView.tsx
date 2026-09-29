import React, { useState } from 'react';
import { ShieldCheck, Check, X, Clock, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { INITIAL_APPROVALS } from '../../data/mockData';
import { ApprovalItem } from '../../types';

export const ApprovalsView: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);

  const handleDecision = (id: string, decision: 'approved' | 'rejected') => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: decision } : a))
    );
    alert(`Decision recorded: ${decision.toUpperCase()} for item ${id}. Audit trail timestamped with authorized user ID.`);
  };

  const pendingList = approvals.filter((a) => a.status === 'pending');
  const historyList = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Governance Engine</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              Revision-Bound Approvals
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Universal Approval Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            One single approval system serves margin floor overrides, customs releases, credit limit extensions, and vendor bill variances.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-600">Pending Decisions:</span>
          <span className="rounded-full bg-[#E8472B] px-2.5 py-0.5 font-bold text-white text-xs">
            {pendingList.length}
          </span>
        </div>
      </div>

      {/* Pending Approvals Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="border-b border-slate-100 bg-slate-50 p-4 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm">Action Items Awaiting Executive Decision</h3>
          <span className="text-xs text-slate-400">Strictly bound to exact document revision</span>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingList.map((item) => (
            <div key={item.id} className="p-4 hover:bg-slate-50 transition space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      item.severity === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.type}
                  </span>
                  <span className="font-mono font-bold text-slate-900">{item.referenceId}</span>
                  <span className="text-slate-400">· Revision: {item.revision}</span>
                </div>
                <span className="text-slate-400">{item.timestamp}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <div className="font-semibold text-slate-800">{item.reason}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Requested by: <strong>{item.requestedBy}</strong> · Value: <strong className="text-slate-900 font-mono">{item.amountOrMargin}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDecision(item.id, 'rejected')}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 transition"
                  >
                    Reject with Reason
                  </button>
                  <button
                    onClick={() => handleDecision(item.id, 'approved')}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 font-bold text-white hover:bg-emerald-700 transition shadow-2xs"
                  >
                    Approve Decision
                  </button>
                </div>
              </div>
            </div>
          ))}

          {pendingList.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No pending approvals. All governance requests are up to date!
            </div>
          )}
        </div>
      </div>

      {/* Decisions History */}
      {historyList.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Recently Resolved Decisions</h4>
          <div className="divide-y divide-slate-100 text-xs">
            {historyList.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{item.type}</span>
                  <span className="text-slate-500 ml-2">{item.referenceId}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    item.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
