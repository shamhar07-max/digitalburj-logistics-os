/**
 * Role-based access control matrix shared by API (enforcement) and web (UI gating).
 * Actions: c=create r=read u=update d=delete a=approve x=export
 */
export const ROLES = [
  'owner',
  'admin',
  'sales',
  'operations',
  'customs',
  'transport',
  'warehouse',
  'finance',
  'hr',
  'driver',
  'customer',
  'partner',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales: 'Sales',
  operations: 'Operations',
  customs: 'Customs',
  transport: 'Transport / Dispatch',
  warehouse: 'Warehouse',
  finance: 'Finance',
  hr: 'HR',
  driver: 'Driver',
  customer: 'Customer (portal)',
  partner: 'Partner (portal)',
};

export const MODULES = [
  'dashboard',
  'shipments',
  'pipeline',
  'quotes',
  'customers',
  'customs',
  'drivers',
  'dispatch',
  'warehouse',
  'rates',
  'procurement',
  'accounting',
  'invoices',
  'jobcosting',
  'vat',
  'approvals',
  'hrms',
  'payroll',
  'projects',
  'ai',
  'docintel',
  'documents',
  'automation',
  'reports',
  'inbox',
  'whatsapp',
  'growth',
  'academy',
  'talent',
  'portal',
  'permissions',
  'settings',
  /** Buy rates, costs and margins. Field-level gate. */
  'costs',
  'audit',
] as const;
export type Module = (typeof MODULES)[number];
export type Action = 'c' | 'r' | 'u' | 'd' | 'a' | 'x';
export type PermissionSet = Partial<Record<Module, string>>;

const ALL = 'crudax';

const ops: PermissionSet = {
  dashboard: 'r', shipments: 'cru x', pipeline: 'r', quotes: 'r', customers: 'ru', customs: 'cru', drivers: 'r',
  dispatch: 'cru', warehouse: 'cru', rates: 'r', procurement: 'cr', jobcosting: 'r', approvals: 'r',
  ai: 'r', docintel: 'cr', documents: 'crud', automation: 'r', reports: 'rx', inbox: 'cru', whatsapp: 'cr',
  projects: 'cru', costs: 'r',
};

export const PERMISSION_MATRIX: Record<Role, PermissionSet> = {
  owner: Object.fromEntries(MODULES.map((m) => [m, ALL])) as PermissionSet,
  admin: Object.fromEntries(MODULES.map((m) => [m, m === 'costs' ? 'r' : ALL])) as PermissionSet,
  sales: {
    dashboard: 'r', shipments: 'r', pipeline: 'crud', quotes: 'cru', customers: 'crud', rates: 'r', ai: 'r',
    docintel: 'cr', documents: 'cr', inbox: 'cru', whatsapp: 'cr', reports: 'r', growth: 'r', projects: 'r', approvals: 'r',
    // NB: no `costs` -> buy rates & margins are hidden from sales
  },
  operations: ops,
  customs: {
    dashboard: 'r', shipments: 'r', customs: 'crudx', documents: 'cru', docintel: 'cr', inbox: 'cr', ai: 'r',
    reports: 'r', approvals: 'r',
  },
  transport: {
    dashboard: 'r', shipments: 'r', drivers: 'crud', dispatch: 'crud', documents: 'cr', inbox: 'cr', reports: 'r', ai: 'r',
  },
  warehouse: { dashboard: 'r', shipments: 'r', warehouse: 'crud', documents: 'cr', reports: 'r', procurement: 'r' },
  finance: {
    dashboard: 'r', shipments: 'r', customers: 'r', quotes: 'r', accounting: 'crudx', invoices: 'crudx a', jobcosting: 'rx',
    vat: 'rx', approvals: 'rua', procurement: 'crua', payroll: 'r', reports: 'rx', costs: 'r', rates: 'r', documents: 'r',
    ai: 'r', docintel: 'cr', audit: 'r',
  },
  hr: { dashboard: 'r', hrms: 'crudx', payroll: 'crux a', approvals: 'r', academy: 'crud', talent: 'crud', documents: 'cr' },
  driver: { dispatch: 'ru', documents: 'c' },
  customer: { portal: 'r', documents: 'r', inbox: 'cr', quotes: 'ra', invoices: 'r', shipments: 'r' },
  partner: { portal: 'r', documents: 'cr', shipments: 'r', inbox: 'cr' },
};

/** Permission overrides (custom roles) look like { module: 'cru' }. */
export function hasPermission(perms: PermissionSet | undefined, module: string, action: Action): boolean {
  const p = (perms as any)?.[module];
  return typeof p === 'string' && p.replace(/\s+/g, '').includes(action);
}

export function permissionsForRole(role: Role, overrides?: PermissionSet | null): PermissionSet {
  return overrides && Object.keys(overrides).length ? overrides : PERMISSION_MATRIX[role] || {};
}

export const STAFF_ROLES: Role[] = ROLES.filter((r) => !['customer', 'partner', 'driver'].includes(r)) as Role[];
