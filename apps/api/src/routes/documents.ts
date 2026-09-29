import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { DOC_TYPES } from '@digitalburj/shared';
import { many, one, query } from '../db';
import { portalScope, requirePerm } from '../auth/middleware';
import { badRequest, notFound, wrap } from '../lib/errors';
import { isUuid } from '../crud/validate';
import { auditFromReq } from '../services/audit';
import { DOC_KINDS, extractDocument, type DocKind } from '../services/docintel';
import { newKey, storage } from '../lib/storage';

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new Error('Unsupported file type'))),
});

export const documentsRouter = Router();

documentsRouter.post(
  '/upload',
  requirePerm('documents', 'c'),
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded');
    const b = z.object({ shipment_id: z.string().uuid().optional(), customer_id: z.string().uuid().optional(), type: z.enum(DOC_TYPES as any).default('OTHER'), is_public: z.enum(['true', 'false']).optional() }).parse(req.body);
    const t = req.user!.tenantId;
    if (b.shipment_id) {
      const ok = await one({ query }, 'SELECT 1 FROM shipments WHERE id=$1 AND tenant_id=$2', [b.shipment_id, t]);
      if (!ok) throw badRequest('Unknown shipment');
    }
    const key = newKey(t, 'documents', req.file.originalname);
    await storage.put(key, req.file.buffer, req.file.mimetype);
    const row = await one<any>({ query }, `INSERT INTO documents (tenant_id, shipment_id, customer_id, type, name, mime, size, storage_key, is_public, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, type, name, mime, size, is_public, shipment_id, created_at`,
      [t, b.shipment_id ?? null, b.customer_id ?? null, b.type, req.file.originalname.slice(0, 200), req.file.mimetype, req.file.size, key, b.is_public === 'true', req.user!.id]);
    await auditFromReq(req, 'upload', 'document', row.id, { name: row.name, type: row.type });
    res.status(201).json(row);
  }),
);

