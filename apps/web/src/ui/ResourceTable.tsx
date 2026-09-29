import { useState, type ReactNode } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api, qs, ApiError } from '../lib/api';
import { useCan } from '../store/session';
import { ConfirmModal, DataTable, Empty, Pager, toast, type Column } from './kit';
import { FormModal, type FieldSpec } from './forms';

export interface ResourceTableProps {
  /** API path without /api, e.g. 'customers' */
  resource: string;
  /** RBAC module used to show create/edit/delete controls */
  module: string;
  columns: Column[];
  fields?: FieldSpec[];
  noun?: string;
  searchPlaceholder?: string;
  /** filter chips: [{ key:'status', label:'Status', options:['active','hold'] }] */
  filters?: { key: string; label: string; options: string[] }[];
  params?: Record<string, any>;
  defaultValues?: Record<string, any>;
  onRowClick?: (row: any) => void;
  rowActions?: (row: any, refresh: () => void) => ReactNode;
  toolbarExtra?: ReactNode;
  canEdit?: boolean;
  canDelete?: boolean;
  createLabel?: string;
  emptyText?: string;
  pageSize?: number;
  /** maps a row to form initial values when editing */
  toForm?: (row: any) => Record<string, any>;
  /** last-chance transform of form values before they are sent (e.g. parse JSON text areas) */
  transform?: (values: Record<string, any>) => Record<string, any>;
}

export function ResourceTable(p: ResourceTableProps) {
  const can = useCan();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [flt, setFlt] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const pageSize = p.pageSize || 25;
  const params = { ...p.params, ...flt, search: search || undefined, page, pageSize };
  const key = ['res', p.resource, params];

  const q = useQuery({ queryKey: key, queryFn: () => api.get(`/${p.resource}${qs(params)}`), placeholderData: keepPreviousData });
  const refresh = () => qc.invalidateQueries({ queryKey: ['res', p.resource] });
  const save = useMutation({
    mutationFn: async (raw: Record<string, any>) => {
      const v = p.transform ? p.transform(raw) : raw;
      return editing?.id ? api.patch(`/${p.resource}/${editing.id}`, v) : api.post(`/${p.resource}`, { ...p.defaultValues, ...v });
    },
    onSuccess: () => { refresh(); toast.success(`${p.noun || 'Record'} saved`); },
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/${p.resource}/${id}`), onSuccess: () => { refresh(); toast.success(`${p.noun || 'Record'} deleted`); }, onError: (e: any) => toast.error(e.message) });

  const canCreate = !!p.fields && can(p.module, 'c');
  const canEdit = p.canEdit !== false && !!p.fields && can(p.module, 'u');
  const canDelete = p.canDelete !== false && can(p.module, 'd');
  const cols: Column[] = [...p.columns];
  if (canEdit || canDelete || p.rowActions) {
    cols.push({
      key: '_actions', label: '', sortable: false,
      render: (r) => (
        <div className="actions" onClick={(e) => e.stopPropagation()} style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          {p.rowActions?.(r, refresh)}
          {canEdit && <button className="icon-btn" aria-label="Edit" onClick={() => setEditing(p.toForm ? p.toForm(r) : r)}><Pencil /></button>}
          {canDelete && <button className="icon-btn" aria-label="Delete" onClick={() => setDeleting(r)}><Trash2 /></button>}
        </div>
      ),
    });
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <Search aria-hidden />
          <input className="input" placeholder={p.searchPlaceholder || 'Search…'} aria-label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {(p.filters || []).map((f) => (
          <div className="chips" key={f.key} role="group" aria-label={f.label}>
            <button className={`chip ${!flt[f.key] ? 'on' : ''}`} onClick={() => { setFlt({ ...flt, [f.key]: '' }); setPage(1); }}>All</button>
            {f.options.map((o) => (
              <button key={o} className={`chip ${flt[f.key] === o ? 'on' : ''}`} onClick={() => { setFlt({ ...flt, [f.key]: o }); setPage(1); }}>{o.replace(/_/g, ' ')}</button>
            ))}
          </div>
        ))}
        <div className="spacer" />
        {p.toolbarExtra}
        {canCreate && <button className="btn primary" onClick={() => setEditing({ ...p.defaultValues })}><Plus /> {p.createLabel || `New ${p.noun || 'record'}`}</button>}
      </div>
      {q.error ? (
        <Empty title="Could not load data" text={(q.error as ApiError).message} />
      ) : (
        <DataTable columns={cols} rows={q.data?.data || []} loading={q.isLoading} onRowClick={p.onRowClick} empty={<Empty title={`No ${p.noun || 'records'} found`} text={p.emptyText || (search ? 'Try a different search.' : canCreate ? 'Create the first one to get started.' : undefined)} />} />
      )}
      <Pager page={page} pageSize={pageSize} total={q.data?.total || 0} onPage={setPage} />
      {editing && p.fields && (
        <FormModal
          title={editing.id ? `Edit ${p.noun || 'record'}` : `New ${p.noun || 'record'}`}
          fields={p.fields}
          initial={editing}
          onSubmit={(v) => save.mutateAsync(v)}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && <ConfirmModal danger title={`Delete ${p.noun || 'record'}?`} text="This cannot be undone. Records referenced elsewhere cannot be deleted." confirmLabel="Delete" onConfirm={() => del.mutateAsync(deleting.id)} onClose={() => setDeleting(null)} />}
    </div>
  );
}

/** Download CSV helper button used on report pages. */
export function CsvButton({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn outline" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const blob = await api.blob(path + (path.includes('?') ? '&' : '?') + 'format=csv');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = path.split('?')[0].split('/').pop() + '.csv';
        a.click();
      } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
    }}><Download /> CSV</button>
  );
}
