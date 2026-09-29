import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, Plus, Printer, Send, ShieldAlert, Trash2 } from 'lucide-react';
import { calcTotals, CHARGE_TYPES, defaultTaxCode, marginPct, MODES } from '@digitalburj/shared';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, fdate, label, num } from '../lib/format';
import { Banner, Card, Empty, Skeleton, StatusBadge, toast } from '../ui/kit';
import { Field, type FieldSpec } from '../ui/forms';

interface Item { key: number; rate_id?: string | null; charge_type: string; description: string; quantity: number; unit_price: number; unit_cost?: number; tax_code: 'S' | 'Z' | 'E' | 'O' }
let k = 1;
const blank = (): Item => ({ key: k++, charge_type: 'freight', description: '', quantity: 1, unit_price: 0, tax_code: 'Z' });

const HEAD: FieldSpec[] = [
  { name: 'customer_id', label: 'Customer', type: 'ref', required: true, ref: { resource: 'customers' } },
  { name: 'mode', label: 'Mode', type: 'select', required: true, options: MODES.map((m) => ({ value: m.value, label: m.label })) },
  { name: 'origin', label: 'Origin' }, { name: 'destination', label: 'Destination' },
  { name: 'incoterm', label: 'Incoterm', type: 'select', options: ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'] }, { name: 'valid_until', label: 'Valid until', type: 'date' },
  { name: 'containers', label: 'Equipment', placeholder: '2x40HC' }, { name: 'weight_kg', label: 'Weight (kg)', type: 'number' }, { name: 'volume_cbm', label: 'Volume (CBM)', type: 'number' },
  { name: 'cargo_description', label: 'Cargo', span: 2 },
];

export default function QuoteBuilder() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const canCost = can('costs', 'r');
  const [form, setForm] = useState<Record<string, any>>({ mode: 'sea_fcl', customer_id: sp.get('customer') || null, deal_id: sp.get('deal') || null, terms: 'Rates valid for the period stated. Subject to space and equipment availability. Payment terms per customer agreement. Storage, demurrage and detention at cost.' });
  const [items, setItems] = useState<Item[]>([blank()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const existing = useQuery({ queryKey: ['quote', id], enabled: !!id, queryFn: () => api.get(`/quotes/${id}`) });
  const rates = useQuery({ queryKey: ['res', 'rates', form.mode], queryFn: () => api.get(`/rates?pageSize=200&mode=${form.mode}&status=active`) });
  const q = existing.data;

  useEffect(() => {
    if (!q) return;
    setForm({ ...q });
    setItems((q.items as any[]).map((i) => ({ key: k++, charge_type: i.charge_type, description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price), unit_cost: i.unit_cost === undefined ? undefined : Number(i.unit_cost), tax_code: i.tax_code })));
  }, [q]);

  const totals = useMemo(() => calcTotals(items.map((i) => ({ quantity: i.quantity || 0, unit_price: i.unit_price || 0, tax_code: i.tax_code }))), [items]);
  const knownCost = canCost && items.every((i) => i.unit_cost !== undefined);
  const cost = knownCost ? items.reduce((s, i) => s + i.quantity * (i.unit_cost || 0), 0) : null;
  const status: string = q?.status || 'draft';
  const editable = !id || ['draft', 'approved', 'pending_approval'].includes(status);
  const setItem = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const refresh = () => { qc.invalidateQueries({ queryKey: ['quote', id] }); qc.invalidateQueries({ queryKey: ['res', 'quotes'] }); };

  const payload = () => ({
    customer_id: form.customer_id, deal_id: form.deal_id || null, mode: form.mode, origin: form.origin || null, destination: form.destination || null, incoterm: form.incoterm || null, cargo_description: form.cargo_description || null,
    weight_kg: form.weight_kg ?? null, volume_cbm: form.volume_cbm ?? null, containers: form.containers || null, valid_until: form.valid_until ? String(form.valid_until).slice(0, 10) : null, terms: form.terms || null, notes: form.notes || null,
    items: items.filter((i) => i.description.trim()).map((i) => ({ rate_id: i.rate_id || null, charge_type: i.charge_type, description: i.description, quantity: i.quantity, unit_price: i.unit_price, unit_cost: canCost && !i.rate_id ? i.unit_cost : undefined, tax_code: i.tax_code })),
  });
  const save = useMutation({
    mutationFn: async () => {
      const p = payload();
      const e: Record<string, string> = {};
      if (!p.customer_id) e.customer_id = 'Select a customer';
      if (!p.items.length) e.items = 'Add at least one charge line';
      setErrors(e);
      if (Object.keys(e).length) throw new Error(Object.values(e)[0]);
      return id ? api.put(`/quotes/${id}`, p) : api.post('/quotes', p);
    },
    onSuccess: (r) => { toast.success(`Quote ${r.number} saved`); refresh(); if (!id) nav(`/quotes/${r.id}`, { replace: true }); },
  });
  const act = (path: string, msg: string, after?: (r: any) => void) => ({
    mutationFn: () => api.post(`/quotes/${id}/${path}`, {}),
    onSuccess: (r: any) => { toast.success(msg); refresh(); after?.(r); },
  });
  const submit = useMutation(act('submit', 'Submitted'));
  const send = useMutation(act('send', 'Quote marked as sent'));
  const accept = useMutation(act('accept', 'Accepted — job created', (r) => nav(`/shipments/${r.shipment_id}`)));
  const reject = useMutation(act('reject', 'Quote rejected'));
  const dup = useMutation(act('duplicate', 'Duplicated', (r) => nav(`/quotes/${r.id}`)));

  if (id && existing.isLoading) return <Skeleton rows={8} />;
  if (id && existing.error) return <Empty title="Quote not found" action={<Link className="btn outline" to="/quotes">Back</Link>} />;

  const addRate = (rid: string) => {
    const r = (rates.data?.data || []).find((x: any) => x.id === rid);
    if (!r) return;
    setForm((f) => ({ ...f, origin: f.origin || r.origin, destination: f.destination || r.destination }));
    setItems((xs) => [...xs.filter((x) => x.description.trim() || x.unit_price), { key: k++, rate_id: r.id, charge_type: r.mode === 'road' ? 'trucking' : 'freight', description: `${r.origin} → ${r.destination}${r.container_type ? ' · ' + r.container_type : ''} (${r.unit})`, quantity: 1, unit_price: Number(r.sell_rate), unit_cost: r.buy_rate !== undefined ? Number(r.buy_rate) : undefined, tax_code: defaultTaxCode(r.mode === 'road' ? 'trucking' : 'freight') }]);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/quotes" className="muted" style={{ fontSize: 12.5, display: 'inline-flex', gap: 4, alignItems: 'center' }}><ArrowLeft size={13} /> Quotations</Link>
          <h1 className="page-title mono" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{q?.number || 'New quote'} {id && <StatusBadge value={status} />}</h1>
          {q && <p className="page-sub">{q.customer_name} · created {fdate(q.created_at)}{q.sent_at ? ` · sent ${fdate(q.sent_at)}` : ''}{q.accepted_at ? ` · accepted ${fdate(q.accepted_at)}` : ''}</p>}
        </div>
        <div className="actions no-print">
          {id && can('quotes', 'c') && <button className="btn outline" onClick={() => dup.mutate()}><Copy /> Duplicate</button>}
          {id && <button className="btn outline" onClick={() => window.print()}><Printer /> Print</button>}
          {editable && can('quotes', 'u') && <button className="btn dark" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : id ? 'Save changes' : 'Create quote'}</button>}
          {id && status === 'draft' && can('quotes', 'u') && <button className="btn primary" disabled={submit.isPending} onClick={() => submit.mutate()}><Check /> Submit</button>}
          {id && ['approved', 'sent'].includes(status) && can('quotes', 'u') && <button className="btn primary" disabled={send.isPending} onClick={() => send.mutate()}><Send /> {status === 'sent' ? 'Re-send' : 'Mark as sent'}</button>}
          {id && status === 'sent' && can('quotes', 'u') && <button className="btn ok" disabled={accept.isPending} onClick={() => accept.mutate()}>Customer accepted → create job</button>}
          {id && status === 'sent' && can('quotes', 'u') && <button className="btn outline" onClick={() => reject.mutate()}>Rejected</button>}
        </div>
      </div>
      {status === 'pending_approval' && <Banner kind="warn"><ShieldAlert size={14} /> Waiting for owner approval. It cannot be sent until approved — editing the quote withdraws the approval request.</Banner>}
      {status === 'accepted' && q?.shipment_id && <Banner>Accepted. <Link to={`/shipments/${q.shipment_id}`}>Open the job →</Link></Banner>}
      {id && q && !editable && <Banner kind="warn">This quote is {status}. Duplicate it to revise.</Banner>}
      {errors.items && <Banner kind="bad">{errors.items}</Banner>}

      <div className="grid g2" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
        <Card title="Shipment details">
          <div className="row2">{HEAD.map((f) => <Field key={f.name} spec={{ ...f, span: f.span }} value={form[f.name]} error={errors[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} editing={!editable} />)}</div>
        </Card>
        <Card title="Summary">
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Subtotal</span><b className="mono">{aed(totals.subtotal)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">VAT</span><b className="mono">{aed(totals.vat)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}><b>Total</b><b className="mono">{aed(totals.total)}</b></div>
            {canCost && cost !== null && <>
              <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Buy cost</span><b className="mono">{aed(cost)}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Margin</span><b className={`mono ${marginPct(totals.subtotal, cost) < 8 ? 'down' : 'up'}`}>{aed(totals.subtotal - cost)} · {marginPct(totals.subtotal, cost)}%</b></div>
            </>}
            {!canCost && <p className="hint">Buy rates and margin are hidden for your role; the system checks margin policy when you submit.</p>}
          </div>
        </Card>
      </div>

      <Card title="Charges" pad={false} className="mt" actions={editable && <>
        <select className="select" style={{ width: 260, height: 32 }} value="" onChange={(e) => e.target.value && addRate(e.target.value)} aria-label="Add from rate card">
          <option value="">+ Add from rate card…</option>
          {(rates.data?.data || []).map((r: any) => <option key={r.id} value={r.id}>{r.origin} → {r.destination} · {r.container_type || r.unit} · {num(r.sell_rate)}</option>)}
        </select>
        <button className="btn sm outline" onClick={() => setItems((x) => [...x, blank()])}><Plus /> Line</button>
      </>}>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table className="t" style={{ minWidth: 820 }}>
            <thead><tr><th>Type</th><th style={{ width: '32%' }}>Description</th><th className="num">Qty</th><th className="num">Unit price</th>{canCost && <th className="num">Unit cost</th>}<th>VAT</th><th className="num">Net</th><th className="num">Total</th><th /></tr></thead>
            <tbody>
              {items.map((it, idx) => {
                const r = totals.rows[idx];
                return (
                  <tr key={it.key}>
                    <td><select className="select" disabled={!editable} value={it.charge_type} onChange={(e) => setItem(it.key, { charge_type: e.target.value, tax_code: defaultTaxCode(e.target.value) })} aria-label="Charge type">{CHARGE_TYPES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></td>
                    <td><input className="input" disabled={!editable} value={it.description} onChange={(e) => setItem(it.key, { description: e.target.value })} placeholder="Description" aria-label="Description" /></td>
                    <td><input className="input num" disabled={!editable} type="number" min="0" step="any" value={it.quantity} onChange={(e) => setItem(it.key, { quantity: Number(e.target.value) })} style={{ width: 80 }} aria-label="Quantity" /></td>
                    <td><input className="input num" disabled={!editable} type="number" min="0" step="any" value={it.unit_price} onChange={(e) => setItem(it.key, { unit_price: Number(e.target.value) })} style={{ width: 110 }} aria-label="Unit price" /></td>
                    {canCost && <td><input className="input num" disabled={!editable || !!it.rate_id} type="number" min="0" step="any" value={it.unit_cost ?? ''} onChange={(e) => setItem(it.key, { unit_cost: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ width: 110 }} aria-label="Unit cost" /></td>}
                    <td><select className="select" disabled={!editable} value={it.tax_code} onChange={(e) => setItem(it.key, { tax_code: e.target.value as any })} style={{ width: 64 }} aria-label="VAT code"><option value="S">5%</option><option value="Z">0% Z</option><option value="E">Exempt</option><option value="O">OOS</option></select></td>
                    <td className="num mono">{num(r?.net, 2)}</td><td className="num mono">{num(r?.total, 2)}</td>
                    <td>{editable && items.length > 1 && <button className="icon-btn" aria-label="Remove line" onClick={() => setItems((x) => x.filter((y) => y.key !== it.key))}><Trash2 /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ padding: '8px 16px' }}>International freight is zero-rated (Z) under UAE VAT; local handling, clearance and trucking are 5% (S). Disbursements are out of scope (O).</p>
      </Card>
      <Card title="Terms & notes" className="mt">
        <div className="row2">
          <Field spec={{ name: 'terms', label: 'Terms & conditions', type: 'textarea' }} value={form.terms} onChange={(v) => setForm({ ...form, terms: v })} editing={!editable} />
          <Field spec={{ name: 'notes', label: 'Internal notes', type: 'textarea' }} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} editing={!editable} />
        </div>
      </Card>
    </>
  );
}

