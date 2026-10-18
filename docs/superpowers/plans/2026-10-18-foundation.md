# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A SvelteKit app at the repo root with SQLite, migrations, its own username and password sessions, a first-start admin from the environment, admin user management, tests at both levels, and a production Dockerfile.

**Architecture:** One SvelteKit app (adapter-node). Server-only modules under `src/lib/server/` own the database, passwords, sessions, throttling and users; routes call them and nothing else touches the database. `hooks.server.ts` runs migrations and the first-start admin once at startup and resolves the session on every request.

**Tech Stack:** Node 24, TypeScript, SvelteKit (via `sv` 1.1.1), Svelte 5 runes, Tailwind CSS, shadcn-svelte, Drizzle ORM + drizzle-kit, better-sqlite3, @node-rs/argon2, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-foundation-design.md`

## Global Constraints

- Commits: Conventional Commits, no scope, lowercase imperative, no AI attribution, no `Co-Authored-By`.
- Never run `docker` or `docker compose`. Never `git push`.
- Usernames: 3–32 chars of `a-z 0-9 . _ -`, stored lowercase; input is trimmed and lowercased before validation and lookup.
- Passwords: 10–256 characters, no composition rules; argon2id via `@node-rs/argon2` defaults.
- Session cookie: name `session`, HttpOnly, SameSite=Lax, `Secure` on HTTPS, path `/`; token 160 random bits; DB stores SHA-256 hex; lifetime 30 days, renewed to 30 when fewer than 15 remain.
- Throttle: 5 failures per (username, client address) within 15 minutes → refused for 15 minutes; in memory.
- Times stored as integer ms since epoch UTC. Ids: 128 random bits, base32 lowercase, 26 chars.
- Env: `DATABASE_PATH` (default `./data/time-keep.db`), `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ORIGIN`, `PORT`, `ADDRESS_HEADER`, `XFF_DEPTH`.
- Formats: English, ISO dates `YYYY-MM-DD`, 24-hour times.
- Browser tests need Chromium's libraries: until the devcontainer is rebuilt run them as `LD_LIBRARY_PATH=$HOME/.cache/pw-libs npm run test:e2e`. Nothing in the repo may reference `~/.cache/pw-libs`.

## Review Focus

1. **Sign-in with a different case or surrounding spaces** (`  Admin `) signs in the `admin` account — pinned in Task 6.
2. **A disabled user who still holds a session cookie** is signed out on their next request, not served — pinned in Task 4 and Task 8.
3. **Creating a username that already exists** returns a form error "Username is taken.", not a 500 — pinned in Task 6 and Task 8.
4. **A non-admin POSTing directly to an `/admin/users` action** is refused with 403 even though the page never showed them the form — pinned in Task 7 and Task 8.
5. **Sign-in for a username that does not exist** gives the same message as a wrong password and still spends an argon2 verify — pinned in Task 6.

---

### Task 1: Scaffold the app

**Files:**
- Create: everything `sv create` generates at the repo root; `components.json`, `src/lib/utils.ts`, `src/lib/components/ui/*` from shadcn-svelte.
- Modify: `.gitignore` (add `data/`, `build/`, `.svelte-kit/`, `test-results/`, `playwright-report/`), merging with what `sv` writes; keep every existing line.

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `check`, `lint`, `format`, `test:unit`, `test:e2e`, `test`; `$lib/utils` `cn()`; shadcn components `button`, `input`, `label`, `card`, `table`, `alert`, `badge` under `$lib/components/ui/`.

- [ ] **Step 1: Generate in a temporary directory** (the repo root is not empty)

Run in a scratch dir outside the repo:
`npx -y sv@1.1.1 create tk --template minimal --types ts --no-install --add prettier eslint vitest=usages:unit playwright=demo:no tailwindcss=plugins:none sveltekit-adapter=adapter:node drizzle=database:sqlite+client:better-sqlite3+docker:no`
Expected: project created in `tk/` with no prompts.

- [ ] **Step 2: Move it into the repo root**

Copy every file from `tk/` into the repo root except `README.md` and `.gitignore` (merge `.gitignore` by hand, keep the repo's `README.md`). Delete the drizzle demo schema contents and any demo route; keep `src/routes/+page.svelte` as a placeholder. Set `"name": "time-keep"` and `"private": true` in `package.json`; add `"engines": { "node": ">=24" }`.

- [ ] **Step 3: Install and init shadcn-svelte**

Run: `npm install`, then `npx shadcn-svelte@latest init` with defaults (base color neutral, `$lib/components/ui`, `$lib/utils`), then `npx shadcn-svelte@latest add button input label card table alert badge`. Name the CLI version used in the commit body.
Expected: `components.json` exists, components compile.

- [ ] **Step 4: Make `test` run both suites**

`package.json` scripts: `"test:unit": "vitest run"`, `"test:e2e": "playwright test"`, `"test": "npm run test:unit && npm run test:e2e"`. Vitest config: Node environment for `src/**/*.test.ts`, no browser project.

- [ ] **Step 5: Verify**

Run: `npm run check && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 6: Commit**

