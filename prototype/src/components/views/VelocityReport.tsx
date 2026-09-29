import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Clock, Download, Info, Layers, Plane, Ship, Truck, Zap } from 'lucide-react';
import { ModeGroup } from '../../types';
import { VELOCITY_RECORDS } from '../../data/velocityData';
import {
  MODE_GROUPS,
  SLA_MINUTES,
  TARGET_MINUTES,
  VELOCITY_STAGES,
  VelocityStageKey,
  compareModes,
  diagnose,
  fmtMinutes,
  measure,
  slaLabel,
  toCsv,
} from '../../utils/velocity';

type Scope = 'All' | ModeGroup | 'Compare';

const MODE_STYLE: Record<ModeGroup, { icon: React.ElementType; text: string; soft: string; ring: string; label: string }> = {
  Sea: { icon: Ship, text: 'text-blue-700', soft: 'bg-blue-50', ring: 'ring-blue-500', label: 'Sea Freight' },
  Air: { icon: Plane, text: 'text-purple-700', soft: 'bg-purple-50', ring: 'ring-purple-500', label: 'Air Cargo' },
  Road: { icon: Truck, text: 'text-emerald-700', soft: 'bg-emerald-50', ring: 'ring-emerald-500', label: 'Road & GCC Cartage' },
};

const STAGE_COLOR: Record<VelocityStageKey, string> = {
  jobCreation: 'bg-indigo-500',
  carrierBooking: 'bg-orange-500',
  docGeneration: 'bg-emerald-500',
};

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'Compare', label: 'Compare modes' },
  { id: 'All', label: 'All modes' },
  { id: 'Sea', label: 'Sea' },
  { id: 'Air', label: 'Air' },
  { id: 'Road', label: 'Road' },
];

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmtMinutes(Math.abs(n))}`;

function fmtWhen(iso: string, now: number) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${time}`;
}

