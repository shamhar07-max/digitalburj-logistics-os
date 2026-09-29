import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, label } from '../lib/format';
import { Card, Detail, Drawer, Empty, PageHead, StatusBadge, toast } from '../ui/kit';
import { FormModal, type FieldSpec } from '../ui/forms';
import { ResourceTable } from '../ui/ResourceTable';

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Company name', required: true, span: 2 },
  { name: 'type', label: 'Type', type: 'select', options: ['shipper', 'consignee', 'agent', 'broker', 'carrier', 'other'] },
  { name: 'trn', label: 'TRN (15 digits)', placeholder: '100…', hint: 'Required on UAE tax invoices' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'address', label: 'Address', span: 2 }, { name: 'city', label: 'City' }, { name: 'country', label: 'Country code', placeholder: 'AE' }, { name: 'main_lane', label: 'Main lane', placeholder: 'Shanghai → Jebel Ali' },
  { name: 'credit_limit', label: 'Credit limit (AED)', type: 'number', min: 0 }, { name: 'credit_days', label: 'Credit days', type: 'number', min: 0 },
  { name: 'status', label: 'Status', type: 'select', options: ['active', 'hold', 'blocked'], hint: 'Hold flags the customer to ops and finance' },
  { name: 'owner_id', label: 'Account owner', type: 'ref', ref: { resource: 'lookup/users' } }, { name: 'tags', label: 'Tags', type: 'tags' }, { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
];

function CustomerDrawer({ c, onClose }: { c: any; onClose: () => void }) {
  const can = useCan();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const contacts = useQuery({ queryKey: ['res', 'contacts', c.id], queryFn: () => api.get(`/contacts?customer_id=${c.id}`) });
  const ships = useQuery({ queryKey: ['res', 'shipments', 'cust', c.id], queryFn: () => api.get(`/shipments?customer_id=${c.id}&pageSize=6`) });
  const over = c.credit_limit > 0 && c.outstanding > c.credit_limit;
  return (
    <Drawer title={c.name} onClose={onClose}>
      <div style={{ padding: 16, display: 'grid', gap: 14 }}>
        <div className="actions"><StatusBadge value={c.status} />{over && <span className="badge b-bad">Over credit limit</span>}
          {can('quotes', 'c') && <button className="btn sm primary" onClick={() => nav(`/quotes/new?customer=${c.id}`)}>New quote</button>}
          {can('customers', 'u') && <button className="btn sm outline" onClick={() => setInviteOpen(true)}><UserPlus /> Invite to portal</button>}</div>
        <Detail items={[['Code', <span key="c" className="mono">{c.code}</span>], ['Type', label(c.type)], ['TRN', c.trn || '—'], ['Email', c.email], ['Phone', c.phone], ['Main lane', c.main_lane],
          ['Credit', `${aed(c.credit_limit, { compact: true })} · ${c.credit_days}d`], ['Outstanding', <b key="o" className={over ? 'down' : ''}>{aed(c.outstanding)}</b>], ['Active jobs', c.active_shipments]]} />
        <Card title="Contacts" actions={can('customers', 'c') && <button className="btn xs outline" onClick={() => setContactOpen(true)}><Plus /> Add</button>}>
          {!contacts.data?.data.length ? <Empty title="No contacts" /> : contacts.data.data.map((p: any) => (
            <div className="list-item" key={p.id}><span className="ico"><Mail /></span><div style={{ flex: 1 }}><b>{p.name}</b> <span className="muted">{p.role}</span><div className="muted" style={{ fontSize: 12.5 }}>{[p.email, p.phone, p.whatsapp && `WA ${p.whatsapp}`].filter(Boolean).join(' · ')}</div></div></div>
          ))}
        </Card>
        <Card title="Recent shipments" pad={false}>
          {!ships.data?.data.length ? <Empty title="No shipments yet" /> : ships.data.data.map((s: any) => (
            <button key={s.id} className="list-item" style={{ width: '100%', padding: 12 }} onClick={() => nav(`/shipments/${s.id}`)}><b className="mono">{s.number}</b><span className="muted" style={{ flex: 1, textAlign: 'start' }}>{s.origin} → {s.destination}</span><StatusBadge value={s.status} /></button>
          ))}
        </Card>
      </div>
      {contactOpen && <FormModal title="Add contact" fields={[{ name: 'name', label: 'Name', required: true }, { name: 'role', label: 'Role' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'whatsapp', label: 'WhatsApp number', type: 'tel', hint: 'Used to match inbound WhatsApp messages to this customer' }]}
        onSubmit={async (v) => { await api.post('/contacts', { ...v, customer_id: c.id }); qc.invalidateQueries({ queryKey: ['res', 'contacts'] }); }} onClose={() => setContactOpen(false)} />}
      {inviteOpen && <FormModal title="Invite to customer portal" sub={`Gives ${c.name} self-service tracking, quote acceptance, invoices and documents.`} submitLabel="Send invite" fields={[{ name: 'name', label: 'Contact name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }]}
        onSubmit={async (v) => { const r = await api.post('/portal/invite', { ...v, customer_id: c.id }); toast.success(r.invite?.sent ? 'Invitation emailed' : 'Invitation queued (email not configured)'); if (r.invite?.link) toast.info('Dev link: ' + r.invite.link); }} onClose={() => setInviteOpen(false)} />}
    </Drawer>
  );
}

export default function Customers() {
  const [open, setOpen] = useState<any>(null);
  return (
    <>
      <PageHead title="Customers" sub="Shippers, consignees, agents and brokers — with credit control and portal access." />
      <ResourceTable resource="customers" module="customers" noun="customer" fields={FIELDS} searchPlaceholder="Search name, code, TRN, email…" onRowClick={setOpen}
        filters={[{ key: 'status', label: 'Status', options: ['active', 'hold', 'blocked'] }]}
        columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="mono">{r.code}</span> }, { key: 'name', label: 'Customer', render: (r) => <b>{r.name}</b> }, { key: 'type', label: 'Type', render: (r) => label(r.type), hideSm: true },
          { key: 'trn', label: 'TRN', render: (r) => <span className="mono">{r.trn || '—'}</span>, hideSm: true }, { key: 'main_lane', label: 'Main lane', hideSm: true },
          { key: 'outstanding', label: 'Outstanding', num: true, render: (r) => <span className={r.credit_limit > 0 && r.outstanding > r.credit_limit ? 'down' : ''}>{aed(r.outstanding, { noSymbol: true })}</span> },
          { key: 'credit_limit', label: 'Credit', num: true, render: (r) => aed(r.credit_limit, { compact: true, noSymbol: true }), hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        ]} />
      {open && <CustomerDrawer c={open} onClose={() => setOpen(null)} />}
    </>
  );
}
