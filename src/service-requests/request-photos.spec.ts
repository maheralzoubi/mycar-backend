import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { hasImageSignature, ownedPhotoPath, requestPhotoUrl } from './request-photos';

const CUSTOMER = '65f0a1b2c3d4e5f6a7b8c9d0';
const OTHER = '65f0a1b2c3d4e5f6a7b8c9d1';
const FILE = '0b3c6f0e-6a3e-4d0b-9a59-2f7d1c1e8a11.jpg';

describe('request photo URLs', () => {
  let cwd: jest.SpyInstance;
  beforeAll(() => {
    cwd = jest.spyOn(process, 'cwd').mockReturnValue('/srv/app');
  });
  afterAll(() => cwd.mockRestore());

  it('round-trips a URL built by requestPhotoUrl to the customer folder', () => {
    const url = requestPhotoUrl(CUSTOMER, FILE);
    expect(url).toBe(`/uploads/request-photos/${CUSTOMER}/${FILE}`);
    expect(ownedPhotoPath(url, CUSTOMER)).toBe(
      join('/srv/app', 'uploads', 'request-photos', CUSTOMER, FILE),
    );
  });

  it("rejects another customer's photo", () => {
    expect(ownedPhotoPath(requestPhotoUrl(OTHER, FILE), CUSTOMER)).toBeNull();
  });

  it.each([
    `/uploads/driver-docs/${FILE}`,
    `/uploads/request-photos/${CUSTOMER}/../${OTHER}/${FILE}`,
    `/uploads/request-photos/${CUSTOMER}/not-a-uuid.jpg`,
    `/uploads/request-photos/${CUSTOMER}/${FILE.replace('.jpg', '.svg')}`,
    `https://evil.example/uploads/request-photos/${CUSTOMER}/${FILE}`,
    `/uploads/request-photos/${CUSTOMER}/${FILE}?x=1`,
    '',
  ])('rejects malformed URL %p', (url) => {
    expect(ownedPhotoPath(url, CUSTOMER)).toBeNull();
  });
});

describe('hasImageSignature', () => {
  const dir = mkdtempSync(join(tmpdir(), 'photo-sig-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const file = (name: string, bytes: number[] | string) => {
    const path = join(dir, name);
    writeFileSync(path, typeof bytes === 'string' ? Buffer.from(bytes, 'latin1') : Buffer.from(bytes));
    return path;
  };

  it.each([
    ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0, 0, 0x10]],
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]],
    ['image/webp', 'RIFF\x24\x00\x00\x00WEBPVP8 '],
    ['image/heic', '\x00\x00\x00\x18ftypheic'],
    ['image/heif', '\x00\x00\x00\x18ftypmif1'],
  ])('accepts a real %s header', async (mime, bytes) => {
    expect(await hasImageSignature(file(`ok-${mime.replace('/', '-')}`, bytes), mime)).toBe(true);
  });

  it('rejects bytes that do not match the declared type', async () => {
    const html = file('fake.jpg', '<html><script>alert(1)</script></html>');
    expect(await hasImageSignature(html, 'image/jpeg')).toBe(false);
    const jpeg = file('real.jpg', [0xff, 0xd8, 0xff, 0xe0]);
    expect(await hasImageSignature(jpeg, 'image/png')).toBe(false);
  });

  it('rejects an empty file and unknown types', async () => {
    expect(await hasImageSignature(file('empty', []), 'image/jpeg')).toBe(false);
    expect(await hasImageSignature(file('svg', '<svg/>'), 'image/svg+xml')).toBe(false);
  });
});
