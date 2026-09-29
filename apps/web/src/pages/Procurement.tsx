import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, fdate } from '../lib/format';
import { PageHead, StatusBadge, Tabs, toast } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';
import type { FieldSpec } from '../ui/forms';

const PR: FieldSpec[] = [
  { name: 'description', label: 'What are you buying?', required: true, span: 2 }, { name: 'kind', label: 'Kind', type: 'select', options: ['PR', 'PO'] }, { name: 'category', label: 'Category' },
  { name: 'supplier_id', label: 'Supplier', type: 'ref', ref: { resource: 'suppliers' } }, { name: 'amount', label: 'Amount (AED)', type: 'number', required: true, min: 0 }, { name: 'shipment_id', label: 'Charge to job (optional)', type: 'ref', ref: { resource: 'shipments', label: 'number' } }, { name: 'needed_by', label: 'Needed by', type: 'date' },
];
const SUP: FieldSpec[] = [
  { name: 'name', label: 'Supplier', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['carrier', 'agent', 'trucker', 'customs_broker', 'warehouse', 'vendor'] }, { name: 'trn', label: 'TRN' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'iban', label: 'IBAN' }, { name: 'payment_days', label: 'Payment terms (days)', type: 'number' }, { name: 'rating', label: 'Rating (0–5)', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'blocked'] },
];

export default function Procurement() {
  const [tab, setTab] = useState('po');
  const can = useCan();
  const qc = useQueryClient();
  const act = useMutation({ mutationFn: (v: { id: string; a: string }) => api.post(`/procurement/purchases/${v.id}/${v.a}`), onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['res'] }); qc.invalidateQueries({ queryKey: ['approvals'] }); toast.success(r.status === 'pending_approval' ? 'Sent for approval' : 'Updated'); } });
  return (
    <>
      <PageHead title="Procurement" sub="Purchase requests and orders with approval thresholds, plus your supplier master." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'po', label: 'Requests & orders' }, { key: 'sup', label: 'Suppliers' }]} />
      {tab === 'po' && <ResourceTable resource="purchases" module="procurement" noun="request" fields={PR} defaultValues={{ kind: 'PR' }} filters={[{ key: 'status', label: 'Status', options: ['draft', 'pending_approval', 'approved', 'ordered', 'received'] }]}
        columns={[{ key: 'number', label: 'No.', render: (r) => <b className="mono">{r.number}</b> }, { key: 'description', label: 'Description' }, { key: 'supplier_name', label: 'Supplier', hideSm: true }, { key: 'category', label: 'Category', hideSm: true }, { key: 'amount', label: 'Amount', num: true, render: (r) => aed(r.amount, { noSymbol: true }) }, { key: 'needed_by', label: 'Needed', render: (r) => fdate(r.needed_by), hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]}
        rowActions={(r) => can('procurement', 'u') ? <>
          {['draft', 'rejected'].includes(r.status) && <button className="btn xs primary" onClick={() => act.mutate({ id: r.id, a: 'submit' })}>Submit</button>}
          {r.status === 'approved' && <button className="btn xs primary" onClick={() => act.mutate({ id: r.id, a: 'order' })}>Place order</button>}
          {r.status === 'ordered' && <button className="btn xs outline" onClick={() => act.mutate({ id: r.id, a: 'receive' })}>Mark received</button>}</> : null} />}
      {tab === 'sup' && <ResourceTable resource="suppliers" module="procurement" noun="supplier" fields={SUP} filters={[{ key: 'type', label: 'Type', options: ['carrier', 'agent', 'trucker', 'customs_broker'] }]}
        columns={[{ key: 'name', label: 'Supplier', render: (r) => <b>{r.name}</b> }, { key: 'type', label: 'Type' }, { key: 'trn', label: 'TRN', render: (r) => <span className="mono">{r.trn || '—'}</span>, hideSm: true }, { key: 'payment_days', label: 'Terms', num: true, render: (r) => `${r.payment_days}d` }, { key: 'rating', label: 'Rating', num: true, render: (r) => (r.rating ? `★ ${r.rating}` : '—') }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />}
    </>
  );
}
