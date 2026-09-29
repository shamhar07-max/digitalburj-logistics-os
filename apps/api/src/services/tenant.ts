import bcrypt from 'bcryptjs';
import { PERMISSION_MATRIX, ROLES, ROLE_LABELS } from '@digitalburj/shared';
import type { Db } from '../db';
import { DEFAULT_WORKFLOWS } from './workflowDefaults';

/** UAE freight-forwarder chart of accounts. */
export const DEFAULT_COA: { code: string; name: string; type: string; subtype?: string; is_bank?: boolean }[] = [
  { code: '1000', name: 'Cash on Hand', type: 'asset', subtype: 'cash' },
  { code: '1010', name: 'Bank — Emirates NBD (AED)', type: 'asset', subtype: 'bank', is_bank: true },
  { code: '1020', name: 'Bank — ADCB (AED)', type: 'asset', subtype: 'bank', is_bank: true },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'ar' },
  { code: '1150', name: 'Unbilled Revenue (WIP)', type: 'asset', subtype: 'wip' },
  { code: '1200', name: 'VAT Input (Recoverable)', type: 'asset', subtype: 'vat_input' },
  { code: '1300', name: 'Prepayments & Deposits', type: 'asset' },
  { code: '1400', name: 'Fixed Assets — Vehicles & Equipment', type: 'asset', subtype: 'fixed' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'ap' },
  { code: '2100', name: 'VAT Output (Payable)', type: 'liability', subtype: 'vat_output' },
  { code: '2200', name: 'Accrued Expenses', type: 'liability' },
  { code: '2300', name: 'Salaries Payable', type: 'liability', subtype: 'payroll' },
  { code: '2400', name: 'End of Service Provision', type: 'liability' },
  { code: '3000', name: 'Share Capital', type: 'equity' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', subtype: 'retained' },
  { code: '4000', name: 'Freight Revenue', type: 'revenue', subtype: 'freight' },
  { code: '4100', name: 'Customs Clearance Revenue', type: 'revenue', subtype: 'customs' },
  { code: '4200', name: 'Transport & Delivery Revenue', type: 'revenue', subtype: 'transport' },
  { code: '4300', name: 'Warehousing & Handling Revenue', type: 'revenue', subtype: 'warehouse' },
  { code: '4900', name: 'Other Income', type: 'revenue' },
  { code: '5000', name: 'Freight Cost (Carriers)', type: 'expense', subtype: 'cogs' },
  { code: '5100', name: 'Customs & Duties Cost', type: 'expense', subtype: 'cogs' },
  { code: '5200', name: 'Trucking Cost', type: 'expense', subtype: 'cogs' },
  { code: '5300', name: 'Warehouse & Handling Cost', type: 'expense', subtype: 'cogs' },
  { code: '5900', name: 'Other Direct Cost', type: 'expense', subtype: 'cogs' },
  { code: '6000', name: 'Salaries & Wages', type: 'expense', subtype: 'opex' },
  { code: '6100', name: 'Rent', type: 'expense', subtype: 'opex' },
  { code: '6200', name: 'Utilities & Telecom', type: 'expense', subtype: 'opex' },
  { code: '6300', name: 'Fuel & Vehicle Running', type: 'expense', subtype: 'opex' },
  { code: '6400', name: 'Marketing', type: 'expense', subtype: 'opex' },
  { code: '6500', name: 'Software & Subscriptions', type: 'expense', subtype: 'opex' },
  { code: '6900', name: 'General & Administrative', type: 'expense', subtype: 'opex' },
  { code: '6950', name: 'Bank Charges', type: 'expense', subtype: 'opex' },
  { code: '6990', name: 'FX Gain / Loss', type: 'expense', subtype: 'opex' },
];

export interface ProvisionInput {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  trn?: string;
  tradeLicense?: string;
}

export async function provisionTenant(db: Db, input: ProvisionInput) {
  const t = (
    await db.query(`INSERT INTO tenants (name, slug, trn, trade_license) VALUES ($1,$2,$3,$4) RETURNING *`, [input.name, input.slug, input.trn ?? null, input.tradeLicense ?? null])
  ).rows[0];
  const ent = (
    await db.query(`INSERT INTO entities (tenant_id, code, name, branch, trn, is_default) VALUES ($1,'HQ',$2,'Main Branch',$3,true) RETURNING *`, [t.id, input.name, input.trn ?? null])
  ).rows[0];
  for (const a of DEFAULT_COA) {
    await db.query(`INSERT INTO accounts (tenant_id, code, name, type, subtype, is_bank) VALUES ($1,$2,$3,$4,$5,$6)`, [t.id, a.code, a.name, a.type, a.subtype ?? null, !!a.is_bank]);
  }
  for (const r of ROLES) {
    await db.query(`INSERT INTO roles (tenant_id, key, label, base_role, permissions, is_system) VALUES ($1,$2,$3,$2,$4,true)`, [t.id, r, ROLE_LABELS[r], JSON.stringify(PERMISSION_MATRIX[r])]);
  }
  for (const w of DEFAULT_WORKFLOWS) {
    await db.query(`INSERT INTO workflows (tenant_id, name, trigger_event, conditions, actions) VALUES ($1,$2,$3,$4,$5)`, [t.id, w.name, w.trigger_event, JSON.stringify(w.conditions), JSON.stringify(w.actions)]);
  }
  const hash = await bcrypt.hash(input.ownerPassword, 12);
  const owner = (
    await db.query(`INSERT INTO users (tenant_id, email, password_hash, name, role, entity_ids) VALUES ($1,$2,$3,$4,'owner',$5) RETURNING id, email, name`, [t.id, input.ownerEmail.toLowerCase(), hash, input.ownerName, [ent.id]])
  ).rows[0];
  return { tenant: t, entity: ent, owner };
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';
