import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const driverDocsStorage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'driver-docs'),
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

export const imageFileFilter = (
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.startsWith('image/')) {
    callback(new Error('Only image uploads are allowed'), false);
    return;
  }
  callback(null, true);
};

// ── Customer photos attached to a roadside request ──────────────────────────

export const MAX_REQUEST_PHOTOS = 5;

/**
 * Raster formats a phone camera/gallery produces. The stored extension comes
 * from this map, never from the client's filename, so an upload can't be
 * served back as e.g. `.html` or `.svg` (both executable in a browser).
 */
export const REQUEST_PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

export const requestPhotosRoot = () => join(process.cwd(), 'uploads', 'request-photos');

/** One folder per customer, so a stored URL proves who uploaded it. */
export const requestPhotosStorage = diskStorage({
  destination: (req, _file, callback) => {
    const customerId = (req as unknown as { user: { sub: string } }).user.sub;
    const dir = join(requestPhotosRoot(), customerId);
    try {
      mkdirSync(dir, { recursive: true });
      callback(null, dir);
    } catch (error) {
      callback(error as Error, dir);
    }
  },
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${REQUEST_PHOTO_EXTENSIONS[file.mimetype]}`);
  },
});

export const requestPhotoFileFilter = (
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!REQUEST_PHOTO_EXTENSIONS[file.mimetype]) {
    // An HttpException so Nest answers 400 instead of a generic 500.
    callback(
      new BadRequestException('Only JPEG, PNG, WebP or HEIC photos are allowed'),
      false,
    );
    return;
  }
  callback(null, true);
};
