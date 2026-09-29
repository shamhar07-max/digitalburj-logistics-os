import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useCan } from '../store/session';
import { aed, fdate, label, monthStart, today, yearStart } from '../lib/format';
import { Badge, Banner, Bars, Card, DataTable, Empty, Kpi, Modal, PageHead, Skeleton, StatusBadge, Tabs, toast } from '../ui/kit';
import { Field, FormModal, useRefOptions, type FieldSpec } from '../ui/forms';
import { ResourceTable } from '../ui/ResourceTable';

const TABS = [['overview', 'Overview'], ['coa', 'Chart of accounts'], ['journal', 'Journal'], ['gl', 'General ledger'], ['ar', 'AR / AP'], ['bank', 'Bank reconciliation'], ['pl', 'P&L'], ['bs', 'Balance sheet'], ['cf', 'Cash flow'], ['tb', 'Trial balance']];

function Range({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return <div className="toolbar"><label className="muted">From</label><input type="date" className="input" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} /><label className="muted">To</label><input type="date" className="input" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} /></div>;
}
const Row = ({ l, v, b, indent }: { l: string; v: number; b?: boolean; indent?: boolean }) => <tr><td style={{ paddingInlineStart: indent ? 28 : 12, fontWeight: b ? 800 : 400 }}>{l}</td><td className="num mono" style={{ fontWeight: b ? 800 : 400 }}>{aed(v, { noSymbol: true })}</td></tr>;

function Overview() {
  const q = useQuery({ queryKey: ['res', 'acc-overview'], queryFn: () => api.get('/accounting/overview') });
  if (q.isLoading) return <Skeleton />;
  const o = q.data;
  return (
    <>
      <div className="kpis">
        <Kpi label="Cash position" value={aed(o.cashPosition, { compact: true })} /><Kpi label="Receivables" value={aed(o.receivables, { compact: true })} /><Kpi label="Payables" value={aed(o.payables, { compact: true })} />
        <Kpi label="Revenue (MTD)" value={aed(o.mtd.revenue, { compact: true })} /><Kpi label="Net profit (MTD)" value={aed(o.mtd.netProfit, { compact: true })} tone={o.mtd.netProfit >= 0 ? 'up' : 'down'} sub={`${o.mtd.grossMarginPct}% gross margin`} />
      </div>
      <div className="grid g2">
        <Card title="Bank accounts">{o.bankAccounts.map((b: any) => <div className="list-item" key={b.id}><span style={{ flex: 1 }}><b className="mono">{b.code}</b> {b.name}</span><b className="mono">{aed(b.balance)}</b></div>)}</Card>
        <Card title="Receivables ageing"><Bars data={[['Current', o.arAgeing.current], ['1–30', o.arAgeing.d1_30], ['31–60', o.arAgeing.d31_60], ['61–90', o.arAgeing.d61_90], ['90+', o.arAgeing.d90p]].map(([l, v]) => ({ label: l as string, value: Math.round(v as number) }))} format={(n) => aed(n, { compact: true, noSymbol: true })} /></Card>
      </div>
    </>
  );
}

