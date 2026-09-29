import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { api, openFile } from '../lib/api';
import { useCan } from '../store/session';
import { aed } from '../lib/format';
import { Banner, Card, DataTable, Empty, Kpi, Modal, PageHead, StatusBadge, toast } from '../ui/kit';
import { FormModal, useRefOptions, Field } from '../ui/forms';
import { ApiError } from '../lib/api';

function RunModal({ id, onClose }: { id: string; onClose: () => void }) {
  const can = useCan();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [bank, setBank] = useState('');
  const banks = useRefOptions({ resource: 'accounts', params: { is_bank: 'true' } } as any);
  const q = useQuery({ queryKey: ['res', 'payrun', id], queryFn: () => api.get(`/payroll/runs/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['res'] }); qc.invalidateQueries({ queryKey: ['approvals'] }); };
  const submit = useMutation({ mutationFn: () => api.post(`/payroll/runs/${id}/submit`), onSuccess: () => { refresh(); toast.success('Sent to owner for approval'); } });
  const pay = useMutation({ mutationFn: () => api.post(`/payroll/runs/${id}/pay`, { bank_account_id: bank }), onSuccess: () => { refresh(); toast.success('Payroll posted to the ledger'); setPayOpen(false); } });
  const r = q.data?.run;
  const sif = async () => {
    try { await openFile(`/payroll/runs/${id}/sif`, `${r.period}.SIF`); refresh(); } catch (e) { const a = e as ApiError; toast.error(Array.isArray(a.details) ? a.details.slice(0, 3).join(' · ') : a.message); }
  };
  return (
    <Modal size="xl" title={`Payroll ${r?.period || ''}`} onClose={onClose} footer={r && <>
      {['approved', 'paid'].includes(r.status) && can('payroll', 'x') && <button className="btn outline" onClick={sif}><Download /> WPS SIF file</button>}
      {r.status === 'draft' && can('payroll', 'u') && <button className="btn primary" onClick={() => submit.mutate()}>Submit for approval</button>}
      {r.status === 'approved' && can('payroll', 'a') && can('accounting', 'c') && <button className="btn primary" onClick={() => setPayOpen(true)}>Mark paid & post</button>}
    </>}>
      {!r ? <div className="skel" style={{ height: 200 }} /> : (<>
        <div className="kpis"><Kpi label="Status" value={<StatusBadge value={r.status} />} /><Kpi label="Gross" value={aed(r.total_gross, { compact: true })} /><Kpi label="Deductions" value={aed(r.total_deductions, { compact: true })} /><Kpi label="Net pay" value={aed(r.total_net, { compact: true })} /></div>
        <DataTable rows={q.data.payslips} columns={[{ key: 'name', label: 'Employee', render: (p) => <span><b>{p.name}</b> <span className="muted mono">{p.code}</span></span> }, { key: 'basic', label: 'Basic', num: true, render: (p) => aed(p.basic, { noSymbol: true }) }, { key: 'allowances', label: 'Allowances', num: true, render: (p) => aed(p.allowances, { noSymbol: true }) }, { key: 'overtime', label: 'Overtime', num: true, render: (p) => aed(p.overtime, { noSymbol: true }) }, { key: 'deductions', label: 'Deductions', num: true, render: (p) => aed(p.deductions, { noSymbol: true }) }, { key: 'net', label: 'Net', num: true, render: (p) => <b>{aed(p.net, { noSymbol: true })}</b> }, { key: 'leave_days', label: 'Unpaid days', num: true },
          { key: '_', label: '', sortable: false, render: (p) => r.status === 'draft' && can('payroll', 'u') && <button className="btn xs outline" onClick={() => setEdit(p)}>Adjust</button> }]} />
      </>)}
      {edit && <FormModal title={`Adjust ${edit.name}`} initial={{ overtime: edit.overtime, deductions: edit.deductions, notes: edit.notes }} fields={[{ name: 'overtime', label: 'Overtime (AED)', type: 'number', min: 0 }, { name: 'deductions', label: 'Deductions (AED)', type: 'number', min: 0 }, { name: 'notes', label: 'Notes', type: 'textarea', span: 2 }]} onSubmit={async (v) => { await api.patch(`/payroll/runs/${id}/payslips/${edit.id}`, v); refresh(); }} onClose={() => setEdit(null)} />}
      {payOpen && <Modal title="Post payroll payment" onClose={() => setPayOpen(false)} footer={<><button className="btn outline" onClick={() => setPayOpen(false)}>Cancel</button><button className="btn primary" disabled={!bank} onClick={() => pay.mutate()}>Post</button></>}><Field spec={{ name: 'b', label: 'Pay from bank account', type: 'select', options: banks.options, required: true }} value={bank} onChange={(v) => setBank(v || '')} /></Modal>}
    </Modal>
  );
}

export default function Payroll() {
  const can = useCan();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const runs = useQuery({ queryKey: ['res', 'payruns'], queryFn: () => api.get('/payroll/runs') });
  const month = new Date().toISOString().slice(0, 7);
  return (
    <>
      <PageHead title="Payroll & WPS" sub="Monthly runs with unpaid-leave deductions, owner approval and a WPS SIF file for your bank." actions={can('payroll', 'c') && <button className="btn primary" onClick={() => setCreate(true)}><Plus /> New payroll run</button>} />
      <Banner>The SIF file follows the MOHRE structure (EDR rows + SCR trailer). Employer establishment ID and bank routing code live in Settings → Integrations → WPS. Always validate the first file with your bank — formats vary slightly by bank.</Banner>
      {runs.isLoading ? null : !runs.data?.data.length ? <Empty title="No payroll runs yet" /> : (
        <DataTable rows={runs.data.data} onRowClick={(r) => setOpen(r.id)} columns={[{ key: 'period', label: 'Period', render: (r) => <b className="mono">{r.period}</b> }, { key: 'employees', label: 'Employees', num: true }, { key: 'total_gross', label: 'Gross', num: true, render: (r) => aed(r.total_gross, { noSymbol: true }) }, { key: 'total_deductions', label: 'Deductions', num: true, render: (r) => aed(r.total_deductions, { noSymbol: true }) }, { key: 'total_net', label: 'Net', num: true, render: (r) => <b>{aed(r.total_net, { noSymbol: true })}</b> }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />
      )}
      {create && <FormModal title="New payroll run" sub="Creates payslips for all active employees." initial={{ period: month }} fields={[{ name: 'period', label: 'Period (YYYY-MM)', required: true, placeholder: month }]} onSubmit={async (v) => { const r = await api.post('/payroll/runs', v); qc.invalidateQueries({ queryKey: ['res'] }); setOpen(r.id); }} onClose={() => setCreate(false)} />}
      {open && <RunModal id={open} onClose={() => setOpen(null)} />}
      <Card title="Notes" className="mt"><ul className="muted" style={{ paddingInlineStart: 18 }}><li>Unpaid leave is deducted on a 30-day basis from approved leave requests.</li><li>Overtime and other adjustments can be entered until the run is submitted.</li><li>The owner (not the preparer) approves; posting creates Dr Salaries / Cr Bank in the ledger.</li></ul></Card>
    </>
  );
}
