export const aed = (n: any, opts: { compact?: boolean; noSymbol?: boolean } = {}) => {
  const v = Number(n || 0);
  if (opts.compact && Math.abs(v) >= 1000) {
    const s = Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : (v / 1e3).toFixed(0) + 'K';
    return opts.noSymbol ? s : 'AED ' + s;
  }
  const s = v.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return opts.noSymbol ? s : 'AED ' + s;
};
export const num = (n: any, d = 0) => Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: d });
export const pct = (n: any) => `${Number(n || 0).toFixed(1)}%`;

export const fdate = (d?: string | Date | null) => {
  if (!d) return '—';
  const dt = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fdt = (d?: string | Date | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
export function ago(d?: string | Date | null) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fdate(d);
}
export const monthName = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' });
export const today = () => new Date().toISOString().slice(0, 10);
export const monthStart = () => today().slice(0, 8) + '01';
export const yearStart = () => today().slice(0, 5) + '01-01';
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
export const label = (s?: string | null) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'violet' | 'signal' | '';
const TONES: Record<string, Tone> = {
  // shipments
  booked: 'info', confirmed: 'info', in_transit: 'signal', arrived: 'violet', customs: 'warn', cleared: 'ok', out_for_delivery: 'signal', delivered: 'ok', invoiced: 'violet', closed: '', cancelled: 'bad',
  // generic
  active: 'ok', available: 'ok', inactive: '', hold: 'bad', blocked: 'bad', on_trip: 'signal', off_duty: '', maintenance: 'warn', retired: '',
  draft: '', pending: 'warn', pending_approval: 'warn', approved: 'ok', sent: 'info', accepted: 'ok', rejected: 'bad', expired: '', submitted: 'info', under_review: 'warn',
  partial: 'warn', paid: 'ok', overdue: 'bad', void: '', open: 'info', received: 'ok', ordered: 'info',
  unassigned: 'warn', assigned: 'info', in_progress: 'signal', completed: 'ok', done: 'ok', doing: 'signal', todo: '', failed: 'bad', unmatched: 'warn', matched: 'ok', ignored: '',
  low: 'ok', medium: 'warn', high: 'bad', urgent: 'bad', normal: '', stored: 'info', released: 'ok', discrepancy: 'bad', picked: 'violet',
  lead: '', qualified: 'info', quoted: 'violet', negotiation: 'warn', won: 'ok', lost: 'bad', verified: 'ok', at_risk: 'bad', blocked_m: 'bad',
  not_submitted: '', planned: 'info', on_hold: 'warn', enrolled: 'info', on_leave: 'warn', terminated: 'bad',
};
export const tone = (s?: string | null): Tone => TONES[String(s || '')] ?? '';

const VERB: Record<string, string> = { create: 'created', update: 'updated', delete: 'deleted', status: 'moved', issue: 'issued', receipt: 'recorded a payment on', approve: 'approved', reject: 'rejected', send: 'sent', accept: 'accepted',
  upload: 'uploaded', pay: 'paid', void: 'voided', assign: 'assigned', receive: 'received', extract: 'extracted', configure: 'configured', invite: 'invited to', reset_password: 'reset the password of', credit_note: 'issued a credit note on', asp_submit: 'submitted to the ASP:', sif: 'generated a WPS file for', move: 'moved', milestone: 'updated a milestone on', duplicate: 'duplicated', reverse: 'reversed' };
const NOUN: Record<string, string> = { 'growth-metrics': 'growth score', 'project-tasks': 'project task', 'leave-requests': 'leave request', 'journal-entries': 'journal entry', 'bank-transactions': 'bank line', 'driver-expenses': 'driver expense', payroll_run: 'payroll run', warehouse_stock: 'stock item', customs: 'customs declaration' };
/** "Noura Al Ketbi created talent" style sentence pieces from an audit row. */
export const describeActivity = (action: string, entity?: string | null) => `${VERB[action] || action.replace(/_/g, ' ')} ${NOUN[entity || ''] || (entity || '').replace(/[-_]/g, ' ').replace(/s$/, '')}`.trim();
/** Customers never see billing state: invoiced/closed jobs read as delivered. */
export const portalStatus = (s?: string | null) => (s === 'invoiced' || s === 'closed' ? 'delivered' : s || '');
