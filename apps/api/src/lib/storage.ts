import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config';
import { logger } from '../logger';

/** Pluggable object storage: local disk (default) or S3-compatible (AWS S3, R2, MinIO). Keys are tenant-prefixed. */
export interface Storage {
  put(key: string, data: Buffer, mime?: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements Storage {
  private root = path.resolve(config.UPLOAD_DIR);
  private full(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error('invalid storage key'); // path traversal guard
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.full(key);
    await fs.promises.mkdir(path.dirname(p), { recursive: true });
    await fs.promises.writeFile(p, data);
  }
  async get(key: string) {
    try {
      return await fs.promises.readFile(this.full(key));
    } catch {
      return null;
    }
  }
  async remove(key: string) {
    await fs.promises.rm(this.full(key), { force: true });
  }
}

class S3Storage implements Storage {
  private client: any;
  private mod: any;
  private async init() {
    if (this.client) return;
    this.mod = await import('@aws-sdk/client-s3' as string);
    this.client = new this.mod.S3Client({ region: config.S3_REGION, endpoint: config.S3_ENDPOINT, forcePathStyle: !!config.S3_ENDPOINT });
  }
  async put(key: string, data: Buffer, mime?: string) {
    await this.init();
    await this.client.send(new this.mod.PutObjectCommand({ Bucket: config.S3_BUCKET, Key: key, Body: data, ContentType: mime }));
  }
  async get(key: string) {
    await this.init();
    try {
      const r = await this.client.send(new this.mod.GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
      return Buffer.from(await r.Body.transformToByteArray());
    } catch (err) {
      logger.warn({ err, key }, 's3 get failed');
      return null;
    }
  }
  async remove(key: string) {
    await this.init();
    await this.client.send(new this.mod.DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
  }
}

export const storage: Storage = config.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();

export const newKey = (tenantId: string, folder: string, filename: string) =>
  `${tenantId}/${folder}/${crypto.randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)}`;

/** Decode a data: URL (canvas signature / photo) to bytes. */
export function decodeDataUrl(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
}
