import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, qs } from '../lib/api';
import { aed, label, today } from '../lib/format';
import { Card, DataTable, Kpi, PageHead } from '../ui/kit';
import { CsvButton } from '../ui/ResourceTable';

export default function JobCosting() {
  const nav = useNavigate();
  const [from, setFrom] = useState(new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today());
  const jobs = useQuery({ queryKey: ['res', 'jc', from, to], queryFn: () => api.get(`/reports/job-costing${qs({ from, to })}`) });
  const lanes = useQuery({ queryKey: ['res', 'lane', from, to], queryFn: () => api.get(`/reports/lane-profitability${qs({ from, to })}`) });
  const rows: any[] = jobs.data?.data || [];
  const rev = rows.reduce((x, r) => x + r.revenue, 0), cost = rows.reduce((x, r) => x + r.cost, 0);
  const pctCell = (r: any) => <span className={r.margin_pct < 8 ? 'down' : 'up'}>{r.margin_pct}%</span>;
  return (
    <>
      <PageHead title="Job costing" sub="Per-shipment and per-lane profitability: quoted revenue against carrier and local cost lines." actions={<CsvButton path={`/reports/job-costing${qs({ from, to })}`} />} />
      <div className="toolbar"><label className="muted">From</label><input type="date" className="input" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} /><label className="muted">To</label><input type="date" className="input" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="kpis"><Kpi label="Revenue" value={aed(rev, { compact: true })} /><Kpi label="Cost" value={aed(cost, { compact: true })} /><Kpi label="Gross margin" value={aed(rev - cost, { compact: true })} sub={`${rev ? (((rev - cost) / rev) * 100).toFixed(1) : 0}%`} tone={rev - cost >= 0 ? 'up' : 'down'} /><Kpi label="Loss-making jobs" value={rows.filter((r) => r.margin < 0).length} tone="down" /></div>
      <div className="grid g2">
        <Card title="By shipment" pad={false}><DataTable loading={jobs.isLoading} rows={rows} onRowClick={(r) => nav(`/shipments/${r.id}`)} columns={[{ key: 'number', label: 'Job', render: (r) => <b className="mono">{r.number}</b> }, { key: 'customer', label: 'Customer', hideSm: true }, { key: 'revenue', label: 'Revenue', num: true, render: (r) => aed(r.revenue, { noSymbol: true }) }, { key: 'cost', label: 'Cost', num: true, render: (r) => aed(r.cost, { noSymbol: true }) }, { key: 'margin', label: 'Margin', num: true, render: (r) => aed(r.margin, { noSymbol: true }) }, { key: 'margin_pct', label: '%', num: true, render: pctCell }]} /></Card>
        <Card title="By lane" pad={false}><DataTable loading={lanes.isLoading} rows={lanes.data?.data || []} rowKey="lane" columns={[{ key: 'lane', label: 'Lane', render: (r) => <b>{r.lane}</b> }, { key: 'mode', label: 'Mode', render: (r) => label(r.mode), hideSm: true }, { key: 'shipments', label: 'Jobs', num: true }, { key: 'revenue', label: 'Revenue', num: true, render: (r) => aed(r.revenue, { noSymbol: true }) }, { key: 'margin', label: 'Margin', num: true, render: (r) => aed(r.margin, { noSymbol: true }) }, { key: 'margin_pct', label: '%', num: true, render: pctCell }]} /></Card>
      </div>
    </>
  );
}
