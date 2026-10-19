# The MCP server

The contract between time-keep and an agent. The server is a client of the core like
the screens (decision 4), with `actor: 'agent'`, so an agent meets the UI's rules
exactly and every change it makes is a batch on History, undone in one step. Decision
6 is the rule for how agents sign in. The code is `src/lib/server/mcp/` (`http.ts`
the request, `server.ts` the tools, `change.ts` the `change` tool's work, `rows.ts`
the rows as the agent reads them) and the route `src/routes/mcp/+server.ts`.

## The endpoint

`POST /mcp`, the MCP Streamable HTTP transport, **stateless**: no MCP session id, a
fresh server per request, and JSON responses (no server-sent event stream). A client
sends `content-type: application/json` and `accept: application/json,
text/event-stream`; no `initialize` is needed before a call. Only `POST` is served;
`GET`, `DELETE` and the rest answer 405. The route sits outside the signed-in screens,
so no session, redirect or screen applies.

- **Origin.** A request with an `Origin` header other than the app's own origin is
  refused with 403 `{"error":"Forbidden."}`, which stops cross-origin browser requests.
  It is not a DNS-rebinding guard: the expected origin comes from the forwarded host.
  A request without an `Origin` is allowed; agents send none.
- A body that is not valid MCP JSON-RPC gets the SDK's JSON-RPC error.

## Authentication

`Authorization: Bearer tk_…`, a per-user access token made on Account (Agent access)
and shown once there. A token is `tk_` and 32 lowercase base32 characters (20 random
bytes); only its SHA-256 is stored. The agent acts as the token's user, on that user's
data only.

A missing, malformed, unknown or revoked token, or one whose user is disabled, is 401
with `WWW-Authenticate: Bearer` and the same body `{"error":"Unauthorized."}`, saying
nothing about which. A session cookie never authorises `/mcp`, and a token never
authorises a screen. A valid token sets its `last_used_at`, at most once a minute.
Disabling a user deletes their tokens; enabling does not bring them back; a password
change leaves them alone. Bad tokens are not throttled (20 random bytes cannot be
guessed).

## Results

Every tool answers JSON as its text content, and as `structuredContent` too except
when the SDK rejects the input (below).

- **A refusal** is `isError: true` with `{ code, message, fields?, operation? }`: the
  core's `code` (`invalid`, `not_found`, `conflict`, `archived`), message and fields
  as it gave them, and in `change` `operation`, the 0-based index of the operation
  that failed. A refusal of the batch as a whole (the label, or the check at the
  batch's end that a project has one running entry) names no operation, since no one
  operation failed. Nothing is stored on any refusal.
- **An input the tool's own schema rejects** (a read's input, or `change`'s envelope:
  the label's type, the operation count, an unknown command, an `as` that breaks its
  pattern) is answered by the SDK as `isError` with its own text and no
  `structuredContent`. The commands' inputs are not checked there: the core checks
  them and refuses in its own words.
- **An unexpected exception** is logged on the server with `console.error` and
  answered `isError` with `{ code: 'error', message: 'Something went wrong.' }`.
  Nothing was stored, since the core's batch rolled back.

## Rows

