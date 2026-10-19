# The app

A SvelteKit 3.1 server (adapter-node 6) over SQLite through Drizzle, TypeScript
throughout (decision 1). The UI is Tailwind and shadcn-svelte (decision 2), dressed as
a punch-clock time card (decision 5); [DESIGN.md](../DESIGN.md) is the visual system
and `PRODUCT.md` the product record it serves. The app owns every write to the
database.

Imports use `#lib` (the `imports` map in `package.json`, `src/lib/*`), not `$lib`.
Hook types come from `@sveltejs/kit/hooks`.

## Layout

| Path | Responsibility |
|------|----------------|
| `src/hooks.server.ts` | `init`: run migrations, ensure the first admin. `handle`: resolve the session cookie into `locals.user` and `locals.session`, renew or clear the cookie. |
| `src/lib/server/db/` | `index.ts` opens SQLite (WAL, foreign keys on) and holds the single `getDb()` instance; `schema.ts` is the Drizzle schema; `migrate.ts` applies `drizzle/` at startup. |
| `src/lib/server/auth/credentials.ts` | Username and password rules, argon2id hashing and verification. |
| `src/lib/server/auth/sessions.ts` | Create, validate, renew and invalidate sessions; the session cookie. |
| `src/lib/server/auth/throttle.ts` | In-memory sign-in throttle. |
| `src/lib/server/auth/bootstrap.ts` | Creates the first admin from the environment. |
| `src/lib/server/users.ts` | User operations: create, list, authenticate, set password, change own password, disable and enable. Returns `Result` values instead of throwing for expected failures. |
| `src/lib/server/guards.ts` | `requireUser` (redirect to `/login`) and `requireAdmin` (403). |
| `src/lib/server/core/` | The only way to read and write the time data: batches, recorded changes, undo, history, reference data. Import only `core/index.ts`. See [core.md](core.md) and decision 4. |
| `src/lib/server/id.ts` | Random base32 ids. |
| `src/routes/login`, `logout` | Sign in and out. |
| `src/routes/(app)/` | Signed-in screens: Today (`/`), the entry edit screen (`entries/[id]`), `account`, `admin/users` (see Screens). The layout requires a user and draws the shell: a left rail on the PC, a top bar and bottom navigation on the phone. |
| `src/lib/server/screens/` | Server logic behind the screens, unit-tested: zone resolution (`zone.ts`), today's range and the `HH:mm` / `YYYY-MM-DD` formats (`today.ts`), form input for the core (`actions.ts`, `edit.ts`), the flash cookie and undo lookup (`flash.ts`). |
| `src/lib/components/today/` | The Today screen's parts: timers, template sheets, start a timer, today's entries, the undo strip, the ticking elapsed time. |
| `src/lib/format.ts` | Formatting shared by server and browser: elapsed time, template times, warning text. |
| `src/routes/layout.css` | Design tokens as Tailwind theme values, light and dark (see DESIGN.md). |
| `src/lib/components/ui/` | shadcn-svelte components, copied in and restyled (decision 2). |
| `static/manifest.webmanifest`, `static/icons/` | The web app manifest and icons (see Installable). |
| `src/routes/healthz` | Health check: `{"status":"ok"}`, or 503 when the database fails a query. |
| `drizzle/` | Generated SQL migrations. |
| `e2e/` | Playwright tests; `seed.ts` seeds their data through the core. |

## Screens

Every screen action is one core call (one batch) through `openCore(getDb(), user.id,
'ui')`; no rule is enforced in a screen, the core's refusals and warnings are shown
as it gives them. Forms are plain posts that work without JavaScript; `use:enhance`
enhances them. A successful action redirects (303) back to Today. No browser dialogs.

### Today (`/`)

In thumb order, one column on the phone (the PC adds a side column):