function Journal() {
  const can = useCan();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any>(null);
  const accts = useRefOptions({ resource: 'accounts', label: (r: any) => `${r.code} — ${r.name}` } as any);
  const [lines, setLines] = useState<any[]>([{ account_id: '', debit: '', credit: '' }, { account_id: '', debit: '', credit: '' }]);
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(today());
  const dr = lines.reduce((s, l) => s + Number(l.debit || 0), 0), cr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const post = useMutation({ mutationFn: () => api.post('/accounting/journal', { memo, date, lines: lines.filter((l) => l.account_id).map((l) => ({ account_id: l.account_id, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['res'] }); toast.success('Journal posted'); setOpen(false); setMemo(''); setLines([{ account_id: '', debit: '', credit: '' }, { account_id: '', debit: '', credit: '' }]); } });
  return (
    <>
      <ResourceTable resource="journal-entries" module="accounting" noun="journal entry" canEdit={false} canDelete={false} searchPlaceholder="Search number or memo…" filters={[{ key: 'source', label: 'Source', options: ['manual', 'invoice', 'payment', 'bill', 'payroll'] }]}
        onRowClick={async (r) => setView(await api.get(`/accounting/journal/${r.id}`))} toolbarExtra={can('accounting', 'c') && <button className="btn primary" onClick={() => setOpen(true)}><Plus /> Manual journal</button>}
        columns={[{ key: 'number', label: 'Entry', render: (r) => <b className="mono">{r.number}</b> }, { key: 'entry_date', label: 'Date', render: (r) => fdate(r.entry_date) }, { key: 'memo', label: 'Memo' }, { key: 'source', label: 'Source', render: (r) => <Badge>{label(r.source)}</Badge> }, { key: 'total_debit', label: 'Amount', num: true, render: (r) => aed(r.total_debit, { noSymbol: true }) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status === 'posted' ? 'active' : r.status} /> }]} />
      {view && <Modal title={`${view.number} — ${view.memo}`} sub={`${fdate(view.entry_date)} · ${label(view.source)}`} onClose={() => setView(null)} footer={<>{can('accounting', 'd') && view.source === 'manual' && view.status === 'posted' && <button className="btn outline" onClick={async () => { await api.post(`/accounting/journal/${view.id}/reverse`); qc.invalidateQueries({ queryKey: ['res'] }); toast.success('Reversed'); setView(null); }}>Reverse entry</button>}<button className="btn primary" onClick={() => setView(null)}>Close</button></>}>
        <div className="table-wrap"><table className="t"><thead><tr><th>Account</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead><tbody>{view.lines.map((l: any) => <tr key={l.id}><td><b className="mono">{l.code}</b> {l.account_name}</td><td className="num">{l.debit ? aed(l.debit, { noSymbol: true }) : ''}</td><td className="num">{l.credit ? aed(l.credit, { noSymbol: true }) : ''}</td></tr>)}</tbody></table></div>
      </Modal>}
      {open && (
        <Modal title="Manual journal entry" size="lg" onClose={() => setOpen(false)} footer={<><span className={dr === cr && dr > 0 ? 'up' : 'down'} style={{ marginInlineEnd: 'auto', fontWeight: 700 }}>Debits {aed(dr, { noSymbol: true })} · Credits {aed(cr, { noSymbol: true })}</span><button className="btn outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" disabled={!memo || dr !== cr || dr === 0 || post.isPending} onClick={() => post.mutate()}>Post entry</button></>}>
          <div className="row2"><Field spec={{ name: 'm', label: 'Memo', required: true }} value={memo} onChange={setMemo} /><Field spec={{ name: 'd', label: 'Date', type: 'date' }} value={date} onChange={setDate} /></div>
          {lines.map((l, i) => (
            <div key={i} className="row3" style={{ gridTemplateColumns: '2fr 1fr 1fr auto', alignItems: 'end' }}>
              <Field spec={{ name: 'a' + i, label: i === 0 ? 'Account' : '', type: 'select', options: accts.options }} value={l.account_id} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, account_id: v } : x)))} />
              <Field spec={{ name: 'dr' + i, label: i === 0 ? 'Debit' : '', type: 'number' }} value={l.debit} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, debit: v, credit: v ? '' : x.credit } : x)))} />
              <Field spec={{ name: 'cr' + i, label: i === 0 ? 'Credit' : '', type: 'number' }} value={l.credit} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, credit: v, debit: v ? '' : x.debit } : x)))} />
              <button className="icon-btn" style={{ marginBottom: 12 }} aria-label="Remove line" disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 /></button>
            </div>
          ))}
          <button className="btn sm outline" onClick={() => setLines([...lines, { account_id: '', debit: '', credit: '' }])}><Plus /> Add line</button>
        </Modal>
      )}
    </>
  );
}

function GL() {
  const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(today()); const [acct, setAcct] = useState('');
  const accts = useRefOptions({ resource: 'accounts' } as any);
  const q = useQuery({ queryKey: ['res', 'gl', from, to, acct], queryFn: () => api.get(`/accounting/general-ledger${qs({ from, to, account_id: acct })}`) });
  return (<><Range from={from} to={to} setFrom={setFrom} setTo={setTo} />
    <div className="toolbar"><select className="select" style={{ maxWidth: 320 }} value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Account"><option value="">All accounts</option>{accts.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
    <DataTable loading={q.isLoading} rows={q.data?.data || []} columns={[{ key: 'entry_date', label: 'Date', render: (r) => fdate(r.entry_date) }, { key: 'number', label: 'Entry', render: (r) => <span className="mono">{r.number}</span> }, { key: 'account', label: 'Account', render: (r) => <span><b className="mono">{r.code}</b> {r.account}</span> }, { key: 'memo', label: 'Memo', render: (r) => r.line_memo || r.memo }, { key: 'debit', label: 'Debit', num: true, render: (r) => (r.debit ? aed(r.debit, { noSymbol: true }) : '') }, { key: 'credit', label: 'Credit', num: true, render: (r) => (r.credit ? aed(r.credit, { noSymbol: true }) : '') }]} /></>);
}

