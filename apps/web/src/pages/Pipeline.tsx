import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText } from 'lucide-react';
import { DEAL_STAGES } from '@digitalburj/shared';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, fdate, label } from '../lib/format';
import { Badge, Card, Kpi, PageHead, Skeleton, toast } from '../ui/kit';
import { FormModal, type FieldSpec } from '../ui/forms';

const FIELDS: FieldSpec[] = [
  { name: 'title', label: 'Deal title', required: true, span: 2 },
  { name: 'customer_id', label: 'Customer', type: 'ref', ref: { resource: 'customers' } },
  { name: 'stage', label: 'Stage', type: 'select', required: true, options: DEAL_STAGES as unknown as string[] },
  { name: 'value', label: 'Value (AED)', type: 'number', min: 0 }, { name: 'expected_close', label: 'Expected close', type: 'date' },
  { name: 'mode', label: 'Mode', type: 'select', options: ['sea_fcl', 'sea_lcl', 'air', 'road', 'multimodal'] }, { name: 'lane', label: 'Lane', placeholder: 'Shanghai → Jebel Ali' },
  { name: 'source', label: 'Source', type: 'select', options: ['referral', 'website', 'linkedin', 'expo', 'cold_outreach', 'whatsapp', 'other'] },
  { name: 'owner_id', label: 'Owner', type: 'ref', ref: { resource: 'lookup/users' } },
  { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
];

export default function Pipeline() {
  const nav = useNavigate();
  const can = useCan();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<any>(null);
  const deals = useQuery({ queryKey: ['res', 'deals', 'board'], queryFn: () => api.get('/deals?pageSize=300') });
  const sum = useQuery({ queryKey: ['res', 'pipeline-summary'], queryFn: () => api.get('/pipeline/summary') });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['res'] }); };

  const move = useMutation({
    mutationFn: (v: { id: string; stage: string; lost_reason?: string }) => api.post(`/pipeline/deals/${v.id}/move`, { stage: v.stage, position: 0, lost_reason: v.lost_reason }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['res', 'deals', 'board'] });
      const prev = qc.getQueryData<any>(['res', 'deals', 'board']);
      qc.setQueryData(['res', 'deals', 'board'], (old: any) => old && { ...old, data: old.data.map((d: any) => (d.id === v.id ? { ...d, stage: v.stage } : d)) });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['res', 'deals', 'board'], ctx.prev),
    onSettled: refresh,
  });

  const rows: any[] = deals.data?.data || [];
  const open = rows.filter((d) => !['won', 'lost'].includes(d.stage));
  const S = sum.data;

  const drop = (stage: string) => {
    const d = rows.find((r) => r.id === drag);
    setOver(null); setDrag(null);
    if (!d || d.stage === stage) return;
    if (stage === 'lost') setLostFor(d);
    else move.mutate({ id: d.id, stage });
  };

  return (
    <>
      <PageHead title="Sales pipeline" sub="Drag cards between stages. Sending a quote advances the deal; accepting it marks it won."
        actions={can('pipeline', 'c') && <button className="btn primary" onClick={() => setEditing({ stage: 'lead', currency: 'AED' })}><Plus /> New deal</button>} />
      <div className="kpis">
        <Kpi label="Open deals" value={S?.openDeals ?? open.length} />
        <Kpi label="Pipeline value" value={aed(S?.pipelineValue ?? open.reduce((x, d) => x + Number(d.value), 0), { compact: true })} />
        <Kpi label="Won this month" value={S?.wonThisMonth?.n ?? 0} sub={aed(S?.wonThisMonth?.value, { compact: true })} tone="up" />
        <Kpi label="Win rate (month)" value={`${S?.winRatePct ?? 0}%`} />
      </div>
      {deals.isLoading ? <Skeleton rows={6} /> : (
        <div className="board" aria-label="Deals board">
          {DEAL_STAGES.map((stage) => {
            const list = rows.filter((d) => d.stage === stage);
            return (
              <div key={stage} className={`col ${over === stage ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(stage); }} onDragLeave={() => setOver(null)} onDrop={() => drop(stage)}>
                <div className="col-h"><span>{label(stage)}</span><small>{list.length} · {aed(list.reduce((x, d) => x + Number(d.value), 0), { compact: true, noSymbol: true })}</small></div>
                <div className="col-b">
                  {list.map((d) => (
                    <div key={d.id} className={`kcard ${drag === d.id ? 'drag' : ''}`} draggable={can('pipeline', 'u')} onDragStart={() => setDrag(d.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => can('pipeline', 'u') && setEditing(d)}>
                      <b>{d.title}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{d.customer_name || 'No customer'}{d.lane ? ` · ${d.lane}` : ''}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <b className="mono">{aed(d.value, { compact: true })}</b>
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {d.source && <Badge>{label(d.source)}</Badge>}
                          {can('quotes', 'c') && !['won', 'lost'].includes(d.stage) && <button className="icon-btn" style={{ width: 26, height: 26 }} aria-label="Create quote" title="Create quote" onClick={(e) => { e.stopPropagation(); nav(`/quotes/new?deal=${d.id}&customer=${d.customer_id || ''}`); }}><FileText /></button>}
                        </span>
                      </div>
                      {d.expected_close && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Close {fdate(d.expected_close)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {S?.sources?.length > 0 && (
        <Card title="Lead source → revenue" className="mt">
          <div className="table-wrap"><table className="t"><thead><tr><th>Source</th><th className="num">Deals</th><th className="num">Won</th><th className="num">Won value</th></tr></thead>
            <tbody>{S.sources.map((r: any) => <tr key={r.source}><td>{label(r.source)}</td><td className="num">{r.deals}</td><td className="num">{r.won}</td><td className="num">{aed(r.won_value, { noSymbol: true })}</td></tr>)}</tbody></table></div>
        </Card>
      )}
      {editing && <FormModal title={editing.id ? 'Edit deal' : 'New deal'} fields={FIELDS} initial={editing} onSubmit={async (v) => { editing.id ? await api.patch(`/deals/${editing.id}`, v) : await api.post('/deals', v); refresh(); toast.success('Deal saved'); }} onClose={() => setEditing(null)} />}
      {lostFor && <FormModal title={`Mark “${lostFor.title}” as lost`} fields={[{ name: 'lost_reason', label: 'Why was it lost?', type: 'select', required: true, options: ['Price — competitor cheaper', 'Service / transit time', 'Customer went silent', 'Project cancelled', 'Went direct to carrier', 'Other'] }]} submitLabel="Mark lost"
        onSubmit={async (v) => { await move.mutateAsync({ id: lostFor.id, stage: 'lost', lost_reason: v.lost_reason }); }} onClose={() => setLostFor(null)} />}
    </>
  );
}
