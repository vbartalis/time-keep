# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An MCP endpoint at `POST /mcp` where an agent holding a user's access token reads and changes that user's time data through the core, one tool call one batch, undone in one step.

**Architecture:** Tokens live beside sessions (`src/lib/server/auth/tokens.ts`, a new `access_token` table) and are managed on the Account screen. `src/lib/server/mcp/` builds an SDK `McpServer` over one user's `Core` (opened with actor `'agent'`): read tools, one `change` tool running many core commands in `core.batch` with refs between them, and `undo`/`redo`. `mcp/http.ts` checks the Origin and the bearer token and hands the request to the SDK's web-standard Streamable HTTP transport, stateless, JSON responses; `src/routes/mcp/+server.ts` only calls it. The core gains exports, a `history.get` read and `BatchCore.batchId`; no rule changes.

**Tech Stack:** SvelteKit 3.1 (adapter-node, `#lib` imports, Svelte 5 runes), Drizzle over better-sqlite3, zod 4, `@modelcontextprotocol/sdk` 1.32 (new runtime dependency), Tailwind, shadcn-svelte, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-mcp-server-design.md`

## Global Constraints

- Every write goes through the core (`openCore(db, userId, 'agent')`); the MCP imports only `core/index.ts` (the guard test in `core/guard.test.ts` must stay green unedited).
- One `change`, `undo` or `redo` call is exactly one batch, or none when it changed nothing or failed. A failure stores nothing.
- `change`: `label` 1–200 characters after trim (the core's own check); `operations` 1–1000; `as` names unique in a call; refs only in the id fields `id`, `customerId`, `projectId`, `activityId`, `locationId`, `entryId`, `templateId`, written `{ "ref": "<name>" }`.
- Commands accepted by `change` (exactly these 22): `customers.create|rename|archive|unarchive`, `projects.create|rename|archive|unarchive`, `activities.create|rename|archive|unarchive`, `locations.create|rename|archive|unarchive`, `entries.create|update|delete|fromTemplate`, `timers.start|stop`, `templates.create|update|delete|fromEntry`. No undo/redo inside `change`.
- Tool names (exactly 13): `list_customers`, `list_projects`, `list_activities`, `list_locations`, `list_entries`, `get_entry`, `list_templates`, `get_template`, `list_history`, `get_batch`, `change`, `undo`, `redo`. Reads carry `readOnlyHint: true`; `change`, `undo`, `redo` carry `destructiveHint: true`.
- `list_entries`: `limit` 1–999, default 500; answers `truncated: true` when more matched. `list_history`: `limit` 1–200, default 20.
- Rows for the agent: `userId`/`user_id` and `nameKey`/`name_key` dropped; an entry's `startAt`/`endAt` as ISO 8601 with its own zone's offset, seconds always (`2026-10-19T09:00:00+02:00`, UTC as `+00:00`); every other instant on a live row or batch as `new Date(ms).toISOString()`. History `before`/`after` stay as stored otherwise.
- Refusals: `isError: true`, body `{ code, message, fields?, operation? }` with the core's code, message and fields as given; `operation` the 0-based index in `change`. An unexpected exception: logged with `console.error`, answered `isError` with `{ code: 'error', message: 'Something went wrong.' }`.
- Tokens: `tk_` + 32 lowercase base32 characters (20 random bytes, `base32` from `src/lib/server/id.ts`); only the SHA-256 hex stored; `last_used_at` written at most once a minute per token; disabling a user deletes their tokens; password changes do not.
- HTTP: an `Origin` header other than the app's origin → 403; a missing, malformed, unknown or revoked token, or a disabled user → 401 with `WWW-Authenticate: Bearer` and the same body `{"error":"Unauthorized."}`; only `POST` is exported (SvelteKit answers 405 for the rest). No session cookie is read on `/mcp`.
- Copy (exact, Account): "Agent access", "Name", "Create token", "Copy", "Copied", "Copy it now: it is not shown again.", "Never used", "Revoke", "Revoke \"<name>\"?", "Yes, revoke", "Cancel", "Token revoked.", "No tokens yet.", "Name must be 1–100 characters.", "You already have a token with that name.", "Token not found.".
- Forms work without JavaScript; no browser dialogs. The time card world (`DESIGN.md`): rules, not boxes; violet only for the primary action; red only for the destructive confirm; the token punched (mono).
- Browser tests: `npm run test:e2e`, phone (Pixel 7) and PC (1440×900) projects, one seeded user per test.
- Never run docker; never git push. Conventional Commits, no scope, no AI attribution.

## Review Focus

1. **A refusal thrown inside a command** (a timer that started later, a start in the future) at operation k of a `change`: `runBatch` turns the throw into a failure, so the index must be the operation running when it threw, and nothing stored — Task 4.
2. **A `change` that changes nothing** (renaming to the same name): ok, `batchId: null`, `message: "Nothing changed."`, and History unchanged — Task 4.
3. **A ref in a field that is not an id field** (`{ "ref": "x" }` as a `description`) is passed through untouched and the core refuses it as it would any object there; a ref to a later or unknown name refuses before anything runs — Task 4.
4. **An entry in a zone with daylight saving** read back: 2026-10-25 00:30Z and 01:30Z in `Europe/Budapest` carry `+02:00` and `+01:00` — Task 3.
5. **A token with a lowercase `bearer` scheme, extra spaces, or an uppercase body**: the scheme is case-insensitive, the token exact; `Bearer  tk_…` (two spaces) and an uppercase body are 401 — Task 2.

---

### Task 1: The core's additions

**Files:**
- Modify: `src/lib/server/core/index.ts`, `src/lib/server/core/history.ts`
- Modify (exports only, no content change): `src/lib/server/core/reference.ts`, `entries.ts`, `templates.ts`, `undo.ts`
- Test: `src/lib/server/core/history.test.ts`, `src/lib/server/core/core.test.ts`
- Docs: `docs/core.md` (Opening's API block, History, a short "Schemas" paragraph)

**Interfaces:**
- Produces (from `core/index.ts`):
  - `type CommandName` — the 22 names in Global Constraints, as a string union; `COMMANDS: readonly CommandName[]` in that order.
  - `commandSchemas: Record<CommandName, z.ZodType>` — the zod schema each command already parses its input with (e.g. `'customers.rename'` → reference's `renameSchema`, `'projects.create'` → `projectSchema`, `'entries.fromTemplate'` → `fromTemplateSchema`, `'templates.fromEntry'` → `fromEntrySchema`). The same objects, exported, not copies.
  - `readSchemas: { customers, projects, activities, locations, entries, entry, template, history, batch }` — reference `listSchema` (×3), `projectListSchema`, entries `listSchema`, entries `getSchema`, templates `getSchema`, history `listSchema`, and the new history `getSchema` below.
  - `undoSchema` — undo's `inputSchema`.
  - `Core.history.get(input: unknown): Result<HistoryBatch>` — input `z.object({ batchId: z.string().min(1) })`; the batch with its changes exactly as `history.list` builds them; unknown or another user's → `not_found`, `Not found.`.
  - `BatchCore.batchId: string` — the id of the open batch, for `core.batch`'s callers. Commands outside `core.batch` are unchanged.

- [ ] **Step 1: Failing tests:**
  - `history.test.ts`: `history.get({ batchId })` deep-equals `history.list().value.find(b => b.id === batchId)` for a batch of two changes, one of them undone (so `undone` / `undoneBy` per change match); another user's batch id and `'nope'` → `{ ok: false, error: { code: 'not_found' } }`; `{}` → `invalid`.
  - `core.test.ts`: inside `core.batch('L', (c) => { seen = c.batchId; return c.customers.create({ name: 'A' }); })`, `seen` equals `core.history.list({ limit: 1 }).value[0].id`; `Object.keys(commandSchemas).sort()` equals the 22 names sorted; `COMMANDS.length === 22`; `commandSchemas['customers.create'].safeParse({ name: ' ' }).success === false`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/core` — FAIL.
