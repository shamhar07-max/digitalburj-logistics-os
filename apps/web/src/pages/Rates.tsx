import { PageHead, Badge } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';
import { useCan } from '../store/session';
import { aed, fdate, label } from '../lib/format';
import type { FieldSpec } from '../ui/forms';

const FIELDS: FieldSpec[] = [
  { name: 'supplier_id', label: 'Carrier / supplier', type: 'ref', ref: { resource: 'suppliers' } }, { name: 'mode', label: 'Mode', type: 'select', required: true, options: ['sea_fcl', 'sea_lcl', 'air', 'road', 'multimodal'] },
  { name: 'origin', label: 'Origin', required: true }, { name: 'destination', label: 'Destination', required: true }, { name: 'container_type', label: 'Equipment / class', placeholder: '40HC' },
  { name: 'unit', label: 'Unit', type: 'select', options: ['container', 'kg', 'cbm', 'shipment', 'trip'] }, { name: 'buy_rate', label: 'Buy rate', type: 'number', min: 0 }, { name: 'sell_rate', label: 'Sell rate', type: 'number', min: 0 },
  { name: 'transit_days', label: 'Transit days', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['active', 'draft', 'expired'] }, { name: 'valid_from', label: 'Valid from', type: 'date' }, { name: 'valid_to', label: 'Valid to', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
];

export default function Rates() {
  const can = useCan();
  const costs = can('costs', 'r');
  const soon = (d?: string) => d && new Date(d).getTime() - Date.now() < 7 * 86_400_000;
  return (
    <>
      <PageHead title="Rate management" sub={costs ? 'Buy vs sell by lane with margin. Rates expiring within a week are flagged.' : 'Sell rates by lane. Buy rates and margins are restricted to finance and management.'} />
      <ResourceTable resource="rates" module="rates" noun="rate" fields={FIELDS} searchPlaceholder="Search lane, equipment…" filters={[{ key: 'mode', label: 'Mode', options: ['sea_fcl', 'sea_lcl', 'air', 'road'] }]}
        columns={[
          { key: 'origin', label: 'Lane', render: (r) => <b>{r.origin} → {r.destination}</b> }, { key: 'mode', label: 'Mode', render: (r) => label(r.mode), hideSm: true }, { key: 'container_type', label: 'Equipment' }, { key: 'supplier_name', label: 'Carrier', hideSm: true },
          ...(costs ? [{ key: 'buy_rate', label: 'Buy', num: true, render: (r: any) => aed(r.buy_rate, { noSymbol: true }) }] : []), { key: 'sell_rate', label: 'Sell', num: true, render: (r) => aed(r.sell_rate, { noSymbol: true }) },
          ...(costs ? [{ key: 'margin_pct', label: 'Margin', num: true, render: (r: any) => <span className={Number(r.margin_pct) < 10 ? 'down' : 'up'}>{r.margin_pct ?? '—'}%</span> }] : []),
          { key: 'transit_days', label: 'Transit', num: true, render: (r) => (r.transit_days ? `${r.transit_days}d` : '—'), hideSm: true },
          { key: 'valid_to', label: 'Valid to', render: (r) => <span>{fdate(r.valid_to)} {soon(r.valid_to) && <Badge tone="warn">expiring</Badge>}</span> },
        ]} />
    </>
  );
}
