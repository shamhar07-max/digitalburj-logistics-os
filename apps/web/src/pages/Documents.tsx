import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { DOC_TYPES } from '@digitalburj/shared';
import { api, openFile } from '../lib/api';
import { useCan } from '../store/session';
import { fdt } from '../lib/format';
import { Badge, PageHead, toast } from '../ui/kit';
import { ResourceTable } from '../ui/ResourceTable';
import { FormModal } from '../ui/forms';

export default function Documents() {
  const can = useCan();
  const qc = useQueryClient();
  const [up, setUp] = useState(false);
  const fileRef = useRef<File | null>(null);
  return (
    <>
      <PageHead title="Documents" sub="Every B/L, AWB, certificate and POD, linked to its job. Mark documents visible to customers in their portal." actions={can('documents', 'c') && <button className="btn primary" onClick={() => setUp(true)}><Upload /> Upload</button>} />
      <ResourceTable resource="documents" module="documents" noun="document" searchPlaceholder="Search name or type…" filters={[{ key: 'type', label: 'Type', options: ['BL', 'AWB', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'COO', 'POD'] }]}
        columns={[{ key: 'name', label: 'Document', render: (r) => <b>{r.name}</b> }, { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> }, { key: 'shipment_number', label: 'Job', render: (r) => <span className="mono">{r.shipment_number || '—'}</span> }, { key: 'is_public', label: 'Portal', render: (r) => (r.is_public ? <Badge tone="ok">visible</Badge> : <span className="muted">internal</span>) }, { key: 'created_at', label: 'Uploaded', render: (r) => fdt(r.created_at) }]}
        rowActions={(r) => <button className="btn xs outline" onClick={() => openFile(`/documents/${r.id}/download`).catch((e) => toast.error(e.message))}><Download /> Open</button>} />
      {up && <FormModal title="Upload document" submitLabel="Upload" fields={[
        { name: 'type', label: 'Type', type: 'select', required: true, options: DOC_TYPES as unknown as string[] }, { name: 'shipment_id', label: 'Shipment', type: 'ref', ref: { resource: 'shipments', label: 'number' } }, { name: 'customer_id', label: 'Customer', type: 'ref', ref: { resource: 'customers' } }, { name: 'is_public', label: 'Visible to customer', type: 'checkbox', hint: 'Show in the customer portal' },
        { name: 'file', label: 'File', span: 2, hint: 'Choose below after filling the form' } as any]} initial={{ type: 'BL' }}
        footerExtra={<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx" onChange={(e) => (fileRef.current = e.target.files?.[0] || null)} aria-label="File" style={{ marginInlineEnd: 'auto' }} />}
        onSubmit={async (v) => { if (!fileRef.current) throw new Error('Choose a file first'); const f = new FormData(); f.append('file', fileRef.current); f.append('type', v.type); if (v.shipment_id) f.append('shipment_id', v.shipment_id); if (v.customer_id) f.append('customer_id', v.customer_id); f.append('is_public', String(!!v.is_public)); await api.upload('/documents/upload', f); qc.invalidateQueries({ queryKey: ['res'] }); toast.success('Uploaded'); fileRef.current = null; }} onClose={() => setUp(false)} />}
    </>
  );
}
