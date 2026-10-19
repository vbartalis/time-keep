# Phase 7, the MCP server — design

Date: 2026-10-19. Roadmap item 7. Written without the operator under the continuous
development experiment (operator, 2026-10-18); every choice not taken from the vision,
the roadmap, decisions 1–5, `docs/core.md`, `docs/app.md` or the earlier specs is
marked **(call)**.

## Intent

The vision's agents section: "An MCP server is a first-class client of the same API,
for bulk entry, month-end reorganising and rewording, and importing from Kimai. […]
Agent changes are batches like any other, so a wrong tidy-up is one undo." Principle 3:
"The UI and agents go through the same API and the same validation; neither can do what
the other cannot." Hosting: "The MCP server is behind authentication."

The operator's intent, from the discovery conversation: at month-end an agent adds
entries in bulk, reorganises, rewrites and tidies the month; phase 9's Kimai import is
an agent creating years of entries through this server. That is why batch undo matters
most: whatever the agent did in one request comes back in one undo.

Roadmap exit: an authenticated agent can do through the MCP server what the UI can,
and no more, and a wrong agent change is undone in one step.

## Goals

- An MCP endpoint in the app (`/mcp`), so the one container serves it.
- Per-user **access tokens**, made and revoked by the user on the Account screen, that
  an agent sends as a bearer token. An agent acts as that user, on that user's data.
- Tools that read the time data and change it through the core, with `actor: 'agent'`,
  where **one tool call is one batch**, and one call can carry many changes, so a
  month's tidy-up or a slice of the import is one batch and one undo.
- Undo and redo for the agent too, and the history to find what to undo.

## Non-goals

