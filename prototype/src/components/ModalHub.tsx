import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Plane, Ship, Truck } from 'lucide-react';
import { ModeGroup, Shipment } from '../types';
import { INITIAL_FLEET_EQUIPMENT, INITIAL_FLEET_VEHICLES, INITIAL_ROAD_TRIPS } from '../data/mockData';
import { buildCapacitySeed } from '../data/modalCapacity';
import { VELOCITY_RECORDS } from '../data/velocityData';
import { Bar, LaneModel, Metric, Section, Source, Tone, buildHub, fmtCountdown } from '../utils/modalHub';
import { SLA_MINUTES, compareModes, fmtMinutes, measure } from '../utils/velocity';

const LANES: { group: ModeGroup; title: string; subtitle: string; icon: React.ElementType; accent: string; soft: string; link: { label: string; view: string } }[] = [
  { group: 'Sea', title: 'Sea', subtitle: 'Jebel Ali · vessel slots & container pool', icon: Ship, accent: 'text-blue-700', soft: 'bg-blue-50 border-blue-200', link: { label: 'Sea shipments', view: 'shipments' } },
  { group: 'Air', title: 'Air', subtitle: 'DXB / AUH / DWC · uplift & ULD pool', icon: Plane, accent: 'text-purple-700', soft: 'bg-purple-50 border-purple-200', link: { label: 'Air shipments', view: 'shipments' } },
  { group: 'Road', title: 'Road', subtitle: 'UAE & GCC cartage · fleet & trips', icon: Truck, accent: 'text-emerald-700', soft: 'bg-emerald-50 border-emerald-200', link: { label: 'Fleet register', view: 'fleet' } },
];

