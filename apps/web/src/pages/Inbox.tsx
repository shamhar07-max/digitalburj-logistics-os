import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Phone, Plus, Send, StickyNote, Globe } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useCan } from '../store/session';
import { aed, ago, fdt, label } from '../lib/format';
import { Badge, Empty, PageHead, Skeleton, StatusBadge, toast } from '../ui/kit';
import { FormModal } from '../ui/forms';

const ICON: Record<string, any> = { whatsapp: MessageCircle, email: Mail, portal: Globe, phone: Phone };

export default function Inbox() {
  const can = useCan();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [note, setNote] = useState(false);
  const [compose, setCompose] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const params: any = { search: search || undefined, status: 'open' };
  if (['whatsapp', 'email', 'portal'].includes(filter)) params.channel = filter;
  if (filter === 'unread') params.unread = 'true';
  const list = useQuery({ queryKey: ['inbox', 'list', params], queryFn: () => api.get(`/inbox/threads${qs(params)}`) });
  const th = useQuery({ queryKey: ['inbox', 'thread', sel], enabled: !!sel, queryFn: () => api.get(`/inbox/threads/${sel}`) });
  useEffect(() => { if (!sel && list.data?.data?.[0]) setSel(list.data.data[0].id); }, [list.data]);
  useEffect(() => end.current?.scrollIntoView(), [th.data?.messages?.length]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['inbox'] }); };
  const send = useMutation({ mutationFn: () => api.post(`/inbox/threads/${sel}/messages`, { body, note }), onSuccess: (m: any) => { setBody(''); refresh(); if (m.delivery_note) toast.warning(m.delivery_note); } });
  const close = useMutation({ mutationFn: () => api.patch(`/inbox/threads/${sel}`, { status: 'closed' }), onSuccess: () => { setSel(null); refresh(); } });
  const threads: any[] = list.data?.data || [];
  const t = th.data?.thread, ctx = th.data?.context;
  return (
    <>
      <PageHead title="Unified inbox" sub="WhatsApp, email, portal and phone — one thread per customer, with the shipment and account context beside it." actions={can('inbox', 'c') && <button className="btn primary" onClick={() => setCompose(true)}><Plus /> New message</button>} />
      <div className="inbox">
        <div>
          <div style={{ padding: 10, borderBottom: '1px solid var(--line)' }}>
            <input className="input" placeholder="Search conversations…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search conversations" />
            <div className="chips" style={{ marginTop: 8 }}>{[['all', 'All'], ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['portal', 'Portal'], ['unread', 'Unread']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {list.isLoading ? <div style={{ padding: 12 }}><Skeleton /></div> : !threads.length ? <Empty title="No conversations" /> : threads.map((x) => {
              const I = ICON[x.channel] || MessageCircle;
              return (
                <button key={x.id} className={`thread ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><I size={14} /><b style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.customer_name || x.contact_name || 'Unknown'}</b>{x.unread > 0 && <span className="u">{x.unread}</span>}<span className="muted" style={{ fontSize: 11 }}>{ago(x.last_message_at)}</span></div>
                  <div className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.last_message_preview}</div>
                  {!x.customer_id && <Badge tone="warn">needs triage</Badge>}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          {!sel ? <Empty title="Select a conversation" /> : !t ? <div style={{ padding: 16 }}><Skeleton /></div> : (
            <>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}><b>{t.customer_name || t.contact_name}</b><div className="muted" style={{ fontSize: 12 }}>{label(t.channel)}{t.external_id ? ` · ${t.external_id}` : ''}{t.subject ? ` · ${t.subject}` : ''}</div></div>
                {can('inbox', 'u') && <button className="btn sm outline" onClick={() => close.mutate()}>Close</button>}
              </div>
              <div className="msgs">
                {th.data.messages.map((m: any) => (
                  <div key={m.id} className={`msg ${m.direction === 'out' ? 'out' : m.direction === 'note' ? 'note' : ''}`}>{m.direction === 'note' && <b>Internal note · </b>}{m.body}<small>{m.sender} · {fdt(m.created_at)}{m.direction === 'out' && m.status !== 'sent' ? ` · ${m.status}` : ''}</small></div>
                ))}
                <div ref={end} />
              </div>
              {can('inbox', 'c') && (
                <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }} style={{ padding: 10, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
                  <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder={note ? 'Internal note (not sent)…' : `Reply on ${label(t.channel)}…`} aria-label="Message" style={note ? { background: 'var(--warn-bg)' } : undefined} />
                  <button type="button" className={`icon-btn ${note ? 'on' : ''}`} onClick={() => setNote(!note)} aria-pressed={note} aria-label="Internal note" title="Internal note"><StickyNote /></button>
                  <button className="btn primary" disabled={!body.trim() || send.isPending} aria-label="Send"><Send /></button>
                </form>
              )}
            </>
          )}
        </div>
        <div style={{ padding: 14, overflowY: 'auto' }}>
          {!ctx ? <p className="muted">{t && !t.customer_id ? 'Unknown sender. Link this thread to a customer to see account context.' : 'Customer context appears here.'}</p> : (
            <>
              <h3 style={{ fontFamily: 'var(--font)' }}>{ctx.customer.name}</h3>
              <p className="muted">{ctx.customer.code} · <StatusBadge value={ctx.customer.status} /></p>
              <p style={{ marginTop: 10 }}>Outstanding: <b className={ctx.outstanding > ctx.customer.credit_limit && ctx.customer.credit_limit > 0 ? 'down' : ''}>{aed(ctx.outstanding)}</b></p>
              <h4 style={{ margin: '14px 0 6px', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-3)' }}>Open shipments</h4>
              {ctx.shipments.length ? ctx.shipments.map((s: any) => <div key={s.id} className="list-item" style={{ padding: '8px 0' }}><b className="mono">{s.number}</b><span style={{ flex: 1 }} className="muted">{s.origin}→{s.destination}</span><StatusBadge value={s.status} /></div>) : <p className="muted">None</p>}
            </>
          )}
        </div>
      </div>
      {compose && <FormModal title="New message" fields={[{ name: 'channel', label: 'Channel', type: 'select', required: true, options: ['whatsapp', 'email', 'phone'] }, { name: 'customer_id', label: 'Customer', type: 'ref', ref: { resource: 'customers' } }, { name: 'external_id', label: 'Phone (with country code) or email', required: true }, { name: 'subject', label: 'Subject' }, { name: 'body', label: 'Message', type: 'textarea', required: true, span: 2 }]} initial={{ channel: 'whatsapp' }} submitLabel="Send"
        onSubmit={async (v) => { const r = await api.post('/inbox/threads', v); setSel(r.thread.id); refresh(); if (r.msg.status === 'queued') toast.warning(r.msg.note || 'Queued — channel not connected'); else toast.success('Sent'); }} onClose={() => setCompose(false)} />}
    </>
  );
}
