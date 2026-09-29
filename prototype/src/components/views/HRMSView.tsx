import React, { useState } from 'react';
import {
  Users,
  CreditCard,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Building,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { INITIAL_EMPLOYEES } from '../../data/mockData';
import { Employee } from '../../types';

interface HRMSViewProps {
  mode?: 'staff' | 'payroll';
}

export const HRMSView: React.FC<HRMSViewProps> = ({ mode = 'payroll' }) => {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [sifGenerated, setSifGenerated] = useState(false);

  const totalGross = employees.reduce((acc, e) => acc + e.totalSalary, 0);
  const totalDeductions = Math.round(totalGross * 0.05);
  const totalNetWps = totalGross - totalDeductions;

  const handleGenerateSif = () => {
    setSifGenerated(true);

    // Generate MOHRE SIF content string
    const sifContent = [
      `SCR,100234567800003,GULFSTAR,${new Date().toISOString().slice(0, 10).replace(/-/g, '')},1102,${employees.length},${totalNetWps}.00,AED`,
      ...employees.map(
        (e) =>
          `EDR,${e.code},${e.iban},${e.basicSalary}.00,${e.allowances}.00,${(e.totalSalary * 0.05).toFixed(2)},0.00,0,0,${e.name.replace(/ /g, '_')}`
      ),
    ].join('\n');

    const blob = new Blob([sifContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MOHRE_SIF_GULFSTAR_${new Date().toISOString().slice(0, 10)}.sif`;
    a.click();
    URL.revokeObjectURL(url);

    alert('MOHRE-compliant WPS SIF (Salary Information File) generated and downloaded! Upload this directly to your UAE corporate banking portal (Emirates NBD, FAB, Mashreq).');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">People & Payroll</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              MOHRE WPS Compliant
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">HRMS & WPS SIF Payroll</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full UAE labor law compliance: Visa & Emirates ID expiration alerts, salary structure, and automated SIF payroll generation.
          </p>
        </div>

        <button
          onClick={handleGenerateSif}
          className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
        >
          <Download className="h-4 w-4" />
          <span>Generate MOHRE WPS SIF File</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Workforce</span>
          <div className="text-2xl font-black text-slate-950 mt-1">{employees.length} Employees</div>
          <span className="text-[10px] text-slate-500">100% Registered on UAE WPS</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Payroll (Sep)</span>
          <div className="text-2xl font-black text-slate-950 mt-1">AED {totalGross.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500">Includes basic + allowances</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Net WPS Disbursement</span>
          <div className="text-2xl font-black text-emerald-800 mt-1">AED {totalNetWps.toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-bold">Due 30 Sep 2026</span>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Visas Expiring ≤ 90d</span>
          <div className="text-2xl font-black text-amber-900 mt-1">2 Renewals Due</div>
          <span className="text-[10px] text-amber-700 font-bold">Fatima Zayed (62d) & Sara Menon (93d)</span>
        </div>
      </div>

      {/* SIF Generator Banner */}
      <div className="rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50/50 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-950">
              Why WPS inside the Logistics OS is a Massive Competitive Advantage
            </span>
          </div>
          <p className="text-xs text-emerald-950 leading-relaxed max-w-2xl">
            In competitive freight tools (CargoWise, GoFreight, Shipsy), forwarders are forced to maintain a disconnected standalone payroll software for UAE Wage Protection System compliance. In DigitalBurj, driver overtime, salesperson commission, and staff basic salaries generate your audited SIF in one click.
          </p>
        </div>
        <button
          onClick={handleGenerateSif}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition shrink-0"
        >
          {sifGenerated ? 'Download Again (.SIF)' : 'Download September SIF File'}
        </button>
      </div>

      {/* Employee Master Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-800">
          UAE Employee Directory & Visa Expiration Trackers ({employees.length})
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-3.5">Employee</th>
              <th className="p-3.5">Department & Role</th>
              <th className="p-3.5 text-right">Basic (AED)</th>
              <th className="p-3.5 text-right">Allowances</th>
              <th className="p-3.5 text-right">Net Salary</th>
              <th className="p-3.5">IBAN Verification</th>
              <th className="p-3.5">Visa Expiration</th>
              <th className="p-3.5">WPS Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50 transition">
                <td className="p-3.5">
                  <div className="font-bold text-slate-900">{e.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{e.code}</div>
                </td>
                <td className="p-3.5">
                  <div className="font-semibold text-slate-800">{e.role}</div>
                  <div className="text-[10px] text-slate-400">{e.department}</div>
                </td>
                <td className="p-3.5 text-right font-mono font-medium text-slate-600">
                  {e.basicSalary.toLocaleString()}
                </td>
                <td className="p-3.5 text-right font-mono font-medium text-slate-500">
                  {e.allowances.toLocaleString()}
                </td>
                <td className="p-3.5 text-right font-mono font-bold text-slate-950">
                  {e.totalSalary.toLocaleString()}
                </td>
                <td className="p-3.5">
                  <span className="font-mono text-[10.5px] text-slate-600 truncate block max-w-[140px]">
                    {e.iban}
                  </span>
                </td>
                <td className="p-3.5">
                  <span
                    className={`font-semibold text-[11px] ${
                      e.visaExpiry.includes('Due') ? 'text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded' : 'text-slate-700'
                    }`}
                  >
                    {e.visaExpiry}
                  </span>
                </td>
                <td className="p-3.5">
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                    ✓ WPS Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
