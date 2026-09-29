import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useCan, useSession } from '../store/session';
import { Badge, Banner, Card, DataTable, PageHead, Skeleton, Tabs, toast } from '../ui/kit';
import { Field, FormModal, type FieldSpec } from '../ui/forms';

const THRESH: FieldSpec[] = [
  { name: 'min_margin_pct', label: 'Minimum quote margin %', type: 'number', hint: 'Quotes below this need owner approval' }, { name: 'quote_approval_threshold', label: 'Quote approval threshold (AED)', type: 'number', hint: 'Quotes at or above this need approval' },
  { name: 'po_approval_threshold', label: 'Purchase approval threshold (AED)', type: 'number' }, { name: 'expense_approval_threshold', label: 'Driver expense auto-approve limit (AED)', type: 'number' }, { name: 'invoice_terms_days', label: 'Default invoice terms (days)', type: 'number' },
];
const HELP: Record<string, string> = {
  whatsapp: 'Meta Business → WhatsApp → API setup: permanent access token and phone number ID.', email: 'Resend API key and a verified sender, e.g. Al Noor <no-reply@yourdomain.ae>.',
  wps: 'MOHRE establishment ID (13 digits) and your bank’s 9-digit routing code — required to export a SIF.', asp: 'Endpoint and key from your FTA-accredited e-invoicing service provider. Without it, invoices are recorded in sandbox mode only.', tracking: 'Container tracking provider key (optional).',
};

function Company() {
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery({ queryKey: ['res', 'settings'], queryFn: () => api.get('/admin/settings') });
  const [v, setV] = useState<any>({}); const [s, setS] = useState<any>({}); const [ent, setEnt] = useState(false);
  useEffect(() => { if (q.data) { setV({ name: q.data.tenant.name, trn: q.data.tenant.trn || '', trade_license: q.data.tenant.trade_license || '' }); setS(q.data.tenant.settings); } }, [q.data]);
  const save = useMutation({ mutationFn: () => api.patch('/admin/settings', { ...v, settings: s }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['res', 'settings'] }); qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Settings saved'); } });
  const [err, setErr] = useState('');
  if (q.isLoading) return <Skeleton />;
  const ro = !can('settings', 'u');
  return (
    <div className="grid g2">
      <Card title="Company profile">
        <Field spec={{ name: 'name', label: 'Company name', required: true }} value={v.name} onChange={(x) => setV({ ...v, name: x })} editing={ro} />
        <div className="row2"><Field spec={{ name: 'trn', label: 'TRN (15 digits)', hint: 'Printed on every tax invoice' }} value={v.trn} error={err} onChange={(x) => { setV({ ...v, trn: x }); setErr(''); }} editing={ro} /><Field spec={{ name: 'tl', label: 'Trade licence' }} value={v.trade_license} onChange={(x) => setV({ ...v, trade_license: x })} editing={ro} /></div>
        {!ro && <button className="btn primary" disabled={save.isPending} onClick={() => save.mutate(undefined, { onError: (e: any) => setErr(e.field?.('trn') || e.message) })}>Save</button>}
      </Card>
      <Card title="Approval policy & defaults">
        <div className="row2">{THRESH.map((f) => <Field key={f.name} spec={f} value={s[f.name]} onChange={(x) => setS({ ...s, [f.name]: x })} editing={ro} />)}</div>
        <Field spec={{ name: 'auto_generate_docs', label: 'Generate documents on booking confirmation', type: 'checkbox', hint: 'Creates the B/L, AWB or CMR, Packing List and Commercial Invoice as soon as a booking is confirmed' }} value={s.auto_generate_docs !== false} onChange={(x) => setS({ ...s, auto_generate_docs: !!x })} editing={ro} />
        {!ro && <button className="btn primary" onClick={() => save.mutate()}>Save policy</button>}
      </Card>
      <Card title="Legal entities" className="g2-span" pad={false} actions={can('settings', 'c') && <button className="btn sm outline" onClick={() => setEnt(true)}><Plus /> Add entity</button>}>
        <DataTable rows={q.data.entities} columns={[{ key: 'code', label: 'Code', render: (e) => <b className="mono">{e.code}</b> }, { key: 'name', label: 'Name' }, { key: 'branch', label: 'Branch' }, { key: 'trn', label: 'TRN', render: (e) => <span className="mono">{e.trn || '—'}</span> }, { key: 'is_default', label: '', render: (e) => (e.is_default ? <Badge>default</Badge> : '') }]} />
        <p className="hint" style={{ padding: '8px 16px' }}>Use the entity switcher in the top bar to work in one entity or see a consolidated view.</p>
      </Card>
      {ent && <FormModal title="Add legal entity" fields={[{ name: 'code', label: 'Code', required: true, placeholder: 'AUH' }, { name: 'name', label: 'Name', required: true }, { name: 'branch', label: 'Branch' }, { name: 'trn', label: 'TRN (15 digits)' }]} onSubmit={async (x) => { await api.post('/admin/entities', x); qc.invalidateQueries({ queryKey: ['res', 'settings'] }); qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Entity added'); }} onClose={() => setEnt(false)} />}
    </div>
  );
}

function Integrations() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['res', 'integrations'], queryFn: () => api.get('/admin/integrations') });
  const [open, setOpen] = useState<any>(null);
  if (q.isLoading) return <Skeleton />;
  return (
    <>
      <Banner>Secrets are encrypted at rest (AES-256-GCM) and never shown again after saving.</Banner>
      <div className="grid g2">
        {q.data.data.map((i: any) => (
          <Card key={i.provider} title={i.label} actions={<Badge tone={i.enabled ? 'ok' : ''}>{i.enabled ? 'connected' : 'not connected'}</Badge>}>
            <p className="muted">{HELP[i.provider]}</p>
            <button className="btn outline" style={{ marginTop: 10 }} onClick={() => setOpen(i)}>Configure</button>
          </Card>
        ))}
      </div>
      {open && <FormModal title={open.label} initial={{ enabled: open.enabled, ...open.config }} fields={[{ name: 'enabled', label: 'Enabled', type: 'checkbox' }, ...open.fields.map((f: string) => ({ name: f, label: f.replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase()), placeholder: /token|key|secret/.test(f) ? '********' : '' } as FieldSpec))]}
        onSubmit={async (v) => { const { enabled, ...config } = v; await api.put(`/admin/integrations/${open.provider}`, { enabled: !!enabled, config: Object.fromEntries(Object.entries(config).map(([k, x]) => [k, x == null ? '' : String(x)])) }); qc.invalidateQueries({ queryKey: ['res', 'integrations'] }); toast.success('Integration saved'); }} onClose={() => setOpen(null)} />}
    </>
  );
}

