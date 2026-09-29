import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { aed, fdate, label, monthStart, today } from '../lib/format';
import { Banner, Card, DataTable, Kpi, PageHead, StatusBadge } from '../ui/kit';

export default function Vat() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const q = useQuery({ queryKey: ['res', 'vat', from, to], queryFn: () => api.get(`/accounting/vat${qs({ from, to })}`) });
  const b = q.data?.boxes;
  return (
    <>
      <PageHead title="UAE VAT & e-invoicing" sub="VAT return summary aligned to FTA VAT 201 boxes, plus the e-invoice transmission status of every tax invoice." />
      <Banner>Review-ready summary computed from posted invoices and bills. File through the FTA EmaraTax portal — this system does not submit returns. E-invoice XML is generated in PINT-AE (Peppol) structure and transmitted only if an accredited service provider is configured (Settings → Integrations); otherwise it is recorded in sandbox mode.</Banner>
      <div className="toolbar"><label className="muted">From</label><input type="date" className="input" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} /><label className="muted">To</label><input type="date" className="input" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {b && <div className="kpis">
        <Kpi label="Standard-rated supplies" value={aed(b.standardRatedSupplies.net, { compact: true })} sub={`VAT ${aed(b.standardRatedSupplies.vat)}`} />
        <Kpi label="Zero-rated supplies" value={aed(b.zeroRatedSupplies, { compact: true })} sub="International transport" />
        <Kpi label="Output VAT" value={aed(b.totalOutputVat)} /><Kpi label="Input VAT (recoverable)" value={aed(b.inputVat)} />
        <Kpi label="Net VAT payable" value={aed(b.netVatPayable)} tone={b.netVatPayable > 0 ? 'down' : 'up'} sub={b.netVatPayable >= 0 ? 'Payable to FTA' : 'Refundable'} />
      </div>}
      <Card title="Tax invoices in period" pad={false}>
        <DataTable loading={q.isLoading} rows={q.data?.invoices || []} rowKey="number" columns={[{ key: 'number', label: 'Invoice', render: (r) => <b className="mono">{r.number}</b> }, { key: 'kind', label: 'Type', render: (r) => label(r.kind) }, { key: 'issue_date', label: 'Date', render: (r) => fdate(r.issue_date) }, { key: 'customer_name', label: 'Customer' }, { key: 'subtotal', label: 'Net', num: true, render: (r) => aed(r.subtotal, { noSymbol: true }) }, { key: 'vat', label: 'VAT', num: true, render: (r) => aed(r.vat, { noSymbol: true }) }, { key: 'asp_status', label: 'E-invoice', render: (r) => <StatusBadge value={r.asp_status} /> }]} />
      </Card>
    </>
  );
}
