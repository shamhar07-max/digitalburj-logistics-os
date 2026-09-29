import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CUSTOMS_STATUSES, CUSTOMS_TRANSITIONS } from '@digitalburj/shared';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, label } from '../lib/format';
import { Banner, PageHead, StatusBadge, toast } from '../ui/kit';
import { FormModal, type FieldSpec } from '../ui/forms';
import { ResourceTable } from '../ui/ResourceTable';

const FIELDS: FieldSpec[] = [
  { name: 'number', label: 'Declaration number', required: true, readOnlyOnEdit: false }, { name: 'shipment_id', label: 'Shipment', type: 'ref', ref: { resource: 'shipments', label: 'number' } },
  { name: 'type', label: 'Type', type: 'select', options: ['import', 'export', 'transit', 're_export'] }, { name: 'hs_code', label: 'HS code', placeholder: '8517.13' },
  { name: 'description', label: 'Goods description', span: 2 }, { name: 'origin_country', label: 'Origin country (ISO-2)', placeholder: 'CN' },
  { name: 'cif_value', label: 'CIF value (AED)', type: 'number', min: 0 }, { name: 'duty_rate', label: 'Duty rate %', type: 'number', min: 0, hint: 'GCC common external tariff is 5% for most goods' },
];

const ACTION: Record<string, { label: string; cls: string }> = { submitted: { label: 'Submit', cls: 'primary' }, under_review: { label: 'Under review', cls: 'outline' }, cleared: { label: 'Clear', cls: 'ok' }, hold: { label: 'Hold', cls: 'outline' }, rejected: { label: 'Reject', cls: 'outline' }, draft: { label: 'Reopen', cls: 'outline' } };

export default function Customs() {
  const can = useCan();
  const qc = useQueryClient();
  const [hold, setHold] = useState<any>(null);
  const move = useMutation({
    mutationFn: (v: { id: string; status: string; hold_reason?: string }) => api.post(`/customs/${v.id}/status`, { status: v.status, hold_reason: v.hold_reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['res'] }); toast.success('Declaration updated'); },
  });
  return (
    <>
      <PageHead title="Customs" sub="Declaration desk with duty calculation and hold management. Clearing a declaration releases the shipment; holds raise risk and alert operations." />
      <Banner>Filing itself happens in Dubai Trade / Mirsal — this desk tracks declarations, evidence and duty so nothing is re-typed. Live e-filing needs broker credentials and is not enabled.</Banner>
      <ResourceTable resource="customs" module="customs" noun="declaration" fields={FIELDS} filters={[{ key: 'status', label: 'Status', options: CUSTOMS_STATUSES as unknown as string[] }]} searchPlaceholder="Search declaration, HS code…" canDelete={false}
        columns={[
          { key: 'number', label: 'Declaration', render: (r) => <b className="mono">{r.number}</b> }, { key: 'shipment_number', label: 'Job', render: (r) => <span className="mono">{r.shipment_number || '—'}</span> },
          { key: 'type', label: 'Type', render: (r) => label(r.type), hideSm: true }, { key: 'hs_code', label: 'HS', render: (r) => <span className="mono">{r.hs_code || '—'}</span> }, { key: 'origin_country', label: 'Origin', hideSm: true },
          { key: 'cif_value', label: 'CIF', num: true, render: (r) => aed(r.cif_value, { noSymbol: true }) }, { key: 'duty_amount', label: 'Duty', num: true, render: (r) => aed(r.duty_amount, { noSymbol: true }) },
          { key: 'status', label: 'Status', render: (r) => <span><StatusBadge value={r.status} />{r.hold_reason && <div className="muted" style={{ fontSize: 12 }}>{r.hold_reason}</div>}</span> },
        ]}
        rowActions={(r) => can('customs', 'u') ? <>{(CUSTOMS_TRANSITIONS[r.status] || []).map((s) => (
          <button key={s} className={`btn xs ${ACTION[s].cls}`} onClick={() => (s === 'hold' ? setHold(r) : move.mutate({ id: r.id, status: s }))}>{ACTION[s].label}</button>
        ))}</> : null} />
      {hold && <FormModal title={`Place ${hold.number} on hold`} fields={[{ name: 'hold_reason', label: 'Reason', required: true, placeholder: 'Missing Certificate of Origin' }]} submitLabel="Place on hold"
        onSubmit={(v) => move.mutateAsync({ id: hold.id, status: 'hold', hold_reason: v.hold_reason })} onClose={() => setHold(null)} />}
    </>
  );
}