export const VelocityReport: React.FC = () => {
  const [scope, setScope] = useState<Scope>('Compare');
  const [showAllRows, setShowAllRows] = useState(false);
  const now = useMemo(() => Date.now(), []);

  const { valid, rejected } = useMemo(() => measure(VELOCITY_RECORDS), []);
  const cmp = useMemo(() => compareModes(valid), [valid]);

  const single: ModeGroup | 'All' = scope === 'Compare' ? 'All' : scope;
  const summary = scope === 'Compare' ? cmp.all : scope === 'All' ? cmp.all : cmp.byMode[scope];
  const rows = useMemo(() => valid.filter((r) => single === 'All' || r.group === single), [valid, single]);
  const diagnostics = useMemo(() => diagnose(valid, single), [valid, single]);
  const logRows = showAllRows ? rows : rows.slice(0, 8);

  const downloadCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operational-velocity-${single.toLowerCase()}-${new Date(now).toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // scale for the compare matrix mini-bars
  const matrixMax = Math.max(1, ...MODE_GROUPS.flatMap((g) => VELOCITY_STAGES.map((s) => cmp.byMode[g].stageAvg[s.key])));
  const downstreamAvg = (() => {
    const xs = rows.map((r) => r.downstream).filter((x): x is number => x !== undefined);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-md">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-500 text-white font-bold">
              <Zap className="h-4 w-4" />
            </span>
            <h3 className="text-base font-extrabold text-white">Operational Velocity & Bottleneck Diagnostic Report</h3>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">Computed from order timestamps</span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Average time from <strong>'Quote Accepted'</strong> to <strong>'Document Generation'</strong> (HBL / AWB, Packing List &amp; Commercial Invoice), broken down by mode so the
            slow stage in Sea, Air and Road can be seen separately.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export {single === 'All' ? 'all modes' : single} CSV ({rows.length})</span>
        </button>
      </div>

      {/* Mode filter */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div role="group" aria-label="Transport mode filter" className="flex flex-wrap gap-1.5">
          {SCOPES.map((s) => {
            const count = s.id === 'Compare' || s.id === 'All' ? valid.length : cmp.byMode[s.id].n;
            const active = scope === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => setScope(s.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${active ? 'bg-[#09192D] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {s.label} <span className={`font-mono ${active ? 'text-slate-300' : 'text-slate-400'}`}>({count})</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {valid.length} converted orders analysed · SLA {SLA_MINUTES}m · target &lt; {TARGET_MINUTES}m
          {rejected.length > 0 && <span className="font-bold text-amber-700"> · {rejected.length} excluded (bad timestamps)</span>}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(['All', ...MODE_GROUPS] as (ModeGroup | 'All')[]).map((g) => {
          const s = g === 'All' ? cmp.all : cmp.byMode[g];
          const style = g === 'All' ? null : MODE_STYLE[g];
          const Icon = style?.icon ?? Clock;
          const selected = scope === g;
          const vsTarget = s.avg - TARGET_MINUTES;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setScope(g)}
              aria-pressed={selected}
              className={`text-left rounded-2xl border bg-white p-4 shadow-xs transition hover:border-slate-400 ${selected ? `border-transparent ring-2 ${style?.ring ?? 'ring-indigo-500'}` : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Icon className={`h-3.5 w-3.5 ${style?.text ?? 'text-indigo-600'}`} />
                  {g === 'All' ? 'All modes' : style!.label}
                </span>
                <span className="font-mono text-[10px]">n={s.n}</span>
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900 font-mono">
                {s.n ? fmtMinutes(s.avg) : '—'} <span className="text-base font-bold text-slate-500">mins</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                median {fmtMinutes(s.median)}m · P90 {fmtMinutes(s.p90)}m
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className={vsTarget > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>
                  {s.n ? `${signed(vsTarget)}m vs ${TARGET_MINUTES}m target` : ''}
                </span>
                <span className={s.slaBreachPct > 0 ? 'font-bold text-rose-700' : 'text-slate-500'}>{s.slaBreachPct.toFixed(0)}% over SLA</span>
              </div>
            </button>
          );
        })}
      </div>

      {scope === 'Compare' ? (
        <>
          {/* Stage × mode comparison matrix */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-sm text-slate-900">Stage-by-stage comparison across Sea, Air and Road</h4>
              <p className="text-xs text-slate-500">
                Average minutes per stage. The bar is scaled across the whole table; the tag marks the slowest mode for that stage; the ± figure is against the all-mode average.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <caption className="sr-only">Average minutes per stage for Sea, Air and Road</caption>
                <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="p-3">Stage</th>
                    {MODE_GROUPS.map((g) => (
                      <th scope="col" key={g} className={`p-3 ${MODE_STYLE[g].text}`}>{g}</th>
                    ))}
                    <th scope="col" className="p-3 text-slate-600">All modes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {VELOCITY_STAGES.map((st) => (
                    <tr key={st.key}>
                      <th scope="row" className="p-3 font-bold text-slate-800 max-w-[260px]">
                        {st.label}
                        <span className="block font-normal text-[11px] text-slate-500 mt-0.5">{st.desc}</span>
                      </th>
                      {MODE_GROUPS.map((g) => {
                        const v = cmp.byMode[g].stageAvg[st.key];
                        const slowest = cmp.slowestByStage[st.key] === g && cmp.byMode[g].n > 0;
                        const delta = v - cmp.all.stageAvg[st.key];
                        return (
                          <td key={g} className="p-3 align-top">
                            {cmp.byMode[g].n === 0 ? (
                              <span className="text-slate-400">no data</span>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-slate-900">{fmtMinutes(v)}m</span>
                                  <span className={`font-mono text-[10px] ${delta > 0.5 ? 'text-rose-600' : delta < -0.5 ? 'text-emerald-600' : 'text-slate-400'}`}>{signed(delta)}</span>
                                  {slowest && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-800">Slowest</span>}
                                </div>
                                <div className="mt-1.5 h-1.5 w-full max-w-[140px] rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                                  <div className={`h-full rounded-full ${STAGE_COLOR[st.key]}`} style={{ width: `${Math.max(2, (v / matrixMax) * 100)}%` }} />
                                </div>
                              </>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 align-top font-mono font-bold text-slate-600">{fmtMinutes(cmp.all.stageAvg[st.key])}m</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <th scope="row" className="p-3 font-extrabold text-slate-900">Quote Accepted → Documents generated</th>
                    {MODE_GROUPS.map((g) => (
                      <td key={g} className="p-3 font-mono font-black text-slate-900">{cmp.byMode[g].n ? `${fmtMinutes(cmp.byMode[g].avg)}m` : '—'}</td>
                    ))}
                    <td className="p-3 font-mono font-black text-slate-900">{fmtMinutes(cmp.all.avg)}m</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Composition of the cycle per mode */}
            <div className="space-y-2.5 pt-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800">Where the time goes:</span>
                {VELOCITY_STAGES.map((st) => (
                  <span key={st.key} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-sm ${STAGE_COLOR[st.key]}`} aria-hidden="true" />
                    {st.short}
                  </span>
                ))}
              </div>
              {MODE_GROUPS.map((g) => {
                const s = cmp.byMode[g];
                const Icon = MODE_STYLE[g].icon;
                const maxTotal = Math.max(1, ...MODE_GROUPS.map((m) => cmp.byMode[m].avg));
                return (
                  <div key={g} className="flex items-center gap-3">
                    <span className={`flex w-16 shrink-0 items-center gap-1 text-xs font-bold ${MODE_STYLE[g].text}`}>
                      <Icon className="h-3.5 w-3.5" /> {g}
                    </span>
                    <div className="flex h-5 rounded-md overflow-hidden bg-slate-100" style={{ width: `${Math.max(8, (s.avg / maxTotal) * 100)}%` }}>
                      {VELOCITY_STAGES.map((st) => (
                        <div key={st.key} className={STAGE_COLOR[st.key]} style={{ width: `${s.avg ? (s.stageAvg[st.key] / s.avg) * 100 : 0}%` }} title={`${st.short}: ${fmtMinutes(s.stageAvg[st.key])} min`} />
                      ))}
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-800 shrink-0">{s.n ? `${fmtMinutes(s.avg)}m` : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mode-specific bottleneck callouts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MODE_GROUPS.map((g) => {
              const s = cmp.byMode[g];
              const st = VELOCITY_STAGES.find((x) => x.key === s.bottleneck.stage)!;
              const delta = s.bottleneck.avg - cmp.all.stageAvg[s.bottleneck.stage];
              const Icon = MODE_STYLE[g].icon;
              return (
                <div key={g} className={`rounded-2xl border p-4 space-y-1.5 ${MODE_STYLE[g].soft} border-slate-200`}>
                  <div className={`flex items-center gap-1.5 text-xs font-extrabold ${MODE_STYLE[g].text}`}>
                    <Icon className="h-4 w-4" /> {g} bottleneck
                  </div>
                  {s.n === 0 ? (
                    <p className="text-xs text-slate-500">No orders yet.</p>
                  ) : (
                    <>
                      <div className="text-sm font-black text-slate-900">{st.short}</div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">
                        <span className="font-mono font-bold">{fmtMinutes(s.bottleneck.avg)} min</span> = {Math.round(s.bottleneck.share * 100)}% of the {g.toLowerCase()} cycle
                        {Math.abs(delta) >= 0.5 && (
                          <>
                            ,{' '}
                            <span className={`font-mono font-bold ${delta > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{signed(delta)} min</span> vs the all-mode average for this stage
                          </>
                        )}
                        .
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">
                {scope === 'All' ? 'All modes' : MODE_STYLE[scope].label} — Quote-to-Document lifecycle (stage-by-stage)
              </h4>
              <p className="text-xs text-slate-500">Each bar shows the stage's share of the average cycle for the selected scope.</p>
            </div>
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
              Total average: {summary.n ? `${fmtMinutes(summary.avg)} mins` : '—'}
            </span>
          </div>

          <div className="space-y-3">
            {VELOCITY_STAGES.map((st) => {
              const v = summary.stageAvg[st.key];
              const share = summary.avg ? (v / summary.avg) * 100 : 0;
              const isBottleneck = summary.bottleneck.flagged && summary.bottleneck.stage === st.key;
              const delta = scope !== 'All' ? v - cmp.all.stageAvg[st.key] : null;
              return (
                <div key={st.key} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-extrabold text-slate-800">{st.label}</span>
                    <div className="flex items-center gap-2">
                      {delta !== null && Math.abs(delta) >= 0.5 && (
                        <span className={`font-mono text-[10px] ${delta > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{signed(delta)}m vs all modes</span>
                      )}
                      <span className="font-mono font-black text-slate-900">{fmtMinutes(v)} mins</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase ${isBottleneck ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>
                        {isBottleneck ? `⚠ Bottleneck (${share.toFixed(0)}%)` : `${share.toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                    <div className={`h-full rounded-full ${isBottleneck ? 'bg-rose-500' : STAGE_COLOR[st.key]}`} style={{ width: `${share}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">{st.desc}</p>
                </div>
              );
            })}
            {downstreamAvg !== null && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-slate-700">After document generation</strong> — Customs pre-declaration &amp; broker validation (not counted in the figures above)
                </span>
                <span className="font-mono font-bold text-slate-700">{fmtMinutes(downstreamAvg)} mins avg</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottleneck diagnostics */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h4 className="font-extrabold text-sm text-slate-900">
            Identified operational bottlenecks &amp; recommended actions{single !== 'All' ? ` — ${single}` : ''}
          </h4>
        </div>
        {diagnostics.length === 0 ? (
          <p className="text-xs text-slate-500">No stage or hold reason is running 3+ minutes over its benchmark for this selection.</p>
        ) : (
          <div className="rounded-2xl border border-slate-200 overflow-x-auto text-xs">
            <table className="w-full text-left min-w-[760px]">
              <caption className="sr-only">Bottlenecks ranked by delay added</caption>
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  <th scope="col" className="p-3.5">Bottleneck</th>
                  <th scope="col" className="p-3.5">Mode</th>
                  <th scope="col" className="p-3.5">Delay added</th>
                  <th scope="col" className="p-3.5">Orders</th>
                  <th scope="col" className="p-3.5">Root cause</th>
                  <th scope="col" className="p-3.5">Recommended action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diagnostics.map((d) => {
                  const style = d.scope === 'All' ? null : MODE_STYLE[d.scope];
                  return (
                    <tr key={d.key} className="hover:bg-slate-50 align-top">
                      <td className="p-3.5 font-bold text-slate-900">{d.title}</td>
                      <td className="p-3.5">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${style ? `${style.soft} ${style.text}` : 'bg-slate-100 text-slate-700'}`}>{d.scope}</span>
                      </td>
                      <td className="p-3.5">
                        <div className={`font-mono font-bold ${d.delayMinutes >= 10 ? 'text-rose-600' : 'text-amber-600'}`}>+{fmtMinutes(d.delayMinutes)} mins</div>
                        <div className="text-[10px] text-slate-400">{d.basis}</div>
                      </td>
                      <td className="p-3.5 font-mono">
                        {d.samples}
                        {d.samples < 3 && <span className="block font-sans text-[10px] font-bold text-amber-700">low sample</span>}
                      </td>
                      <td className="p-3.5 text-slate-600">{d.rootCause}</td>
                      <td className="p-3.5 text-emerald-700 font-semibold">{d.action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h4 className="font-extrabold text-sm text-slate-900">Converted orders — velocity audit log{single !== 'All' ? ` (${single})` : ''}</h4>
          <span className="text-xs text-slate-500">
            {logRows.length} of {rows.length} orders · newest first
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 overflow-x-auto text-xs">
          <table className="w-full text-left min-w-[820px]">
            <caption className="sr-only">Converted orders with quote-accepted and document-generated times</caption>
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th scope="col" className="p-3.5">Job / Quote</th>
                <th scope="col" className="p-3.5">Customer &amp; mode</th>
                <th scope="col" className="p-3.5">Quote accepted</th>
                <th scope="col" className="p-3.5">Docs generated</th>
                <th scope="col" className="p-3.5">Stage split</th>
                <th scope="col" className="p-3.5 text-right">Cycle</th>
                <th scope="col" className="p-3.5 text-right">SLA status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logRows.map((r) => {
                const sla = slaLabel(r.total);
                const style = r.group ? MODE_STYLE[r.group] : null;
                return (
                  <tr key={r.rec.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      {r.rec.jobNo} <span className="text-slate-400 font-normal">/ {r.rec.quoteNo}</span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{r.rec.customer}</div>
                      <div className={`text-[10px] ${style?.text ?? 'text-slate-600'}`}>
                        {r.rec.mode} ({r.rec.lane})
                        {r.rec.holdReason && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 font-bold text-amber-800">hold</span>}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600">{fmtWhen(r.rec.acceptedAt, now)}</td>
                    <td className="p-3.5 text-slate-600">{fmtWhen(r.rec.docsGeneratedAt, now)}</td>
                    <td className="p-3.5">
                      <div className="flex h-2 w-28 rounded-full overflow-hidden bg-slate-100" aria-hidden="true">
                        {VELOCITY_STAGES.map((st) => (
                          <div key={st.key} className={STAGE_COLOR[st.key]} style={{ width: `${(r.stages[st.key] / r.total) * 100}%` }} />
                        ))}
                      </div>
                    </td>
                    <td className={`p-3.5 text-right font-mono font-black ${sla.tone === 'breach' ? 'text-rose-600' : sla.tone === 'fast' ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {fmtMinutes(r.total)} mins
                    </td>
                    <td className="p-3.5 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sla.tone === 'breach' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}
                      >
                        {sla.tone === 'breach' ? '⚠ ' : sla.tone === 'fast' ? '⚡ ' : '✓ '}
                        {sla.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {logRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">No converted orders for this mode yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 8 && (
          <button type="button" onClick={() => setShowAllRows((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline">
            {showAllRows ? 'Show latest 8 only' : `Show all ${rows.length} orders`} <ArrowRight className="h-3 w-3" />
          </button>
        )}
        <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <Layers className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Sample dataset: durations are computed from the accepted / job-created / carrier-confirmed / docs-generated timestamps on each order. Connect the quote, booking and
            document-generator events to feed real orders into the same calculation.
          </span>
        </div>
      </div>
    </div>
  );
};

export default VelocityReport;
