# Backup and Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin downloads the whole database as a SQLite file from a Backup screen and restores one into the running app in one all-or-nothing step, with the data from before the last restore kept downloadable.

**Architecture:** `src/lib/server/backup.ts` holds all of it: `writeBackup` makes a cleaned `VACUUM INTO` copy, `restoreBackup` checks and migrates an uploaded copy, keeps a before-restore copy, then attaches it and copies every table's rows into the live database in one transaction on the app's own connection. `src/routes/(app)/admin/backup/` only parses requests and calls it. `BODY_SIZE_LIMIT` rises to 100M, and `/mcp` enforces its own 512 KB.

**Tech Stack:** SvelteKit 3.1 (adapter-node 6, `#lib` imports, Svelte 5 runes), Drizzle over better-sqlite3 13, Tailwind, shadcn-svelte, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-backup-restore-design.md`

## Global Constraints

- Admin only: every route uses `requireAdmin(locals)` (signed out → 303 `/login`, non-admin → 403).
- No write to time data outside the restore's one transaction; the core is not touched and the restore is not recorded in the history.
- A backup and the before-restore file never hold a `session` or `access_token` row, and their freed pages are vacuumed away (no credential hash recoverable from free pages).
- Every temporary file (`<dir>/backup-<newId()>.db`, `<dir>/restore-<newId()>.db`, and their `-journal`, `-wal`, `-shm`) lives in the directory of `DATABASE_PATH` and is removed before the request ends, success or not.
- Before-restore file: `<directory of DATABASE_PATH>/time-keep.before-restore.db`, one, replaced at each restore.
- File names (admin's zone via the `tz` cookie as other screens resolve it, `src/lib/server/screens/zone.ts`): `time-keep-YYYY-MM-DD-HHmm.db`; `time-keep-before-restore-YYYY-MM-DD-HHmm.db` (the file's modification time). `Content-Type: application/vnd.sqlite3`, `Content-Disposition: attachment; filename="…"`.
- Copy (exact): "Backup", "A backup is the whole database: every user, their time data and history. Keep it somewhere safe; it holds password hashes.", "Download backup", "Restore", "Restoring replaces every user's data with the backup's and signs everyone out.", "Backup file", "Replace all data with this backup", "Before the last restore", "The data as it was just before the last restore, <YYYY-MM-DD HH:mm>.", "Download", "Restored. Sign in with the backup's passwords.".
- Refusals (exact): "Choose a backup file.", "Tick the box to confirm the restore.", "This file is not a time-keep backup.", "This backup is from a newer version of time-keep.", "This backup has no admin who can sign in.", "The restore failed; nothing was changed.".
- `BODY_SIZE_LIMIT=100M` in the `Dockerfile` and in `playwright.config.ts`'s web server env; `/mcp` answers 413 `{"error":"Too large."}` above 524288 body bytes, counted while reading (no trust in `Content-Length`).
- Forms work without JavaScript; no browser dialogs. The time card world (`DESIGN.md`): ruled lines, violet only for the primary (Download backup), red only for Restore.
- Never run docker; never git push. Conventional Commits, no scope, no AI attribution.

## Review Focus

1. **A restore that fails half way** (a row the live schema refuses): nothing changed, the `backup` schema detached, and a second restore right after works — Task 1 (a temp trigger forces the failure).
2. **The restoring admin's own session**: after success it no longer authenticates, and the action redirects instead of rendering a page for a signed-out user — Task 1 (sessions gone) and Task 3 (redirect).
3. **A backup restored twice in a row**, or the before-restore file restored: both are ordinary backups and succeed — Task 1.
4. **Free pages holding deleted token hashes**: the downloaded file contains no `token_hash` value as bytes — Task 1 (search the file's bytes for a known hash).
5. **An upload that is a SQLite file of another app** (no `__drizzle_migrations`) or a time-keep file with one extra column: refused, live data unchanged — Task 1.

---

### Task 1: `backup.ts`

**Files:**
- Modify: `src/lib/server/db/migrate.ts`
- Create: `src/lib/server/backup.ts`, `src/lib/server/backup.test.ts`

**Interfaces:**
- Produces:
  - `runMigrations(db: DB, migrationsFolder = path.resolve(process.cwd(), 'drizzle')): void` (existing callers unchanged).
  - `appMigrations(migrationsFolder?): number[]` — the `when` of every entry in `<folder>/meta/_journal.json` (drizzle stores it as `__drizzle_migrations.created_at`).
  - `writeBackup(db: DB, file: string): void` — `VACUUM INTO file`, then on its own connection `DELETE FROM session`, `DELETE FROM access_token`, `VACUUM`, close.
  - `type RestoreResult = { ok: true } | { ok: false; message: string }`.
  - `restoreBackup(db: DB, uploadFile: string, opts: { beforeRestoreFile: string; migrationsFolder?: string }): RestoreResult` — the spec's steps 2–5 in order (step 1, writing the upload, is the caller's; step 6's redirect is the route's). Checks, each refusing with the spec's message: not openable as SQLite / `integrity_check` ≠ `ok` / no `__drizzle_migrations` → not a backup; any `created_at` not in `appMigrations()` → newer version; then `runMigrations` on the upload; then its `sqlite_master` rows (`type, name, tbl_name, sql`, names not starting `sqlite_`, ordered by type and name) differ from the live database's → not a backup; no `user` with `is_admin = 1 AND disabled_at IS NULL` → no admin; `foreign_key_check` returns a row → not a backup. Then `writeBackup(db, beforeRestoreFile)` (unlink the old one first; `VACUUM INTO` refuses an existing file). Then `ATTACH ? AS backup` outside the transaction; in `db.$client.transaction`: `PRAGMA defer_foreign_keys = ON`, `DELETE FROM main.<t>` for every live table (including `sqlite_sequence` if present), `INSERT INTO main.<t> SELECT * FROM backup.<t>` for every table except `session` and `access_token`; `DETACH backup` in a `finally`. Any throw in the copy → "The restore failed; nothing was changed." The upload's own connection is closed before attaching.
  - `beforeRestoreInfo(file: string): { at: number } | null` — `statSync(file).mtimeMs`, or null when missing.

- [ ] **Step 1: Failing tests** (`backup.test.ts`, a temporary directory per test via `mkdtempSync`; the live database is `openDb(<tmp>/live.db)` + `runMigrations`, an admin via `createUser`, data through `openCore`):
  - `writeBackup`: the file opens with `new Database`, holds the live `customer`, `entry`, `batch`, `change` rows, zero `session` and `access_token` rows; the bytes of the file do not contain a live token's `token_hash` (`createToken` first) — Review Focus 4.
  - Round trip: back up, create customer `Later` and a token and a session, restore → `restoreBackup` is `{ ok: true }`; `customer`, `entry`, `batch`, `change` and `user` rows deep-equal those read before `Later` (ids included); `Later` gone; `session` and `access_token` empty; `beforeRestoreFile` exists and holds `Later` and no session or token.
  - Restoring the same file twice, and then restoring `beforeRestoreFile` → each `{ ok: true }`; the last brings `Later` back — Review Focus 3.
  - Refusals, each leaving the live rows unchanged and the directory holding only `live.db*` and the input file: a text file `hello` and a SQLite file with only `CREATE TABLE t(x)` → "This file is not a time-keep backup."; a backup with an extra `__drizzle_migrations` row `created_at = 9999999999999` → "This backup is from a newer version of time-keep."; a backup after `ALTER TABLE customer ADD COLUMN x` → "This file is not a time-keep backup."; a backup whose admin has `disabled_at` set → "This backup has no admin who can sign in."; a backup with `foreign_keys = OFF` and a `project` row naming a missing customer → "This file is not a time-keep backup." — Review Focus 5.
  - Older backup: a database migrated from a temporary copy of `drizzle/` whose journal keeps the first four entries (no `access_token`), with a user who is admin → restore `{ ok: true }`; that user is live, the live schema unchanged.
  - Failure in the copy: `db.$client.exec("CREATE TEMP TRIGGER boom BEFORE INSERT ON main.customer BEGIN SELECT RAISE(ABORT, 'boom'); END")`, restore a backup holding a customer → "The restore failed; nothing was changed.", live rows unchanged, `PRAGMA database_list` has no `backup`; drop the trigger, restore again → `{ ok: true }` — Review Focus 1.
  - `beforeRestoreInfo`: null for a missing file; `{ at }` equal to the file's mtime after a restore.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/backup.test.ts` — FAIL.
