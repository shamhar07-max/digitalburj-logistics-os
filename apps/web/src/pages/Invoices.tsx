import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Download, FileMinus, Printer, Send, Wallet } from 'lucide-react';
import { api, openFile } from '../lib/api';
import { useCan } from '../store/session';
import { aed, fdate, label } from '../lib/format';
import { Badge, Banner, Card, DataTable, Detail, Empty, Modal, PageHead, StatusBadge, Tabs, toast } from '../ui/kit';
import { FormModal } from '../ui/forms';
import { ResourceTable } from '../ui/ResourceTable';

function InvoiceModal({ id, onClose }: { id: string; onClose: () => void }) {
  const can = useCan();
  const qc = useQueryClient();
  const [pay, setPay] = useState(false);
  const [credit, setCredit] = useState(false);
  const q = useQuery({ queryKey: ['res', 'invoice', id], queryFn: () => api.get(`/invoices/${id}/detail`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['res'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const send = useMutation({ mutationFn: () => api.post(`/invoices/${id}/send`, {}), onSuccess: (r: any) => { refresh(); toast.success(r.asp_status === 'submitted' ? `Issued · ASP ref ${r.asp_ref} (sandbox)` : 'Issued'); } });
  const asp = useMutation({ mutationFn: () => api.post(`/invoices/${id}/asp-submit`, {}), onSuccess: (r: any) => { refresh(); r.sandbox ? toast.warning(r.message || 'Recorded in sandbox mode — not transmitted') : toast.success('Submitted to ASP'); } });
  const voidIt = useMutation({ mutationFn: () => api.post(`/invoices/${id}/void`, {}), onSuccess: () => { refresh(); toast.success('Invoice voided and charges released'); onClose(); } });
  const i = q.data;
  return (
    <Modal size="lg" title={i ? <span className="mono">{i.number}</span> : 'Invoice'} sub={i && `${i.customer_name}${i.shipment_number ? ' · ' + i.shipment_number : ''}`} onClose={onClose} footer={i && <>
      <button className="btn outline" onClick={() => openFile(`/invoices/${id}/print`).catch((e) => toast.error(e.message))}><Printer /> Print / PDF</button>
      {i.has_xml && <button className="btn outline" onClick={() => openFile(`/invoices/${id}/xml`, `${i.number}.xml`)}><Download /> XML</button>}
      {can('invoices', 'u') && i.has_xml && i.asp_status === 'not_submitted' && <button className="btn outline" onClick={() => asp.mutate()}>Submit to ASP</button>}
      {can('invoices', 'a') && i.kind === 'tax_invoice' && !['draft', 'void'].includes(i.status) && <button className="btn outline" onClick={() => setCredit(true)}><FileMinus /> Credit note</button>}
      {can('invoices', 'd') && i.status !== 'void' && i.paid === 0 && i.kind === 'tax_invoice' && i.asp_status === 'not_submitted' && <button className="btn outline" onClick={() => voidIt.mutate()}><Ban /> Void</button>}
      {can('invoices', 'u') && i.status === 'draft' && <button className="btn primary" disabled={send.isPending} onClick={() => send.mutate()}><Send /> Issue invoice</button>}
      {can('accounting', 'c') && can('invoices', 'u') && ['sent', 'partial', 'overdue'].includes(i.status) && i.kind === 'tax_invoice' && <button className="btn primary" onClick={() => setPay(true)}><Wallet /> Record payment</button>}
    </>}>
      {!i ? <div className="skel" style={{ height: 200 }} /> : (
        <>
          <div className="actions" style={{ marginBottom: 12 }}><StatusBadge value={i.status} /><Badge tone={i.asp_status === 'not_submitted' ? '' : 'info'}>e-invoice: {label(i.asp_status)}</Badge>{i.kind === 'credit_note' && <Badge tone="violet">credit note</Badge>}</div>
          <Detail items={[['Issued', fdate(i.issue_date)], ['Due', fdate(i.due_date)], ['Subtotal', aed(i.subtotal)], ['VAT', aed(i.vat)], ['Total', <b key="t">{aed(i.total)}</b>], ['Paid', aed(i.paid)], ['Outstanding', <b key="o" className={i.outstanding > 0 && i.status === 'overdue' ? 'down' : ''}>{aed(i.outstanding)}</b>], ['ASP reference', i.asp_ref || '—']]} />
          <div className="table-wrap" style={{ marginTop: 14 }}><table className="t"><thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Unit</th><th>VAT</th><th className="num">Net</th><th className="num">VAT</th><th className="num">Total</th></tr></thead>
            <tbody>{i.items.map((l: any) => <tr key={l.id}><td>{l.description}</td><td className="num">{Number(l.quantity)}</td><td className="num">{aed(l.unit_price, { noSymbol: true })}</td><td className="mono">{l.tax_code}</td><td className="num">{aed(l.net, { noSymbol: true })}</td><td className="num">{aed(l.vat, { noSymbol: true })}</td><td className="num">{aed(l.total, { noSymbol: true })}</td></tr>)}</tbody></table></div>
          {i.payments.length > 0 && <Card title="Payments" className="mt" pad={false}><DataTable rows={i.payments} columns={[{ key: 'number', label: 'Receipt', render: (p) => <span className="mono">{p.number}</span> }, { key: 'paid_at', label: 'Date', render: (p) => fdate(p.paid_at) }, { key: 'method', label: 'Method', render: (p) => label(p.method) }, { key: 'reference', label: 'Reference' }, { key: 'amount', label: 'Amount', num: true, render: (p) => aed(p.amount, { noSymbol: true }) }]} /></Card>}
        </>
      )}
      {pay && i && <FormModal title="Record payment" sub={`Outstanding ${aed(i.outstanding)}`} initial={{ amount: i.outstanding, method: 'bank_transfer' }} fields={[
        { name: 'amount', label: 'Amount (AED)', type: 'number', required: true, min: 0.01 }, { name: 'method', label: 'Method', type: 'select', options: ['bank_transfer', 'cheque', 'cash', 'card', 'online'] },
        { name: 'bank_account_id', label: 'Deposit to', type: 'ref', ref: { resource: 'accounts', params: { is_bank: 'true' }, label: (r: any) => `${r.code} — ${r.name}` } }, { name: 'reference', label: 'Reference' }, { name: 'paid_at', label: 'Date received', type: 'date' }]}
        onSubmit={async (v) => { await api.post(`/invoices/${id}/payments`, v); refresh(); toast.success('Payment recorded'); }} onClose={() => setPay(false)} />}
      {credit && i && <FormModal title="Issue credit note" sub="Reduces the receivable and reverses VAT proportionally. Required once an invoice has been reported to the FTA." initial={{ amount: i.outstanding > 0 ? i.outstanding : i.total }} fields={[{ name: 'amount', label: 'Credit amount (gross, AED)', type: 'number', required: true, min: 0.01 }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, span: 2 }]}
        onSubmit={async (v) => { const r = await api.post(`/invoices/${id}/credit-note`, v); refresh(); toast.success(`Credit note ${r.number} issued`); }} onClose={() => setCredit(false)} />}
    </Modal>
  );
}

function Unbilled() {
  const can = useCan();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['res', 'unbilled'], queryFn: () => api.get('/invoices/unbilled') });
  const mk = useMutation({ mutationFn: (sid: string) => api.post(`/invoices/from-shipment/${sid}`, {}), onSuccess: (inv: any) => { qc.invalidateQueries({ queryKey: ['res'] }); toast.success(`Draft ${inv.number} created`); } });
  return (
    <>
      <Banner>Jobs with revenue that has not been invoiced. Delivered jobs with a POD are safest to bill first — disputes drop when the proof is attached.</Banner>
      <DataTable loading={q.isLoading} rows={q.data?.data || []} empty={<Empty title="Everything is invoiced" />} columns={[
        { key: 'number', label: 'Job', render: (r) => <b className="mono">{r.number}</b> }, { key: 'customer_name', label: 'Customer', render: (r) => <span>{r.customer_name} {r.customer_status !== 'active' && <Badge tone="bad">{r.customer_status}</Badge>}</span> },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }, { key: 'has_pod', label: 'POD', render: (r) => (r.has_pod ? <Badge tone="ok">attached</Badge> : <span className="muted">—</span>) },
        { key: 'unbilled', label: 'Unbilled (AED)', num: true, render: (r) => aed(r.unbilled, { noSymbol: true }) }, { key: 'lines', label: 'Lines', num: true },
        { key: '_', label: '', sortable: false, render: (r) => can('invoices', 'c') && <button className="btn xs primary" disabled={mk.isPending} onClick={() => mk.mutate(r.id)}>Create invoice</button> },
      ]} />
    </>
  );
}

