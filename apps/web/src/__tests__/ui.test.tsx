import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataTable, Pager } from '../ui/kit';
import { Field, FormModal } from '../ui/forms';
import { ApiError } from '../lib/api';

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe('DataTable', () => {
  const rows = [{ id: '1', name: 'Beta', n: 2 }, { id: '2', name: 'Alpha', n: 10 }, { id: '3', name: 'Gamma', n: 1 }];
  const cols = [{ key: 'name', label: 'Name' }, { key: 'n', label: 'Count', num: true }];
  it('sorts on header click (asc, desc, off) with numeric awareness', () => {
    render(<DataTable columns={cols} rows={rows} />);
    const names = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    fireEvent.click(screen.getByText('Count'));
    expect(names()).toEqual(['Gamma1', 'Beta2', 'Alpha10']);
    fireEvent.click(screen.getByText('Count'));
    expect(names()).toEqual(['Alpha10', 'Beta2', 'Gamma1']);
    fireEvent.click(screen.getByText('Count'));
    expect(names()).toEqual(['Beta2', 'Alpha10', 'Gamma1']);
  });
  it('shows the empty state', () => {
    render(<DataTable columns={cols} rows={[]} empty={<p>Nothing</p>} />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
  });
  it('makes rows keyboard-activatable when clickable', () => {
    const onRow = vi.fn();
    render(<DataTable columns={cols} rows={rows} onRowClick={onRow} />);
    fireEvent.keyDown(screen.getAllByRole('row')[1], { key: 'Enter' });
    expect(onRow).toHaveBeenCalledWith(rows[0]);
  });
});

describe('Pager', () => {
  it('reports ranges and disables edges', () => {
    const onPage = vi.fn();
    render(<Pager page={1} pageSize={25} total={60} onPage={onPage} />);
    expect(screen.getByText('1–25 of 60')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeDisabled();
    fireEvent.click(screen.getByText('Next'));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

describe('forms', () => {
  it('associates labels with reference selects (accessibility regression)', async () => {
    wrap(<Field spec={{ name: 'customer_id', label: 'Customer', type: 'ref', ref: { resource: 'customers' } }} value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/Customer/)).toBeInstanceOf(HTMLSelectElement);
  });
  it('blocks submit and shows required-field errors', async () => {
    const onSubmit = vi.fn();
    render(<FormModal title="New" fields={[{ name: 'name', label: 'Name', required: true }]} onSubmit={onSubmit} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('maps server validation errors onto the right field and stays open', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, 'Validation failed', 'validation', { trn: ['must be 15 digits'] }));
    render(<FormModal title="New" fields={[{ name: 'trn', label: 'TRN' }]} initial={{ trn: '123' }} onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText(/trn must be 15 digits/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
  it('only submits declared fields (never echoes server-computed columns)', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<FormModal title="Edit" fields={[{ name: 'name', label: 'Name' }]} initial={{ id: 'x', name: 'A', revenue: 999, created_at: 'now' }} onSubmit={onSubmit} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'A' }));
  });
  it('supports conditional fields', () => {
    render(<FormModal title="x" fields={[{ name: 'kind', label: 'Kind' }, { name: 'sup', label: 'Supplier', showIf: (v) => v.kind === 'cost' }]} initial={{ kind: 'revenue' }} onSubmit={async () => {}} onClose={() => {}} />);
    expect(screen.queryByLabelText('Supplier')).toBeNull();
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'cost' } });
    expect(screen.getByLabelText('Supplier')).toBeInTheDocument();
  });
});