`git add -A && git commit -m "feat: scaffold the sveltekit app"`

---

### Task 2: Database, schema and migrations

**Files:**
- Create: `src/lib/server/db/schema.ts`, `src/lib/server/db/index.ts`, `src/lib/server/db/migrate.ts`, `src/lib/server/id.ts`, `src/lib/server/testing/db.ts`, `drizzle/` (generated), `src/lib/server/db/db.test.ts`, `src/lib/server/id.test.ts`
- Modify: `drizzle.config.ts` (schema path, `out: 'drizzle'`, dialect sqlite, `dbCredentials.url` from `DATABASE_PATH` with the default)

**Interfaces:**
- Produces:
  - `schema.ts`: tables `user` (`id` text pk, `username` text unique not null, `passwordHash` → `password_hash`, `isAdmin` → `is_admin` integer boolean not null default false, `disabledAt` → `disabled_at` integer nullable, `createdAt`, `updatedAt` integer not null) and `session` (`id` text pk, `userId` → `user_id` text not null references `user.id`, `expiresAt`, `createdAt` integer not null), index on `session.user_id`. Exported types `User = typeof user.$inferSelect`, `Session = typeof session.$inferSelect`.
  - `index.ts`: `type DB = BetterSQLite3Database<typeof schema>`; `openDb(path: string): DB` (creates the parent dir unless `:memory:`, sets `journal_mode = WAL`, `foreign_keys = ON`); `getDb(): DB` (lazy singleton over `DATABASE_PATH` or `./data/time-keep.db`).
  - `migrate.ts`: `runMigrations(db: DB): void` using drizzle's better-sqlite3 migrator with `migrationsFolder` = `path.resolve(process.cwd(), 'drizzle')` (the image copies `drizzle/` next to `build/`).
  - `id.ts`: `newId(): string` — 16 bytes from `crypto.getRandomValues`, base32 lowercase (`abcdefghijklmnopqrstuvwxyz234567`), no padding, 26 chars.
  - `testing/db.ts`: `createTestDb(): DB` — `openDb(':memory:')` with migrations applied.

- [ ] **Step 1: Write failing tests**