export default function Invoices() {
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const ageing = useQuery({ queryKey: ['res', 'ar-report'], queryFn: () => api.get('/reports/ar-ageing'), enabled: tab === 'ageing' });
  return (
    <>
      <PageHead title="Invoices" sub="UAE tax invoices with per-line VAT, e-invoicing (PINT-AE XML), credit notes and receivables control." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All invoices' }, { key: 'unbilled', label: 'Ready to invoice' }, { key: 'ageing', label: 'AR ageing' }]} />
      {tab === 'all' && <ResourceTable resource="invoices" module="invoices" noun="invoice" canEdit={false} canDelete={false} searchPlaceholder="Search invoice number…" onRowClick={(r) => setOpen(r.id)}
        filters={[{ key: 'status', label: 'Status', options: ['draft', 'sent', 'partial', 'overdue', 'paid'] }]}
        columns={[{ key: 'number', label: 'Invoice', render: (r) => <b className="mono">{r.number}</b> }, { key: 'customer_name', label: 'Customer' }, { key: 'issue_date', label: 'Issued', render: (r) => fdate(r.issue_date), hideSm: true },
          { key: 'due_date', label: 'Due', render: (r) => <span className={r.days_overdue > 0 && r.outstanding > 0 ? 'down' : ''}>{fdate(r.due_date)}{r.days_overdue > 0 && r.outstanding > 0 ? ` (${r.days_overdue}d)` : ''}</span> },
          { key: 'vat', label: 'VAT', num: true, render: (r) => aed(r.vat, { noSymbol: true }), hideSm: true }, { key: 'total', label: 'Total', num: true, render: (r) => aed(r.total, { noSymbol: true }) }, { key: 'outstanding', label: 'Outstanding', num: true, render: (r) => aed(r.outstanding, { noSymbol: true }) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }, { key: 'asp_status', label: 'e-invoice', render: (r) => <span className="muted">{label(r.asp_status)}</span>, hideSm: true }]} />}
      {tab === 'unbilled' && <Unbilled />}
      {tab === 'ageing' && (ageing.isLoading ? null : (
        <Card title={`Outstanding ${aed(ageing.data?.total)}`} pad={false}>
          <DataTable rows={ageing.data?.customers || []} rowKey="customer_id" columns={[{ key: 'customer_name', label: 'Customer', render: (r) => <b>{r.customer_name}</b> }, { key: 'c', label: 'Current', num: true, render: (r) => aed(r.buckets.current, { noSymbol: true }) }, { key: 'a', label: '1–30', num: true, render: (r) => aed(r.buckets.d1_30, { noSymbol: true }) }, { key: 'b', label: '31–60', num: true, render: (r) => aed(r.buckets.d31_60, { noSymbol: true }) }, { key: 'd', label: '61–90', num: true, render: (r) => aed(r.buckets.d61_90, { noSymbol: true }) }, { key: 'e', label: '90+', num: true, render: (r) => <span className="down">{aed(r.buckets.d90p, { noSymbol: true })}</span> }, { key: 'total', label: 'Total', num: true, render: (r) => <b>{aed(r.total, { noSymbol: true })}</b> }]} />
        </Card>
      ))}
      {open && <InvoiceModal id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
