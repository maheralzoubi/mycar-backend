export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/mycar',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  geocodeBaseUrl:
    process.env.GEOCODE_BASE_URL ?? 'https://nominatim.openstreetmap.org',
  admin: {
    email: process.env.ADMIN_EMAIL ?? 'owner@mycar.com',
    password: process.env.ADMIN_PASSWORD ?? 'change-me-admin',
  },
  firebase: {
    // Preferred on cloud hosts (e.g. Render): paste the whole service-account JSON as one env var.
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? null,
    // Preferred for local dev: path to the downloaded service-account file (gitignored).
    serviceAccountPath:
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? 'firebase-service-account.json',
  },
});