`id.test.ts`: `newId()` matches `/^[a-z2-7]{26}$/`; 1000 calls give 1000 distinct values.
`db.test.ts`: `createTestDb()` has tables `user` and `session` (query `sqlite_master`); `PRAGMA foreign_keys` returns 1; inserting a `session` with an unknown `user_id` throws; inserting two users with username `a.b` throws; `openDb(<tmp file>)` reports `journal_mode` `wal`.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/server` fails on missing modules.

- [ ] **Step 3: Implement the files above, then `npx drizzle-kit generate --name init`**

Expected: one SQL migration under `drizzle/` plus `meta/`.

- [ ] **Step 4: Run, expect PASS** — `npx vitest run src/lib/server`

- [ ] **Step 5: Commit** — `git commit -m "feat: add the database, schema and migrations"`

---

### Task 3: Usernames and passwords

**Files:**
- Create: `src/lib/server/auth/credentials.ts`, `src/lib/server/auth/credentials.test.ts`

**Interfaces:**
- Produces:
  - `normalizeUsername(raw: string): string` — trim, lowercase.
  - `validateUsername(normalized: string): string | null` — null when valid, else `Username must be 3–32 characters: a–z, 0–9, dot, underscore or hyphen.`
  - `validatePassword(raw: string): string | null` — null when valid, else `Password must be 10–256 characters.`
  - `hashPassword(password: string): Promise<string>`; `verifyPassword(hash: string, password: string): Promise<boolean>` (false, never throws, on a malformed hash).
  - `dummyHash(): Promise<string>` — the hash of a fixed random string, computed once and cached, for constant-work failures.

- [ ] **Step 1: Write failing tests**: `normalizeUsername('  Ad.Min ')` is `ad.min`; `validateUsername` accepts `abc`, `a-b_c.d`, 32 chars; rejects `ab`, 33 chars, `a b`, `ä`; `validatePassword` accepts 10 and 256 chars, rejects 9 and 257; `verifyPassword(await hashPassword('correct horse'), 'correct horse')` true, a wrong password false; the hash starts with `$argon2id$`; `verifyPassword('garbage', 'x')` false.
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/server/auth`
- [ ] **Step 3: Implement** with `@node-rs/argon2` (`npm i @node-rs/argon2`) `hash`/`verify`, argon2id.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: validate and hash credentials"`

---

### Task 4: Sessions

**Files:**
- Create: `src/lib/server/auth/sessions.ts`, `src/lib/server/auth/sessions.test.ts`

