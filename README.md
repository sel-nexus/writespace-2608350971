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

`dist/` is the production bundle. This change run passed 612 unit/component tests (baseline: 531) and the production Vite build. The independent test critic passed with score 1.00 and zero high failures in two rounds. Full desktop/mobile E2E specs are authored, but the sandbox's Playwright runner hangs before discovery, including `--list`. Full-suite, fresh-cache and guest-home-copy attempts timed out without output; the human approved publication with E2E explicitly unverified. Chromium preflight captured 20 light/dark desktop/mobile states with accessibility trees, HTML, computed styles and screenshots, with no browser errors or horizontal overflow. Preflight is not a substitute for passing full journeys.

## Theme and authoring
Use **Switch to dark mode** / **Switch to light mode** in public or signed-in navigation. The raw `writespace_theme` preference is independent of login and survives logout/reload. Missing, invalid or unreadable preference defaults to light; storage write failure does not prevent the visible switch. No operating-system theme synchronization is used.

Content shows an immediate informational character count while typing, pasting or clearing. Editing begins with the saved content count. There is no maximum length and required-field validation is unchanged. Count follows JavaScript string length (UTF-16 code units); some emoji count as two units.

Known dependency warning: the inherited pinned dependencies report 11 npm audit findings (2 moderate, 7 high, 2 critical). No unrelated breaking upgrades were applied; review dependency remediation separately.

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