const TONE: Record<Tone, { bar: string; text: string; chip: string }> = {
  ok: { bar: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-800' },
  warn: { bar: 'bg-amber-500', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-800' },
  risk: { bar: 'bg-rose-500', text: 'text-rose-700', chip: 'bg-rose-100 text-rose-800' },
};

const SOURCE: Record<Source, { label: string; cls: string; title: string }> = {
  live: { label: 'Live', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: 'Computed right now from your job records' },
  register: { label: 'Register', cls: 'bg-slate-50 text-slate-600 border-slate-200', title: 'From the fleet / equipment register' },
  sample: { label: 'Sample feed', cls: 'bg-amber-50 text-amber-700 border-amber-200', title: 'Illustrative telemetry — replace with a terminal, airline or GPS feed' },
};

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const SourceTag: React.FC<{ source: Source }> = ({ source }) => (
  <span title={SOURCE[source].title} className={`rounded border px-1 py-px text-[8.5px] font-bold uppercase tracking-wide ${SOURCE[source].cls}`}>
    {SOURCE[source].label}
  </span>
);

const MetricTile: React.FC<{ m: Metric }> = ({ m }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-2.5 min-w-0">
    <div className="flex items-center justify-between gap-1">
      <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500 truncate">{m.label}</span>
      <SourceTag source={m.source} />
    </div>
    <div className={`mt-1 font-mono text-base font-black leading-none ${TONE[m.tone].text}`}>{m.value}</div>
    {m.sub && <div className="mt-1 text-[10px] text-slate-500 truncate">{m.sub}</div>}
  </div>
);

const BarRow: React.FC<{ bar: Bar; now: number }> = ({ bar, now }) => {
  const width = Math.min(100, bar.pct);
  const left = bar.cutoffAt !== undefined ? bar.cutoffAt - now : undefined;
  const closing = left !== undefined && left < 6 * 3_600_000;
  return (
    <li className="space-y-1">
      <div className="flex items-start justify-between gap-2 text-[11px]">
        <div className="min-w-0">
          <div className="font-bold text-slate-800 truncate">{bar.label}</div>
          {bar.sublabel && <div className="text-[10px] text-slate-500 truncate">{bar.sublabel}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className={`font-mono font-bold ${TONE[bar.tone].text}`}>
            {Math.round(bar.used).toLocaleString()} / {Math.round(bar.total).toLocaleString()} <span className="text-[9px] font-normal text-slate-500">{bar.unit}</span>
          </div>
          {left !== undefined && (
            <div className={`text-[10px] font-semibold ${closing ? 'text-amber-700' : 'text-slate-500'}`}>
              <Clock className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
              {left > 0 ? `cut-off in ${fmtCountdown(left)}` : 'cut-off passed'}
            </div>
          )}
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(bar.pct)}
        aria-label={`${bar.label}: ${Math.round(bar.pct)}% used`}
        className="relative h-2 w-full rounded-full bg-slate-200 overflow-hidden"
      >
        <div className={`h-full rounded-full ${TONE[bar.tone].bar}`} style={{ width: `${width}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className={`font-mono font-bold ${TONE[bar.tone].text}`}>{Math.round(bar.pct)}%{bar.pct > 100 ? ' · overbooked' : ''}</span>
        {bar.note && <span className={`truncate ml-2 ${bar.tone === 'ok' ? 'text-slate-500' : TONE[bar.tone].text}`}>{bar.note}</span>}
      </div>
    </li>
  );
};

const SectionBlock: React.FC<{ section: Section; now: number }> = ({ section, now }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <h5 className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">{section.title}</h5>
      <SourceTag source={section.source} />
    </div>
    {section.bars.length ? (
      <ul className="space-y-3">{section.bars.map((b) => <BarRow key={b.key} bar={b} now={now} />)}</ul>
    ) : (
      <p className="text-[11px] text-slate-500">No open departures.</p>
    )}
  </div>
);

const STATUS_LABEL: Record<string, string> = { in_transit: 'In transit', at_port_gate: 'At port gate', available: 'Available', maintenance: 'Maintenance', idling: 'Idling' };

const Lane: React.FC<{
  meta: (typeof LANES)[number];
  lane: LaneModel;
  now: number;
  velocity?: { avg: number; n: number; bottleneck: string };
  onSelectShipment: (s: Shipment) => void;
  onNavigateView: (v: any) => void;
}> = ({ meta, lane, now, velocity, onSelectShipment, onNavigateView }) => {
  const Icon = meta.icon;
  const alerts = lane.alerts.slice(0, 3);
  return (
    <section aria-labelledby={`lane-${meta.group}`} className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col">
      <header className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${meta.soft}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs ${meta.accent}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h4 id={`lane-${meta.group}`} className={`text-sm font-black leading-tight ${meta.accent}`}>{meta.title}</h4>
            <p className="text-[10.5px] text-slate-600 truncate">{meta.subtitle}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">{lane.headline.label}</div>
          <div className={`font-mono text-2xl font-black leading-none ${TONE[lane.headline.tone].text}`}>{lane.headline.value}</div>
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2">{lane.metrics.map((m) => <MetricTile key={m.label} m={m} />)}</div>

        {lane.sections.map((s) => <SectionBlock key={s.id} section={s} now={now} />)}

        {lane.pipeline && (
          <div className="space-y-2">
            <h5 className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">Trip pipeline</h5>
            <ol className="grid grid-cols-5 gap-1">
              {lane.pipeline.map((p) => (
                <li key={p.label} className="rounded-lg bg-slate-50 border border-slate-200 px-1 py-1.5 text-center">
                  <div className="font-mono text-sm font-black text-slate-900">{p.count}</div>
                  <div className="text-[8.5px] font-bold uppercase leading-tight text-slate-500">{p.label}</div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {lane.vehicles && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">Vehicle board</h5>
              <SourceTag source="register" />
            </div>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {lane.vehicles.map(({ vehicle: v, tone, note }) => (
                <li key={v.id} className="flex items-center justify-between gap-2 px-2.5 py-2 text-[11px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[tone].bar}`} aria-hidden="true" />
                      <span className="font-mono font-bold text-slate-900 truncate">{v.plateNo}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{v.vehicleType} · {v.assignedDriver}</div>
                    {note && <div className={`text-[10px] font-semibold leading-snug ${TONE[tone].text}`}>{note}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-slate-700">{STATUS_LABEL[v.status] ?? v.status}</div>
                    <div className={`font-mono text-[10px] ${v.fuelLevelPercent < 30 ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>fuel {v.fuelLevelPercent}%</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1.5">
          <h5 className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">Needs attention</h5>
          {alerts.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> All clear on the {meta.title.toLowerCase()} lane
            </p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li key={i} className={`flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[11px] ${TONE[a.tone].chip}`}>
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="leading-snug">{a.text}</span>
                </li>
              ))}
              {lane.alerts.length > alerts.length && <li className="text-[10px] text-slate-500 pl-1">+{lane.alerts.length - alerts.length} more</li>}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <h5 className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">Active jobs</h5>
          {lane.jobs.length === 0 ? (
            <p className="text-[11px] text-slate-500">No active {meta.title.toLowerCase()} jobs.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {lane.jobs.map(({ shipment: s, attention }) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectShipment(s)}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[11px] hover:bg-slate-50"
                    aria-label={`Open ${s.jobNo} for ${s.customer}`}
                  >
                    <span className="min-w-0">
                      <span className="font-mono font-bold text-slate-900">{s.jobNo}</span>
                      <span className="text-slate-500"> · {s.customer}</span>
                      <span className="block truncate text-[10px] text-slate-500">{s.origin} → {s.destination}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${attention ? TONE[s.health === 'risk' || s.status === 'customs_hold' ? 'risk' : 'warn'].chip : 'bg-slate-100 text-slate-700'}`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lane.hiddenJobs > 0 && (
            <button type="button" onClick={() => onNavigateView('shipments')} className="text-[10.5px] font-bold text-[#E8472B] hover:underline">
              +{lane.hiddenJobs} more {meta.title.toLowerCase()} jobs →
            </button>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-[10.5px]">
        {velocity && velocity.n > 0 ? (
          <button type="button" onClick={() => onNavigateView('velocity')} className="text-left text-slate-600 hover:text-slate-900">
            Quote → docs{' '}
            <strong className={`font-mono ${velocity.avg > SLA_MINUTES ? 'text-rose-700' : 'text-slate-900'}`}>{fmtMinutes(velocity.avg)}m</strong>{' '}
            <span className="text-slate-500">· slowest: {velocity.bottleneck}</span>
          </button>
        ) : (
          <span className="text-slate-500">No velocity data yet</span>
        )}
        <button type="button" onClick={() => onNavigateView(meta.link.view)} className="flex items-center gap-1 font-bold text-[#E8472B] hover:underline shrink-0">
          {meta.link.label} <ArrowRight className="h-3 w-3" />
        </button>
      </footer>
    </section>
  );
};

interface ModalHubProps {
  shipments: Shipment[];
  onSelectShipment: (s: Shipment) => void;
  onNavigateView: (v: any) => void;
}

/** Dashboard section that splits operations into Sea / Air / Road swimlanes with per-domain capacity and asset utilisation. */
export const ModalHub: React.FC<ModalHubProps> = ({ shipments, onSelectShipment, onNavigateView }) => {
  const now = useNow(1000);
  // Cut-offs are absolute timestamps fixed at mount, so their countdowns run against the real clock.
  const seed = useMemo(() => buildCapacitySeed(), []);
  const fleet = useMemo(() => ({ vehicles: INITIAL_FLEET_VEHICLES, equipment: INITIAL_FLEET_EQUIPMENT, trips: INITIAL_ROAD_TRIPS }), []);
  const hub = useMemo(() => buildHub(shipments, seed, fleet, now), [shipments, seed, fleet, now]);
  const cmp = useMemo(() => compareModes(measure(VELOCITY_RECORDS).valid), []);
  const STAGE_SHORT = { jobCreation: 'job creation', carrierBooking: 'carrier booking', docGeneration: 'doc generation' } as const;

  return (
    <section aria-label="Modal Hub" className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-900 text-base">Modal Hub</h3>
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800" aria-live="off">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
              </span>
              Live · {new Date(now).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Capacity and asset utilisation for each transport mode. Click a job to open it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
          {(['live', 'register', 'sample'] as Source[]).map((k) => (
            <span key={k} className="flex items-center gap-1"><SourceTag source={k} /> {SOURCE[k].title}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {LANES.map((meta) => {
          const s = cmp.byMode[meta.group];
          return (
            <Lane
              key={meta.group}
              meta={meta}
              lane={hub.lanes[meta.group]}
              now={now}
              velocity={{ avg: s.avg, n: s.n, bottleneck: STAGE_SHORT[s.bottleneck.stage] }}
              onSelectShipment={onSelectShipment}
              onNavigateView={onNavigateView}
            />
          );
        })}
      </div>
      {hub.unlaned > 0 && <p className="text-[11px] text-slate-500">{hub.unlaned} active job{hub.unlaned > 1 ? 's' : ''} on other modes (e.g. rail) are not shown in a lane.</p>}
    </section>
  );
};

export default ModalHub;