- **OAuth** **(call)**. The MCP specification's authorization flow (dynamic client
  registration, a consent screen, refresh tokens) serves clients that cannot hold a
  secret header; the agents used here (Claude Code, the import script) can. A static
  bearer token is all "behind authentication" needs. Cost if wrong: a client that
  accepts only OAuth (claude.ai's web connectors) cannot connect until it is added.
- Account tools: no password change, user management or token management through the
  MCP **(call: accounts are outside the time data and its history, decision 3 and 4; an
  agent holding a token must not be able to mint more)**.
- Output tools: no copy-out rows, CSV or report totals **(call: those are
  presentations of `list_entries`, which the agent has; rounding and splitting are the
  operator's output choices, not data)**.
- Token scopes (read-only tokens), expiry dates, or a per-token rate limit **(call:
  one person, revocation on Account is the control)**.
- MCP resources, prompts, sampling, server-sent notifications, sessions **(call:
  tools are the whole surface)**.
- An importer: the Kimai import stays an agent's job (vision); the server only has to
  take large batches.
- Any change to the core's rules. The core gains only exports and one read,
  `history.get` (see Tools).

## Anti-goals

- A write that does not go through the core, or a rule the agent meets that the UI
  does not, or the reverse.
- One tool call ending in two batches, or in half a batch: a call's changes are all
  stored or none.
- A session cookie authorising `/mcp`, or a token authorising a screen.
- A token stored in clear, or shown again after it was made.
- An agent seeing or touching another user's data, or a disabled user's token working.
- A tool result the agent cannot act on: a refusal must say which change failed and
  why, in the core's words.

## Decided

### Transport **(call)**

Streamable HTTP, the MCP transport for remote servers, at `POST /mcp`, **stateless**:
no MCP session id, a fresh server per request, JSON responses (no server-sent event
stream). `GET` and `DELETE` on `/mcp` answer 405. The route sits outside `(app)`, so
the screens' session and redirect never apply. The official TypeScript SDK
(`@modelcontextprotocol/sdk`, its web-standard Streamable HTTP transport, which takes
a `Request` and returns a `Response` as a SvelteKit `+server.ts` does) is a new runtime
dependency **(call)**.

A request carrying an `Origin` header other than the app's own origin is refused with
403 (the MCP specification's guard against DNS rebinding); one without is allowed
(agents send none) **(call)**.

### Access tokens **(call: the whole section; a decision record, 6)**

- A token is `tk_` and 32 base32 characters (20 random bytes, as session tokens), the
  prefix making a leaked one recognisable. Only its SHA-256 is stored, in a new
  `access_token` table: `id`, `user_id`, `name` (trimmed, 1–100 characters, unique per
  user case-insensitively as names are), `token_hash` (unique), `created_at`,
  `last_used_at` (null until used).
- **Account** gains a section **Agent access** under Change password, on the phone and
  the PC: a ruled list of the user's tokens (name, created, last used or "Never
  used", a **Revoke** button), and an add line (Name, **Create token**). Creating shows
  the token once, in a mono field with a Copy button (JavaScript) and the line "Copy it
  now: it is not shown again." Revoke is a two-step confirm on the page, as the entry
  delete is. No undo: accounts are outside the history (decision 4), and revoking is
  the safe direction. The screen's plain posts work without JavaScript, as every form.
- `Authorization: Bearer tk_…` on `/mcp`. A missing, malformed, unknown or revoked
  token, or one whose user is disabled, is 401 with `WWW-Authenticate: Bearer` and no
  detail on which. A valid one sets `last_used_at` (at most once a minute per token)
  and opens the core as `openCore(getDb(), userId, 'agent')`.
- Disabling a user deletes their tokens, as it deletes their sessions; enabling does
  not bring them back. A password change, by the user or an admin, leaves tokens alone
  (they are a separate credential, listed and revoked on Account).
- No limit on how many tokens a user has. The admin's tokens act on the admin's own
  data, like the admin's screens.
- Bad tokens are not throttled: 20 random bytes cannot be guessed.

### Tools

Every tool's input is validated by the core's own zod schemas, so the agent meets the
UI's rules exactly. The core's command input schemas are exported from
`core/index.ts` for the MCP to describe its tools with **(call: the guard test still
holds, the MCP imports only `core/index.ts`; the schemas move to exports, their
contents do not change)**. Tool names are snake_case **(call)**; every tool has a
description written for the agent, and the MCP annotations `readOnlyHint` (the reads)
and `destructiveHint` (`change`, `undo`, `redo`).

**Reads** (read the database, write nothing):

| Tool | Core read | Input |
|------|-----------|-------|
| `list_customers` | `customers.list` | `includeArchived?` |
| `list_projects` | `projects.list` | `includeArchived?`, `customerId?` |
| `list_activities` | `activities.list` | `includeArchived?` |
| `list_locations` | `locations.list` | `includeArchived?` |
| `list_entries` | `entries.list` | the core's list input, `limit` 1–999 defaulting to 500 |
| `get_entry` | `entries.get` | `id` |
| `list_templates` | `templates.list` | none |
| `get_template` | `templates.get` | `id` |
| `list_history` | `history.list` | `before?`, `limit?` (1–200, default 20) |
| `get_batch` | `history.get` (new) | `batchId` |

`list_entries` fetches one row past its limit and answers `truncated: true` when there
were more, so the agent narrows the range **(call: no cursor paging; the tool's limit
stops at 999 so the extra row stays within the core's 1000)**.

`list_history` gives each batch as a summary: `id`, `label`, `actor`, `createdAt`,
`changeCount`, and whether it is undone, partly undone (how many of how many) and by
which batch, without the changes **(call: an import slice is 1000 changes, and 20
batches of whole rows is more than an agent can read)**. `get_batch` gives one batch
with every change: its `id`, `entity`, `entityId`, `op`, `before`, `after` and whether
it is undone, which is what `undo({ changeIds })` needs. The core gains the read
`history.get({ batchId })`, the same data `history.list` builds for one batch (an
unknown or foreign batch `not_found`) **(call: a read, no rule changes)**.

**Writes:**

- `change`: `label` (trimmed, 1–200 characters, the batch's label in History) and
  `operations`, an array of 1 to 1000 `{ command, input, as? }`. It runs them in order
  through `core.batch(label, …)` as one batch. `command` is one of the `BatchCore`
  commands: `customers.create|rename|archive|unarchive`, the same for `projects`,
  `activities` and `locations`, `entries.create|update|delete|fromTemplate`,
  `timers.start|stop`, `templates.create|update|delete|fromEntry` **(call: one write
  tool rather than one per command, since a batch is one call; undo and redo are not
  among the commands, they are their own tools)**.
- `undo` and `redo`: the core's `{ batchId } | { changeIds }`, each its own batch, as
  on History.

**References inside a call** **(call)**. An operation may name its result with `as`
(a short name, unique in the call). A later operation's id field (`id`, `customerId`,
`projectId`, `activityId`, `locationId`, `entryId`, `templateId`) may then be
`{ "ref": "<name>" }` instead of an id, and is replaced with the named result's `id`
before the command runs. Only id fields take refs; nothing else in an input is
rewritten. A ref to a name not yet defined is refused before anything runs. This is
what lets one call create a customer, its project and the entries on it, or a new
project and move entries to it, as one batch and one undo.

**Results** **(call)**. A tool answers with JSON as its text content and as
`structuredContent`:

- reads: `{ items }` (or the one item), plus `truncated` on `list_entries`;
- `change`: `{ batchId, results, warnings }`, `results` holding each operation's
  returned row in order; `batchId` is null when the batch changed nothing, which is
  then said;
- `undo`/`redo`: `{ batchId, reverted, warnings }`;
- a refusal: `isError: true` with `{ code, message, fields?, operation? }`,
  `operation` the index of the failing operation in a `change`, the core's code,
  message and fields as they are. Nothing was stored.

Live rows (reads and `change` results) are given as the core returns them, with two
changes for the agent: an entry's `startAt` and `endAt` are written as ISO 8601
date-times with the offset of their own zone (`2026-10-19T09:00:00+02:00`) beside the
zone names, every other instant (`createdAt`, `updatedAt`, `archivedAt`, a batch's
`createdAt`) as ISO 8601 in UTC (`…Z`), and the bookkeeping fields (`userId`,
`nameKey`) are left out. `version` stays, for `expectedVersion`. A change's `before`
and `after` in `get_batch` are the stored record as it is (snake_case columns,
epoch milliseconds), less `user_id` and `name_key`: they are history, read for ids
and to see what changed **(call: all of this paragraph)**.

A batch's id comes back from `core.batch`'s result through the history's newest batch
or a core export, whichever the builder finds clean; the core's behaviour does not
change.

### Size

One call is at most 1000 operations, and its body at most the server's limit
(adapter-node's `BODY_SIZE_LIMIT`, 512 KB by default, which 1000 entries with
ordinary descriptions fit) **(call: an import is sent in month-sized calls; raising the
limit is phase 9's call if it bites)**.

### Errors outside the tools

A request that is not valid MCP JSON-RPC gets the SDK's JSON-RPC error. An unexpected
exception in a tool is logged on the server and answered as `isError` with "Something
went wrong."; nothing was stored, since the core's batch rolled back.

### Documentation

- `docs/mcp.md`, a new contract doc for the boundary: the endpoint, authentication,
  every tool with its input and result, refs, limits, and how to connect an agent
  (Claude Code: `claude mcp add --transport http time-keep https://<host>/mcp --header
  "Authorization: Bearer tk_…"`).
- Decision record 6: agents authenticate with per-user bearer tokens over stateless
  Streamable HTTP; OAuth not now, and why.
- `docs/app.md`: the layout rows (`src/routes/mcp`, `src/lib/server/mcp/`,
  `auth/tokens.ts`), the Account screen's Agent access, Accounts and sessions (tokens,
  disabling), the tests. `docs/core.md`: the exported schemas.
- `DESIGN.md`: the token list and the shown-once token, through impeccable's document
  step.
- `docs/roadmap.md`: 7 done.

### Tests

- Unit: tokens (made, hashed, found, revoked, a disabled user's refused, deleted on
  disable, `last_used_at`); the bearer check (missing, malformed, unknown, revoked,
  disabled: 401 alike); the Origin check.
- Unit, through the SDK's client over an in-memory transport against the real core on
  in-memory SQLite: every tool listed with its schema; each read; `change` with
  several commands as one batch with `actor: 'agent'` and the call's label; refs
  (customer, project and entries in one call; a project created and entries moved to
  it); a refusal at operation k storing nothing and naming k; warnings returned; an
  unknown ref refused before anything runs; undo of a `change` restoring everything in
  one step, redo; `list_history` summaries and `get_batch`'s changes, its change ids
  undone through `undo`; another user's id `not_found`; `list_entries` truncation; the ISO
  times with offsets.
- Browser, phone and PC sizes: Account's Agent access (create, the token shown once,
  listed, revoke with its confirm, without JavaScript too); then, against the
  production build with Playwright's request client, an MCP `tools/call` with that
  token succeeding, the same after revoke 401, a session cookie alone 401, and a
  `change` call showing on History with the Agent chip and undone there in one step.

## Exit

An agent holding a user's token can, through `/mcp`, read and change everything that
user can on the screens' time data, under the same rules, and nothing of anyone
else's; each call is one batch, shown on History as Agent and undone in one step.
Check, lint, unit and browser tests pass.

## Left to the builder

The module layout under `src/lib/server/mcp/`; how the tool schemas are built from the
core's exports (a discriminated union on `command` or per-command schemas checked at
run time); how the batch id is obtained; the token list's component structure; copy
beyond the strings above.
