import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Bot, ChevronsLeft, ChevronsRight, LogOut, Menu, Moon, Search, Send, Sun, Languages, CornerDownLeft } from 'lucide-react';
import { api } from './lib/api';
import { useCan, useSession } from './store/session';
import { NAV } from './nav';
import { applyLocale, applyTheme, useT } from './lib/i18n';
import { ago, initials } from './lib/format';
import { Drawer, Empty, Modal, Skeleton } from './ui/kit';
import { useRealtime } from './hooks/useRealtime';

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const can = useCan();
  const t = useT();
  const collapsed = useSession((s) => s.collapsed);
  const pending = useQuery({ queryKey: ['approvals', 'count'], queryFn: () => api.get('/approvals'), enabled: can('approvals', 'r'), refetchInterval: 60_000 });
  const badge = pending.data?.data?.length || 0;
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`} aria-label="Primary">
      <div className="brand">
        <img src="/brand/business-os.svg" alt="" />
        <div><b>DigitalBurj</b><small>Logistics OS</small></div>
      </div>
      <nav className="nav">
        {NAV.map((s) => {
          const items = s.items.filter((i) => can(i.module, 'r'));
          if (!items.length) return null;
          return (
            <div key={s.title}>
              <div className="nav-title">{t(s.key, s.title)}</div>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={onNavigate} title={t(i.key, i.label)} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <i.icon aria-hidden />
                  <span className="nav-label">{t(i.key, i.label)}</span>
                  {i.key === 'approvals' && badge > 0 && <span className="nav-badge">{badge}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications') });
  const read = useMutation({ mutationFn: (ids?: string[]) => api.post('/notifications/read', { ids }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  return (
    <Drawer title="Notifications" onClose={onClose} footer={<div className="modal-f"><button className="btn outline" onClick={() => read.mutate(undefined)}>Mark all read</button></div>}>
      {q.isLoading ? <div style={{ padding: 16 }}><Skeleton /></div> : !q.data?.data.length ? <Empty title="You're all caught up" icon={<Bell />} /> : (
        <div style={{ padding: '4px 16px' }}>
          {q.data.data.map((n: any) => (
            <button key={n.id} className="list-item" style={{ width: '100%', textAlign: 'start', opacity: n.read_at ? 0.6 : 1 }} onClick={() => { read.mutate([n.id]); if (n.link) { nav(n.link); onClose(); } }}>
              <span className={`ico ${n.level === 'error' ? 'bad' : n.level === 'warning' ? 'warn' : n.level === 'success' ? 'ok' : 'info'}`}><Bell /></span>
              <span style={{ flex: 1 }}><b style={{ display: 'block' }}>{n.title}</b>{n.body && <span className="muted" style={{ fontSize: 12.5 }}>{n.body}</span>}<span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{ago(n.created_at)}</span></span>
            </button>
          ))}
        </div>
      )}
    </Drawer>
  );
}

const SUGGESTIONS = ['What needs my attention today?', 'Which jobs are delivered but unbilled?', 'Who owes us money?', 'Which shipments are at risk?'];
function Assistant({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([{ role: 'assistant', content: 'Hi — I can answer from your live shipments, invoices and pipeline. I am read-only: I never send, pay or file anything.' }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy]);
  const ask = async (m: string) => {
    if (!m.trim() || busy) return;
    const history = msgs.slice(1).slice(-8);
    setMsgs((x) => [...x, { role: 'user', content: m }]);
    setText('');
    setBusy(true);
    try {
      const r = await api.post('/ai/chat', { message: m, history });
      setMsgs((x) => [...x, { role: 'assistant', content: r.reply }]);
    } catch (e: any) {
      setMsgs((x) => [...x, { role: 'assistant', content: `Sorry — ${e.message}` }]);
    } finally { setBusy(false); }
  };
  return (
    <Drawer title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Bot size={18} /> Assistant</span>} onClose={onClose} footer={
      <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
        <div className="chips" style={{ marginBottom: 8 }}>{SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); ask(text); }} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your operation…" aria-label="Message" />
          <button className="btn primary" disabled={busy || !text.trim()} aria-label="Send"><Send /></button>
        </form>
      </div>
    }>
      <div className="msgs" style={{ background: 'var(--paper)', flex: 1 }}>
        {msgs.map((m, i) => <div key={i} className={`msg ${m.role === 'user' ? 'out' : ''}`}>{m.content}</div>)}
        {busy && <div className="msg muted">Thinking…</div>}
        <div ref={end} />
      </div>
    </Drawer>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const can = useCan();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 200); return () => clearTimeout(t); }, [q]);
  const pages = useMemo(() => NAV.flatMap((s) => s.items).filter((i) => can(i.module, 'r') && (!q || i.label.toLowerCase().includes(q.toLowerCase()))).map((i) => ({ type: 'Go to', title: i.label, sub: '', path: i.to })), [q, can]);
  const res = useQuery({ queryKey: ['search', debounced], queryFn: () => api.get(`/search?q=${encodeURIComponent(debounced)}`), enabled: debounced.trim().length >= 2 });
  const items = [...(res.data?.results || []), ...pages].slice(0, 14);
  const go = (p: string) => { nav(p); onClose(); };
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input autoFocus placeholder="Search shipments, containers, customers, invoices… or jump to a page" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
            if (e.key === 'Enter' && items[idx]) go(items[idx].path);
          }} aria-label="Search" />
        <ul>
          {items.map((it, i) => (
            <li key={it.type + it.title + i}><button className={i === idx ? 'on' : ''} onMouseEnter={() => setIdx(i)} onClick={() => go(it.path)}>
              <span className="badge">{it.type}</span><b>{it.title}</b><span className="muted" style={{ marginInlineStart: 'auto' }}>{it.sub}</span>{i === idx && <CornerDownLeft size={14} />}
            </button></li>
          ))}
          {!items.length && <li className="empty">No matches</li>}
        </ul>
      </div>
    </div>
  );
}

export default function Layout() {
  const s = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panel, setPanel] = useState<'' | 'notif' | 'ai' | 'search' | 'user'>('');
  useRealtime();
  useEffect(() => setMobileOpen(false), [loc.pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPanel('search'); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const notif = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications'), refetchInterval: 90_000 });
  const can = useCan();
  const setEntity = (id: string) => { s.set({ entityId: id }); qc.invalidateQueries(); };

  const toggleTheme = () => { const th = s.theme === 'dark' ? 'light' : 'dark'; s.set({ theme: th }); applyTheme(th); };
  const toggleLang = () => { const l = s.locale === 'en' ? 'ar' : 'en'; s.set({ locale: l }); applyLocale(l); };
  const logout = async () => {
    try { await api.post('/auth/logout', { refreshToken: s.refreshToken }); } catch { /* ignore */ }
    s.logout(); qc.clear(); nav('/login');
  };

  return (
    <div className="app">
      <a href="#main" className="sr-only">Skip to content</a>
      <Sidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <div className={`overlay-sidebar ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <div className={`main ${s.collapsed ? 'collapsed' : ''}`}>
        <header className="topbar">
          <button className="icon-btn hide-lg-only" aria-label="Menu" onClick={() => (window.innerWidth <= 960 ? setMobileOpen(true) : s.set({ collapsed: !s.collapsed }))}>
            {window.innerWidth > 960 ? (s.collapsed ? <ChevronsRight /> : <ChevronsLeft />) : <Menu />}
          </button>
          {s.entities.length > 1 && (
            <select className="select-pill hide-sm" aria-label="Legal entity" value={s.entityId} onChange={(e) => setEntity(e.target.value)}>
              <option value="all">All entities (consolidated)</option>
              {s.entities.map((e) => <option key={e.id} value={e.id}>{e.name}{e.branch ? ` · ${e.branch}` : ''}</option>)}
            </select>
          )}
          <button className="search-btn" onClick={() => setPanel('search')} aria-label="Search"><Search size={15} /><span>{t('search', 'Search…')}</span><kbd>⌘K</kbd></button>
          <div className="spacer" />
          {can('ai', 'r') && <button className="icon-btn" onClick={() => setPanel('ai')} aria-label="Assistant"><Bot /></button>}
          <button className="icon-btn" onClick={toggleLang} aria-label="Toggle language" title="English / العربية"><Languages /></button>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">{s.theme === 'dark' ? <Sun /> : <Moon />}</button>
          <button className="icon-btn" onClick={() => setPanel('notif')} aria-label={`Notifications (${notif.data?.unread || 0} unread)`}>
            <Bell />{!!notif.data?.unread && <span className="dot">{notif.data.unread > 9 ? '9+' : notif.data.unread}</span>}
          </button>
          <button className="icon-btn" style={{ width: 'auto', gap: 8, paddingInline: 4 }} onClick={() => setPanel('user')} aria-label="Account">
            <span className="avatar">{initials(s.user?.name)}</span>
            <span className="hide-sm" style={{ textAlign: 'start', lineHeight: 1.15 }}><b style={{ display: 'block', fontSize: 12.5 }}>{s.user?.name}</b><span className="muted" style={{ fontSize: 11 }}>{s.user?.role}</span></span>
          </button>
        </header>
        <main id="main" className="content">
          <Suspense fallback={<Skeleton rows={8} />}><Outlet /></Suspense>
        </main>
      </div>
      {panel === 'notif' && <NotificationsPanel onClose={() => setPanel('')} />}
      {panel === 'ai' && <Assistant onClose={() => setPanel('')} />}
      {panel === 'search' && <Palette onClose={() => setPanel('')} />}
      {panel === 'user' && (
        <Modal title={s.user?.name} sub={`${s.user?.email} · ${s.tenant?.name}`} onClose={() => setPanel('')} footer={<><button className="btn outline" onClick={() => { setPanel(''); nav('/settings'); }}>Account settings</button><button className="btn primary" onClick={logout}><LogOut /> Sign out</button></>}>
          <p className="muted">Role: <b>{s.user?.role}</b></p>
          <p className="muted" style={{ marginTop: 6 }}>Keyboard: <span className="kbd-list"><kbd>⌘/Ctrl</kbd> + <kbd>K</kbd> opens search from anywhere.</span></p>
        </Modal>
      )}
    </div>
  );
}