1. **Timers**: each running entry with its start, the elapsed time (ticking each
   second with JavaScript, the server's value without), customer › project,
   description, and Stop (`timers.stop`).
2. **Templates**: one row per template, opening a sheet (a `<details>` panel, so it
   works without JavaScript) that shows the template's filled fields and asks for a
   description; a reference when the template has none, and a project when it has
   none (from its customer's projects when it has a customer). The button is "Start
   timer" when the result would run, else "Log". "Change times" offers date, start,
   end or minutes. Submits `entries.fromTemplate`.
3. **Start a timer**: an active project, grouped by customer, and an optional
   description (`timers.start`; the core stops a timer already running on that
   project).
4. **Today's entries**: entries whose interval touches today in the user's zone, with
   in, out (or Running), hours, customer › project, "Since YYYY-MM-DD" when it
   started on an earlier day, and description; each row opens
   the edit screen.

Empty states have no dead buttons: Timers says "No timer running.", Start a timer
says "Customers and projects are set up on the PC." when there are no projects, and
Templates says "Templates are set up on the PC." when there are none. A refused
action re-renders the form it came from with the core's field messages beside the
fields; a message that belongs to no shown field is shown under the fields (the
template sheet, the edit form) or beside the action; the template sheet and the edit
form focus the first refused field.

### Edit entry (`/entries/[id]`)

Start and end as `datetime-local` in the entry's own zones (an empty end makes the
entry running), project, activity and location (the active ones plus the entry's
current one, marked archived when it is), reference, description. Save sends
`entries.update` with the form's `expectedVersion`; a save that changed nothing
stores no batch and goes back to Today without a strip. When the entry changed
elsewhere since the form was loaded, the core's message shows with a Reload link
that loads the entry as it is now. Delete asks first on the page itself ("Yes,
delete it" / "Keep it"), then sends `entries.delete` with the version. A missing or
another user's entry is a 404; a save or delete on an entry deleted since the page
loaded says "This entry was deleted elsewhere." with a link back to Today.

### Time zones

The request's zone is, in order: the form's hidden `timeZone` field, the `tz`
cookie, the zone of the user's newest entry of the last month, else UTC
(`screens/zone.ts`). The app layout's script fills every `timeZone` field with the
browser's zone and writes the cookie; when the cookie was missing or stale it reloads
the screen's data once (not while a strip is showing). Today names the zone it uses,
and says when it is only the default. Times are shown in each entry's own zone, as
24-hour `HH:mm` and `YYYY-MM-DD`.

### Done and undo

After a successful action the server stores a flash in a short-lived `httpOnly`
cookie (`flash`, 60 seconds, capped in size) and redirects; Today reads and clears
it. The strip says "Done: <batch label>." with an Undo button for that batch, the
user's newest batch right after the action (`flashAfter`), so it is the right batch
across the redirect. Undo calls `core.undo({ batchId })` and the strip says
"Undone.". The strip lasts until the next load. The core's warnings for the action
(`overlap`: "Overlaps another entry", `long`: "Longer than 24 hours") show in the
strip and as a red mark on that entry's row, for that response only; the core does
not store them.

### Installable

`static/manifest.webmanifest` (name time-keep, `display: standalone`, start URL `/`,
rack ink theme and card stock background) and PNG icons in `static/icons/` rendered
from `icons/mark.svg` (see `icons/README.md`), linked from `src/app.html`. They are
static files, so reachable before sign-in. There is no service worker; offline is out
of scope.

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `DATABASE_PATH` | `./data/time-keep.db` | SQLite file. The directory is created. The image sets `/data/time-keep.db`. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | none | The first admin. Read only while no admin exists; startup fails if there is none and these are unset. |
| `PORT` | `3000` | Listen port. |
| `PROTOCOL_HEADER`, `HOST_HEADER` | unset locally | Where adapter-node builds the request origin. |
| `ADDRESS_HEADER`, `XFF_DEPTH` | unset locally | Where the client address comes from (sign-in throttle). |

There is no `ORIGIN`. adapter-node 6 builds the origin from `PROTOCOL_HEADER` and
`HOST_HEADER`, and takes the scheme as https when no protocol header is set, so form
posts over plain http are refused. Behind a proxy set the headers (the image does).
A local `node build` over plain http needs `PROTOCOL_HEADER=x-forwarded-proto` and a
client that sends `x-forwarded-proto: http`; the e2e does this.

`DATABASE_PATH`, `ADMIN_USERNAME` and `ADMIN_PASSWORD` are declared in `src/env.ts` and
read through SvelteKit's `$app/env/private`, so the dev server picks them up from `.env`
as well as from real environment variables in production. `drizzle.config.ts` reads
`process.env.DATABASE_PATH` directly (drizzle-kit runs outside SvelteKit).

`.env.example` lists the variables.

## Running

```
cp .env.example .env
npm run dev
```

Migrations run and the admin is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD` at
server start in production; the dev server does this lazily on the first request. Other scripts: `npm run build`, `check`, `lint`, `format`.

## Migrations

Change `src/lib/server/db/schema.ts`, then `npm run db:generate` (drizzle-kit
generate) and commit the SQL in `drizzle/`. The app applies pending migrations at
startup. Never use `db:push`; the schema is changed only through reviewed migration
files.

## Tests

- `npm run test:unit` runs Vitest over `src/**/*.test.ts` against in-memory SQLite.
- `npm run test:e2e` runs Playwright (`e2e/`) against a production build served on
  port 4173 with a throwaway database in `test-results/e2e`, in a phone project and a
  PC project.
  `e2e/seed.ts` opens that database on a second connection once the server has
  created and migrated it, and seeds through the core: one user per browser project
  (so the two never share timers or entries), with customers, projects, templates and
  this morning's entries. The browser runs in a fixed-offset zone where it is about
  noon (`noonZone`), so the seeded times are today and in the past whenever the suite
  runs. `phone.test.ts` covers Today, the edit screen, undo and the no-JavaScript
  posts.
- `npm test` runs both.

Chromium needs system libraries and fonts. The devcontainer image installs them, so
after rebuilding the devcontainer `npm run test:e2e` runs as is. Until the rebuild,
unpack the libraries into a user cache and run with `LD_LIBRARY_PATH` and
`FONTCONFIG_FILE` pointing at it.

## Accounts and sessions

Decision 3 is the rule; these are the details.

- Usernames are trimmed and lowercased, 3 to 32 characters of `a-z`, `0-9`, `.`, `_`,
  `-`. Passwords are 10 to 256 characters.
- Passwords are hashed with argon2id. A sign-in for an unknown username still verifies
  against a dummy hash, so timing does not reveal which usernames exist. Failures
  always read "Wrong username or password.", including for disabled accounts.
- The session token is 20 random bytes as base32, sent in an `httpOnly`,
  `sameSite=lax` cookie named `session` (`secure` over https). Only its SHA-256 is
  stored. Sessions last 30 days and are renewed to 30 days on use once under 15 days
  remain.
- Sign-out deletes the session. Changing a password invalidates the user's other
  sessions and keeps the current one; an admin setting a password invalidates all of
  that user's sessions. Disabling a user deletes their sessions, and a disabled user's
  session never validates.
- The sign-in throttle keys on username and client address: 5 failures within 15
  minutes lock the pair for 15 minutes. It is in memory and resets on restart.
- The first admin comes from the environment, only while no admin exists. The admin
  flag is set at creation and has no edit path. Admins create users, set passwords and
  disable or enable anyone except themselves. Users are never deleted. Setting a
  password or disabling an unknown id returns "User not found."

## Image

The `Dockerfile` builds with adapter-node and runs `node build` as the `node` user.
It sets `DATABASE_PATH=/data/time-keep.db`, `PORT=3000`, `PROTOCOL_HEADER=x-forwarded-proto`,
`HOST_HEADER=x-forwarded-host`, `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1`,
which suits one reverse proxy (Coolify's). `/data` is a volume and must be persistent.
The image contains `drizzle/` for startup migrations. The healthcheck calls
`/healthz`. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the deployment environment
for the first start.
