import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Banner, Card, Empty, PageHead, Skeleton, toast } from '../ui/kit';

export default function AiAgents() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['res', 'agents'], queryFn: () => api.get('/ai/agents'), refetchInterval: 120_000 });
  const act = useMutation({
    mutationFn: async (a: { kind: string; id?: string }) => (a.kind === 'hold_customer' ? api.patch(`/customers/${a.id}`, { status: 'hold' }) : api.post('/ai/actions/chase-pod', { shipment_id: a.id })),
    onSuccess: () => { toast.success('Done'); qc.invalidateQueries({ queryKey: ['res'] }); },
  });
  return (
    <>
      <PageHead title="AI agents" sub="Eight watchers over your live data. Each finding is explainable — it names the rule and the record. Agents recommend; people decide." />
      <Banner>Engine: <b>{q.data?.engine || '…'}</b>. Agents never send messages, move money or file declarations on their own. Enable the assistant’s language model with <code className="mono">ANTHROPIC_API_KEY</code>.</Banner>
      {q.isLoading ? <Skeleton rows={6} /> : (
        <div className="grid g2">
          {q.data.agents.map((a: any) => (
            <Card key={a.key} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{a.name}</span>} icon={<Bot />} actions={<Badge tone={a.status === 'attention' ? 'bad' : a.status === 'watching' ? 'warn' : 'ok'}>{a.status === 'clear' ? 'all clear' : `${a.findings.length} finding${a.findings.length === 1 ? '' : 's'}`}</Badge>}>
              <p className="muted" style={{ marginBottom: 8 }}>{a.desc}</p>
              {!a.findings.length ? <Empty title="Nothing to report" /> : a.findings.slice(0, 5).map((f: any, i: number) => (
                <div className="list-item" key={i}>
                  <span className={`ico ${f.severity === 'high' ? 'bad' : f.severity === 'medium' ? 'warn' : 'info'}`}><Bot /></span>
                  <div style={{ flex: 1, minWidth: 0 }}><b>{f.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{f.detail}</div></div>
                  {f.action ? <button className="btn xs outline" onClick={() => act.mutate({ kind: f.action.kind, id: f.action.id })}>{f.action.label}</button> : f.link && <button className="btn xs outline" onClick={() => nav(f.link)}>Open</button>}
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
