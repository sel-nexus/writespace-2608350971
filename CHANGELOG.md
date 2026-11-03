# WriteSpace change-run changelog

## Added
- Accessible, keyboard-operable light/dark control on public and authenticated navigation.
- Independent raw `writespace_theme` preference (`light`/`dark`), safe light fallback and graceful storage failure handling. App applies Tailwind class mode to the root before paint using state/effects and props, without Context or OS theme synchronization.
- Three focused theme component suites and theme/public/content browser journey specs.

## Modified
- `frontend/tailwind.config.js`: class-based dark mode.
- `frontend/src/App.jsx`, shared `Navbar.jsx`, `PublicNavbar.jsx`, `styles.js`, `FormField.jsx`: themed shell, navigation/dropdown, buttons, focus, labels, inputs, hints and errors. New `theme.js`, `ThemeToggle.jsx`, `theme.test.jsx` implement and test the shared behavior.
- Discovery `LandingPage.jsx`; auth `LoginPage.jsx` / `RegisterPage.jsx`: paired dark surfaces, metadata, preview/empty states, footer and form feedback.
- Posts `BlogCard.jsx`, `BlogListPage.jsx`, `BlogReadPage.jsx`; admin `AdminPage.jsx`, `StatCard.jsx`, `UserRow.jsx`, `UsersPage.jsx`: paired dark reader, cards, stats, rows/tables/mobile cards, badges, selects and actions.
- `PostFormPage.jsx` and its tests, `e2e/writing.spec.js`: themed editor and explicit verification of existing live counting, typing/paste/clear, edit prefill and large-content persistence. Count remains informational, unlimited and based on UTF-16 string length; no new validation rule.
- `LandingPage.test.jsx`: dark unknown-route recovery proof. `Avatar.jsx` and landing tags: readability-only formatting; no avatar/layout changes.
- README and code graph refreshed; added development plan, test report, browser preflight script/evidence and publication handoff.

## Preservation and migration
No breaking changes or data migration. Routes, authorization/ownership rules, post/user/session models, layouts, dashboard metric decisions, content workflows and deployment configuration are preserved. `writespace_theme` is the only new persisted key. `index.css` remains the three Tailwind directives. No backend, API or database added. Existing data is browser-local; plaintext demo credentials and client-side roles are not secure authentication.

## Verification and limitations
- Baseline: 531 tests passed; final: 612 tests passed across 14 files.
- Per-feature parent verification: theme 60, public/auth 68, reading/admin 84, editor 27, all passed before commits. Critic follow-up: 98 tests passed.
- Independent critic: PASS, 1.00, zero high failures, two rounds; both additional concerns repaired.
- Vite production build passed after creating ignored local `.env` from its existing template.
- Chromium preflight: 20 light/dark desktop/mobile states, no browser errors or horizontal overflow; accessibility/HTML/style evidence and screenshots captured.
- **Full E2E unverified:** Playwright runner hangs before discovery with no output. Full suite (900s), fresh-cache `--list` (90s), guest-home-copy suite (180s) timed out. Human explicitly approved proceeding with this warning. Preflight does not prove the full authored journeys.
- Inherited npm audit: 11 findings (2 moderate, 7 high, 2 critical); upgrades left to separate remediation. GitHub PR tools are unavailable in this run; pushed branch is the review/handoff source, not a merged change.
