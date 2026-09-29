import { PageHead, Badge } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';
import { label } from '../lib/format';
import type { FieldSpec } from '../ui/forms';

const F: FieldSpec[] = [
  { name: 'title', label: 'Course title', required: true, span: 2 }, { name: 'category', label: 'Category' }, { name: 'level', label: 'Level', type: 'select', options: ['beginner', 'intermediate', 'advanced'] },
  { name: 'duration_hrs', label: 'Duration (hours)', type: 'number', min: 0 }, { name: 'certificate', label: 'Certificate', type: 'checkbox', hint: 'Issues a completion certificate' }, { name: 'description', label: 'Description', type: 'textarea', span: 2 },
];
export default function Academy() {
  return (
    <>
      <PageHead title="Academy" sub="Training and certification for your team — customs classification, VAT for forwarders, Incoterms, dangerous goods awareness." />
      <ResourceTable resource="courses" module="academy" noun="course" fields={F} filters={[{ key: 'level', label: 'Level', options: ['beginner', 'intermediate', 'advanced'] }]}
        columns={[
          { key: 'title', label: 'Course', render: (r) => <span><b>{r.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{r.description}</div></span> }, { key: 'category', label: 'Category' },
          { key: 'level', label: 'Level', render: (r) => <Badge tone={r.level === 'advanced' ? 'violet' : r.level === 'intermediate' ? 'info' : ''}>{label(r.level)}</Badge> },
          { key: 'duration_hrs', label: 'Hours', num: true }, { key: 'certificate', label: 'Certificate', render: (r) => (r.certificate ? <Badge tone="ok">yes</Badge> : '—') }, { key: 'enrolled', label: 'Enrolled', num: true },
        ]} />
    </>
  );
}
