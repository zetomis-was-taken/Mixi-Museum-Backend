import { PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { createImageStorageService } from './image-storage.service.js';

const config = {
  endpoint: 'https://project.storage.supabase.co/storage/v1/s3',
  bucket: 'images',
  region: 'ap-northeast-1',
};

describe('image storage service', () => {
  it('uploads image bytes and returns a publicly accessible URL', async () => {
    const send = vi.fn().mockResolvedValue({});
    const service = createImageStorageService(config, { send } as never, () => 'image-id');

    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = await service.uploadImage({
      body: imageBytes,
      contentType: 'image/png',
      originalName: 'museum logo.png',
    });

    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'images',
      Key: 'image-id.png',
      Body: imageBytes,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(result).toEqual({
      key: 'image-id.png',
      publicUrl: 'https://project.supabase.co/storage/v1/object/public/images/image-id.png',
    });
  });

  it('rejects non-image content types without uploading', async () => {
    const send = vi.fn();
    const service = createImageStorageService(config, { send } as never);

    await expect(
      service.uploadImage({ body: Buffer.from('not image'), contentType: 'text/plain', originalName: 'file.txt' }),
    ).rejects.toThrow('Only supported image content types are allowed');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a declared image type when the payload signature does not match', async () => {
    const send = vi.fn();
    const service = createImageStorageService(config, { send } as never);

    await expect(
      service.uploadImage({ body: Buffer.from('not png'), contentType: 'image/png', originalName: 'file.png' }),
    ).rejects.toThrow('Image bytes do not match the declared content type');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects files over the size limit', async () => {
    const send = vi.fn();
    const service = createImageStorageService(config, { send } as never);

    await expect(
      service.uploadImage({
        body: Buffer.alloc(10 * 1024 * 1024 + 1, 1),
        contentType: 'image/png',
        originalName: 'large.png',
      }),
    ).rejects.toThrow('Image file exceeds the 10485760-byte limit');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects empty files', async () => {
    const send = vi.fn();
    const service = createImageStorageService(config, { send } as never);

    await expect(
      service.uploadImage({ body: Buffer.alloc(0), contentType: 'image/png', originalName: 'empty.png' }),
    ).rejects.toThrow('Image file cannot be empty');
    expect(send).not.toHaveBeenCalled();
  });
});
