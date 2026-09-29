import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, fdate } from '../lib/format';
import { Card, Drawer, Empty, PageHead, StatusBadge, toast } from '../ui/kit';
import { FormModal, type FieldSpec } from '../ui/forms';
import { ResourceTable } from '../ui/ResourceTable';

const F: FieldSpec[] = [
  { name: 'name', label: 'Project name', required: true, span: 2 }, { name: 'customer_id', label: 'Customer', type: 'ref', ref: { resource: 'customers' } }, { name: 'owner_id', label: 'Owner', type: 'ref', ref: { resource: 'lookup/users' } },
  { name: 'status', label: 'Status', type: 'select', options: ['planned', 'active', 'on_hold', 'completed', 'cancelled'] }, { name: 'budget', label: 'Budget (AED)', type: 'number', min: 0 }, { name: 'start_date', label: 'Start', type: 'date' }, { name: 'end_date', label: 'End', type: 'date' },
  { name: 'progress', label: 'Progress %', type: 'number', min: 0 }, { name: 'description', label: 'Description', type: 'textarea', span: 2 },
];

function Tasks({ p, onClose }: { p: any; onClose: () => void }) {
  const can = useCan();
  const qc = useQueryClient();
  const [add, setAdd] = useState(false);
  const q = useQuery({ queryKey: ['res', 'tasks', p.id], queryFn: () => api.get(`/project-tasks?project_id=${p.id}&pageSize=200`) });
  const upd = useMutation({ mutationFn: (v: { id: string; status: string }) => api.patch(`/project-tasks/${v.id}`, { status: v.status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['res'] }) });
  const cols = ['todo', 'doing', 'done'];
  return (
    <Drawer title={p.name} onClose={onClose}>
      <div style={{ padding: 16 }}>
        <p className="muted">{p.customer_name} · {fdate(p.start_date)} → {fdate(p.end_date)} · budget {aed(p.budget, { compact: true })} · {p.hours_logged}h logged</p>
        <div className="actions" style={{ margin: '10px 0' }}>{can('projects', 'c') && <button className="btn sm primary" onClick={() => setAdd(true)}><Plus /> Task</button>}</div>
        {cols.map((c) => (
          <Card key={c} title={<StatusBadge value={c} />} className="mt" pad={false}>
            {(q.data?.data || []).filter((t: any) => t.status === c).map((t: any) => (
              <div className="list-item" key={t.id} style={{ padding: '10px 14px' }}><div style={{ flex: 1 }}><b>{t.title}</b><div className="muted" style={{ fontSize: 12 }}>{t.due_date ? `Due ${fdate(t.due_date)}` : ''} {t.hours_est ? `· ${t.hours_est}h est.` : ''}</div></div>
                {can('projects', 'u') && <select className="select" style={{ width: 100, height: 30 }} value={t.status} onChange={(e) => upd.mutate({ id: t.id, status: e.target.value })} aria-label="Task status">{cols.map((x) => <option key={x}>{x}</option>)}</select>}</div>
            ))}
            {!(q.data?.data || []).some((t: any) => t.status === c) && <Empty title="No tasks" />}
          </Card>
        ))}
      </div>
      {add && <FormModal title="New task" fields={[{ name: 'title', label: 'Task', required: true, span: 2 }, { name: 'assignee_id', label: 'Assignee', type: 'ref', ref: { resource: 'lookup/users' } }, { name: 'due_date', label: 'Due', type: 'date' }, { name: 'hours_est', label: 'Estimated hours', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: cols }]} initial={{ status: 'todo' }}
        onSubmit={async (v) => { await api.post('/project-tasks', { ...v, project_id: p.id }); qc.invalidateQueries({ queryKey: ['res'] }); toast.success('Task added'); }} onClose={() => setAdd(false)} />}
    </Drawer>
  );
}

export default function Projects() {
  const [open, setOpen] = useState<any>(null);
  return (
    <>
      <PageHead title="Projects" sub="Contract logistics and fit-out projects with tasks, milestones and timesheets." />
      <ResourceTable resource="projects" module="projects" noun="project" fields={F} onRowClick={setOpen} filters={[{ key: 'status', label: 'Status', options: ['planned', 'active', 'on_hold', 'completed'] }]}
        columns={[{ key: 'code', label: 'Code', render: (r) => <span className="mono">{r.code}</span> }, { key: 'name', label: 'Project', render: (r) => <b>{r.name}</b> }, { key: 'customer_name', label: 'Customer', hideSm: true },
          { key: 'progress', label: 'Progress', render: (r) => <div style={{ minWidth: 100 }}><div className="bar"><i style={{ width: `${r.progress}%` }} /></div><span className="muted" style={{ fontSize: 11.5 }}>{r.tasks_done}/{r.tasks} tasks · {r.progress}%</span></div> }, { key: 'budget', label: 'Budget', num: true, render: (r) => aed(r.budget, { compact: true, noSymbol: true }), hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />
      {open && <Tasks p={open} onClose={() => setOpen(null)} />}
    </>
  );
}