**Interfaces:**
- Consumes: `DB`, `schema`, `createTestDb`.
- Produces:
  - `SESSION_COOKIE = 'session'`; `SESSION_DAYS = 30`; `RENEW_BELOW_DAYS = 15`.
  - `generateSessionToken(): string` — 20 random bytes, base32 lowercase.
  - `createSession(db: DB, userId: string, now?: number): { token: string; session: Session }` — stores `sha256hex(token)` as `id`, `expiresAt = now + 30d`.
  - `validateSessionToken(db: DB, token: string, now?: number): { user: User; session: Session; renewed: boolean } | null` — null when unknown, expired (also deletes it), or the user is disabled (deletes all that user's sessions); renews `expiresAt` to `now + 30d` when fewer than 15 days remain.
  - `invalidateSession(db: DB, sessionId: string): void`
  - `invalidateUserSessions(db: DB, userId: string, exceptSessionId?: string): void`
  - `setSessionCookie(cookies: Cookies, token: string, expiresAt: number, secure: boolean): void`; `clearSessionCookie(cookies: Cookies, secure: boolean): void`.

- [ ] **Step 1: Write failing tests** (insert users directly with the schema): a created token validates and returns the user; the stored `session.id` is not the token and is 64 hex chars; at `now + 30d + 1` validation returns null and the row is gone; at `now + 14d` (16 days left) `expiresAt` is unchanged and `renewed` false; at `now + 20d` it becomes `now + 20d + 30d` and `renewed` true; a user with `disabledAt` set → null and all their sessions deleted (Review Focus 2); `invalidateUserSessions(db, u, keep)` deletes all but `keep`.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** with `node:crypto` `createHash('sha256')`; cookie `expires` from `expiresAt`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: add server-side sessions"`

---

### Task 5: Sign-in throttle

**Files:**
- Create: `src/lib/server/auth/throttle.ts`, `src/lib/server/auth/throttle.test.ts`

**Interfaces:**
- Produces: `class SignInThrottle { constructor(opts?: { maxFailures?: number; windowMs?: number; lockMs?: number; now?: () => number }); isLocked(username: string, address: string): boolean; recordFailure(username: string, address: string): void; reset(username: string, address: string): void }`, defaults 5, 15 min, 15 min; `export const signInThrottle = new SignInThrottle()`. Failures older than the window are pruned on access.

- [ ] **Step 1: Write failing tests** with a fake clock: 4 failures → not locked; 5th → locked; same username from another address → not locked; 15 min + 1 ms after the 5th → unlocked; failures spread so no 5 fall within 15 minutes → never locked; `reset` unlocks.
- [ ] **Step 2: Run, expect FAIL** — **Step 3: Implement** — **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: throttle failed sign-ins"`

---

### Task 6: Users and the first-start admin

**Files:**
- Create: `src/lib/server/users.ts`, `src/lib/server/users.test.ts`, `src/lib/server/auth/bootstrap.ts`, `src/lib/server/auth/bootstrap.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces (`users.ts`); functions return a result instead of throwing for user errors:
  - `type Result<T = void> = { ok: true; value: T } | { ok: false; error: string }`
  - `type UserSummary = { id: string; username: string; isAdmin: boolean; disabled: boolean; createdAt: number }`
  - `listUsers(db: DB): UserSummary[]` — ordered by username.
  - `createUser(db: DB, input: { username: string; password: string; isAdmin: boolean }, now?: number): Promise<Result<UserSummary>>` — normalizes and validates; duplicate → `Username is taken.` (also catch the unique-constraint error, not only a pre-check).
  - `setPassword(db: DB, userId: string, password: string, keepSessionId?: string): Promise<Result>` — validates, hashes, updates `updatedAt`, `invalidateUserSessions(db, userId, keepSessionId)`.
  - `changeOwnPassword(db: DB, userId: string, current: string, next: string, keepSessionId: string): Promise<Result>` — wrong current → `Current password is incorrect.`
  - `setDisabled(db: DB, actorId: string, userId: string, disabled: boolean, now?: number): Result` — `actorId === userId` → `You cannot disable yourself.`; disabling deletes the user's sessions.
  - `authenticate(db: DB, rawUsername: string, password: string, address: string, throttle?: SignInThrottle): Promise<Result<User>>` — locked → `Too many attempts. Try again in 15 minutes.`; unknown user, wrong password or disabled → `Wrong username or password.` (an unknown user still verifies against `dummyHash()`); a failure records in the throttle; success resets it.
- Produces (`bootstrap.ts`): `ensureAdmin(db: DB, env: { ADMIN_USERNAME?: string; ADMIN_PASSWORD?: string }): Promise<'exists' | 'created'>` — throws `Error('No admin exists: set ADMIN_USERNAME and ADMIN_PASSWORD to create one.')` when no admin exists and either is missing; throws with the validation message when the values are invalid.

- [ ] **Step 1: Write failing tests**
  - `authenticate(db, '  Admin ', pw, 'a')` succeeds for user `admin` (Review Focus 1).
  - unknown user and wrong password return the identical error; with `vi.spyOn` on the credentials module the unknown-user path calls `verifyPassword` once (Review Focus 5).
  - a disabled user with the right password → `Wrong username or password.`
  - 5 wrong passwords then the right one → `Too many attempts. Try again in 15 minutes.`
  - `createUser` with `Bob` then `bob` → the second is `Username is taken.` (Review Focus 3).
  - `setPassword` keeps only `keepSessionId`; `changeOwnPassword` with a wrong current password fails and changes nothing.
  - `setDisabled(db, a, a, true)` → `You cannot disable yourself.`; disabling another admin works; enabling clears `disabledAt`.
  - `ensureAdmin` creates when none (returns `'created'`, `isAdmin` true), returns `'exists'` and ignores changed env when one exists, throws the exact message when env is missing and no admin exists.
- [ ] **Step 2: Run, expect FAIL** — **Step 3: Implement** — **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: manage users and create the first admin"`

---

### Task 7: Request wiring, guards and the health route

**Files:**
- Create: `src/hooks.server.ts`, `src/lib/server/guards.ts`, `src/lib/server/guards.test.ts`, `src/routes/healthz/+server.ts`, `src/routes/(app)/+layout.server.ts`, `src/routes/(app)/admin/+layout.server.ts`
- Modify: `src/app.d.ts` (`App.Locals { user: User | null; session: Session | null }`)

**Interfaces:**
- Consumes: `getDb`, `runMigrations`, `ensureAdmin`, sessions.
- Produces:
  - `hooks.server.ts`: `init` (SvelteKit `ServerInit`) runs `runMigrations(getDb())` then `await ensureAdmin(getDb(), process.env)`; `handle` reads `SESSION_COOKIE`, validates, re-sets the cookie when renewed, clears it when invalid, fills `locals`. `secure` is `event.url.protocol === 'https:'`.
  - `guards.ts`: `requireUser(locals: App.Locals): User` — signed out → `redirect(303, '/login')`; `requireAdmin(locals: App.Locals): User` — signed out → redirect, non-admin → `error(403, 'Admins only')`.
  - `/healthz` GET → `json({ status: 'ok' })` after `getDb()` answers `select 1`; on failure `json({ status: 'error' }, { status: 503 })`.
  - `(app)/+layout.server.ts` calls `requireUser` and returns `{ user: { username, isAdmin } }`; `(app)/admin/+layout.server.ts` calls `requireAdmin`.

- [ ] **Step 1: Write failing tests** for `guards.ts`: a null user → redirect to `/login` with status 303; a non-admin in `requireAdmin` → HttpError 403 (Review Focus 4; every admin action also calls `requireAdmin`, pinned in Task 8's e2e).
- [ ] **Step 2: Run, expect FAIL** — **Step 3: Implement** — **Step 4: Run, expect PASS**
- [ ] **Step 5: Verify** — `npm run check && npm run build`
- [ ] **Step 6: Commit** — `git commit -m "feat: resolve sessions per request and guard routes"`

---

### Task 8: Screens and browser tests

**Files:**
- Create: `src/routes/login/+page.svelte`, `src/routes/login/+page.server.ts`, `src/routes/logout/+server.ts`, `src/routes/(app)/+layout.svelte`, `src/routes/(app)/+page.svelte`, `src/routes/(app)/account/+page.svelte`, `src/routes/(app)/account/+page.server.ts`, `src/routes/(app)/admin/users/+page.svelte`, `src/routes/(app)/admin/users/+page.server.ts`, `e2e/accounts.test.ts`
- Modify: `playwright.config.ts`; delete the placeholder `src/routes/+page.svelte` (home moves into `(app)`)

**Interfaces:**
- Consumes: Tasks 3–7.
- Produces: form actions — `/login` default (`username`, `password`; already signed in → redirect `/`); `/logout` POST; `/account` default (`current`, `next`, `confirm`; mismatch → `Passwords do not match.`); `/admin/users` actions `create` (`username`, `password`, `isAdmin` checkbox), `setPassword` (`userId`, `password`), `disable` (`userId`), `enable` (`userId`). Every action calls the guard itself. Errors return `fail(400, { error })` and show in an `Alert`; successes show a short confirmation. The client address is `event.getClientAddress()`.

Screens: plain shadcn components, one column, usable at 390 px wide. Home shows `Signed in as <username>`, links `Account` and (admins) `Users`, and a `Sign out` button (a form POSTing to `/logout`). The users page is a `Table` with username, an `Admin` badge, a `Disabled` badge, the created date as `YYYY-MM-DD`, and per-row set-password and disable/enable forms; the actor's own row has no disable button.

- [ ] **Step 1: Configure Playwright** — `webServer.command`: `npm run build && node build`; `env`: `DATABASE_PATH` = a fresh file under `test-results/` (removed before start), `ADMIN_USERNAME=admin`, `ADMIN_PASSWORD=admin-password-1`, `ORIGIN=http://localhost:4173`, `PORT=4173`; `projects`: `phone` (`devices['Pixel 7']`) and `pc` (Desktop Chrome, 1440×900); `workers: 1`, one shared DB, usernames unique per project.
- [ ] **Step 2: Write the failing e2e test** `e2e/accounts.test.ts`:
  - the admin signs in as `  ADMIN ` with `admin-password-1` and sees `Signed in as admin`;
  - creates user `u-<project>` with `first-password-1`; creating it again shows `Username is taken.` (Review Focus 3);
  - signs out; `u-<project>` signs in, sees no `Users` link; `GET /admin/users` gives 403; a direct `POST /admin/users?/create` with the user's cookies gives 403 (Review Focus 4);
  - changes the password to `second-password-1`, signs out, signs in with it;
  - with the user signed in in a second browser context, the admin disables the user; reloading the user's context lands on `/login` (Review Focus 2); signing in then fails with `Wrong username or password.`;
  - `GET /healthz` → 200 `{"status":"ok"}`.
- [ ] **Step 3: Run, expect FAIL** — `npx playwright install chromium`, then `LD_LIBRARY_PATH=$HOME/.cache/pw-libs npx playwright test`
- [ ] **Step 4: Implement the routes and screens**
- [ ] **Step 5: Run, expect PASS** — the same command; then `npm run check && npm run lint && npm run test:unit`
- [ ] **Step 6: Commit** — `git commit -m "feat: add sign-in, account and user screens"`

---

### Task 9: Container and devcontainer

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `.env.example`
- Modify: `.devcontainer/Dockerfile`

**Interfaces:**
- Produces: the image contract for phase 9 — port 3000, volume `/data`, `DATABASE_PATH=/data/time-keep.db`, `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`; requires `ORIGIN`, and `ADMIN_USERNAME` and `ADMIN_PASSWORD` on first start.

- [ ] **Step 1: Write the Dockerfile** — stages: `deps` (`node:24-slim`, `python3 make g++` for a native build fallback, `npm ci`), `build` (`npm run build`, `npm prune --omit=dev`), `run` (`node:24-slim`, copy `build/`, `node_modules/`, `package.json`, `drizzle/`; `mkdir /data && chown node:node /data`; `USER node`; `EXPOSE 3000`; `VOLUME /data`; `HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`; `CMD ["node","build"]`).
- [ ] **Step 2: `.dockerignore`** — `node_modules`, `build`, `.svelte-kit`, `data`, `.env`, `test-results`, `playwright-report`, `.git`, `.claude`, `docs`.
- [ ] **Step 3: `.env.example`** — every variable from Global Constraints with a one-line comment; `DATABASE_PATH=./data/time-keep.db`, `ADMIN_USERNAME=admin`, `ADMIN_PASSWORD=change-me-please`.
- [ ] **Step 4: Devcontainer** — an apt layer in `.devcontainer/Dockerfile` for Playwright's Chromium: `libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libdbus-1-3 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libxcb1 libxkbcommon0 libasound2t64 libatspi2.0-0t64 libxres1`.
- [ ] **Step 5: Verify what the image runs** — `npm run build`, then start `node build` with `PORT=3999 DATABASE_PATH=test-results/smoke.db ADMIN_USERNAME=admin ADMIN_PASSWORD=admin-password-1 ORIGIN=http://localhost:3999` in the background; `curl -s localhost:3999/healthz` → `{"status":"ok"}`; stop it. Starting with no admin env and a fresh DB exits non-zero with the `No admin exists…` message.
- [ ] **Step 6: Commit** — `git commit -m "feat: add the production image and browser libraries"`

---

### Task 10: Documentation

**Files:**
- Create: `docs/app.md`, `docs/decisions/003-accounts-are-the-apps-own-with-server-side-sessions.md`
- Modify: `docs/environment.md`, `README.md`

- [ ] **Step 1: `docs/app.md`** — the app's part doc: layout (`src/lib/server/*` responsibilities), the configuration table, running (`npm run dev`, `.env`), migrations (`drizzle-kit generate`, applied at startup, never `push`), tests (unit, e2e, the `LD_LIBRARY_PATH` note until the devcontainer is rebuilt), accounts and sessions (the spec's rules), the image contract from Task 9.
- [ ] **Step 2: Decision 3** in the `docs/decisions/README.md` format: Rule — the app's own username and password login, argon2id, server-side sessions in SQLite with hashed tokens, the first admin from the environment, the admin flag fixed at creation, users disabled and never deleted; Why — one paragraph (the app owns every write, decision 1; no email; nothing is lost).
- [ ] **Step 3: `docs/environment.md`** — the Image section gains the Chromium libraries; a short "The app" section lists the npm scripts and points at `docs/app.md`.
- [ ] **Step 4: `README.md`** — one paragraph and a pointer to `docs/app.md`.
- [ ] **Step 5: Commit** — `git commit -m "docs: document the app and decision 3"`
