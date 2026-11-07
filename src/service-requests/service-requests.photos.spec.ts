import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as request from 'supertest';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequest } from './schemas/service-request.schema';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../common/types/jwt-payload.type';

const CUSTOMER = '65f0a1b2c3d4e5f6a7b8c9d0';
const OTHER_CUSTOMER = '65f0a1b2c3d4e5f6a7b8c9d1';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const PHOTO_URL = new RegExp(
  `^/uploads/request-photos/${CUSTOMER}/[0-9a-f-]{36}\\.(jpg|png)$`,
);

describe('Service request photos (HTTP)', () => {
  let app: INestApplication;
  let uploadsDir: string;
  let cwd: jest.SpyInstance;
  let currentUser: JwtPayload;
  const requestModel = {
    create: jest.fn(async (doc: Record<string, unknown>) => ({
      _id: new Types.ObjectId(),
      driverId: null,
      finalPrice: null,
      driverLocation: null,
      rating: null,
      review: null,
      paymentMethod: 'cash',
      cashCollected: false,
      createdAt: new Date(),
      ...doc,
    })),
  };

  const customerFolder = (id = CUSTOMER) => join(uploadsDir, 'uploads', 'request-photos', id);
  const storedFiles = (id = CUSTOMER) =>
    existsSync(customerFolder(id)) ? readdirSync(customerFolder(id)) : [];

  beforeAll(async () => {
    uploadsDir = mkdtempSync(join(tmpdir(), 'request-photos-'));
    cwd = jest.spyOn(process, 'cwd').mockReturnValue(uploadsDir);

    const moduleRef = await Test.createTestingModule({
      controllers: [ServiceRequestsController],
      providers: [
        ServiceRequestsService,
        { provide: getModelToken(ServiceRequest.name), useValue: requestModel },
        { provide: DriversService, useValue: { findNearestOnline: jest.fn(async () => []), findById: jest.fn() } },
        { provide: UsersService, useValue: { findById: jest.fn(async () => null) } },
        { provide: DispatchService, useValue: { broadcast: jest.fn(async () => undefined) } },
        { provide: RealtimeGateway, useValue: { emitToAdmins: jest.fn() } },
        { provide: PushNotificationsService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    // Same pipe as main.ts: unknown body keys are stripped.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    cwd.mockRestore();
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    currentUser = { sub: CUSTOMER, role: 'customer', email: 'c@example.com' };
    requestModel.create.mockClear();
    rmSync(join(uploadsDir, 'uploads'), { recursive: true, force: true });
  });

  const upload = () => request(app.getHttpServer()).post('/service-requests/photos');

  const uploadOne = async () => {
    const res = await upload()
      .attach('photos', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);
    return res.body.photoUrls[0] as string;
  };

  const createBody = (extra: Record<string, unknown> = {}) => ({
    serviceType: 'batteryJump',
    location: { lat: 24.7136, lng: 46.6753 },
    address: 'Olaya St, Riyadh',
    ...extra,
  });

  describe('POST /service-requests/photos', () => {
    it('stores images under the customer folder and returns their URLs', async () => {
      const res = await upload()
        .attach('photos', JPEG, { filename: 'IMG_1.JPG', contentType: 'image/jpeg' })
        .attach('photos', PNG, { filename: 'shot.png', contentType: 'image/png' })
        .expect(201);

      expect(res.body.photoUrls).toHaveLength(2);
      for (const url of res.body.photoUrls) expect(url).toMatch(PHOTO_URL);
      expect(res.body.photoUrls[0]).toMatch(/\.jpg$/);
      expect(res.body.photoUrls[1]).toMatch(/\.png$/);
      expect(storedFiles()).toHaveLength(2);
    });

    it('takes the stored extension from the content type, not the filename', async () => {
      const res = await upload()
        .attach('photos', JPEG, { filename: 'evil.html', contentType: 'image/jpeg' })
        .expect(201);
      expect(res.body.photoUrls[0]).toMatch(/\.jpg$/);
    });

    it('accepts exactly five photos', async () => {
      let req = upload();
      for (let i = 0; i < 5; i++) {
        req = req.attach('photos', JPEG, { filename: `${i}.jpg`, contentType: 'image/jpeg' });
      }
      const res = await req.expect(201);
      expect(res.body.photoUrls).toHaveLength(5);
    });

    it('rejects more than five photos and keeps none', async () => {
      let req = upload();
      for (let i = 0; i < 6; i++) {
        req = req.attach('photos', JPEG, { filename: `${i}.jpg`, contentType: 'image/jpeg' });
      }
      await req.expect(400);
      expect(storedFiles()).toHaveLength(0);
    });

    it.each([
      ['text/plain', 'notes.txt'],
      ['image/svg+xml', 'logo.svg'],
      ['application/octet-stream', 'blob'],
    ])('rejects %s uploads with 400', async (contentType, filename) => {
      const res = await upload()
        .attach('photos', Buffer.from('<svg onload="alert(1)"/>'), { filename, contentType })
        .expect(400);
      expect(res.body.message).toMatch(/photos are allowed/);
      expect(storedFiles()).toHaveLength(0);
    });

    it('rejects a file whose bytes are not the declared image type, deleting the batch', async () => {
      await upload()
        .attach('photos', JPEG, { filename: 'ok.jpg', contentType: 'image/jpeg' })
        .attach('photos', Buffer.from('<html>hi</html>'), { filename: 'x.jpg', contentType: 'image/jpeg' })
        .expect(400);
      expect(storedFiles()).toHaveLength(0);
    });

    it('rejects photos over 10 MB with 413', async () => {
      const big = Buffer.concat([JPEG, Buffer.alloc(10 * 1024 * 1024)]);
      await upload()
        .attach('photos', big, { filename: 'big.jpg', contentType: 'image/jpeg' })
        .expect(413);
      expect(storedFiles()).toHaveLength(0);
    });

    it('rejects an upload with no photos', async () => {
      await upload().field('note', 'x').expect(400);
    });

    it('is customer-only', async () => {
      currentUser = { sub: CUSTOMER, role: 'driver', email: 'd@example.com' };
      await upload()
        .attach('photos', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(403);
    });
  });

  describe('POST /service-requests with photoUrls', () => {
    it('persists and returns uploaded photo URLs', async () => {
      const url = await uploadOne();
      const res = await request(app.getHttpServer())
        .post('/service-requests')
        .send(createBody({ photoUrls: [url] }))
        .expect(201);

      expect(requestModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: CUSTOMER, photoUrls: [url] }),
      );
      expect(res.body.photoUrls).toEqual([url]);
    });

    it('defaults to no photos', async () => {
      const res = await request(app.getHttpServer())
        .post('/service-requests')
        .send(createBody())
        .expect(201);
      expect(requestModel.create).toHaveBeenCalledWith(expect.objectContaining({ photoUrls: [] }));
      expect(res.body.photoUrls).toEqual([]);
    });

    it("rejects another customer's photo", async () => {
      currentUser = { sub: OTHER_CUSTOMER, role: 'customer', email: 'o@example.com' };
      const foreign = await uploadOne();
      currentUser = { sub: CUSTOMER, role: 'customer', email: 'c@example.com' };

      const res = await request(app.getHttpServer())
        .post('/service-requests')
        .send(createBody({ photoUrls: [foreign] }))
        .expect(400);
      expect(res.body.message).toMatch(/Unknown photo/);
      expect(requestModel.create).not.toHaveBeenCalled();
    });

    it('rejects a well-formed URL whose file was never uploaded', async () => {
      await request(app.getHttpServer())
        .post('/service-requests')
        .send(createBody({
          photoUrls: [`/uploads/request-photos/${CUSTOMER}/0b3c6f0e-6a3e-4d0b-9a59-2f7d1c1e8a11.jpg`],
        }))
        .expect(400);
      expect(requestModel.create).not.toHaveBeenCalled();
    });

    it.each([
      ['a path outside the customer folder', ['/uploads/driver-docs/x.jpg']],
      ['a traversal attempt', [`/uploads/request-photos/${CUSTOMER}/../../../etc/passwd`]],
      ['a non-string entry', [42]],
      ['a non-array value', 'x.jpg'],
      ['duplicates', ['/a', '/a']],
      ['more than five URLs', ['/1', '/2', '/3', '/4', '/5', '/6']],
    ])('rejects %s', async (_label, photoUrls) => {
      await request(app.getHttpServer())
        .post('/service-requests')
        .send(createBody({ photoUrls }))
        .expect(400);
      expect(requestModel.create).not.toHaveBeenCalled();
    });
  });
});