function ArAp() {
  const ar = useQuery({ queryKey: ['res', 'ar'], queryFn: () => api.get('/accounting/ar-ageing') });
  const ap = useQuery({ queryKey: ['res', 'ap'], queryFn: () => api.get('/accounting/ap-ageing') });
  const [pay, setPay] = useState<any>(null);
  const qc = useQueryClient();
  const banks = useRefOptions({ resource: 'accounts', params: { is_bank: 'true' } } as any);
  const [bankId, setBankId] = useState(''); const [amount, setAmount] = useState<any>('');
  const doPay = useMutation({ mutationFn: () => api.post(`/accounting/bills/${pay.id}/pay`, { amount: Number(amount), bank_account_id: bankId }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['res'] }); toast.success('Payment recorded'); setPay(null); } });
  const cols = (t: any) => [['Current', t.current], ['1–30', t.d1_30], ['31–60', t.d31_60], ['61–90', t.d61_90], ['90+', t.d90p]];
  return (
    <div className="grid g2">
      <Card title={`Receivables · ${aed(ar.data?.total, { compact: true })}`} pad={false}>
        {ar.data && <div style={{ padding: 12 }}><Bars data={cols(ar.data.totals).map(([l, v]) => ({ label: l as string, value: Math.round(v as number) }))} format={(n) => aed(n, { compact: true, noSymbol: true })} /></div>}
        <DataTable rows={ar.data?.customers || []} rowKey="customer_id" empty={<Empty title="No open receivables" />} columns={[{ key: 'customer_name', label: 'Customer', render: (r) => <b>{r.customer_name}</b> }, { key: 'total', label: 'Total', num: true, render: (r) => aed(r.total, { noSymbol: true }) }, { key: 'd', label: 'Overdue', num: true, render: (r) => <span className="down">{aed(r.total - r.buckets.current, { noSymbol: true })}</span> }]} />
      </Card>
      <Card title={`Payables · ${aed(ap.data?.total, { compact: true })}`} pad={false}>
        {ap.data && <div style={{ padding: 12 }}><Bars data={cols(ap.data.totals).map(([l, v]) => ({ label: l as string, value: Math.round(v as number) }))} format={(n) => aed(n, { compact: true, noSymbol: true })} /></div>}
        <DataTable rows={ap.data?.bills || []} empty={<Empty title="No open bills" />} columns={[{ key: 'number', label: 'Bill', render: (r) => <span className="mono">{r.number}</span> }, { key: 'supplier_name', label: 'Supplier' }, { key: 'due_date', label: 'Due', render: (r) => fdate(r.due_date) }, { key: 'outstanding', label: 'Outstanding', num: true, render: (r) => aed(r.outstanding, { noSymbol: true }) }, { key: '_', label: '', sortable: false, render: (r) => <button className="btn xs outline" onClick={() => { setPay(r); setAmount(r.outstanding); }}>Pay</button> }]} />
      </Card>
      {pay && <Modal title={`Pay ${pay.number}`} sub={pay.supplier_name} onClose={() => setPay(null)} footer={<><button className="btn outline" onClick={() => setPay(null)}>Cancel</button><button className="btn primary" disabled={!bankId || !(Number(amount) > 0)} onClick={() => doPay.mutate()}>Record payment</button></>}>
        <Field spec={{ name: 'b', label: 'Pay from', type: 'select', options: banks.options, required: true }} value={bankId} onChange={(v) => setBankId(v || '')} /><Field spec={{ name: 'a', label: 'Amount', type: 'number', required: true }} value={amount} onChange={setAmount} /></Modal>}
    </div>
  );
}

