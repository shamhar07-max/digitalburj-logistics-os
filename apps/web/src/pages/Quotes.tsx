import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { QUOTE_STATUSES } from '@digitalburj/shared';
import { useCan } from '../store/session';
import { aed, fdate, label } from '../lib/format';
import { PageHead, StatusBadge } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';

export default function Quotes() {
  const nav = useNavigate();
  const can = useCan();
  const costs = can('costs', 'r');
  return (
    <>
      <PageHead title="Quotations" sub="Multi-line quotes with automatic VAT. Thin-margin or high-value quotes route to the owner for approval before they can be sent."
        actions={can('quotes', 'c') && <button className="btn primary" onClick={() => nav('/quotes/new')}><Plus /> New quote</button>} />
      <ResourceTable resource="quotes" module="quotes" noun="quotes" canDelete={false} searchPlaceholder="Search quote number…"
        filters={[{ key: 'status', label: 'Status', options: QUOTE_STATUSES as unknown as string[] }]} onRowClick={(r) => nav(`/quotes/${r.id}`)}
        columns={[
          { key: 'number', label: 'Quote', render: (r) => <b className="mono">{r.number}</b> }, { key: 'customer_name', label: 'Customer' },
          { key: 'mode', label: 'Mode', render: (r) => label(r.mode), hideSm: true }, { key: 'origin', label: 'Lane', render: (r) => `${r.origin || '?'} → ${r.destination || '?'}`, hideSm: true },
          { key: 'total', label: 'Total (AED)', num: true, render: (r) => aed(r.total, { noSymbol: true }) },
          ...(costs ? [{ key: 'margin_pct', label: 'Margin', num: true, render: (r: any) => <span className={Number(r.margin_pct) < 8 ? 'down' : ''}>{Number(r.margin_pct).toFixed(1)}%</span> }] : []),
          { key: 'valid_until', label: 'Valid until', render: (r) => fdate(r.valid_until), hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        ]} />
    </>
  );
}
