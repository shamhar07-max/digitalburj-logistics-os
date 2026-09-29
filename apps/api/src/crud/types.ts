import type { Request } from 'express';
import type { Db } from '../db';

export type ColType = 'text' | 'num' | 'int' | 'bool' | 'date' | 'ts' | 'json' | 'uuid' | 'textarr';

export interface Col {
  n: string;
  t: ColType;
  req?: boolean;
  enum?: readonly string[];
  /** read-only for clients (set by server) */
  ro?: boolean;
  max?: number;
  min?: number;
}

export interface HookCtx {
  req: Request;
  db: Db;
  tenantId: string;
  userId: string;
}

export interface Resource {
  /** URL segment: /api/<key> */
  key: string;
  table: string;
  /** RBAC module used for permission checks */
  module: string;
  cols: Col[];
  /** columns searched by ?search= */
  search?: string[];
  /** columns filterable by ?col=value */
  filters?: string[];
  /** default ORDER BY (raw, trusted) */
  sort?: string;
  /** column used by ?from=&to= (default created_at) */
  dateCol?: string;
  /** extra select expressions (trusted SQL), alias `t` is the main table */
  select?: string;
  /** column names always removed from responses (large or internal columns) */
  hidden?: string[];
  /** column names (including select aliases) stripped for users lacking costs:r */
  sensitive?: string[];
  entityScoped?: boolean;
  /** auto-numbering for a text column, e.g. { col:'code', prefix:'CUS-', pad:4, start:1000 } */
  ref?: { col: string; prefix: string; pad?: number; start?: number };
  /** set created_by from the user on insert */
  createdBy?: boolean;
  /** disable verbs */
  disable?: Array<'create' | 'update' | 'delete'>;
  /** customer-portal row filter -> SQL fragment using push() for params */
  portal?: (req: Request, push: (v: any) => string) => string | null;
  beforeSave?: (ctx: HookCtx, data: Record<string, any>, existing: any | null) => Promise<void> | void;
  afterSave?: (ctx: HookCtx, row: any, existing: any | null) => Promise<void> | void;
  beforeDelete?: (ctx: HookCtx, existing: any) => Promise<void> | void;
  /** domain event prefix, defaults to key */
  event?: string;
}
