import { PageHead, StatusBadge, Badge } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';
import { aed } from '../lib/format';
import type { FieldSpec } from '../ui/forms';

const F: FieldSpec[] = [
  { name: 'name', label: 'Name', required: true }, { name: 'headline', label: 'Headline', span: 2 }, { name: 'skills', label: 'Skills', type: 'tags' },
  { name: 'verified', label: 'Verified', type: 'checkbox', hint: 'Credentials and references checked' }, { name: 'rating', label: 'Rating (0–5)', type: 'number', min: 0 }, { name: 'rate_per_day', label: 'Day rate (AED)', type: 'number', min: 0 },
  { name: 'availability', label: 'Availability', type: 'select', options: ['available', 'busy', 'unavailable'] }, { name: 'contact', label: 'Contact' }, { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
];
export default function Talent() {
  return (
    <>
      <PageHead title="Verified talent" sub="Vetted specialists — customs brokers, rate analysts, drivers, warehouse leads — for overflow and project work." />
      <ResourceTable resource="talent" module="talent" noun="specialist" fields={F} filters={[{ key: 'availability', label: 'Availability', options: ['available', 'busy'] }]}
        columns={[
          { key: 'name', label: 'Specialist', render: (r) => <span><b>{r.name}</b> {r.verified && <Badge tone="ok">verified</Badge>}<div className="muted" style={{ fontSize: 12.5 }}>{r.headline}</div></span> },
          { key: 'skills', label: 'Skills', render: (r) => (r.skills || []).map((s: string) => <Badge key={s}>{s}</Badge>), sortable: false, hideSm: true },
          { key: 'rating', label: 'Rating', num: true, render: (r) => (r.rating ? `★ ${r.rating}` : '—') }, { key: 'rate_per_day', label: 'Day rate', num: true, render: (r) => aed(r.rate_per_day, { noSymbol: true }) },
          { key: 'availability', label: 'Availability', render: (r) => <StatusBadge value={r.availability} /> },
        ]} />
    </>
  );
}