- [ ] **Step 3: Implement** `migrate.ts`'s parameter and `appMigrations`, then `backup.ts`. Table names come from `sqlite_master`; quote them as identifiers.
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run` — PASS, every earlier test unedited.
- [ ] **Step 5: Commit** — `git commit -m "feat: back up and restore the whole database"`

---

### Task 2: The body limits

**Files:**
- Modify: `Dockerfile` (`ENV` block: `BODY_SIZE_LIMIT=100M`), `playwright.config.ts` (web server env: `BODY_SIZE_LIMIT: '100M'`)
- Modify: `src/lib/server/mcp/http.ts`, `src/lib/server/mcp/http.test.ts`

**Interfaces:**
- Produces: `MCP_BODY_LIMIT = 524288` in `http.ts`; `handleMcp` reads the body through a counting reader after the Origin and token checks and before the transport, answering 413 `{"error":"Too large."}` when it passes the limit, else hands the transport a new `Request` with the read bytes (same method, URL, headers).

- [ ] **Step 1: Failing tests** (`http.test.ts`): a valid-token `tools/call` whose body is 524289 bytes (a JSON-RPC call padded with a long string argument) → 413 `{"error":"Too large."}`; the same streamed as a `ReadableStream` with no `content-length` → 413; a body of exactly 524288 bytes reaches the SDK (not 413); every earlier test still passes.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/mcp/http.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: raise the body limit and cap mcp bodies itself"`

