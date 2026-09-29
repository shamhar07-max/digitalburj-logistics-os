import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Gauge } from 'lucide-react';
import {
  MODE_GROUPS, SLA_MINUTES, TARGET_MINUTES, VELOCITY_STAGES, compareModes, diagnose, fmtMinutes, measure, modeGroup, slaLabel, summarise, toCsv,
  type ModeGroup, type ModeSummary, type VelocityRecord,
} from '@digitalburj/shared';
import { api } from '../lib/api';
import { fdt, label } from '../lib/format';
import { Badge, Banner, Card, DataTable, Empty, Kpi, PageHead, Skeleton } from '../ui/kit';

type Scope = 'All' | ModeGroup;

function StageBar({ s }: { s: ModeSummary }) {
  const total = s.avg || 1;
  return (
    <div className="stack" role="img" aria-label={`${s.scope}: ${VELOCITY_STAGES.map((st) => `${st.short} ${fmtMinutes(s.stageAvg[st.key])} minutes`).join(', ')}`}>
      {VELOCITY_STAGES.map((st) => <i key={st.key} style={{ width: `${(s.stageAvg[st.key] / total) * 100}%` }} title={`${st.short}: ${fmtMinutes(s.stageAvg[st.key])} min`} />)}
    </div>
  );
}

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/** Quote Accepted → Document Generation, measured from real timestamps, broken down by Sea / Air / Road. */
export default function Velocity() {
  const [days, setDays] = useState(90);
  const [scope, setScope] = useState<Scope>('All');
  const [compare, setCompare] = useState(true);
  const q = useQuery({ queryKey: ['velocity', days], queryFn: () => api.get<{ records: VelocityRecord[]; coverage: { acceptedQuotes: number; measured: number; pending: number } }>(`/insight/velocity?days=${days}`) });

  const m = useMemo(() => measure(q.data?.records ?? []), [q.data]);
  const cmp = useMemo(() => compareModes(m.valid), [m.valid]);
  const view = scope === 'All' ? cmp.all : cmp.byMode[scope];
  const rows = useMemo(() => m.valid.filter((r) => scope === 'All' || r.group === scope), [m.valid, scope]);
  const diag = useMemo(() => diagnose(m.valid, scope), [m.valid, scope]);
  const cov = q.data?.coverage;

  return (
    <>
      <PageHead title="Operational velocity" sub={`From “Quote accepted” to “Documents generated” — target under ${TARGET_MINUTES} min, SLA ${SLA_MINUTES} min. Customs clearance is downstream and not counted.`}
        actions={<>
          <select className="select" style={{ width: 150 }} aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option></select>
          <button className="btn outline" disabled={!rows.length} onClick={() => download(`velocity-${scope.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))}><Download /> CSV</button>
        </>} />

      <div className="chips" style={{ marginBottom: 14 }} role="tablist" aria-label="Mode filter">
        {(['All', ...MODE_GROUPS] as Scope[]).map((g) => <button key={g} role="tab" aria-selected={scope === g} className={`chip ${scope === g ? 'on' : ''}`} onClick={() => setScope(g)}>{g === 'All' ? 'All modes' : g}</button>)}
        <label className="check" style={{ marginInlineStart: 12 }}><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare Sea · Air · Road</label>
      </div>

      {q.isLoading ? <Skeleton rows={6} /> : !q.data ? <Empty title="Report unavailable" /> : (
        <>
          {cov && cov.pending > 0 && <Banner kind="info">{cov.pending} accepted order(s) in this period are not measured yet — their booking has not been confirmed or their documents have not been generated.</Banner>}
          {m.rejected.length > 0 && <Banner kind="warn">{m.rejected.length} record(s) were left out because their timestamps are missing or out of order.</Banner>}
          {m.valid.length === 0 ? <Empty icon={<Gauge />} title="No measurable orders" text="An order is measured once its quote is accepted, its booking is confirmed and its documents are generated." /> : (
            <>
              <div className="kpis">
                <Kpi label="Orders measured" value={view.n} sub={scope === 'All' ? 'all modes' : scope} />
                <Kpi label="Average" value={`${fmtMinutes(view.avg)} min`} sub={slaLabel(view.avg).text} tone={view.avg > SLA_MINUTES ? 'down' : 'up'} />
                <Kpi label="Median" value={`${fmtMinutes(view.median)} min`} />
                <Kpi label="90th percentile" value={`${fmtMinutes(view.p90)} min`} />
                <Kpi label="Over SLA" value={`${Math.round(view.slaBreachPct)}%`} sub={`> ${SLA_MINUTES} min`} tone={view.slaBreachPct > 20 ? 'down' : 'up'} />
              </div>

              {compare && (
                <Card title="Where the time goes, by mode" icon={<Gauge />}>
                  <div className="legend" style={{ marginBottom: 10 }}>{VELOCITY_STAGES.map((s, i) => <span key={s.key}><i style={{ background: ['#8aa4b8', 'var(--signal)', '#3a8f6e'][i] }} />{s.short}</span>)}</div>
                  {MODE_GROUPS.map((g) => {
                    const s = cmp.byMode[g];
                    return (
                      <div key={g} style={{ marginBottom: 14, opacity: scope !== 'All' && scope !== g ? .45 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <b>{g} <span className="muted">· {s.n} orders</span></b>
                          <span className="mono">{s.n ? `${fmtMinutes(s.avg)} min avg` : 'no data'}{s.n > 0 && s.bottleneck.flagged && <> · <Badge tone="warn">bottleneck: {VELOCITY_STAGES.find((x) => x.key === s.bottleneck.stage)!.short}</Badge></>}</span>
                        </div>
                        {s.n > 0 ? <StageBar s={s} /> : <div className="stack" />}
                      </div>
                    );
                  })}
                  <p className="hint">Slowest mode per stage: {VELOCITY_STAGES.map((st) => `${st.short} → ${cmp.slowestByStage[st.key] ?? '—'}`).join(' · ')}</p>
                </Card>
              )}

              <div className="grid" style={{ marginTop: 14 }}>
                <Card title={scope === 'All' ? 'Stage averages (all modes)' : `Stage averages · ${scope}`} pad={false}>
                  <DataTable rowKey="key" rows={VELOCITY_STAGES.map((s) => ({ key: s.key, label: s.label, desc: s.desc, avg: view.stageAvg[s.key], flagged: view.bottleneck.flagged && view.bottleneck.stage === s.key }))} columns={[
                    { key: 'label', label: 'Stage', render: (r: any) => <span><b>{r.label}</b><div className="muted" style={{ fontSize: 12 }}>{r.desc}</div></span> },
                    { key: 'avg', label: 'Avg (min)', num: true, render: (r: any) => <span className="mono">{fmtMinutes(r.avg)} {r.flagged && <Badge tone="warn">bottleneck</Badge>}</span> },
                  ]} />
                </Card>
                <Card title="Diagnosed bottlenecks" pad={false}>
                  {diag.length === 0 ? <Empty title="No stage stands out" text="No mode is materially slower than the average, and no recorded hold reason adds delay." /> : (
                    <DataTable rowKey="key" rows={diag} columns={[
                      { key: 'title', label: 'Bottleneck', render: (r: any) => <span><b>{r.title}</b> <Badge>{r.scope}</Badge><div className="muted" style={{ fontSize: 12 }}>{r.rootCause}</div><div style={{ fontSize: 12 }}>→ {r.action}</div></span> },
                      { key: 'delayMinutes', label: 'Extra (min)', num: true, render: (r: any) => <span title={`${r.basis} · ${r.samples} orders`} className="mono">+{fmtMinutes(r.delayMinutes)}</span> },
                    ]} />
                  )}
                </Card>
              </div>

              <Card title={`Orders (${rows.length})`} pad={false} className="" actions={<span className="muted" style={{ fontSize: 12 }}>Latest 500 in period</span>}>
                <DataTable rowKey="id" rows={rows.map((r) => ({ id: r.rec.id, ...r }))} columns={[
                  { key: 'job', label: 'Job', render: (r: any) => (r.rec.shipmentId ? <Link className="mono" to={`/shipments/${r.rec.shipmentId}`}><b>{r.rec.jobNo}</b></Link> : <b className="mono">{r.rec.jobNo}</b>) },
                  { key: 'customer', label: 'Customer', render: (r: any) => <span>{r.rec.customer}<div className="muted" style={{ fontSize: 12 }}>{r.rec.lane}</div></span> },
                  { key: 'mode', label: 'Mode', render: (r: any) => label(r.rec.mode) },
                  { key: 'accepted', label: 'Accepted', render: (r: any) => fdt(r.rec.acceptedAt) },
                  { key: 'jobCreation', label: 'Job', num: true, render: (r: any) => fmtMinutes(r.stages.jobCreation) },
                  { key: 'carrierBooking', label: 'Booking', num: true, render: (r: any) => fmtMinutes(r.stages.carrierBooking) },
                  { key: 'docGeneration', label: 'Docs', num: true, render: (r: any) => fmtMinutes(r.stages.docGeneration) },
                  { key: 'total', label: 'Total (min)', num: true, render: (r: any) => { const s = slaLabel(r.total); return <span className="mono"><b>{fmtMinutes(r.total)}</b> <Badge tone={s.tone === 'breach' ? 'bad' : s.tone === 'fast' ? 'ok' : ''}>{s.tone === 'breach' ? 'slow' : s.tone === 'fast' ? 'fast' : 'ok'}</Badge>{r.rec.holdReason && <> <Badge tone="warn">no TRN</Badge></>}</span>; } },
                ]} />
              </Card>
              <p className="hint" style={{ marginTop: 8 }}>Measured from: quote accepted → job created → booking confirmed → first full document set generated. Modes group as Sea = FCL + LCL. {modeGroup('multimodal') === null && 'Multimodal jobs are excluded from the per-mode view.'}</p>
            </>
          )}
        </>
      )}
    </>
  );
}
