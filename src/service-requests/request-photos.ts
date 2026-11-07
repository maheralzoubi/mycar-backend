import { open } from 'fs/promises';
import { join } from 'path';
import { requestPhotosRoot } from '../common/config/multer.config';

const URL_PREFIX = '/uploads/request-photos';

// `/uploads/request-photos/<customerId>/<uuid>.<ext>`, exactly as
// `requestPhotoUrl` builds it. Anything else (other folders, `..`, absolute
// URLs) is rejected before it can reach the filesystem.
const PHOTO_URL =
  /^\/uploads\/request-photos\/([0-9a-f]{24})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|heic|heif))$/;

export function requestPhotoUrl(customerId: string, filename: string): string {
  return `${URL_PREFIX}/${customerId}/${filename}`;
}

/**
 * The on-disk path of [url] if it is a well-formed request-photo URL uploaded
 * by [customerId]; otherwise null.
 */
export function ownedPhotoPath(url: string, customerId: string): string | null {
  const match = PHOTO_URL.exec(url);
  if (!match || match[1] !== customerId) return null;
  return join(requestPhotosRoot(), match[1], match[2]);
}

/**
 * Whether the file's leading bytes match the declared image type. Multer
 * trusts the client's Content-Type, so this stops arbitrary files from being
 * stored and served back under an image extension.
 */
export async function hasImageSignature(path: string, mimetype: string): Promise<boolean> {
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    const bytes = header.subarray(0, bytesRead);
    const ascii = (start: number, end: number) => bytes.subarray(start, end).toString('latin1');
    switch (mimetype) {
      case 'image/jpeg':
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      case 'image/png':
        return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case 'image/webp':
        return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
      case 'image/heic':
      case 'image/heif':
        // ISO-BMFF: a 4-byte box size, then the `ftyp` box type.
        return ascii(4, 8) === 'ftyp';
      default:
        return false;
    }
  } finally {
    await handle.close();
  }
}
