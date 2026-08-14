# my-car-backend

NestJS + MongoDB + Socket.IO backend for the MyCar roadside-assistance apps (customer app, driver app, owner dashboard).

## Local development

```bash
cp .env.example .env   # fill in MONGO_URI (Atlas or local), JWT_SECRET, ADMIN_EMAIL/PASSWORD
npm install
npm run start:dev
```

Or via Docker Compose (spins up a local MongoDB too):

```bash
cp .env.example .env
docker compose up
```

Health check: `curl http://localhost:3000/health`

## Push notifications (optional)

Push notifications are fully optional — the server logs a warning and runs fine without them
(dispatch still works over Socket.IO for foregrounded/connected apps). To enable them:

1. Create a Firebase project and download a service-account key (Project Settings → Service
   Accounts → Generate new private key).
2. Local dev: save it as `firebase-service-account.json` in this folder (already gitignored).
3. Cloud hosting: paste the entire JSON as one line into the `FIREBASE_SERVICE_ACCOUNT_JSON` env var instead.

## Deploying to Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point it at the repo — it will read `render.yaml` and provision
   the web service automatically.
3. Fill in the env vars marked "sync: false" in the Render dashboard: `MONGO_URI` (your Atlas
   connection string), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Once deployed, point both Flutter apps at the Render URL via
   `--dart-define=API_BASE_URL=https://<your-service>.onrender.com`.

**Known limitation:** Render's free tier has an ephemeral filesystem — anything written to
`uploads/driver-docs` (driver license/vehicle-registration photos) is lost on every redeploy or
restart. Fine for testing the flow, but before relying on this for real driver documents, either
add a persistent disk (Render's paid tier) or move file storage to an object store (S3,
Cloudinary, etc.).

## Architecture

- `auth/` — JWT auth for customers, drivers, and the owner (admin)
- `users/`, `drivers/` — account data; drivers also carry vetting status (pending/approved/rejected)
- `service-requests/`, `dispatch/` — the roadside-request lifecycle and nearest-driver broadcast
- `realtime/` — Socket.IO gateway (driver location, job offers, status changes)
- `notifications/` — Firebase push notifications (graceful no-op if unconfigured)
- `admin/` — endpoints backing the owner dashboard (overview, driver approval, revenue, etc.)
- `geocoding/` — reverse-geocode proxy (Nominatim/OpenStreetMap, no API key needed)
