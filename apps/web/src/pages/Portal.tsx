import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, LogOut, Send } from 'lucide-react';
import { api, openFile } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import { useSession } from '../store/session';
import { aed, fdate, fdt, label, portalStatus } from '../lib/format';
import { Badge, Banner, Card, ConfirmModal, DataTable, Empty, Kpi, Modal, Skeleton, StatusBadge, Tabs, Timeline, Toaster, toast } from '../ui/kit';

function ShipmentModal({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['portal', 'ship', id], queryFn: () => api.get(`/shipments/${id}/detail`) });
  const s = q.data?.shipment;
  return (
    <Modal size="lg" title={s ? <span className="mono">{s.number}</span> : 'Shipment'} sub={s && `${s.origin || ''} → ${s.destination || ''}`} onClose={onClose}>
      {!s ? <Skeleton /> : (<>
        <div className="actions" style={{ marginBottom: 12 }}><StatusBadge value={portalStatus(s.status)} />{s.container_no && <span className="mono">{s.container_no}</span>}<span className="muted">ETA {fdate(s.eta)}</span></div>
        <Timeline items={q.data.milestones.map((m: any) => ({ state: m.status === 'done' ? 'done' : '', title: m.name, sub: m.done_at ? `Completed ${fdt(m.done_at)}` : `Expected ${fdate(m.due_at)}` }))} />
        <h4 style={{ margin: '16px 0 6px' }}>Documents</h4>
        {!q.data.documents.length ? <p className="muted">No documents shared yet.</p> : q.data.documents.map((d: any) => <div className="list-item" key={d.id}><FileText size={16} /><span style={{ flex: 1 }}>{d.name}</span><button className="btn xs outline" onClick={() => openFile(`/documents/${d.id}/download`).catch((e) => toast.error(e.message))}><Download /> Open</button></div>)}
      </>)}
    </Modal>
  );
}

function Support() {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const threads = useQuery({ queryKey: ['inbox', 'portal'], queryFn: () => api.get('/inbox/threads?channel=portal') });
  const t = threads.data?.data?.[0];
  const msgs = useQuery({ queryKey: ['inbox', 'portal-thread', t?.id], enabled: !!t, queryFn: () => api.get(`/inbox/threads/${t.id}`) });
  useEffect(() => end.current?.scrollIntoView(), [msgs.data?.messages?.length]);
  const send = useMutation({
    mutationFn: () => (t ? api.post(`/inbox/threads/${t.id}/messages`, { body }) : api.post('/inbox/threads', { channel: 'portal', subject: 'Support', body })),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['inbox'] }); },
  });
  return (
    <Card title="Message your account team" pad={false}>
      <div className="msgs" style={{ minHeight: 280, maxHeight: '50vh' }}>
        {!msgs.data?.messages?.length && <Empty title="Start a conversation" text="Ask about a shipment, a quote or an invoice." />}
        {(msgs.data?.messages || []).map((m: any) => <div key={m.id} className={`msg ${m.direction === 'in' ? 'out' : ''}`}>{m.body}<small>{m.sender} · {fdt(m.created_at)}</small></div>)}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--line)' }}>
        <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message…" aria-label="Message" /><button className="btn primary" disabled={!body.trim() || send.isPending} aria-label="Send"><Send /></button>
      </form>
    </Card>
  );
}

