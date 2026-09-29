import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Anchor, CheckCircle2, Plane, Truck } from 'lucide-react';
import { MODE_GROUPS, buildHub, fmtCountdown, type Bar, type HubInput, type LaneModel, type ModeGroup, type Source, type Tone } from '@digitalburj/shared';
import { api } from '../lib/api';
import { label } from '../lib/format';
import { Badge, Card, Empty, Skeleton, StatusBadge } from '../ui/kit';

const ICON: Record<ModeGroup, typeof Anchor> = { Sea: Anchor, Air: Plane, Road: Truck };
const SOURCE_TEXT: Record<Source, string> = { live: 'live', register: 'register', sample: 'sample' };
const SOURCE_HINT: Record<Source, string> = {
  live: 'Computed now from job records',
  register: 'From the fleet / equipment register',
  sample: 'Entered manually — connect a terminal, airline or GPS feed to make this live',
};
const toneBadge = (t: Tone) => (t === 'risk' ? 'bad' : t === 'warn' ? 'warn' : 'ok');

export const SourceTag = ({ source }: { source: Source }) => (
  <span className={`src src-${source}`} title={SOURCE_HINT[source]}>{SOURCE_TEXT[source]}</span>
);

function UtilBar({ bar, now }: { bar: Bar; now: number }) {
  const width = Math.min(100, Math.max(0, bar.pct));
  return (
    <div className="hub-bar" data-tone={bar.tone}>
      <div className="hub-bar-h">
        <span className="hub-bar-l"><b>{bar.label}</b>{bar.sublabel && <span className="muted"> · {bar.sublabel}</span>}</span>
        <span className="mono hub-bar-v">{bar.used}/{bar.total} {bar.unit} · {Math.round(bar.pct)}%</span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={Math.round(bar.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${bar.label} utilisation`}><i style={{ width: `${width}%` }} /></div>
      {(bar.note || bar.cutoffAt) && (
        <div className="hub-bar-n">
          {bar.cutoffAt && <span>Cut-off in <b className="mono">{fmtCountdown(bar.cutoffAt - now)}</b></span>}
          {bar.note && <span>{bar.note}</span>}
        </div>
      )}
    </div>
  );
}

function Lane({ lane, now }: { lane: LaneModel; now: number }) {
  const Icon = ICON[lane.group];
  return (
    <section className="hub-lane" aria-label={`${lane.group} lane`} data-group={lane.group}>
      <header className="hub-lane-h">
        <span className="hub-lane-i"><Icon /></span>
        <div style={{ flex: 1 }}>
          <h3>{lane.group}</h3>
          <span className="muted">{lane.headline.label}</span>
        </div>
        <b className="hub-lane-v" data-tone={lane.headline.tone}>{lane.headline.value}</b>
      </header>

      <div className="hub-metrics">
        {lane.metrics.map((m) => (
          <div key={m.label} className="hub-metric" data-tone={m.tone}>
            <div className="hub-metric-l">{m.label} <SourceTag source={m.source} /></div>
            <div className="hub-metric-v">{m.value}</div>
            {m.sub && <div className="hub-metric-s">{m.sub}</div>}
          </div>
        ))}
      </div>

      {lane.alerts.length > 0 && (
        <ul className="hub-alerts">
          {lane.alerts.map((a, i) => (
            <li key={i} data-tone={a.tone}><AlertTriangle size={14} /> {a.text}</li>
          ))}
        </ul>
      )}

      {lane.sections.map((s) => (
        <div key={s.id} className="hub-sec">
          <div className="hub-sec-h"><span>{s.title}</span> <SourceTag source={s.source} /></div>
          {s.bars.length ? s.bars.map((b) => <UtilBar key={b.key} bar={b} now={now} />) : <p className="muted" style={{ fontSize: 12.5 }}>Nothing recorded yet.</p>}
        </div>
      ))}

      {lane.vehicles && lane.vehicles.length > 0 && (
        <div className="hub-sec">
          <div className="hub-sec-h"><span>Fleet</span> <SourceTag source="register" /></div>
          {lane.vehicles.map((v) => (
            <div key={v.vehicle.id} className="hub-veh" data-tone={v.tone}>
              <span className="mono"><b>{v.vehicle.plate}</b></span>
              <span className="muted">{v.vehicle.driver_name || 'no driver'}</span>
              <StatusBadge value={v.vehicle.status} />
              {v.note && <span className="hub-veh-n">{v.note}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="hub-sec">
        <div className="hub-sec-h"><span>Jobs needing action</span> <SourceTag source="live" /></div>
        {lane.jobs.length === 0 ? <p className="muted" style={{ fontSize: 12.5 }}><CheckCircle2 size={13} /> No open {lane.group.toLowerCase()} jobs.</p> : lane.jobs.map((j) => (
          <Link key={j.shipment.id} to={`/shipments/${j.shipment.id}`} className="hub-job" data-attn={j.attention || undefined}>
            <b className="mono">{j.shipment.number}</b>
            <span className="hub-job-c">{j.shipment.customer || '—'}</span>
            <Badge tone={j.attention ? 'bad' : ''}>{label(j.shipment.status)}</Badge>
          </Link>
        ))}
        {lane.hiddenJobs > 0 && <Link to={`/shipments?mode=${lane.group === 'Sea' ? 'sea_fcl' : lane.group.toLowerCase()}`} className="muted" style={{ fontSize: 12.5 }}>+{lane.hiddenJobs} more</Link>}
      </div>
    </section>
  );
}

/** Sea / Air / Road swimlanes. The API returns raw rows; every figure is computed in the shared `buildHub`. */
export function ModalHub() {
  const q = useQuery({ queryKey: ['modal-hub'], queryFn: () => api.get<{ now: number; input: HubInput }>('/insight/modal-hub'), refetchInterval: 30_000 });
  const [focus, setFocus] = useState<ModeGroup | 'All'>('All');
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  // Anchor to the server clock so the cut-off countdowns are right even when the device clock is off.
  const offset = useMemo(() => (q.data ? q.data.now - Date.now() : 0), [q.data]);
  const now = Date.now() + offset + 0 * tick;
  const hub = useMemo(() => (q.data ? buildHub(q.data.input, now) : null), [q.data, Math.floor(now / 15_000)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <Skeleton rows={5} />;
  if (q.error || !hub) return <Card title="Modal Hub"><Empty title="Modal Hub unavailable" text="Could not load lane data." /></Card>;
  const groups = focus === 'All' ? MODE_GROUPS : [focus];
  return (
    <div className="hub" aria-label="Modal Hub">
      <div className="hub-bar-top">
        <div>
          <h2 className="hub-title">Modal Hub</h2>
          <span className="muted">Capacity and asset utilisation per mode · <SourceTag source="live" /> job records · <SourceTag source="register" /> fleet · <SourceTag source="sample" /> manual allotments</span>
        </div>
        <div className="chips" role="tablist" aria-label="Lane focus">
          {(['All', ...MODE_GROUPS] as const).map((g) => (
            <button key={g} role="tab" aria-selected={focus === g} className={`chip ${focus === g ? 'on' : ''}`} onClick={() => setFocus(g)}>{g}</button>
          ))}
        </div>
      </div>
      <div className={`hub-lanes hub-${groups.length}`}>
        {groups.map((g) => <Lane key={g} lane={hub.lanes[g]} now={now} />)}
      </div>
      {hub.unlaned > 0 && <p className="muted" style={{ fontSize: 12.5 }}>{hub.unlaned} multimodal job(s) are not shown in a single lane.</p>}
    </div>
  );
}
export { toneBadge };
