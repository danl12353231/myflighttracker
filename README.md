# myFlightTracker

A self-hosted flight tracker with a **web app** and **iOS/Android mobile app** (Expo).

Forked from AirTrail. The web app and backend are preserved from the original
project; a new Expo mobile client talks to the same self-hosted backend.

## Repository layout

```
myFlightTracker/
├── web/            # Self-hosted backend + SvelteKit web app (original project)
│   ├── src/lib/server/   # tRPC API, auth, db
│   ├── prisma/           # PostgreSQL schema + migrations
│   └── docker/           # Dockerfile + compose for self-hosting
└── apps/expo/      # iOS + Android app (Expo / React Native)
    ├── app/              # Expo Router screens
    └── lib/              # API client, auth, storage, types
```

## Self-hosting the backend

The backend is the original AirTrail web app, self-hosted with Docker:

```bash
cd web
docker compose -f docker/production/compose.yml up -d
```

Environment variables are documented in `web/.env.example` (`DB_URL`, `ORIGIN`,
and OAuth/integration keys). On first run you create an owner account via the
web UI.

## Building the mobile app from GitHub Actions

Two workflows build the mobile app on every push to `main` (or on manual
`Run workflow`) and attach the artifacts to the run:

- **`.github/workflows/build-apk.yml`** — Android release APK (Ubuntu runner).
  Works out of the box, no secrets required. Artifact: `myflighttracker-android`.
- **`.github/workflows/build-ipa.yml`** — iOS IPA built with **EAS Build**
  (Expo's cloud build service). The signed IPA is downloaded back and attached
  as a run artifact (`myflighttracker-ios-ipa`) for sideloading.

### Prerequisites for the iOS (EAS) build

1. Create a free account at [expo.dev](https://expo.dev) and generate a token:
   **expo.dev → Account settings → Access tokens**. Copy the token.
2. Add it as a repository secret: **Settings → Secrets and variables →
   Actions → New repository secret**, name `EXPO_TOKEN`.
3. Link the project to your Expo account once (from a machine with the Expo
   CLI) so EAS knows the app's credentials:

   ```bash
   cd apps/expo
   bunx eas-cli init
   bunx eas-cli login
   bunx eas-cli build:configure   # registers iOS signing credentials (ad-hoc)
   ```

   `eas init` adds `extra.eas.projectId` to `apps/expo/app.json`, which is
   committed to the repo.

4. `eas build` manages Apple signing for you. The `sideload` profile in
   `apps/expo/eas.json` uses `distribution: internal` (ad-hoc), which is what
   you need for sideloading the IPA onto your device. EAS will prompt you to
   register the device UDID and create an ad-hoc provisioning profile on the
   first build.

Until `EXPO_TOKEN` is configured, the iOS workflow will fail at the EAS setup
step. The Android workflow is unaffected.

## Mobile app (Expo)

### What's new in the backend for mobile

1. **`POST /api/auth/login`** — accepts `{ username, password }` and returns a
   long-lived bearer token (stored hashed in a new `mobile_session` table).
2. **`POST /api/auth/logout`** — invalidates a bearer token.
3. **Bearer-token auth in tRPC** — the tRPC context accepts
   `Authorization: Bearer <token>` (from the mobile login) in addition to the
   browser session cookie.
4. **CORS** on `/api/trpc` for the mobile client.
5. **`superjson` transformer** — replaces devalue/eval so serialization is
   standard JSON, safe for React Native.
6. **New tRPC procedures for mobile feature parity**:
   - `flight.update` — update an existing flight (access-checked, persists
     flight + passenger custom fields).
   - `flight.create` now also persists flight-level custom fields.
   - `user.updateUser` — admin/owner user editing (username, display name,
     role) with the same permission rules as the web admin UI.

### Running the app

```bash
cd apps/expo
bun install
bun run ios      # or: bun run android
```

On first launch the app asks you to **link to your self-hosted server**
(enter `https://your-server.example.com`), then sign in with your web account
credentials.

### API layer

- `apps/expo/lib/router.ts` — self-contained mirror of the tRPC types.
- `apps/expo/lib/trpc.ts` — typed tRPC client (superjson + bearer header).
- `apps/expo/lib/api.ts` — React Query hooks for the API.
- `apps/expo/lib/auth.tsx` — auth state, server linking, token storage.

## Database migration

The fork adds a `mobile_session` table. Apply it on an existing install:

```bash
cd web
bunx prisma migrate deploy
```

## Notes

- Both apps are independent workspaces (web uses Bun, mobile uses Bun); they
  are not hoisted into a single `node_modules` to avoid tooling conflicts.
- The mobile app covers: server linking, auth, flight list (upcoming/all with
  search) + detail + add/edit, custom fields on the flight form, map (WebView
  with your flight arcs), statistics, visited countries, sharing with privacy
  toggles, settings (preferences, API keys, export JSON/CSV), and admin user
  management. Remaining gaps vs. the web app: multi-platform flight import,
  airline/airport/aircraft data sync, OAuth linking, and the settings data page
  — all reachable through the same typed API layer.