export default function Portal() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const s = useSession();
  useRealtime();
  const [tab, setTab] = useState('home');
  const [ship, setShip] = useState<string | null>(null);
  const [acceptQ, setAcceptQ] = useState<any>(null);
  const home = useQuery({ queryKey: ['portal', 'home'], queryFn: () => api.get('/portal/home'), retry: false });
  const ships = useQuery({ queryKey: ['res', 'portal-ships'], queryFn: () => api.get('/shipments?pageSize=100'), enabled: tab === 'shipments' });
  const quotes = useQuery({ queryKey: ['res', 'portal-quotes'], queryFn: () => api.get('/quotes'), enabled: tab === 'quotes' });
  const invoices = useQuery({ queryKey: ['res', 'portal-inv'], queryFn: () => api.get('/invoices?pageSize=100'), enabled: tab === 'invoices' });
  const docs = useQuery({ queryKey: ['res', 'portal-docs'], queryFn: () => api.get('/documents?pageSize=100'), enabled: tab === 'docs' });
  const accept = useMutation({ mutationFn: (id: string) => api.post(`/quotes/${id}/accept`, {}), onSuccess: (r: any) => { qc.invalidateQueries(); toast.success(`Thank you — your booking ${r.shipment_number || ''} is confirmed`); } });
  const reject = useMutation({ mutationFn: (id: string) => api.post(`/quotes/${id}/reject`, {}), onSuccess: () => { qc.invalidateQueries(); toast.info('Quote declined'); } });
  const h = home.data;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/brand/business-os.svg" width={28} height={30} alt="" /><b style={{ fontFamily: 'var(--font)', fontSize: 17, flex: 1 }}>{h?.company || 'Customer portal'}</b>
        <span className="hide-sm" style={{ opacity: 0.75 }}>{h?.customer?.name}</span>
        <button className="btn sm outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)', background: 'transparent' }} onClick={() => { s.logout(); qc.clear(); nav('/login'); }}><LogOut /> Sign out</button>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 14px' }}>
        {home.error && <Banner kind="bad">{(home.error as Error).message}</Banner>}
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'home', label: 'Home' }, { key: 'shipments', label: 'My shipments' }, { key: 'quotes', label: 'Quotes', badge: h?.quotesAwaiting?.length }, { key: 'invoices', label: 'Invoices', badge: h?.unpaidInvoices?.length }, { key: 'docs', label: 'Documents' }, { key: 'support', label: 'Support', badge: h?.unreadMessages }]} />
        {tab === 'home' && (home.isLoading ? <Skeleton rows={5} /> : h && (
          <>
            <div className="kpis"><Kpi label="Active shipments" value={h.activeShipments.length} /><Kpi label="Quotes to review" value={h.quotesAwaiting.length} /><Kpi label="Invoices to pay" value={h.unpaidInvoices.length} sub={aed(h.unpaidInvoices.reduce((x: number, i: any) => x + i.total - i.paid, 0), { compact: true })} /><Kpi label="Messages" value={h.unreadMessages} /></div>
            <Card title="What’s moving" pad={false}>
              <DataTable rows={h.activeShipments} onRowClick={(r) => setShip(r.id)} empty={<Empty title="No active shipments" />} columns={[{ key: 'number', label: 'Shipment', render: (r) => <b className="mono">{r.number}</b> }, { key: 'origin', label: 'Route', render: (r) => `${r.origin || '?'} → ${r.destination || '?'}`, hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={portalStatus(r.status)} /> }, { key: 'progress', label: 'Progress', render: (r) => <span className="mono">{r.progress}</span> }, { key: 'eta', label: 'ETA', render: (r) => fdate(r.eta) }]} />
            </Card>
          </>
        ))}
        {tab === 'shipments' && <DataTable loading={ships.isLoading} rows={ships.data?.data || []} onRowClick={(r) => setShip(r.id)} columns={[{ key: 'number', label: 'Shipment', render: (r) => <b className="mono">{r.number}</b> }, { key: 'origin', label: 'Route', render: (r) => `${r.origin || '?'} → ${r.destination || '?'}` }, { key: 'container_no', label: 'Container', render: (r) => <span className="mono">{r.container_no || r.awb_number || '—'}</span>, hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={portalStatus(r.status)} /> }, { key: 'eta', label: 'ETA', render: (r) => fdate(r.eta) }]} />}
        {tab === 'quotes' && <DataTable loading={quotes.isLoading} rows={quotes.data?.data || []} empty={<Empty title="No quotes" />} columns={[{ key: 'number', label: 'Quote', render: (r) => <b className="mono">{r.number}</b> }, { key: 'origin', label: 'Route', render: (r) => `${r.origin || '?'} → ${r.destination || '?'}` }, { key: 'total', label: 'Total (incl. VAT)', num: true, render: (r) => aed(r.total, { noSymbol: true }) }, { key: 'valid_until', label: 'Valid until', render: (r) => fdate(r.valid_until) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: '_', label: '', sortable: false, render: (r) => r.status === 'sent' ? <div className="actions" style={{ flexWrap: 'nowrap' }}><button className="btn xs ok" onClick={() => setAcceptQ(r)}>Accept</button><button className="btn xs outline" onClick={() => reject.mutate(r.id)}>Decline</button></div> : null }]} />}
        {tab === 'invoices' && <DataTable loading={invoices.isLoading} rows={invoices.data?.data || []} empty={<Empty title="No invoices" />} columns={[{ key: 'number', label: 'Invoice', render: (r) => <b className="mono">{r.number}</b> }, { key: 'issue_date', label: 'Issued', render: (r) => fdate(r.issue_date), hideSm: true }, { key: 'due_date', label: 'Due', render: (r) => fdate(r.due_date) }, { key: 'total', label: 'Total', num: true, render: (r) => aed(r.total, { noSymbol: true }) }, { key: 'outstanding', label: 'Balance', num: true, render: (r) => aed(r.outstanding, { noSymbol: true }) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: '_', label: '', sortable: false, render: (r) => <button className="btn xs outline" onClick={() => openFile(`/invoices/${r.id}/print`).catch((e) => toast.error(e.message))}><Download /> PDF</button> }]} />}
        {tab === 'docs' && <DataTable loading={docs.isLoading} rows={docs.data?.data || []} empty={<Empty title="No documents shared yet" />} columns={[{ key: 'name', label: 'Document', render: (r) => <b>{r.name}</b> }, { key: 'type', label: 'Type', render: (r) => <Badge>{label(r.type)}</Badge> }, { key: 'shipment_number', label: 'Shipment', render: (r) => <span className="mono">{r.shipment_number || '—'}</span> }, { key: 'created_at', label: 'Added', render: (r) => fdt(r.created_at) },
          { key: '_', label: '', sortable: false, render: (r) => <button className="btn xs outline" onClick={() => openFile(`/documents/${r.id}/download`).catch((e) => toast.error(e.message))}><Download /> Open</button> }]} />}
        {tab === 'support' && <Support />}
      </main>
      {ship && <ShipmentModal id={ship} onClose={() => setShip(null)} />}
      {acceptQ && <ConfirmModal title={`Accept quote ${acceptQ.number}?`} text={<>By accepting you confirm the rates and terms at <b>{aed(acceptQ.total)}</b> (incl. VAT). Your booking is created immediately.</>} confirmLabel="Accept & book" onConfirm={() => accept.mutateAsync(acceptQ.id)} onClose={() => setAcceptQ(null)} />}
      <Toaster />
    </div>
  );
}
