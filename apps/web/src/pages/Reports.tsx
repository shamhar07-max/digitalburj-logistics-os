import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Globe, Clock, ShieldCheck, Truck, Target, Users } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useCan } from '../store/session';
import { aed, label, today } from '../lib/format';
import { Card, DataTable, PageHead } from '../ui/kit';
import { CsvButton } from '../ui/ResourceTable';

const REPORTS = [
  { key: 'sales-performance', title: 'Sales performance', icon: Target, module: 'reports', cols: [['owner', 'Owner'], ['won', 'Won'], ['lost', 'Lost'], ['open', 'Open'], ['won_value', 'Won value', 'aed'], ['pipeline_value', 'Pipeline', 'aed']] },
  { key: 'lane-profitability', title: 'Trade lane profitability', icon: Globe, module: 'costs', cols: [['lane', 'Lane'], ['mode', 'Mode'], ['shipments', 'Jobs'], ['revenue', 'Revenue', 'aed'], ['cost', 'Cost', 'aed'], ['margin', 'Margin', 'aed'], ['margin_pct', 'Margin %', 'pct']] },
  { key: 'ar-ageing', title: 'AR ageing', icon: Clock, module: 'invoices', special: 'ar' },
  { key: 'customs-clearance', title: 'Customs clearance', icon: ShieldCheck, module: 'reports', cols: [['type', 'Type'], ['declarations', 'Declarations'], ['cleared', 'Cleared'], ['on_hold', 'On hold'], ['rejected', 'Rejected'], ['avg_days_to_clear', 'Avg days to clear'], ['duty', 'Duty', 'aed']] },
  { key: 'driver-productivity', title: 'Driver productivity', icon: Truck, module: 'reports', cols: [['driver', 'Driver'], ['trips', 'Trips'], ['stops_done', 'Stops done'], ['stops_failed', 'Failed'], ['pods', 'PODs'], ['pods_verified', 'Verified']] },
  { key: 'carrier-scorecard', title: 'Carrier scorecard', icon: BarChart3, module: 'reports', cols: [['carrier', 'Carrier'], ['shipments', 'Jobs'], ['measured', 'Measured'], ['on_time_pct', 'On-time %'], ['avg_delay_days', 'Avg delay (days)']] },
  { key: 'growth-attribution', title: 'Lead source attribution', icon: Users, module: 'reports', cols: [['source', 'Source'], ['deals', 'Deals'], ['won', 'Won'], ['won_value', 'Won value', 'aed']] },
];
const fmt = (v: any, t?: string) => (v === null || v === undefined ? '—' : t === 'aed' ? aed(v, { noSymbol: true }) : t === 'pct' ? `${v}%` : typeof v === 'string' ? label(v) === '—' ? v : v : v);

export default function Reports() {
  const can = useCan();
  const [active, setActive] = useState(REPORTS[0].key);
  const [from, setFrom] = useState(new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today());
  const rep = REPORTS.find((r) => r.key === active)!;
  const path = `/reports/${active}${qs({ from, to })}`;
  const q = useQuery({ queryKey: ['res', 'report', active, from, to], queryFn: () => api.get(path) });
  const rows = rep.special === 'ar' ? (q.data?.customers || []).map((c: any) => ({ customer: c.customer_name, total: c.total, ...c.buckets })) : q.data?.data || [];
  const cols = rep.special === 'ar' ? [['customer', 'Customer'], ['current', 'Current', 'aed'], ['d1_30', '1–30', 'aed'], ['d31_60', '31–60', 'aed'], ['d61_90', '61–90', 'aed'], ['d90p', '90+', 'aed'], ['total', 'Total', 'aed']] : rep.cols!;
  return (
    <>
      <PageHead title="Reports" sub="Operational and financial reports with CSV export (formula-injection safe)." actions={can('reports', 'x') && <CsvButton path={path} />} />
      <div className="grid g4" style={{ marginBottom: 16 }}>
        {REPORTS.filter((r) => can(r.module, 'r')).map((r) => (
          <button key={r.key} className="kpi" style={{ borderColor: active === r.key ? 'var(--signal)' : undefined }} onClick={() => setActive(r.key)}><div className="kpi-l"><r.icon />{r.title}</div></button>
        ))}
      </div>
      <Card title={rep.title} pad={false} actions={rep.special ? null : <><input type="date" className="input" style={{ width: 150, height: 32 }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><input type="date" className="input" style={{ width: 150, height: 32 }} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" /></>}>
        <DataTable loading={q.isLoading} rows={rows} rowKey={String(cols[0][0])} columns={cols.map(([k, l, t]) => ({ key: k as string, label: l as string, num: !!t || ['won', 'lost', 'open', 'shipments', 'declarations', 'trips', 'deals'].includes(k as string), render: (r: any) => fmt(r[k as string], t as string) }))} />
      </Card>
    </>
  );
}