---

### Task 3: The Backup screen

**Files:**
- Create: `src/routes/(app)/admin/backup/+page.server.ts`, `+page.svelte`, `src/routes/(app)/admin/backup/download/+server.ts`
- Modify: `src/routes/(app)/+layout.svelte` (rail only), `src/routes/login/+page.server.ts`, `src/routes/login/+page.svelte`

**Interfaces:**
- Consumes: Task 1's `writeBackup`, `restoreBackup`, `beforeRestoreInfo`; `DATABASE_PATH` from `$app/env/private`; `newId` from `#lib/server/id.js`; `requireAdmin`; `zoneFor` and `ZONE_COOKIE` as `admin/users/+page.server.ts` uses them.
- Produces:
  - `download/+server.ts` `GET`: `requireAdmin`; `?before-restore=1` serves `time-keep.before-restore.db` (404 when missing) with its name from the file's mtime; otherwise `writeBackup` to a temporary file, read it, unlink it, and serve it with the name from now. Both in the admin's zone.
  - `load` → `{ beforeRestore: string | null }` (`YYYY-MM-DD HH:mm` in the admin's zone).
  - Action `restore`: `requireAdmin`; `file` absent or `size === 0` → `fail(400, { error: 'Choose a backup file.' })`; `confirm !== 'on'` → `fail(400, { error: 'Tick the box to confirm the restore.' })` **(ruling: the file check first, as the spec's table lists them)**; write the file to a temporary path, `restoreBackup`, unlink in a `finally`; refusal → `fail(400, { error: message })`; success → `redirect(303, '/login?restored=1')`.
  - Login `load` → `{ restored: boolean }` from `url.searchParams.get('restored') === '1'`; the page shows "Restored. Sign in with the backup's passwords." as an `Alert` (default variant) under the heading when no `form.error`.
  - Rail: `{ route: '/(app)/admin/backup', label: 'Backup', icon: DatabaseBackup }` after Users, admins only; the phone's bar unchanged. Use `@lucide/svelte/icons/database-backup`, or `database` if it is missing.
  - Page: `h1` Backup; three sections with the Users page's `h2` and ruled-line classes; Download backup as a link with the primary button's look (`buttonVariants()`), Restore a `multipart/form-data` form with `use:enhance` (file input `name="file"` `accept=".db"`, checkbox `name="confirm"`, Restore with `variant="destructive"`), its refusal as a destructive `Alert` under the form; the third section only when `beforeRestore`, its Download outline.

- [ ] **Step 1: Implement** the routes, the page, the rail item and the login message (Task 4's browser tests pin them).
- [ ] **Step 2: Run** `npm run check && npm run lint && npx vitest run` — PASS; look at `/admin/backup` on a dev build at 390 and 1440 px against `DESIGN.md`.
- [ ] **Step 3: Commit** — `git commit -m "feat: add the backup screen"`

---

### Task 4: Browser tests and docs

**Files:**
- Create: `e2e/backup.test.ts`
- Modify: `e2e/seed.ts` (only if a helper is missing)
- Create: `docs/decisions/007-backups-are-the-whole-database-restored-in-one-transaction.md`
- Modify: `docs/app.md`, `docs/mcp.md`, `DESIGN.md`, `docs/roadmap.md`

**Interfaces:**
- Consumes: everything above. The admin is `admin` / `admin-password-1` (playwright env). The restore signs out every session, so each test signs in itself and nothing later in the run relies on a session from before it; the backup each test restores is the one it just downloaded, so other tests' seeded users survive.

- [ ] **Step 1: Browser tests** (both projects):
  - A seeded non-admin: `/admin/backup` → 403; `request.get('/admin/backup/download')` with its cookies → 403; the rail has no Backup.
  - Admin: Download backup → the download's file name matches `/^time-keep-\d{4}-\d{2}-\d{2}-\d{4}\.db$/` and its first 16 bytes are `SQLite format 3\0`; create customer `After backup` on `/setup`; on `/admin/backup` choose the file, tick the box, Restore → `/login?restored=1` shows "Restored. Sign in with the backup's passwords."; sign in; `/setup` has no `After backup`; `/admin/backup` shows "Before the last restore" and its Download gives a SQLite file named `/^time-keep-before-restore-/`.
  - Restore with a file and the box unticked → "Tick the box to confirm the restore."; with no file → "Choose a backup file."; the admin is still signed in after both.
  - JavaScript off: the download link and a full restore both work.
- [ ] **Step 2: Run** `npm run test:e2e` — PASS, every earlier test too.
- [ ] **Step 3: Docs.**
  - Decision 7 in the README's format: rule (a backup is the whole SQLite database without sessions or tokens; a restore checks and migrates the upload, keeps the before-restore copy, and copies every row into the running database in one transaction on the app's connection, signing everyone out); why (no export format to keep in step with the schema; copying rows keeps the connection and file in place, unlike swapping the file; credentials never travel in a backup).
  - `docs/app.md`: layout rows for `backup.ts` and `routes/(app)/admin/backup`; the Backup screen and its download route; the navigation; the login screen's `restored`; `BODY_SIZE_LIMIT` in the environment table and the image paragraph; Tests (`backup.test.ts`, `backup.test.ts` in e2e).
  - `docs/mcp.md` Limits: `/mcp` refuses a body over 512 KB itself with 413, whatever `BODY_SIZE_LIMIT` is.
  - `DESIGN.md`: the file input and the confirm checkbox (edited directly; the impeccable sidecar stays stale, as in 6b and 7; ledger it).
  - `docs/roadmap.md`: phase 8 done (date, spec, plan, decision 7, part docs, test counts, every call and ruling, deferred minors); phase 9 the operator's.
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run && npm run test:e2e` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "test: cover backup and restore end to end"`, then `git commit -m "docs: record backup and restore"`.
