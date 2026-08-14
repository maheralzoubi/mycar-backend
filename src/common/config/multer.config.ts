import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

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
