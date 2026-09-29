import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { ago } from '../lib/format';
import { Badge, Banner, PageHead, toast } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';
import type { FieldSpec } from '../ui/forms';

const EVENTS = ['shipment.created', 'shipment.status_changed', 'shipment.at_risk', 'quote.sent', 'quote.accepted', 'invoice.issued', 'invoice.paid', 'invoice.overdue', 'pod.received', 'customs.hold', 'customs.cleared', 'message.received', 'lead.created', 'approval.requested'];
const F: FieldSpec[] = [
  { name: 'name', label: 'Name', required: true, span: 2 }, { name: 'trigger_event', label: 'When this happens', type: 'select', required: true, options: EVENTS },
  { name: 'enabled', label: 'Enabled', type: 'checkbox' },
  { name: 'conditions', label: 'Only if (JSON)', type: 'textarea', span: 2, hint: 'e.g. [{"field":"to","op":"eq","value":"delivered"}] — ops: eq, neq, gt, gte, lt, lte, contains, in' },
  { name: 'actions', label: 'Do this (JSON)', type: 'textarea', span: 2, hint: 'e.g. [{"type":"customer_message","text":"Your shipment {{number}} was delivered"}] — types: notify, customer_message, webhook (https only), set_priority' },
];
const pretty = (v: any) => JSON.stringify(v ?? [], null, 1);
const parse = (s: any) => { if (typeof s !== 'string') return s; try { const j = JSON.parse(s || '[]'); if (!Array.isArray(j)) throw new Error(); return j; } catch { throw new Error('Conditions and actions must be valid JSON arrays'); } };

export default function Automation() {
  const can = useCan();
  const qc = useQueryClient();
  const [k, setK] = useState(0);
  const toggle = useMutation({ mutationFn: (w: any) => api.patch(`/workflows/${w.id}`, { enabled: !w.enabled }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['res'] }); setK(k + 1); toast.success('Updated'); } });
  return (
    <>
      <PageHead title="Workflow automation" sub="Triggers, conditions and actions that run on live events. Failures are logged and never block the action that triggered them." />
      <Banner>Actions can notify teams, post an update to a customer’s thread, call an https webhook or bump priority. Money movements, filings and approvals are deliberately not automatable.</Banner>
      <ResourceTable key={k} resource="workflows" module="automation" noun="automation" fields={F} toForm={(r) => ({ ...r, conditions: pretty(r.conditions), actions: pretty(r.actions) })} transform={(v) => ({ ...v, conditions: parse(v.conditions), actions: parse(v.actions) })} defaultValues={{ enabled: true, conditions: '[]', actions: '[{"type":"notify","module":"shipments","action":"u","title":"{{number}} updated"}]' }}
        columns={[{ key: 'name', label: 'Automation', render: (r) => <b>{r.name}</b> }, { key: 'trigger_event', label: 'Trigger', render: (r) => <span className="mono">{r.trigger_event}</span> }, { key: 'actions', label: 'Actions', render: (r) => (r.actions || []).map((a: any, i: number) => <Badge key={i}>{a.type}</Badge>), sortable: false },
          { key: 'run_count', label: 'Runs', num: true }, { key: 'last_run_at', label: 'Last run', render: (r) => (r.last_run_at ? ago(r.last_run_at) : '—') }, { key: 'enabled', label: 'On', render: (r) => (r.enabled ? <Badge tone="ok">on</Badge> : <Badge>off</Badge>) }]}
        rowActions={(r) => can('automation', 'u') ? <button className="btn xs outline" onClick={() => toggle.mutate(r)}>{r.enabled ? 'Disable' : 'Enable'}</button> : null} />
    </>
  );
}
