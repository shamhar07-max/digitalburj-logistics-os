/** Pure risk assessment for a shipment — unit tested. */
export interface RiskInput {
  status: string;
  eta?: string | null;
  free_days_end?: string | Date | null;
  customs_status?: string | null;
  customs_hold_reason?: string | null;
  pod_overdue_days?: number;
  credit_hold?: boolean;
}
export interface RiskResult {
  level: 'low' | 'medium' | 'high';
  reason: string | null;
}

export function assessRisk(s: RiskInput, now: Date = new Date()): RiskResult {
  const reasons: { level: 'medium' | 'high'; text: string }[] = [];
  if (['delivered', 'invoiced', 'closed', 'cancelled'].includes(s.status)) {
    if (s.status === 'delivered' && (s.pod_overdue_days || 0) >= 2) reasons.push({ level: 'medium', text: `POD missing for ${s.pod_overdue_days} days` });
    return reasons.length ? { level: 'medium', reason: reasons[0].text } : { level: 'low', reason: null };
  }
  if (s.customs_status === 'hold') reasons.push({ level: 'high', text: s.customs_hold_reason ? `Customs hold: ${s.customs_hold_reason}` : 'Customs hold' });
  if (s.customs_status === 'rejected') reasons.push({ level: 'high', text: 'Customs declaration rejected' });
  if (s.free_days_end) {
    const hrs = (new Date(s.free_days_end).getTime() - now.getTime()) / 3_600_000;
    if (hrs <= 0) reasons.push({ level: 'high', text: 'Demurrage/detention accruing — free time expired' });
    else if (hrs <= 24) reasons.push({ level: 'high', text: `Free time ends in ${Math.ceil(hrs)}h` });
    else if (hrs <= 72) reasons.push({ level: 'medium', text: `Free time ends in ${Math.ceil(hrs / 24)}d` });
  }
  if (s.eta && ['confirmed', 'in_transit'].includes(s.status)) {
    const late = Math.floor((now.getTime() - new Date(s.eta).getTime()) / 86_400_000);
    if (late >= 1) reasons.push({ level: late >= 3 ? 'high' : 'medium', text: `ETA passed ${late}d ago` });
  }
  if (s.credit_hold) reasons.push({ level: 'medium', text: 'Customer on credit hold' });
  if (!reasons.length) return { level: 'low', reason: null };
  const top = reasons.find((r) => r.level === 'high') || reasons[0];
  return { level: top.level, reason: reasons.map((r) => r.text).join(' · ') };
}