function Bank() {
  const qc = useQueryClient();
  const banks = useRefOptions({ resource: 'accounts', params: { is_bank: 'true' } } as any);
  const [acct, setAcct] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const sum = useQuery({ queryKey: ['res', 'bank-sum', acct], enabled: !!acct, queryFn: () => api.get(`/accounting/bank/summary?account_id=${acct}`) });
  const auto = useMutation({ mutationFn: () => api.post('/accounting/bank/auto-match', { account_id: acct }), onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['res'] }); toast.success(`${r.matched} of ${r.scanned} lines matched`); } });
  const ignore = useMutation({ mutationFn: (id: string) => api.post(`/accounting/bank/${id}/match`, { ignore: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ['res'] }) });
  return (
    <>
      <div className="toolbar"><select className="select" style={{ maxWidth: 320 }} value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Bank account"><option value="">Select bank account…</option>{banks.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        {acct && <><button className="btn dark" disabled={auto.isPending} onClick={() => auto.mutate()}>Auto-match</button><button className="btn outline" onClick={() => setCsvOpen(true)}>Import statement</button></>}</div>
      {!acct ? <Empty title="Choose a bank account" text="Import your bank statement (CSV) and auto-match receipts and payments." /> : (
        <>
          {sum.data && <div className="kpis"><Kpi label="Book balance" value={aed(sum.data.bookBalance)} /><Kpi label="Statement net" value={aed(sum.data.statementNet)} /><Kpi label="Difference" value={aed(sum.data.difference)} tone={Math.abs(sum.data.difference) < 0.01 ? 'up' : 'down'} /><Kpi label="Unmatched lines" value={sum.data.unmatchedLines} /></div>}
          <ResourceTable resource="bank-transactions" module="accounting" noun="statement line" params={{ account_id: acct }} canEdit={false} filters={[{ key: 'status', label: 'Status', options: ['unmatched', 'matched', 'ignored'] }]}
            columns={[{ key: 'txn_date', label: 'Date', render: (r) => fdate(r.txn_date) }, { key: 'description', label: 'Description' }, { key: 'reference', label: 'Reference', render: (r) => <span className="mono">{r.reference || '—'}</span>, hideSm: true }, { key: 'amount', label: 'Amount', num: true, render: (r) => <span className={r.amount < 0 ? 'down' : 'up'}>{aed(r.amount, { noSymbol: true })}</span> }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]}
            rowActions={(r) => r.status === 'unmatched' ? <button className="btn xs outline" onClick={() => ignore.mutate(r.id)}>Ignore</button> : null} />
        </>
      )}
      {csvOpen && <FormModal title="Import bank statement" sub="Paste CSV rows: date,description,amount,reference (negative = money out)" submitLabel="Import" fields={[{ name: 'csv', label: 'CSV', type: 'textarea', required: true, span: 2, placeholder: '2026-09-28,NOON WIRE 5541,8728.50,NOON-WIRE-5541' }]}
        onSubmit={async (v) => { const rows = String(v.csv).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^date/i.test(l)).map((l) => { const [date, description, amount, reference] = l.split(',').map((x) => x.trim()); return { date, description, amount: Number(amount), reference: reference || undefined }; }); const r = await api.post('/accounting/bank/import', { account_id: acct, rows }); qc.invalidateQueries({ queryKey: ['res'] }); toast.success(`${r.imported} lines imported`); }} onClose={() => setCsvOpen(false)} />}
    </>
  );
}