function Account() {
  const u = useSession((s) => s.user);
  const [pw, setPw] = useState(false);
  return (
    <div className="grid g2">
      <Card title="Your account"><p><b>{u?.name}</b></p><p className="muted">{u?.email} · role {u?.role}</p><button className="btn outline" style={{ marginTop: 12 }} onClick={() => setPw(true)}>Change password</button></Card>
      {pw && <FormModal title="Change password" fields={[{ name: 'currentPassword', label: 'Current password', required: true, type: 'text' }, { name: 'newPassword', label: 'New password (10+ characters)', required: true }]} submitLabel="Update"
        onSubmit={async (v) => { await api.post('/auth/change-password', v); toast.success('Password changed — other devices were signed out'); }} onClose={() => setPw(false)} />}
    </div>
  );
}

export default function Settings() {
  const can = useCan();
  const [tab, setTab] = useState(can('settings', 'r') ? 'company' : 'account');
  return (
    <>
      <PageHead title="Settings" sub="Company profile, approval policy, legal entities, integrations and your account." />
      <Tabs value={tab} onChange={setTab} tabs={[...(can('settings', 'r') ? [{ key: 'company', label: 'Company & policy' }, { key: 'integrations', label: 'Integrations' }] : []), { key: 'account', label: 'My account' }]} />
      {tab === 'company' && <Company />}{tab === 'integrations' && <Integrations />}{tab === 'account' && <Account />}
    </>
  );
}