- [ ] **Step 3: Implement.** `getHistory(db, userId, input)` in `history.ts` shares the change-building code with `listHistory` (extract it; do not duplicate it). `batchId` comes from the open `Writer` (add a public readonly field if it is private) when `core.batch` builds its `BatchCore`.
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run` — PASS, every earlier test unedited.
- [ ] **Step 5: Commit** — `git commit -m "feat: expose the core's input schemas and one batch"`

---

### Task 2: Access tokens

**Files:**
- Modify: `src/lib/server/db/schema.ts`; generate `drizzle/0004_*.sql` with `npm run db:generate`
- Create: `src/lib/server/auth/tokens.ts`, `src/lib/server/auth/tokens.test.ts`
- Modify: `src/lib/server/users.ts` (`setDisabled`), `src/lib/server/users.test.ts`

**Interfaces:**
- Produces:
  - Table `access_token` (`accessToken` in schema): `id` text pk (`newId()`), `user_id` text not null → `user.id`, `name` text not null, `name_key` text not null, `token_hash` text not null unique, `created_at` integer not null, `last_used_at` integer null; unique index on (`user_id`, `name_key`), index on `user_id`.
  - `TOKEN_PREFIX = 'tk_'`.
  - `type TokenSummary = { id: string; name: string; createdAt: number; lastUsedAt: number | null }`.
  - `createToken(db: DB, userId: string, name: unknown, now = Date.now()): Result<{ token: string; summary: TokenSummary }>` (`Result` from `users.ts`) — name trimmed, 1–100 characters else "Name must be 1–100 characters."; `name_key` = NFC then lowercased; a taken key → "You already have a token with that name.".
  - `listTokens(db: DB, userId: string): TokenSummary[]` — newest first, then id.
  - `revokeToken(db: DB, userId: string, id: string): Result` — deletes the row; not the user's or unknown → "Token not found.".
  - `authenticateToken(db: DB, header: string | null, now = Date.now()): { userId: string } | null` — the header must match `/^bearer (tk_[a-z2-7]{32})$/` with the scheme compared case-insensitively and the token exactly; hash, join `user`, `disabled_at` null; sets `last_used_at = now` when null or `now - last_used_at >= 60_000`.

- [ ] **Step 1: Failing tests** (`tokens.test.ts`, `createTestDb()`):
  - a created token matches `/^tk_[a-z2-7]{32}$/`, the stored `token_hash` is its SHA-256 hex and no column holds the token;
  - `authenticateToken(db, 'Bearer ' + token)` → `{ userId }`; `'bearer ' + token` too; `null`, `''`, `'Bearer'`, `'Basic ' + token`, `'Bearer  ' + token` (two spaces), `'Bearer ' + token.toUpperCase()`, `'Bearer tk_' + 'a'.repeat(32)` → `null`;
  - revoked → `null`; a disabled user's → `null`;
  - `last_used_at`: null after create; `now` after the first use; unchanged by a use 59 999 ms later; updated by one 60 000 ms later;
  - names: `'  Laptop '` stored `Laptop`; `''` and 101 characters refused with the copy; `'laptop'` after `'Laptop'` refused; another user may use `Laptop`;
  - `listTokens` newest first, only the user's; `revokeToken` of another user's id → "Token not found.".
  - `users.test.ts`: `setDisabled(..., true)` deletes the user's tokens; enabling does not restore them; `changeOwnPassword` and the admin's set-password leave them.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/auth/tokens.test.ts src/lib/server/users.test.ts` — FAIL.