function Statements({ kind }: { kind: 'pl' | 'bs' | 'cf' | 'tb' }) {
  const [from, setFrom] = useState(kind === 'cf' || kind === 'pl' ? yearStart() : monthStart()); const [to, setTo] = useState(today());
  const path = kind === 'pl' ? `/accounting/pnl${qs({ from, to })}` : kind === 'bs' ? `/accounting/balance-sheet${qs({ asOf: to })}` : kind === 'cf' ? `/accounting/cash-flow${qs({ from, to })}` : `/accounting/trial-balance${qs({ asOf: to })}`;
  const q = useQuery({ queryKey: ['res', 'stmt', kind, from, to], queryFn: () => api.get(path) });
  const d = q.data;
  return (
    <>
      {kind === 'bs' || kind === 'tb' ? <div className="toolbar"><label className="muted">As of</label><input type="date" className="input" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} /></div> : <Range from={from} to={to} setFrom={setFrom} setTo={setTo} />}
      {q.isLoading ? <Skeleton /> : !d ? null : (
        <div className="table-wrap"><table className="t" style={{ minWidth: 420 }}><tbody>
          {kind === 'pl' && <>
            <tr><th colSpan={2}>Revenue</th></tr>{d.revenue.map((r: any) => <Row key={r.code} l={`${r.code} ${r.name}`} v={r.amount} indent />)}<Row l="Total revenue" v={d.totalRevenue} b />
            <tr><th colSpan={2}>Cost of sales</th></tr>{d.cogs.map((r: any) => <Row key={r.code} l={`${r.code} ${r.name}`} v={r.amount} indent />)}<Row l="Gross profit" v={d.grossProfit} b />
            <tr><th colSpan={2}>Operating expenses</th></tr>{d.opex.map((r: any) => <Row key={r.code} l={`${r.code} ${r.name}`} v={r.amount} indent />)}<Row l="Net profit" v={d.netProfit} b /></>}
          {kind === 'bs' && <>
            <tr><th colSpan={2}>Assets</th></tr>{d.assets.map((r: any) => <Row key={r.code} l={`${r.code} ${r.name}`} v={r.amount} indent />)}<Row l="Total assets" v={d.totalAssets} b />
            <tr><th colSpan={2}>Liabilities</th></tr>{d.liabilities.map((r: any) => <Row key={r.code} l={`${r.code} ${r.name}`} v={r.amount} indent />)}<Row l="Total liabilities" v={d.totalLiabilities} b />
            <tr><th colSpan={2}>Equity</th></tr>{d.equity.map((r: any) => <Row key={r.code} l={`${r.code} ${r.name}`} v={r.amount} indent />)}<Row l="Current earnings" v={d.currentEarnings} indent /><Row l="Total equity" v={d.totalEquity} b />
            <tr><td colSpan={2}>{d.balanced ? <Badge tone="ok">Balanced: assets = liabilities + equity</Badge> : <Badge tone="bad">Out of balance</Badge>}</td></tr></>}
          {kind === 'cf' && <>
            <Row l="Opening cash" v={d.openingBalance} b />{d.lines.map((r: any) => <tr key={r.source}><td style={{ paddingInlineStart: 28 }}>{r.label}</td><td className="num mono"><span className="up">+{aed(r.inflow, { noSymbol: true })}</span> / <span className="down">−{aed(r.outflow, { noSymbol: true })}</span></td></tr>)}
            <Row l="Net change" v={d.netChange} b /><Row l="Closing cash" v={d.closingBalance} b /></>}
          {kind === 'tb' && <>
            <tr><th>Account</th><th className="num">Debit</th><th className="num">Credit</th></tr>{d.lines.map((r: any) => <tr key={r.code}><td><b className="mono">{r.code}</b> {r.name}</td><td className="num mono">{r.balance_debit ? aed(r.balance_debit, { noSymbol: true }) : ''}</td><td className="num mono">{r.balance_credit ? aed(r.balance_credit, { noSymbol: true }) : ''}</td></tr>)}
            <tr><td><b>Totals</b></td><td className="num mono"><b>{aed(d.totalDebit, { noSymbol: true })}</b></td><td className="num mono"><b>{aed(d.totalCredit, { noSymbol: true })}</b></td></tr></>}
        </tbody></table></div>
      )}
    </>
  );
}

const COA: FieldSpec[] = [{ name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true }, { name: 'type', label: 'Type', type: 'select', required: true, options: ['asset', 'liability', 'equity', 'revenue', 'expense'] }, { name: 'subtype', label: 'Sub-type' }, { name: 'is_bank', label: 'Bank account', type: 'checkbox' }, { name: 'active', label: 'Active', type: 'checkbox' }];

export default function Accounting() {
  const [tab, setTab] = useState('overview');
  return (
    <>
      <PageHead title="Accounting" sub="Double-entry ledger with automatic postings from invoices, receipts, bills and payroll. Every entry balances or it is rejected." />
      <Tabs value={tab} onChange={setTab} tabs={TABS.map(([key, l]) => ({ key, label: l }))} />
      {tab === 'overview' && <Overview />}
      {tab === 'coa' && <ResourceTable resource="accounts" module="accounting" noun="account" fields={COA} defaultValues={{ active: true }} searchPlaceholder="Search code or name…" filters={[{ key: 'type', label: 'Type', options: ['asset', 'liability', 'equity', 'revenue', 'expense'] }]} pageSize={60}
        columns={[{ key: 'code', label: 'Code', render: (r) => <b className="mono">{r.code}</b> }, { key: 'name', label: 'Account' }, { key: 'type', label: 'Type', render: (r) => <Badge>{label(r.type)}</Badge> }, { key: 'balance', label: 'Balance', num: true, render: (r) => aed(r.balance, { noSymbol: true }) }, { key: 'is_bank', label: 'Bank', render: (r) => (r.is_bank ? <Badge tone="info">bank</Badge> : '') }]} />}
      {tab === 'journal' && <Journal />}
      {tab === 'gl' && <GL />}
      {tab === 'ar' && <ArAp />}
      {tab === 'bank' && <Bank />}
      {tab === 'pl' && <Statements kind="pl" />}
      {tab === 'bs' && <Statements kind="bs" />}
      {tab === 'cf' && <Statements kind="cf" />}
      {tab === 'tb' && <Statements kind="tb" />}
      <Banner>Bills and supplier payments are created from a job’s cost lines (Shipment → Charges) or via the AR/AP tab. Invoices post to the ledger when issued.</Banner>
    </>
  );
}
