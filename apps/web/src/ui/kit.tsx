import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { X, Inbox, AlertTriangle, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { label, tone, type Tone } from '../lib/format';

// ── toasts ──
interface ToastItem { id: number; msg: string; kind: 'info' | 'success' | 'error' | 'warning' }
export const useToasts = create<{ items: ToastItem[]; push: (msg: string, kind?: ToastItem['kind']) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (msg, kind = 'info') => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, msg, kind }].slice(-4) }));
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), kind === 'error' ? 7000 : 4000);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));
export const toast = {
  info: (m: string) => useToasts.getState().push(m, 'info'),
  success: (m: string) => useToasts.getState().push(m, 'success'),
  error: (m: string) => useToasts.getState().push(m, 'error'),
  warning: (m: string) => useToasts.getState().push(m, 'warning'),
};
export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
      ))}
    </div>
  );
}

// ── primitives ──
export function Badge({ tone: t, children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${t ? 'b-' + t : ''}`}>{children}</span>;
}
export const StatusBadge = ({ value }: { value?: string | null }) => (value ? <Badge tone={tone(value)}>{label(value)}</Badge> : <span className="muted">—</span>);

export function Card({ title, icon, actions, children, pad = true, className = '' }: { title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-h">
          <h3 className="card-t">{icon}{title}</h3>
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      <div className={pad ? 'card-b' : ''}>{children}</div>
    </section>
  );
}

export function Kpi({ label: l, value, sub, icon, onClick, tone: tn }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; onClick?: () => void; tone?: 'up' | 'down' }) {
  const body = (
    <>
      <div className="kpi-l">{icon}{l}</div>
      <div className="kpi-v">{value}</div>
      {sub && <div className={`kpi-s ${tn || ''}`}>{sub}</div>}
    </>
  );
  return onClick ? <button className="kpi" onClick={onClick}>{body}</button> : <div className="kpi">{body}</div>;
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Empty({ title = 'Nothing here yet', text, icon, action }: { title?: string; text?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon || <Inbox />}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div style={{ display: 'grid', gap: 10 }} aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ height: 34 }} />)}
  </div>
);
export const Banner = ({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'bad'; children: ReactNode }) => (
  <div className={`banner ${kind === 'info' ? '' : kind}`} role={kind === 'info' ? 'note' : 'alert'}>
    {kind === 'info' ? <Info /> : <AlertTriangle />}<div>{children}</div>
  </div>
);

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string; badge?: number | string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={`tab ${value === t.key ? 'on' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}{t.badge !== undefined && t.badge !== 0 && <span className="badge b-signal" style={{ marginInlineStart: 6, padding: '0 6px' }}>{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// ── overlays ──
function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({ title, sub, onClose, children, footer, size = '' }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: '' | 'lg' | 'xl' }) {
  useEscape(onClose);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not(.close)')?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; prev?.focus?.(); };
  }, []);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="modal-h">
          <div><h2 id={id}>{title}</h2>{sub && <p className="muted" style={{ fontSize: 12.5 }}>{sub}</p>}</div>
          <button className="icon-btn close" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEscape(onClose);
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={typeof title === 'string' ? title : 'Panel'}>
        <div className="modal-h"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X /></button></div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
        {footer}
      </aside>
    </>
  );
}

export function ConfirmModal({ title, text, confirmLabel = 'Confirm', danger, onConfirm, onClose }: { title: string; text: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => Promise<any> | void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn outline" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>{confirmLabel}</button>
    </>}>
      <p>{text}</p>
    </Modal>
  );
}

// ── data table ──
export interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  num?: boolean;
  sortable?: boolean;
  hideSm?: boolean;
}

export function DataTable<T extends Record<string, any>>({ columns, rows, onRowClick, loading, empty, rowKey = 'id' }: { columns: Column<T>[]; rows: T[]; onRowClick?: (r: T) => void; loading?: boolean; empty?: ReactNode; rowKey?: string }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = sort
    ? [...rows].sort((a, b) => {
        const x = a[sort.key], y = b[sort.key];
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
      })
    : rows;
  if (loading) return <Skeleton />;
  if (!rows.length) return <div className="table-wrap">{empty || <Empty />}</div>;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`${c.num ? 'num' : ''} ${c.sortable !== false ? 'sortable' : ''} ${c.hideSm ? 'hide-sm' : ''}`}
                onClick={() => c.sortable !== false && setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                {c.label}{sort?.key === c.key && (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r[rowKey] ?? i} className={onRowClick ? 'click' : ''} onClick={() => onRowClick?.(r)} tabIndex={onRowClick ? 0 : undefined} onKeyDown={(e) => onRowClick && e.key === 'Enter' && onRowClick(r)}>
              {columns.map((c) => (
                <td key={c.key} className={`${c.num ? 'num' : ''} ${c.hideSm ? 'hide-sm' : ''}`}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return total ? <div className="pager"><span>{total} record{total === 1 ? '' : 's'}</span></div> : null;
  return (
    <div className="pager">
      <span>{(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}</span>
      <div className="actions">
        <button className="btn xs outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} / {pages}</span>
        <button className="btn xs outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

// ── tiny charts ──
export function Bars({ data, format }: { data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart-bars" role="img" aria-label="Bar chart">
      {data.map((d) => (
        <div key={d.label}>
          <span>{format ? format(d.value) : d.value}</span>
          <i style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} title={`${d.label}: ${d.value}`} />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Timeline({ items }: { items: { title: ReactNode; sub?: ReactNode; state?: 'done' | 'active' | 'bad' | '' }[] }) {
  return (
    <div className="timeline">
      {items.map((it, i) => (
        <div key={i} className={`tl ${it.state || ''}`}>
          <div className="tl-t">{it.title}</div>
          {it.sub && <div className="tl-s">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export const Detail = ({ items }: { items: [string, ReactNode][] }) => (
  <dl className="detail-grid">
    {items.map(([k, v]) => (
      <div className="detail" key={k}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>
    ))}
  </dl>
);
