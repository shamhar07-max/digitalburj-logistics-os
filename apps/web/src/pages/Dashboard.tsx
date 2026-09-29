import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, CheckSquare, CircleDollarSign, Plus, Ship, Target, TrendingUp, Activity, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useCan, useSession } from '../store/session';
import { aed, ago, describeActivity, monthName } from '../lib/format';
import { Bars, Card, Empty, Kpi, PageHead, Skeleton, StatusBadge, toast } from '../ui/kit';

const sevIcon = (s: string) => (s === 'high' ? 'bad' : s === 'medium' ? 'warn' : 'info');

export default function Dashboard() {
  const nav = useNavigate();
  const can = useCan();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard'), refetchInterval: 60_000 });
  const act = useMutation({
    mutationFn: async (a: { kind: string; id?: string }) => {
      if (a.kind === 'hold_customer') return api.patch(`/customers/${a.id}`, { status: 'hold' });
      if (a.kind === 'chase_pod') return api.post('/ai/actions/chase-pod', { shipment_id: a.id });
    },
    onSuccess: () => { toast.success('Done'); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
  const d = q.data;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHead title={`${greet}, ${user?.name?.split(' ')[0] || ''}`} sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · your business at a glance'}
        actions={can('shipments', 'c') && <button className="btn primary" onClick={() => nav('/shipments?new=1')}><Plus /> New shipment</button>} />
      {q.isLoading ? <Skeleton rows={6} /> : !d ? <Empty title="Dashboard unavailable" /> : (
        <>
          <div className="kpis">
            {d.shipments && <Kpi icon={<Ship />} label="Active shipments" value={d.shipments.active} sub={`${d.shipments.today} new today · ${d.shipments.at_risk} at risk`} tone={d.shipments.at_risk ? 'down' : 'up'} onClick={() => nav('/shipments')} />}
            {d.pipeline && <Kpi icon={<Target />} label="Pipeline value" value={aed(d.pipeline.value, { compact: true })} sub={`${d.pipeline.deals} open deals`} onClick={() => nav('/pipeline')} />}
            {d.ar && <Kpi icon={<CircleDollarSign />} label="Overdue AR" value={aed(d.ar.overdue, { compact: true })} sub={`${d.ar.overdueCustomers} customers · ${aed(d.ar.total, { compact: true })} total`} tone={d.ar.overdue ? 'down' : 'up'} onClick={() => nav('/invoices')} />}
            {d.cash !== undefined && <Kpi icon={<BookOpen />} label="Cash position" value={aed(d.cash, { compact: true })} sub="All bank accounts" onClick={() => nav('/accounting')} />}
            {d.margin && <Kpi icon={<TrendingUp />} label="Margin (7 days)" value={`${d.margin.pct}%`} sub={`${aed(d.margin.revenue - d.margin.cost, { compact: true })} gross`} tone={d.margin.pct >= 12 ? 'up' : 'down'} onClick={() => nav('/jobcosting')} />}
            {d.approvals && <Kpi icon={<CheckSquare />} label="Approvals" value={d.approvals.pending} sub={d.approvals.high ? `${d.approvals.high} high priority` : 'nothing urgent'} tone={d.approvals.high ? 'down' : undefined} onClick={() => nav('/approvals')} />}
          </div>

          <div className="grid g2">
            {d.priority && (
              <Card title="Priority actions" icon={<AlertTriangle />} actions={<button className="btn sm outline" onClick={() => nav('/ai')}>All agents</button>}>
                {!d.priority.length ? <Empty title="Nothing urgent" text="The agents found no high or medium-priority items." /> : d.priority.map((f: any, i: number) => (
                  <div className="list-item" key={i}>
                    <span className={`ico ${sevIcon(f.severity)}`}><AlertTriangle /></span>
                    <div style={{ flex: 1, minWidth: 0 }}><b>{f.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{f.detail}</div></div>
                    {f.action ? <button className="btn xs outline" onClick={() => act.mutate({ kind: f.action.kind, id: f.action.id })}>{f.action.label}</button>
                      : f.link && <button className="btn xs outline" onClick={() => nav(f.link)}>Open</button>}
                  </div>
                ))}
              </Card>
            )}
            <Card title="Recent activity" icon={<Activity />}>
              {!d.activity?.length ? <Empty title="No activity yet" /> : d.activity.map((a: any, i: number) => (
                <div className="list-item" key={i}>
                  <span className="ico"><Clock /></span>
                  <div style={{ flex: 1 }}><b>{a.user_name || 'System'}</b> {describeActivity(a.action, a.entity_type)}</div>
                  <span className="muted" style={{ fontSize: 12 }}>{ago(a.created_at)}</span>
                </div>
              ))}
            </Card>
            {d.revenueTrend && (
              <Card title="Revenue — last 6 months" icon={<TrendingUp />}>
                {d.revenueTrend.length ? <Bars data={d.revenueTrend.map((r: any) => ({ label: monthName(r.month), value: Math.round(r.revenue) }))} format={(n) => aed(n, { compact: true, noSymbol: true })} /> : <Empty title="No invoices yet" />}
              </Card>
            )}
            {d.byStatus && (
              <Card title="Shipments by stage" icon={<Ship />}>
                {d.byStatus.map((s: any) => (
                  <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 130 }}><StatusBadge value={s.status} /></div>
                    <div className="bar" style={{ flex: 1 }}><i style={{ width: `${(s.n / Math.max(...d.byStatus.map((x: any) => x.n))) * 100}%` }} /></div>
                    <b className="mono" style={{ width: 28, textAlign: 'end' }}>{s.n}</b>
                  </div>
                ))}
              </Card>
            )}
            {d.ar && (
              <Card title="Receivables ageing" icon={<CircleDollarSign />} actions={<button className="btn sm outline" onClick={() => nav('/accounting')}>Details</button>}>
                <Bars data={[['Current', d.ar.buckets.current], ['1–30d', d.ar.buckets.d1_30], ['31–60d', d.ar.buckets.d31_60], ['61–90d', d.ar.buckets.d61_90], ['90d+', d.ar.buckets.d90p]].map(([l, v]) => ({ label: l as string, value: Math.round(v as number) }))} format={(n) => aed(n, { compact: true, noSymbol: true })} />
              </Card>
            )}
            {d.topCustomers && (
              <Card title="Top customers (90 days)" icon={<Target />}>
                {d.topCustomers.length ? d.topCustomers.map((c: any, i: number) => (
                  <div className="list-item" key={c.id}><b className="mono" style={{ width: 20 }}>{i + 1}</b><span style={{ flex: 1 }}>{c.name}</span><b className="mono">{aed(c.revenue, { compact: true })}</b></div>
                )) : <Empty title="No billed revenue yet" />}
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
