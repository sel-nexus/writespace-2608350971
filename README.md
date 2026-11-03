# WriteSpace

A browser-local plain-text blog demo built with React 18, Vite 5, JavaScript, React Router 6 and Tailwind CSS 3.

## Important limits
There is no backend, database or shared publication. Posts, accounts and session live in this browser's localStorage. Passwords are plaintext and client-side roles are not secure authorization. Never use real passwords or sensitive information. Clearing browser data deletes your local demo. Account deletion retains the author's posts and saved name.

Built-in demo login: username `admin`, password `admin`. Self-registration creates contributors; Admin can create contributor or Admin accounts. The default Admin and active account cannot be deleted.

## Run
Use Node 20 or newer. From `frontend/`:

```sh
npm ci --no-bin-links
cp .env.example .env
npm run dev
```

Open the URL printed by Vite. `PORT`, `HOST`, and `E2E_BASE_URL` are documented in `.env.example`. This app does not call an API or read secrets from environment variables.

## Build and test
From `frontend/`:

```sh
npm run build
npm test
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

`dist/` is the production bundle. Unit verification passed 531 tests. The independent test critic passed with score 1.00 in two rounds. Full desktop/mobile E2E specs are authored but the current sandbox's Playwright runner hangs before discovery, including `--list`. Bounded cache/config retries did not resolve it; the human approved publication with E2E explicitly unverified. Browser preflight itself ran successfully and captured accessibility, HTML, style and screenshots. Do not interpret authored specs as passing journeys.

## Features and routes
- `/`: public discovery, three latest local post previews and session-aware navigation.
- `/login`, `/register`: local identity and role-home redirects.
- `/blogs`, `/blog/:id`: newest-first grid and literal multiline reader.
- `/write`, `/edit/:id`: validated creation/editing; contributor own-only, Admin all posts.
- `/admin`, `/users`: Admin overview and account management with protected deletion.

Modules are grouped by feature under `frontend/src/features`. Shared native form and navigation primitives live under `frontend/src/shared`. App owns session state without a global state library.

## Deploy
For Vercel, set **Root Directory to frontend**, framework Vite, output `dist`. `frontend/vercel.json` provides rewrite-only history fallback; `vercel.json` at repository root also documents that rewrite. Deployment itself is not verified by this stage.

For a static nginx container:

```sh
docker build -t writespace ./frontend
docker run --rm -p 8080:80 writespace
```

Dockerfile builds the bundle and nginx serves it with SPA fallback, no backend proxy. Container build/runtime were not executed by this stage. The verified production build is the Vite command above.

## Dashboard counts
Total Users includes the built-in Admin and stored accounts. Total Admins includes all Admin-role accounts including built-in. Total contributors counts user-role accounts. No invented activity statistics or sample posts are seeded.