- [ ] **Step 3: Implement** the table, the migration (`npm run db:generate`; commit the SQL and `drizzle/meta`), `tokens.ts` (hash as `sessions.ts` does, with a local helper), and the delete in `setDisabled`'s transaction beside the sessions delete.
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add per-user access tokens for agents"`

---

### Task 3: The MCP server's reads

**Files:**
- Modify: `package.json`, `package-lock.json` (`npm install @modelcontextprotocol/sdk@^1.32.1`, a runtime dependency)
- Create: `src/lib/server/mcp/rows.ts`, `src/lib/server/mcp/server.ts`, `src/lib/server/mcp/rows.test.ts`, `src/lib/server/mcp/server.test.ts`

**Interfaces:**
- Consumes: Task 1's `readSchemas`, `Core.history.get`; `Core`, `HistoryBatch`, `Result`, `CoreError` from `core/index.ts`.
- Produces:
  - `rows.ts`: `isoAt(ms: number, zone: string): string` (`YYYY-MM-DDTHH:mm:ss±HH:MM`, via `Intl.DateTimeFormat` parts with `timeZoneName: 'longOffset'`, a bare `GMT` meaning `+00:00`); `agentRow(row: Record<string, unknown>): Record<string, unknown>` (drops `userId`, `nameKey`; `startAt`/`endAt` through `isoAt` with `startZone`/`endZone` when those keys are present, a null `endAt` kept null; non-null `createdAt`, `updatedAt`, `archivedAt` to ISO UTC); `batchSummary(b: HistoryBatch)` → `{ id, label, actor, createdAt, changeCount, undoneChanges, undone, undoneBy }`; `batchDetail(b: HistoryBatch)` → the summary's fields plus `changes: [{ id, entity, entityId, op, before, after, undone, undoneBy }]`, `before`/`after` less `user_id` and `name_key`.
  - `server.ts`: `createMcpServer(core: Core): McpServer` (`new McpServer({ name: 'time-keep', version: '0.0.1' })`), registering the ten read tools here and the writes in Task 4. It exports for Task 4: `answer(value: unknown): CallToolResult` (`content: [{ type: 'text', text: JSON.stringify(value) }]`, `structuredContent: value`) and `refuse(error: CoreError & { operation?: number }): CallToolResult` (the same with `isError: true`).
  - Read tools: `list_customers`/`list_activities`/`list_locations` (`readSchemas.<kind>`) → `{ items }`; `list_projects` (`readSchemas.projects`) → `{ items }`; `list_entries` (entries' list schema with `limit` replaced by `z.number().int().min(1).max(999).optional()`) → `{ items, truncated }`, calling the core with `limit + 1` (default 500 + 1) and returning the first `limit`; `get_entry` → the row; `list_templates` (no input) → `{ items }`; `get_template` → the row; `list_history` (`before?`, `limit` 1–200 default 20) → `{ items: batchSummary[] }`; `get_batch` (`batchId`) → `batchDetail`. Every row through `agentRow`. A core refusal → `refuse(error)`.
  - Each tool has a one- or two-sentence `description` for an agent (what it returns; on `list_entries` that times carry their own zone's offset; on `get_batch` that its change ids feed `undo`).

- [ ] **Step 1: Failing tests:**
  - `rows.test.ts`: `isoAt(Date.parse('2026-10-19T07:00:00Z'), 'Europe/Budapest') === '2026-10-19T09:00:00+02:00'`; `isoAt(Date.parse('2026-10-25T00:30:00Z'), 'Europe/Budapest') === '2026-10-25T02:30:00+02:00'`; `isoAt(Date.parse('2026-10-25T01:30:00Z'), 'Europe/Budapest') === '2026-10-25T02:30:00+01:00'`; `isoAt(0, 'UTC') === '1970-01-01T00:00:00+00:00'`; `isoAt(Date.parse('2026-10-19T12:00:00Z'), 'Asia/Kolkata')` ends `+05:30`; `agentRow` on a customer row has no `userId`/`nameKey`, an ISO `createdAt`, `archivedAt: null` kept; on a running entry `endAt: null`.
  - `server.test.ts`, with `InMemoryTransport.createLinkedPair()` (`@modelcontextprotocol/sdk/inMemory.js`) and a `Client` (`@modelcontextprotocol/sdk/client/index.js`) against `createMcpServer(openCore(createTestDb(), userId, 'agent', clock))`: `listTools()` holds the ten reads, each `annotations.readOnlyHint === true`; `list_customers` returns the user's customer, not another user's; with 3 entries, `list_entries` `limit: 2` → 2 items and `truncated: true`, `limit: 3` → `truncated: false`; `limit: 1000` → `isError`; `get_entry` of another user's id → `isError` with `code: 'not_found'`; `list_history` gives summaries without `changes`, 20 of 25 seeded batches by default; `get_batch` gives its changes with ids; a Budapest entry's `startAt` reads `…+02:00`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/mcp` — FAIL.
- [ ] **Step 3: Implement** `rows.ts` and `server.ts` (reads only), passing `readSchemas`' zod objects as `inputSchema`.
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: read the time data through mcp tools"`

---

### Task 4: `change`, `undo` and `redo`

**Files:**
- Create: `src/lib/server/mcp/change.ts`, `src/lib/server/mcp/change.test.ts`
- Modify: `src/lib/server/mcp/server.ts`, `src/lib/server/mcp/server.test.ts`

**Interfaces:**
- Consumes: Task 1's `COMMANDS`, `CommandName`, `commandSchemas`, `BatchCore.batchId`, `Core.history.get`; Task 3's `answer`, `refuse`, `agentRow`.
- Produces:
  - `type Operation = { command: CommandName; input: Record<string, unknown>; as?: string }`.
  - `ID_FIELDS = ['id', 'customerId', 'projectId', 'activityId', 'locationId', 'entryId', 'templateId'] as const`.
  - `checkRefs(ops: Operation[]): (CoreError & { operation: number }) | null` — before anything runs: a repeated `as` → `invalid`, `Name "<as>" is used twice.` at the second; an id field holding `{ ref }` that names no `as` of an earlier operation → `invalid`, `Unknown ref "<name>".`, `fields: { <field>: same message }`.
  - `runChange(core: Core, label: string, ops: Operation[]): { ok: true; batchId: string | null; results: unknown[]; warnings: Warning[] } | { ok: false; error: CoreError & { operation?: number } }` — `checkRefs`, then `core.batch(label, (c) => …)`: for each op in order set `current = i`, replace ref objects in id fields with the named result's `id`, call the command, and return a failed result at once; record `c.batchId`. After an ok batch, `batchId` is that id when `core.history.get({ batchId })` finds it, else `null`. A failure carries `operation: current`, also when `core.batch` returns a failure from a thrown refusal; a label refusal (no op ran) carries none.
  - Tool `change`: input `{ label: z.string(), operations: z.array(z.object({ command: z.enum(COMMANDS), input: z.record(z.string(), z.unknown()), as: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional() })).min(1).max(1000) }`; answers `{ batchId, results (each through agentRow), warnings }`, plus `message: 'Nothing changed.'` when `batchId` is null. Its description lists the commands with each one's input as JSON Schema, generated once at module load (`z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })`), and explains `as` and `ref`.
  - Tools `undo`, `redo`: input `{ batchId: z.string().optional(), changeIds: z.array(z.string()).optional() }` (an object, as the SDK needs; the core's own schema decides validity, so `{}` or both keys is the core's `invalid`); call `core.undo`/`core.redo` with only the keys given; answer `{ batchId, reverted, warnings }`, `batchId` the newest batch (`history.list({ limit: 1 })`) after an ok call **(ruling: undo always writes, and one user's requests rarely interleave; recorded in `docs/mcp.md`)**.
  - Any tool: an unexpected throw → `console.error`, then `refuse({ code: 'error', message: 'Something went wrong.' })`.

- [ ] **Step 1: Failing tests:**
  - `change.test.ts` (`runChange` on `openCore(createTestDb(), userId, 'agent', clock)`):
    - customer `as: 'c'`, project `{ customerId: { ref: 'c' } }` `as: 'p'`, two `entries.create` with `projectId: { ref: 'p' }` → ok; `history.list({ limit: 1 })` shows one batch, actor `agent`, the call's label, 4 changes, and its id equals `batchId`;
    - a project created and two existing entries moved to it (`entries.update { id, projectId: { ref: 'p' } }`) → one batch; `core.undo({ batchId })` restores both entries' projects and removes the project;
    - of three operations the second invalid (an `entries.create` without `projectId`) → `ok: false`, `operation: 1`, `code: 'invalid'`, history unchanged;
    - a thrown refusal: `timers.start` as operation 1 on a project whose running timer started later than the given `start` → `operation: 1`, nothing stored;
    - `Unknown ref "x".` at operation 0, nothing stored; a ref to a later operation's `as` → unknown; a repeated `as` → refused at the second;
    - `{ ref: 'c' }` as a `description` is passed unchanged and the core refuses it (`invalid`);
    - renaming a customer to its own name → ok, `batchId: null`;
    - label `'  '` → `invalid` with `fields.label` and no `operation`;
    - two overlapping `entries.create` → an `overlap` warning comes back.
  - `server.test.ts`: `listTools()` holds `change`, `undo`, `redo`, each `destructiveHint: true`, 13 tools in all, and `change`'s description contains `entries.create`; a `change` over the client returns `structuredContent.batchId`; `undo` with that id returns a new `batchId` and the change's customer is gone from `list_customers`; `redo` brings it back; `undo` with `{}` → `isError`, `code: 'invalid'`; another user's batch id → `not_found`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/mcp` — FAIL.
- [ ] **Step 3: Implement** `change.ts` and register the three tools.
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: change the time data through mcp as one batch"`

---

### Task 5: The `/mcp` endpoint

**Files:**
- Create: `src/lib/server/mcp/http.ts`, `src/lib/server/mcp/http.test.ts`, `src/routes/mcp/+server.ts`

**Interfaces:**
- Consumes: Task 2's `authenticateToken`, `createToken`; Tasks 3–4's `createMcpServer`; `openCore`.
- Produces:
  - `handleMcp(request: Request, deps: { db: DB; origin: string; now?: number }): Promise<Response>` — an `Origin` present and `!== deps.origin` → 403 `{"error":"Forbidden."}`; `authenticateToken(db, request.headers.get('authorization'), now)` null → 401 with `WWW-Authenticate: Bearer`, `{"error":"Unauthorized."}`; else `createMcpServer(openCore(db, userId, 'agent'))`, `new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })` (`@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`), `server.connect(transport)`, return `transport.handleRequest(request)`, closing both once the response is built.
  - `src/routes/mcp/+server.ts`: `export const POST: RequestHandler = ({ request, url }) => handleMcp(request, { db: getDb(), origin: url.origin });` and nothing else.

- [ ] **Step 1: Failing tests** (`http.test.ts`, a `Request` to `http://app.test/mcp` with `content-type: application/json` and `accept: application/json, text/event-stream`, body a JSON-RPC `tools/call` of `list_customers`, `id: 1`):
  - a valid token → 200, JSON whose `result.structuredContent.items` holds the user's customer;
  - no header, a revoked token, a disabled user's token, a malformed one → 401 each, `www-authenticate: Bearer`, identical bodies;
  - `origin: http://evil.test` with a valid token → 403; `origin: http://app.test` → 200; no origin → 200;
  - a `change` call over HTTP stores one batch with actor `agent`;
  - `cookie: session=<a valid session token>` and no authorization → 401;
  - `tools/list` → 200 with 13 tools; a body that is not JSON → the SDK's JSON-RPC error (a 4xx, not 500).
- [ ] **Step 2: Run** `npx vitest run src/lib/server/mcp/http.test.ts` — FAIL.
- [ ] **Step 3: Implement** `http.ts` and the route.
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: serve the mcp server at /mcp behind tokens"`

---

### Task 6: Agent access on the Account screen

**Files:**
- Modify: `src/routes/(app)/account/+page.server.ts`, `src/routes/(app)/account/+page.svelte`
- Create: `src/lib/components/account/TokenList.svelte` (the list with its revoke confirm), `src/lib/components/account/NewToken.svelte` (the shown-once token with Copy)

**Interfaces:**
- Consumes: Task 2's `createToken`, `listTokens`, `revokeToken`, `TokenSummary`; `requireUser`; the request's zone as the other screens resolve it (`src/lib/server/screens/zone.ts`).
- Produces:
  - `load` → `{ tokens: { id, name, created: 'YYYY-MM-DD', lastUsed: 'YYYY-MM-DD HH:mm' | null }[] }`, in the request's zone **(ruling: a date for created, date and time for last used)**.
  - Actions: the password action becomes `?/password` (its form's `action` updated; behaviour and messages unchanged); `?/createToken` (`name`) → `{ token, tokenName }`, or `fail(400, { tokenError })`; `?/revokeToken` (`id`, `confirm`) — without `confirm=yes` returns `{ confirmRevoke: id }` and the page shows "Revoke "<name>"?" with **Yes, revoke** (red, posts `confirm=yes`) and **Cancel** (a link to `/account`); with it revokes and returns `{ tokenMessage: 'Token revoked.' }`, a refusal `fail(400, { tokenError })`.
  - Layout: under Change password, a section headed **Agent access** (the same `h2`): one ruled line per token (the name; created; last used or "Never used", punched; **Revoke**, outline), "No tokens yet." when none; then the add line (label **Name**, input, **Create token** primary). After creating: the token in a read-only mono input with **Copy** (JavaScript only, `navigator.clipboard.writeText`, then "Copied") and "Copy it now: it is not shown again.", above the list. The password lines' 12 rem label column on the PC; stacked on the phone.

- [ ] **Step 1: Implement** the actions and the section (Task 7's browser tests pin them).
- [ ] **Step 2: Run** `npm run check && npm run lint && npx vitest run` — PASS; look at `/account` on a dev build at 390 and 1440 px against `DESIGN.md`'s ruled lines.
- [ ] **Step 3: Commit** — `git commit -m "feat: make and revoke agent tokens on account"`

---

### Task 7: Browser tests and docs

**Files:**
- Create: `e2e/agent.test.ts`
- Modify: `e2e/seed.ts` (only if a helper is missing; `seedEmptyUser` and `seedCustomer` exist)
- Create: `docs/mcp.md`, `docs/decisions/006-agents-sign-in-with-bearer-tokens-over-streamable-http.md`
- Modify: `docs/decisions/README.md` (its list), `docs/app.md`, `docs/core.md` (if Task 1 left anything), `DESIGN.md`, `docs/roadmap.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Browser tests** (`e2e/agent.test.ts`, a user of its own per test, both projects):
  - Account: create a token named `Laptop` → it shows once (`/^tk_[a-z2-7]{32}$/`) with its line; reload → not shown, `Laptop` listed with "Never used"; a second `laptop` → "You already have a token with that name.".
  - With that token, `request.post('/mcp', …)` (headers `authorization: Bearer <token>`, `content-type: application/json`, `accept: application/json, text/event-stream`, plus the `x-forwarded-proto: http` the suite already sends) calling `change` with label `Agent tidy` to create customer `Agent Co` → 200; `/setup` lists `Agent Co`; `/history` shows `Agent tidy` with the Agent chip; its Undo removes `Agent Co` from `/setup` in one step; `/account` shows a last-used time.
  - The same request with only the page's session cookie, no authorization → 401.
  - Revoke → "Revoke "Laptop"?" → Yes, revoke → "Token revoked." and "No tokens yet."; the MCP request now → 401.
  - JavaScript off: create a token and revoke it through both steps.
- [ ] **Step 2: Run** `npm run test:e2e` — PASS, every earlier test too.
- [ ] **Step 3: Docs.**
  - `docs/mcp.md`: the endpoint (stateless Streamable HTTP, JSON responses, `POST` only, the Origin rule), authentication (tokens, the 401), every tool with its input and result, `as`/`ref`, refusals and `operation`, the row rules (times, dropped fields), the limits (1000 operations, 999 entries, `BODY_SIZE_LIMIT` 512 KB), the undo `batchId` ruling, and connecting Claude Code: `claude mcp add --transport http time-keep https://<host>/mcp --header "Authorization: Bearer tk_…"`.
  - Decision 6 in the README's format: the rule (per-user bearer tokens, hashed, made and revoked on Account; stateless Streamable HTTP at `/mcp`; actor `agent`); why (one person, agents that hold a header, nothing new to run; OAuth's registration and consent flow would be the app's largest auth surface for no current client; revisit when a needed client takes only OAuth).
  - `docs/app.md`: layout rows for `src/routes/mcp`, `src/lib/server/mcp/`, `auth/tokens.ts`, `components/account/`; the Account screen's Agent access; Accounts and sessions (tokens; disabling deletes them); Tests (`agent.test.ts`, the new unit files).
  - `DESIGN.md`: the token list and the shown-once token (edited directly, as in 6b; the impeccable sidecar stays stale; ledger it).
  - `docs/roadmap.md`: phase 7 done (date, spec, plan, decision 6, part docs, test counts, every call and ruling, deferred minors); phase 8 next.
- [ ] **Step 4: Run** `npm run check && npm run lint && npx vitest run && npm run test:e2e` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "test: cover agent access end to end"`, then `git commit -m "docs: record the mcp server"`.
