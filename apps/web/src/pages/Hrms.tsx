import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, fdate, label } from '../lib/format';
import { Badge, DataTable, PageHead, StatusBadge, Tabs, toast } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';
import type { FieldSpec } from '../ui/forms';

const EMP: FieldSpec[] = [
  { name: 'name', label: 'Full name', required: true }, { name: 'department', label: 'Department' }, { name: 'position', label: 'Position' }, { name: 'nationality', label: 'Nationality' }, { name: 'joined_on', label: 'Joined', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: ['active', 'on_leave', 'terminated'] },
  { name: 'basic', label: 'Basic salary (AED)', type: 'number', min: 0 }, { name: 'housing', label: 'Housing', type: 'number', min: 0 }, { name: 'transport', label: 'Transport', type: 'number', min: 0 }, { name: 'other_allowance', label: 'Other allowance', type: 'number', min: 0 },
  { name: 'person_id', label: 'MOHRE person ID (14 digits)' }, { name: 'labour_card_no', label: 'Labour card no.' }, { name: 'bank_name', label: 'Bank' }, { name: 'routing_code', label: 'Bank routing code (9 digits)' }, { name: 'iban', label: 'IBAN (AE…)', span: 2 },
  { name: 'visa_expiry', label: 'Visa expiry', type: 'date' }, { name: 'eid_expiry', label: 'Emirates ID expiry', type: 'date' }, { name: 'passport_expiry', label: 'Passport expiry', type: 'date' },
  { name: 'user_id', label: 'System login', type: 'ref', ref: { resource: 'lookup/users' } },
];
const LEAVE: FieldSpec[] = [{ name: 'employee_id', label: 'Employee', type: 'ref', required: true, ref: { resource: 'employees' } }, { name: 'kind', label: 'Type', type: 'select', options: ['annual', 'sick', 'unpaid', 'maternity', 'compassionate', 'hajj'] }, { name: 'from_date', label: 'From', type: 'date', required: true }, { name: 'to_date', label: 'To', type: 'date', required: true }, { name: 'reason', label: 'Reason', type: 'textarea', span: 2 }];
const days = (d?: string) => (d ? Math.floor((new Date(d).getTime() - Date.now()) / 86_400_000) : null);
const Exp = ({ d }: { d?: string }) => { const n = days(d); return d ? <span>{fdate(d)} {n! < 0 ? <Badge tone="bad">expired</Badge> : n! <= 30 ? <Badge tone="warn">{n}d</Badge> : null}</span> : <span className="muted">—</span>; };

export default function Hrms() {
  const [tab, setTab] = useState('emp');
  const can = useCan();
  const qc = useQueryClient();
  const submit = useMutation({ mutationFn: (id: string) => api.post(`/hr/leave-requests/${id}/submit`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['res'] }); qc.invalidateQueries({ queryKey: ['approvals'] }); toast.success('Sent for approval'); } });
  const exp = useQuery({ queryKey: ['res', 'expiries'], queryFn: () => api.get('/compliance/expiries?days=90'), enabled: tab === 'exp' });
  return (
    <>
      <PageHead title="HRMS" sub="Employee master, leave, attendance and document expiries (visa, Emirates ID, passport)." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'emp', label: 'Employees' }, { key: 'leave', label: 'Leave' }, { key: 'att', label: 'Attendance' }, { key: 'exp', label: 'Expiries' }]} />
      {tab === 'emp' && <ResourceTable resource="employees" module="hrms" noun="employee" fields={EMP} searchPlaceholder="Search name, department…" filters={[{ key: 'status', label: 'Status', options: ['active', 'on_leave', 'terminated'] }]}
        columns={[{ key: 'code', label: 'ID', render: (r) => <span className="mono">{r.code}</span> }, { key: 'name', label: 'Employee', render: (r) => <span><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.position}</div></span> }, { key: 'department', label: 'Department', hideSm: true },
          { key: 'gross', label: 'Gross / month', num: true, render: (r) => aed(r.gross, { noSymbol: true }) }, { key: 'visa_expiry', label: 'Visa', render: (r) => <Exp d={r.visa_expiry} />, hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />}
      {tab === 'leave' && <ResourceTable resource="leave-requests" module="hrms" noun="leave request" fields={LEAVE} filters={[{ key: 'status', label: 'Status', options: ['pending', 'approved', 'rejected'] }]}
        columns={[{ key: 'employee_name', label: 'Employee', render: (r) => <b>{r.employee_name}</b> }, { key: 'kind', label: 'Type', render: (r) => label(r.kind) }, { key: 'from_date', label: 'From', render: (r) => fdate(r.from_date) }, { key: 'to_date', label: 'To', render: (r) => fdate(r.to_date) }, { key: 'days', label: 'Days', num: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]}
        rowActions={(r) => can('hrms', 'u') && r.status === 'pending' ? <button className="btn xs primary" onClick={() => submit.mutate(r.id)}>Send for approval</button> : null} />}
      {tab === 'att' && <ResourceTable resource="attendance" module="hrms" noun="attendance record" fields={[{ name: 'employee_id', label: 'Employee', type: 'ref', required: true, ref: { resource: 'employees' } }, { name: 'work_date', label: 'Date', type: 'date', required: true }, { name: 'check_in', label: 'Check in', placeholder: '08:30' }, { name: 'check_out', label: 'Check out', placeholder: '17:30' }, { name: 'status', label: 'Status', type: 'select', options: ['present', 'absent', 'late', 'leave', 'holiday'] }]}
        columns={[{ key: 'work_date', label: 'Date', render: (r) => fdate(r.work_date) }, { key: 'employee_name', label: 'Employee' }, { key: 'check_in', label: 'In', render: (r) => <span className="mono">{r.check_in || '—'}</span> }, { key: 'check_out', label: 'Out', render: (r) => <span className="mono">{r.check_out || '—'}</span> }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />}
      {tab === 'exp' && <DataTable loading={exp.isLoading} rows={exp.data?.data || []} rowKey="subject" columns={[{ key: 'kind', label: 'Type', render: (r) => <Badge>{r.kind}</Badge> }, { key: 'subject', label: 'Name / plate', render: (r) => <b>{r.subject}</b> }, { key: 'doc', label: 'Document' }, { key: 'expires', label: 'Expires', render: (r) => fdate(r.expires) }, { key: 'days_left', label: 'Days left', num: true, render: (r) => <span className={r.days_left < 0 ? 'down' : r.days_left <= 30 ? '' : 'muted'}>{r.days_left < 0 ? `${-r.days_left} overdue` : r.days_left}</span> }]} />}
    </>
  );
}