documentsRouter.get(
  '/:id/download',
  requirePerm('documents', 'r'),
  wrap(async (req, res) => {
    if (!isUuid(req.params.id)) throw notFound();
    const params: any[] = [req.user!.tenantId, req.params.id];
    let extra = '';
    const cust = portalScope(req);
    if (cust) {
      params.push(cust);
      extra = ' AND d.is_public AND (d.customer_id=$3 OR d.shipment_id IN (SELECT id FROM shipments WHERE customer_id=$3 OR consignee_id=$3))';
    }
    const d = await one<any>({ query }, `SELECT d.* FROM documents d WHERE d.tenant_id=$1 AND d.id=$2${extra}`, params);
    if (!d || !d.storage_key) throw notFound();
    const buf = await storage.get(d.storage_key);
    if (!buf) throw notFound('File missing from storage');
    res.setHeader('Content-Type', d.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${String(d.name).replace(/[^\w.\- ]/g, '_')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buf);
  }),
);


/** Generated documents are stored as HTML; open them in a print-ready view. Customers see only documents marked public. */
documentsRouter.get(
  '/:id/render',
  requirePerm('documents', 'r'),
  wrap(async (req, res) => {
    if (!isUuid(req.params.id)) throw notFound();
    const params: any[] = [req.user!.tenantId, req.params.id];
    let extra = '';
    const cust = portalScope(req);
    if (cust) {
      params.push(cust);
      extra = ' AND d.is_public AND (d.customer_id=$3 OR d.shipment_id IN (SELECT id FROM shipments WHERE customer_id=$3 OR consignee_id=$3))';
    }
    const d = await one<any>({ query }, `SELECT d.body_html FROM documents d WHERE d.tenant_id=$1 AND d.id=$2 AND d.origin='generated'${extra}`, params);
    if (!d?.body_html) throw notFound();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:");
    res.type('html').send(d.body_html);
  }),
);

/** POD images (signature/photos) for ops review. */
documentsRouter.get(
  '/pod/:podId/:kind',
  requirePerm('dispatch', 'r'),
  wrap(async (req, res) => {
    const pod = await one<any>({ query }, 'SELECT * FROM pods WHERE id=$1 AND tenant_id=$2', [req.params.podId, req.user!.tenantId]);
    if (!pod) throw notFound();
    const key = req.params.kind === 'signature' ? pod.signature_key : (pod.photo_keys || [])[Number(req.params.kind)];
    if (!key) throw notFound();
    const buf = await storage.get(key);
    if (!buf) throw notFound();
    res.type('image/png').set('X-Content-Type-Options', 'nosniff').send(buf);
  }),
);

// ───────────── AI Document Intelligence ─────────────
export const docintelRouter = Router();
const dtypes = DOC_KINDS as [DocKind, ...DocKind[]];

docintelRouter.post(
  '/extract',
  requirePerm('docintel', 'c'),
  upload.single('file'),
  wrap(async (req, res) => {
    const b = z.object({ doc_type: z.enum(dtypes).default('BL'), text: z.string().max(200_000).optional(), shipment_id: z.string().uuid().optional() }).parse(req.body);
    if (!req.file && !b.text) throw badRequest('Upload a file or paste document text');
    const result = await extractDocument(b.doc_type, { buffer: req.file?.buffer, mime: req.file?.mimetype, text: b.text });
    const row = await one<any>({ query }, `INSERT INTO doc_extractions (tenant_id, shipment_id, doc_type, filename, fields, confidence, engine, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`,
      [req.user!.tenantId, b.shipment_id ?? null, b.doc_type, req.file?.originalname ?? null, JSON.stringify(result.fields), result.confidence, result.engine, req.user!.id]);
    await auditFromReq(req, 'extract', 'document', row.id, { type: b.doc_type, engine: result.engine, confidence: result.confidence });
    res.json({ id: row.id, doc_type: b.doc_type, ...result });
  }),
);

docintelRouter.get(
  '/history',
  requirePerm('docintel', 'r'),
  wrap(async (req, res) => {
    res.json({ data: await many({ query }, `SELECT id, doc_type, filename, confidence, engine, shipment_id, created_at, fields FROM doc_extractions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user!.tenantId]) });
  }),
);

/** Push extracted fields into a shipment. Only fills empty fields unless overwrite=true. */
docintelRouter.post(
  '/:id/apply',
  requirePerm('shipments', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ shipment_id: z.string().uuid(), overwrite: z.boolean().optional() }).parse(req.body);
    const ex = await one<any>({ query }, 'SELECT * FROM doc_extractions WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!ex) throw notFound();
    const s = await one<any>({ query }, 'SELECT * FROM shipments WHERE id=$1 AND tenant_id=$2', [b.shipment_id, req.user!.tenantId]);
    if (!s) throw notFound('Shipment not found');
    const f = ex.fields || {};
    const map: Record<string, any> = {
      bl_number: f.bl_number, awb_number: f.awb_number, vessel: f.vessel, voyage: f.voyage, pol: f.port_of_loading, pod: f.port_of_discharge,
      container_no: Array.isArray(f.container_numbers) ? f.container_numbers[0] : undefined, pieces: f.packages ?? f.pieces, weight_kg: f.gross_weight_kg, volume_cbm: f.volume_cbm,
      cargo_description: f.description, hs_code: Array.isArray(f.hs_codes) ? f.hs_codes[0] : f.hs_code, incoterm: f.incoterm, cargo_value: f.total_amount,
    };
    const sets: string[] = [];
    const vals: any[] = [s.id, req.user!.tenantId];
    const applied: string[] = [];
    for (const [col, v] of Object.entries(map)) {
      if (v === undefined || v === null) continue;
      if (!b.overwrite && s[col] !== null && s[col] !== undefined && s[col] !== '') continue;
      vals.push(v);
      sets.push(`${col}=$${vals.length}`);
      applied.push(col);
    }
    if (!sets.length) return res.json({ applied: [] });
    await query(`UPDATE shipments SET ${sets.join(', ')} WHERE id=$1 AND tenant_id=$2`, vals);
    await query('UPDATE doc_extractions SET shipment_id=$2 WHERE id=$1', [ex.id, s.id]);
    await auditFromReq(req, 'apply_extraction', 'shipment', s.id, { fields: applied });
    res.json({ applied });
  }),
);
