import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, ago, label } from '../lib/format';
import { Badge, Card, Empty, PageHead, Skeleton, StatusBadge, Tabs, toast } from '../ui/kit';
import { FormModal } from '../ui/forms';

export default function Approvals() {
  const can = useCan();
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [deciding, setDeciding] = useState<{ a: any; approve: boolean } | null>(null);
  const q = useQuery({ queryKey: ['approvals', tab], queryFn: () => api.get(`/approvals?status=${tab}`) });
  const rows: any[] = q.data?.data || [];
  const decide = useMutation({ mutationFn: (v: { id: string; approve: boolean; note?: string }) => api.post(`/approvals/${v.id}/decide`, { approve: v.approve, note: v.note }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['approvals'] }); qc.invalidateQueries({ queryKey: ['res'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); } });
  return (
    <>
      <PageHead title="Approvals" sub="One queue for quotes below margin floor, purchase orders, payroll runs, leave and large driver expenses. Requesters cannot approve their own requests." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'pending', label: 'Pending', badge: tab === 'pending' ? rows.length : undefined }, { key: 'history', label: 'Decided' }]} />
      {q.isLoading ? <Skeleton /> : !rows.length ? <Empty title={tab === 'pending' ? 'Nothing waiting for you' : 'No decisions yet'} /> : rows.map((a) => (
        <Card key={a.id} className="mt">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Badge tone="info">{label(a.entity_type)}</Badge>{a.priority === 'high' && <Badge tone="bad">high priority</Badge>}<b>{a.title}</b></div>
              <div className="muted" style={{ marginTop: 3 }}>{a.summary}</div>
              <div className="muted" style={{ fontSize: 12 }}>Requested by {a.requested_by_name || 'system'} · {ago(a.created_at)}{a.decided_by_name ? ` · decided by ${a.decided_by_name}` : ''}{a.decision_note ? ` — “${a.decision_note}”` : ''}</div>
            </div>
            {a.amount != null && <b className="mono" style={{ fontSize: 18 }}>{aed(a.amount, { compact: true })}</b>}
            {tab === 'pending' && can('approvals', 'a') ? <div className="actions"><button className="btn outline" onClick={() => setDeciding({ a, approve: false })}><X /> Reject</button><button className="btn ok" onClick={() => setDeciding({ a, approve: true })}><Check /> Approve</button></div> : tab !== 'pending' && <StatusBadge value={a.status} />}
          </div>
        </Card>
      ))}
      {deciding && <FormModal title={`${deciding.approve ? 'Approve' : 'Reject'}: ${deciding.a.title}`} fields={[{ name: 'note', label: deciding.approve ? 'Note (optional)' : 'Reason', type: 'textarea', required: !deciding.approve, span: 2 }]} submitLabel={deciding.approve ? 'Approve' : 'Reject'}
        onSubmit={async (v) => { await decide.mutateAsync({ id: deciding.a.id, approve: deciding.approve, note: v.note }); toast.success(deciding.approve ? 'Approved' : 'Rejected'); }} onClose={() => setDeciding(null)} />}
    </>
  );
}
