import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_SIGNATURES: Record<string, (body: Buffer) => boolean> = {
  'image/avif': (body) => body.length >= 12 && body.toString('ascii', 4, 8) === 'ftyp',
  'image/gif': (body) => ['GIF87a', 'GIF89a'].includes(body.toString('ascii', 0, 6)),
  'image/jpeg': (body) => body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff,
  'image/png': (body) => body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (body) =>
    body.length >= 12 && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP',
};

export interface ImageStorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
}

export interface ImageUpload {
  body: Buffer;
  contentType: string;
  originalName: string;
}

export interface UploadedImage {
  key: string;
  publicUrl: string;
}

interface StorageClient {
  send(command: PutObjectCommand): Promise<unknown>;
}

function extensionForUpload(upload: ImageUpload): string {
  const extensionByContentType: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  return extensionByContentType[upload.contentType] ?? 'bin';
}

function publicUrl(config: ImageStorageConfig, key: string): string {
  const endpoint = new URL(config.endpoint);
  if (endpoint.hostname.endsWith('.storage.supabase.co')) {
    endpoint.hostname = endpoint.hostname.replace(/\.storage\.supabase\.co$/, '.supabase.co');
  }
  const endpointPath = endpoint.pathname.replace(/\/$/, '').replace(/\/s3$/, '');
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');

  endpoint.pathname = `${endpointPath}/object/public/${encodeURIComponent(config.bucket)}/${encodedKey}`;
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint.toString();
}

export function createImageStorageService(
  config: ImageStorageConfig,
  client: StorageClient,
  idGenerator: () => string = randomUUID,
) {
  return {
    async uploadImage(upload: ImageUpload): Promise<UploadedImage> {
      const signatureCheck = IMAGE_SIGNATURES[upload.contentType];
      if (!signatureCheck) {
        throw new Error('Only supported image content types are allowed');
      }

      if (upload.body.byteLength === 0) {
        throw new Error('Image file cannot be empty');
      }

      if (upload.body.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(`Image file exceeds the ${MAX_IMAGE_BYTES}-byte limit`);
      }

      if (!signatureCheck(upload.body)) {
        throw new Error('Image bytes do not match the declared content type');
      }

      const key = `${idGenerator()}.${extensionForUpload(upload)}`;

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: upload.body,
          ContentType: upload.contentType,
          CacheControl: PUBLIC_CACHE_CONTROL,
        }),
      );

      return { key, publicUrl: publicUrl(config, key) };
    },
  };
}

const storageConfig: ImageStorageConfig = {
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  region: env.S3_REGION,
};

const lazyStorageClient: StorageClient = {
  send(command) {
    const missing = [
      ['S3_ENDPOINT', env.S3_ENDPOINT],
      ['S3_ACCESS_KEY_ID', env.S3_ACCESS_KEY_ID],
      ['S3_SECRET_ACCESS_KEY', env.S3_SECRET_ACCESS_KEY],
      ['S3_BUCKET', env.S3_BUCKET],
      ['S3_REGION', env.S3_REGION],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Image storage is not configured; missing: ${missing.join(', ')}`);
    }

    const client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });

    return client.send(command);
  },
};

export const imageStorageService = createImageStorageService(storageConfig, lazyStorageClient);