Live rows (the reads and `change`'s results) are what the core returns, with these
changes for the agent:

- `userId` and `nameKey` are left out. `version` stays, for `expectedVersion`.
- An entry's `startAt` and `endAt` are ISO 8601 date-times with the offset of their
  own zone, seconds always: `2026-10-19T09:00:00+02:00`, UTC as `+00:00`. The zone
  names stay beside them (`startZone`, `endZone`).
- Every other instant (`createdAt`, `updatedAt`, `archivedAt`, a batch's `createdAt`)
  is ISO 8601 in UTC, `new Date(ms).toISOString()` (`…Z`).

A change's `before` and `after` in `get_batch` are the stored record as it is
(camelCase fields, epoch milliseconds), less `userId` and `nameKey`: history,
read for ids and to see what changed.

## Tools

Thirteen. The reads carry `readOnlyHint: true` and write nothing; `change`, `undo`
and `redo` carry `destructiveHint: true`. The inputs are the core's own zod schemas
(see [core.md](core.md)), exported from `core/index.ts`.

| Tool | Input | Result |
|------|-------|--------|
| `list_customers` | `includeArchived?` | `{ items }` |
| `list_projects` | `includeArchived?`, `customerId?` | `{ items }`, each with its customer |
| `list_activities` | `includeArchived?` | `{ items }` |
| `list_locations` | `includeArchived?` | `{ items }` |
| `list_entries` | the core's `entries.list` input; `limit` 1–999, default 500 | `{ items, truncated }` |
| `get_entry` | `id` | the entry, with its names |
| `list_templates` | none | `{ items }` |
| `get_template` | `id` | the template |
| `list_history` | `before?`, `limit?` (1–200, default 20) | `{ items }`, batch summaries |
| `get_batch` | `batchId` | the batch with its changes |
| `change` | `label`, `operations` | `{ batchId, results, warnings }` |
| `undo` | `batchId` or `changeIds` | `{ batchId, reverted, warnings }` |
| `redo` | `batchId` or `changeIds` | `{ batchId, reverted, warnings }` |

**`list_entries`** asks the core for one row past `limit` and answers `truncated:
true` when there were more, so the agent narrows the range; there is no cursor. The
filters are `entries.list`'s: `from`, `to`, `projectId`, `customerId`, `running`,
`activityId`, `locationId`, `text`, `startedIn`, `order`.

**`list_history`** gives each batch without its changes: `id`, `label`, `actor`
(`ui`, `agent`, `system`), `createdAt`, `changeCount`, `undoneChanges`, `undone` and
`undoneBy`. **`get_batch`** adds `changes`, each `id`, `entity`, `entityId`, `op`,
`before`, `after`, `undone` and `undoneBy`; those ids are what `undo` and `redo`
take. An unknown or another user's batch is `not_found`.

### `change`

`label` is the batch's label in History (trimmed, 1–200 characters, the core's own
check). `operations` is 1 to 1000 `{ command, input, as? }`, run in order through
`core.batch` as **one batch**: all of it is stored or none, and one `undo` of the
returned `batchId` reverts it all. `command` is one of the 26:

- `customers.create|rename|archive|unarchive`, and the same for `projects`,
  `activities` and `locations`;
- `entries.create|update|delete|fromTemplate`;
- `timers.start|stop`;
- `templates.create|update|delete|fromEntry`.

`input` is that command's input as the core takes it; the tool's description lists
each command's input as JSON Schema. Undo and redo are not commands of `change`; they
are their own tools.

**References.** An operation may name its result with `as` (letters, digits, `_` and
`-`, 1–40 characters, unique in the call). A later operation may give `{ "ref":
"<name>" }` in place of an id in `id`, `customerId`, `projectId`, `activityId`,
`locationId`, `entryId` or `templateId`, and it is replaced with the named result's
`id` before the command runs. Nothing else in an input is rewritten. A ref to a name
no earlier operation defines, or a name used twice, is refused `invalid` before
anything runs, with the operation's index. So one call can create a customer, its
project and the entries on it:

```json
{
  "label": "Set up Globex",
  "operations": [
    { "command": "customers.create", "input": { "name": "Globex" }, "as": "globex" },
    { "command": "projects.create", "input": { "customerId": { "ref": "globex" }, "name": "Portal" }, "as": "portal" },
    { "command": "entries.create", "input": { "projectId": { "ref": "portal" }, "start": "2026-10-19T09:00", "end": "2026-10-19T10:30", "timeZone": "Europe/Budapest" } }
  ]
}
```

`results` holds each operation's returned row, in order; `warnings` the core's
warnings of every operation (`overlap`, `long`). When the operations changed nothing
(renaming to the same name), no batch is stored: `batchId` is null and `message`
says "Nothing changed.".

### `undo` and `redo`

The core's `{ batchId } | { changeIds }`, exactly one of the two, as on History: each
call is one new batch (`Undo "<label>"`, `Redo <n> changes`). `reverted` is
the array of the reverted change ids. The `batchId` answered is the user's newest
batch after the call, which is the one just written: a user's batch times strictly
increase and the handler runs without awaiting from the revert to the read, so it is
exact (the core's `undo` and `redo` return no batch id, hence the read).

## Limits

- One `change` is at most 1000 operations; `list_entries` at most 999 rows (the extra
  row stays within the core's 1000); `list_history` at most 200 batches.
- A request body is at most adapter-node's `BODY_SIZE_LIMIT`, 512 KB by default, which
  1000 entries with ordinary descriptions fit. An import is sent in month-sized calls.
- No rate limit, token scopes or expiry: revoking on Account is the control.

## Connecting an agent

Make a token on Account under Agent access, copy it (it is not shown again), then, for
Claude Code:

```
claude mcp add --transport http time-keep https://<host>/mcp --header "Authorization: Bearer tk_…"
```

Any MCP client that speaks Streamable HTTP and sends a fixed header connects the same
way. A client that takes only OAuth cannot connect (decision 6).
