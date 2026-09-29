import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { aed, fdate, label } from '../lib/format';
import { Bars, Card, DataTable, Kpi, PageHead } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';

const METRICS = [['seo_health', 'SEO health'], ['ai_visibility', 'AI visibility (AEO/GEO)'], ['content_authority', 'Content authority']];
export default function Growth() {
  const m = useQuery({ queryKey: ['res', 'growth-latest'], queryFn: () => api.get('/growth-metrics?pageSize=100') });
  const attr = useQuery({ queryKey: ['res', 'attr'], queryFn: () => api.get('/reports/growth-attribution') });
  const latest = (k: string) => (m.data?.data || []).find((x: any) => x.metric === k);
  return (
    <>
      <PageHead title="Growth platform" sub="Search and AI visibility scores next to CRM revenue — so marketing is judged by won shipments, not clicks." />
      <div className="kpis">{METRICS.map(([k, l]) => <Kpi key={k} label={l} value={latest(k) ? `${Math.round(latest(k).score)}/100` : '—'} sub={latest(k) ? `as of ${fdate(latest(k).period)}` : 'Record a score below'} />)}</div>
      <Card title="Lead source → won revenue" pad={false}>
        <div style={{ padding: 12 }}><Bars data={(attr.data?.data || []).slice(0, 8).map((r: any) => ({ label: label(r.source), value: Math.round(r.won_value) }))} format={(n) => aed(n, { compact: true, noSymbol: true })} /></div>
        <DataTable rows={attr.data?.data || []} rowKey="source" columns={[{ key: 'source', label: 'Source', render: (r) => label(r.source) }, { key: 'deals', label: 'Deals', num: true }, { key: 'won', label: 'Won', num: true }, { key: 'won_value', label: 'Won value', num: true, render: (r) => aed(r.won_value, { noSymbol: true }) }]} />
      </Card>
      <Card title="Score history" className="mt">
        <ResourceTable resource="growth-metrics" module="growth" noun="score" fields={[{ name: 'metric', label: 'Metric', type: 'select', required: true, options: METRICS.map(([v, l]) => ({ value: v, label: l })) }, { name: 'score', label: 'Score (0–100)', type: 'number', required: true, min: 0 }, { name: 'period', label: 'Date', type: 'date' }, { name: 'notes', label: 'Notes', type: 'textarea', span: 2 }]}
          columns={[{ key: 'period', label: 'Date', render: (r) => fdate(r.period) }, { key: 'metric', label: 'Metric', render: (r) => label(r.metric) }, { key: 'score', label: 'Score', num: true }, { key: 'notes', label: 'Notes' }]} />
      </Card>
    </>
  );
}
