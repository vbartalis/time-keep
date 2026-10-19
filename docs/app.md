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
| `src/routes/(app)/` | Signed-in screens: Today (`/`), the entry edit screen (`entries/[id]`), `account`, `admin/users`, `setup`, and `templates`, `templates/new`, `templates/[id]` (see Screens). The layout requires a user and draws the shell: a left rail on the PC (Today, Templates, Setup, Account, Users for an admin), a top bar and bottom navigation on the phone (Today, Setup, Account, Users for an admin; Templates is a PC screen). |
| `src/lib/server/screens/` | Server logic behind the screens, unit-tested: zone resolution (`zone.ts`), today's range and the `HH:mm` / `YYYY-MM-DD` formats (`today.ts`), form input for the core (`actions.ts`, `edit.ts`), the flash cookie and undo lookup (`flash.ts`), the safe return path for forms (`back.ts`), the Setup tree (`setup.ts`), the template form's input and pickers (`templates.ts`). |
| `src/lib/components/templates/` | The template form shared by the new and edit screens. |
| `src/lib/components/setup/` | The Setup screen's parts: a rename-in-place row, the add lines, the Add project disclosure. |
| `src/lib/components/today/` | The Today screen's parts: timers, template sheets, start a timer, today's entries, the ticking elapsed time. |
| `src/lib/components/UndoStrip.svelte` | The undo strip every screen shows after an action; posts to `/undo`. |
| `src/routes/(app)/undo/` | The shared `/undo` route: `core.undo`, then back to the screen it came from. |
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
enhances them. A successful action redirects (303) back to the screen it was posted
from (Today, `/setup`, `/templates`), with the undo strip. No browser dialogs.

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
says "Customers and projects are set up on the PC." with a "Set up customers and
projects" link to `/setup` when there are no projects, and Templates says "Templates
are set up on the PC." with a "Create a template" link to `/templates/new` when there
are none; the Templates head always links "Edit templates" to `/templates`. A refused
action re-renders the form it came from with the core's field messages beside the
fields; a message that belongs to no shown field is shown under the fields (the
template sheet, the edit form) or beside the action; the template sheet and the edit
form focus the first refused field.

### Setup (`/setup`)

Customers and projects, activities and locations on one screen (a second column for
activities and locations from 1280 px). Customers are heavy lines with their projects
indented on hairlines beneath; each line has Rename and Archive (Unarchive when
archived), a customer also Add project. Rename opens in place (a `<details>` with the
name, Save and Cancel; one open at a time) and sends `rename` with the row's
`expectedVersion` (a rename to the same name stores no batch and returns without a strip). Archive and Unarchive are one press, undone from the strip. Each
region ends with an add line (Add project opens one under its customer). Archived rows
are hidden unless the "Show archived" link (`?archived=1`) is on, and then show struck
through with an `Archived` badge; an archived customer lists all its projects, an
active one with none active says "No active projects.". Every action is one core call
(`create`, `rename`, `archive`, `unarchive`, with `kind` customer, project, activity
or location) and returns to `/setup` (or `/setup?archived=1`, as posted) with the
strip. A refusal re-renders the form that was posted, open, with the posted name and
the core's message beside the field, focused; a stale version shows the message with a
Reload link on that row; any other refusal (unarchiving a project under an archived
customer) shows on the row. `setupTree` (`screens/setup.ts`) shapes the tree from the
core's lists read with archived rows included.

### Templates (`/templates`, `/templates/new`, `/templates/[id]`)

`/templates` is a ruled table sorted by name: name (a link to its edit screen),
customer › project, activity, location, times (punched) and a printed Timer or Log
mark as on Today; the phone keeps name, times and mark (customer › project under the
name) and the narrower PC widths drop activity and location. "New template" is the one
primary button; with no templates the page says "No templates yet." beside the same
button. The undo strip shows after a save or delete.

`/templates/new` and `/templates/[id]` share one ruled form: name, customer, project,
activity, location, start time, end time, duration in minutes, time zone (a text field
with the browser's zones as a `<datalist>` filled by script; blank means the device's
zone at use), reference, description. The pickers list active rows plus the template's
current archived ones marked "(archived)". With JavaScript, choosing a project sets its
customer and choosing a customer lists only its projects; without it both are sent as
chosen. `templateInput` (`screens/templates.ts`) shapes the post for the core: the name
as posted, every other field trimmed with blank sent as `null` (which clears it on an
update), and a project with no customer sent with the project's customer. Save sends
`templates.create`, or `templates.update` with every field and the form's
`expectedVersion`, and returns to `/templates` with the strip. Refusals re-render the
form with the posted values and the core's messages beside the fields (a message for
no shown field goes under the form), focusing the first refused field; a stale version
shows the message with a Reload link; a save that changed nothing returns without a strip. Delete asks on the page ("Yes, delete it" /
"Keep it"), then sends `templates.delete` with the version; a template deleted
elsewhere says so with a link back to the list, and a missing one is a 404. The shell's
Templates item stays current on both sub-routes.

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

A "Save as template" disclosure under the form (a name field and an outline Save
template button) sends `templates.fromEntry({ entryId, name })`. On success it goes to
`/templates` with the strip, so the new template is in view. A refusal (a duplicate
name) re-renders the disclosure open, by attribute so it also works without
JavaScript, with the posted name and the message beside the field, which takes the
focus.

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
cookie (`flash`, 60 seconds, capped in size) and redirects; the screen it lands on reads
and clears it. The strip says "Done: <batch label>." with an Undo button for that batch, the
user's newest batch right after the action (`flashAfter`), so it is the right batch
across the redirect. The strip (`UndoStrip`, shared by every screen) posts to the
one `/undo` route with the batch and a `back` path (checked by `safeBack`: a path on
this site, else Today); undo calls `core.undo({ batchId })`, and the redirect back
shows "Undone.". A refused undo (for example of "Create customer" once a project
was added under it) sets the flash's `error` to the core's message instead: the strip
is then an alert showing that message in red, with the same Undo button kept, so the
refusal is seen on the screen the user was on. A GET of `/undo` redirects to Today.
The strip lasts until the next load. The core's warnings for the action
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
  runs. `phone.test.ts` covers Today, the edit screen, Save as template, undo and the
  no-JavaScript posts; `setup.test.ts` covers Setup (create, rename, duplicates,
  archive and unarchive, a refused undo, a stale rename), Templates (create, edit,
  delete and undo, an archived project, a stale save) and their no-JavaScript posts.
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
