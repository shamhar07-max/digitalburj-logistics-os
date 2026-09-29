import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw } from 'lucide-react';
import { ROLES } from '@digitalburj/shared';
import { api, qs } from '../lib/api';
import { useCan, useSession } from '../store/session';
import { fdt, label } from '../lib/format';
import { Badge, Banner, Card, ConfirmModal, DataTable, PageHead, Skeleton, StatusBadge, Tabs, toast } from '../ui/kit';
import { FormModal } from '../ui/forms';

const ACTIONS: [string, string][] = [['c', 'Create'], ['r', 'Read'], ['u', 'Update'], ['d', 'Delete'], ['a', 'Approve'], ['x', 'Export']];
const strip = (s?: string) => (s || '').replace(/\s+/g, '');

function Roles() {
  const can = useCan();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['res', 'roles'], queryFn: () => api.get('/admin/roles') });
  const [sel, setSel] = useState<string>('');
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [newRole, setNewRole] = useState(false);
  const roles: any[] = q.data?.data || [];
  const role = roles.find((r) => r.id === sel) || roles[0];
  useEffect(() => { if (role) { setSel(role.id); setPerms(role.permissions || {}); } }, [role?.id, q.data]);
  const dirty = role && JSON.stringify(perms) !== JSON.stringify(role.permissions || {});
  const save = useMutation({ mutationFn: (body: any) => api.patch(`/admin/roles/${role.id}`, body), onSuccess: () => { qc.invalidateQueries({ queryKey: ['res', 'roles'] }); toast.success('Role updated — applies within 30 seconds'); } });
  const editable = can('permissions', 'u') && role && role.key !== 'owner';
  const toggle = (m: string, a: string) => {
    if (!editable) return;
    const cur = strip(perms[m]);
    const next = cur.includes(a) ? cur.replace(a, '') : cur + a;
    setPerms({ ...perms, [m]: next });
  };
  if (q.isLoading) return <Skeleton />;
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(220px,300px) minmax(0,1fr)' }}>
      <Card title="Roles" pad={false} actions={can('permissions', 'c') && <button className="btn xs primary" onClick={() => setNewRole(true)}><Plus /> New</button>}>
        {roles.map((r) => (
          <button key={r.id} className={`thread ${role?.id === r.id ? 'on' : ''}`} onClick={() => { setSel(r.id); setPerms(r.permissions || {}); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{r.label}</b><span className="muted">{r.users} user{r.users === 1 ? '' : 's'}</span></div>
            <span className="muted" style={{ fontSize: 12 }}>{r.is_system ? 'Built-in' : `Custom · based on ${label(r.base_role)}`}</span>
          </button>
        ))}
      </Card>
      {role && (
        <Card title={`Permission matrix — ${role.label}`} pad={false} actions={<>
          {editable && role.is_system && <button className="btn sm outline" onClick={() => save.mutate({ reset: true })}><RotateCcw /> Reset to default</button>}
          {editable && <button className="btn sm primary" disabled={!dirty || save.isPending} onClick={() => save.mutate({ permissions: perms })}>Save changes</button>}
        </>}>
          {role.key === 'owner' && <div style={{ padding: 12 }}><Banner>The owner role always has full access and cannot be edited.</Banner></div>}
          <div className="matrix"><table><thead><tr><th>Module</th>{ACTIONS.map(([a, l]) => <th key={a}>{l}</th>)}</tr></thead>
            <tbody>{(q.data.modules as string[]).map((m) => (
              <tr key={m}><td>{label(m)}{m === 'costs' && <Badge tone="warn">buy rates & margins</Badge>}</td>
                {ACTIONS.map(([a]) => { const on = strip(perms[m]).includes(a); return <td key={a}><button className={`icon-btn`} style={{ width: 26, height: 26, background: on ? 'var(--ink)' : 'var(--paper)', color: on ? '#fff' : 'var(--text-3)', fontWeight: 800, fontSize: 11 }} disabled={!editable} aria-pressed={on} aria-label={`${label(m)} ${a}`} onClick={() => toggle(m, a)}>{on ? '✓' : '·'}</button></td>; })}</tr>
            ))}</tbody></table></div>
        </Card>
      )}
      {newRole && <FormModal title="New custom role" sub="Starts from a built-in role’s permissions — adjust after creating." fields={[{ name: 'label', label: 'Role name', required: true }, { name: 'base_role', label: 'Base role (sets portal/driver behaviour)', type: 'select', required: true, options: ROLES as unknown as string[] }]} initial={{ base_role: 'operations' }}
        onSubmit={async (v) => { const d = q.data.defaults[v.base_role] || {}; await api.post('/admin/roles', { label: v.label, base_role: v.base_role, permissions: d }); qc.invalidateQueries({ queryKey: ['res', 'roles'] }); toast.success('Role created'); }} onClose={() => setNewRole(false)} />}
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const can = useCan();
  const [add, setAdd] = useState(false);
  const [confirm, setConfirm] = useState<any>(null);
  const q = useQuery({ queryKey: ['res', 'admin-users'], queryFn: () => api.get('/admin/users') });
  const roles = useQuery({ queryKey: ['res', 'roles'], queryFn: () => api.get('/admin/roles') });
  const patch = useMutation({ mutationFn: (v: { id: string; body: any }) => api.patch(`/admin/users/${v.id}`, v.body), onSuccess: () => { qc.invalidateQueries({ queryKey: ['res', 'admin-users'] }); toast.success('User updated'); }, onError: (e: any) => toast.error(e.message) });
  const reset = useMutation({ mutationFn: (id: string) => api.post(`/admin/users/${id}/reset-password`), onSuccess: (r: any) => { toast.success(r.sent ? 'Reset link emailed' : 'Reset link queued (email not configured)'); if (r.link) toast.info('Dev link: ' + r.link); } });
  return (
    <>
      <div className="toolbar"><div className="spacer" />{can('permissions', 'c') && <button className="btn primary" onClick={() => setAdd(true)}><Plus /> Add user</button>}</div>
      <DataTable loading={q.isLoading} rows={q.data?.data || []} columns={[
        { key: 'name', label: 'User', render: (u) => <span><b>{u.name}</b><div className="muted" style={{ fontSize: 12 }}>{u.email}</div></span> },
        { key: 'role', label: 'Role', render: (u) => can('permissions', 'u') && u.id !== me?.id ? <select className="select" style={{ width: 170, height: 30 }} value={u.role} onChange={(e) => patch.mutate({ id: u.id, body: { role: e.target.value } })} aria-label="Role">{(roles.data?.data || []).map((r: any) => <option key={r.key} value={r.key}>{r.label}</option>)}</select> : label(u.role) },
        { key: 'customer_name', label: 'Customer', hideSm: true }, { key: 'last_login', label: 'Last sign-in', render: (u) => fdt(u.last_login), hideSm: true }, { key: 'is_active', label: 'Status', render: (u) => <StatusBadge value={u.is_active ? 'active' : 'inactive'} /> },
        { key: '_', label: '', sortable: false, render: (u) => can('permissions', 'u') && <div className="actions" style={{ flexWrap: 'nowrap' }}><button className="btn xs outline" onClick={() => reset.mutate(u.id)}>Reset password</button>{u.id !== me?.id && <button className="btn xs outline" onClick={() => (u.is_active ? setConfirm(u) : patch.mutate({ id: u.id, body: { is_active: true } }))}>{u.is_active ? 'Disable' : 'Enable'}</button>}</div> },
      ]} />
      {add && <FormModal title="Add user" sub="They receive an email to set their password." submitLabel="Create & invite" fields={[{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'role', label: 'Role', type: 'select', required: true, options: (roles.data?.data || []).map((r: any) => ({ value: r.key, label: r.label })) }, { name: 'customer_id', label: 'Customer (portal users)', type: 'ref', ref: { resource: 'customers' }, showIf: (v) => v.role === 'customer' }]}
        onSubmit={async (v) => { const r = await api.post('/admin/users', v); qc.invalidateQueries({ queryKey: ['res', 'admin-users'] }); toast.success(r.invite?.sent ? 'Invitation emailed' : 'User created — invitation queued (email not configured)'); if (r.invite?.link) toast.info('Dev link: ' + r.invite.link); }} onClose={() => setAdd(false)} />}
      {confirm && <ConfirmModal danger title={`Disable ${confirm.name}?`} text="They are signed out immediately and cannot sign in until re-enabled." confirmLabel="Disable" onConfirm={() => patch.mutateAsync({ id: confirm.id, body: { is_active: false } })} onClose={() => setConfirm(null)} />}
    </>
  );
}

function Audit() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['res', 'audit', entity, page], queryFn: () => api.get(`/admin/audit${qs({ entity_type: entity, page, pageSize: 40 })}`) });
  return (
    <>
      <div className="toolbar"><input className="input" style={{ maxWidth: 260 }} placeholder="Filter by entity (shipment, invoice, user…)" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Entity type" /></div>
      <DataTable loading={q.isLoading} rows={q.data?.data || []} columns={[{ key: 'created_at', label: 'When', render: (r) => fdt(r.created_at) }, { key: 'user_name', label: 'User', render: (r) => r.user_name || 'system' }, { key: 'action', label: 'Action', render: (r) => <Badge>{label(r.action)}</Badge> }, { key: 'entity_type', label: 'Entity', render: (r) => <span className="mono">{r.entity_type}</span> }, { key: 'changes', label: 'Changes', sortable: false, render: (r) => <span className="mono muted" style={{ fontSize: 11.5 }}>{r.changes ? JSON.stringify(r.changes).slice(0, 120) : ''}</span> }, { key: 'ip', label: 'IP', hideSm: true }]} />
      <div className="pager"><span>{q.data?.total ?? 0} events</span><div className="actions"><button className="btn xs outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn xs outline" disabled={(q.data?.data?.length || 0) < 40} onClick={() => setPage(page + 1)}>Next</button></div></div>
    </>
  );
}

export default function Permissions() {
  const can = useCan();
  const [tab, setTab] = useState('roles');
  return (
    <>
      <PageHead title="Permissions & roles" sub="Role-based access with a per-module matrix. Buy rates and margins are a separate “costs” permission so sales can quote without seeing them. Changes are audited." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'roles', label: 'Roles & matrix' }, { key: 'users', label: 'Users' }, ...(can('audit', 'r') ? [{ key: 'audit', label: 'Audit trail' }] : [])]} />
      {tab === 'roles' && <Roles />}{tab === 'users' && <Users />}{tab === 'audit' && <Audit />}
    </>
  );
}
