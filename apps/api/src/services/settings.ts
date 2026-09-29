import { Db, one } from '../db';

export interface TenantSettings {
  min_margin_pct: number; // quotes below this need approval
  quote_approval_threshold: number; // AED total above which quotes need approval
  po_approval_threshold: number;
  expense_approval_threshold: number;
  invoice_terms_days: number;
  ai_enabled: boolean;
  /** generate the mode-specific document set as soon as a booking is confirmed */
  auto_generate_docs: boolean;
  [k: string]: any;
}

export const DEFAULT_SETTINGS: TenantSettings = {
  min_margin_pct: 8,
  quote_approval_threshold: 100_000,
  po_approval_threshold: 10_000,
  expense_approval_threshold: 500,
  invoice_terms_days: 30,
  ai_enabled: true,
  auto_generate_docs: true,
};

export async function getSettings(db: Db, tenantId: string): Promise<TenantSettings> {
  const t = await one<{ settings: any }>(db, 'SELECT settings FROM tenants WHERE id=$1', [tenantId]);
  return { ...DEFAULT_SETTINGS, ...(t?.settings || {}) };
}
