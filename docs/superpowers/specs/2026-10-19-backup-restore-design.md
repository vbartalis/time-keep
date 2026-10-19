# Phase 8, backup and restore — design

Date: 2026-10-19. Roadmap item 8. Written without the operator under the continuous
development experiment (operator, 2026-10-18); every choice not taken from the vision,
the roadmap, decisions 1–6, `docs/core.md`, `docs/app.md`, `docs/mcp.md` or the
earlier specs is marked **(call)**.

## Intent

The vision's hosting section: "Backup and restore are admin-only actions, through a
backend admin UI if the stack has one, otherwise through buttons in the app." The stack
has no backend admin UI (decision 1 chose SvelteKit over PocketBase, whose admin app the
operator liked mainly for backups), so this is buttons in the app. Decision 1 named the
cost: "building user management and backup and restore, both small."

The app holds years of the operator's time data once phase 9 imports Kimai, in one
SQLite file on a Coolify volume. The operator never touches containers or files by hand
(the Docker rule); the app is the only way the data leaves the server or comes back.

Roadmap exit: a backup taken from the app restores into it, and only the admin can do
either.

## Goals

- An admin downloads a backup of the whole database from the app: every user, all
  time data, all history.
- An admin uploads a backup and the app's data becomes the backup's, as one step that
  either completes or changes nothing.
- A restore from a mistake is recoverable through the app: the data as it was just
  before the last restore can be downloaded too **(call)**.

## Non-goals

- Scheduled or automatic backups, backups kept on the server, a list of them, or
  sending them anywhere (S3, e-mail) **(call: the vision asks for actions through
  buttons; the operator downloads and keeps the file; Coolify's own volume backups are
  the operator's to configure in phase 9)**.
- Per-user export or import, or restoring one user's data, or merging a backup into
  the current data **(call: admin-only, whole-instance; the vision keeps importers out
  of scope)**.
- Backup and restore through the MCP server **(call: admin actions, outside the time
  data; decision 6's tokens act as a user on that user's data)**.
- Encryption of the backup file **(call: it holds what the volume holds; the admin
  keeps it safe)**.
- Recording a restore in the history **(call: the restore replaces the history itself;
  it cannot be a batch in it)**.

## Anti-goals

- A restore that leaves the database half old, half new, or unusable.
- A restore that locks every admin out.
- A non-admin, or anyone signed out, reaching a backup's contents or starting a
  restore.
- Any docker, shell or file step in the operator's path.

## The backup

- **Contents:** the whole SQLite database, as a SQLite file, taken consistently while
  the app runs **(call: the database is the format; no JSON export to maintain against
  the schema)**. It includes users with their password hashes, history, and the
  `__drizzle_migrations` table that says which schema version it is. Sessions and
  access tokens are left out **(call: a backup carries no credential that opens the
  running app, and a restore must not revive a revoked token)**.
- **How:** `VACUUM INTO` a temporary file next to the database (in the directory of
  `DATABASE_PATH`), with the `session` and `access_token` rows deleted from that copy,
  streamed to the admin and then removed **(call; the builder may use better-sqlite3's
  `backup()` or `serialize()` instead if the result is the same consistent file)**.
- **Download:** `GET /admin/backup/download`, `Content-Type: application/vnd.sqlite3`,
  `Content-Disposition: attachment; filename="time-keep-2026-10-19-1432.db"`, the date
  and time in the admin's zone (the `tz` cookie, as elsewhere) **(call)**. Anyone not
  an admin gets what `requireAdmin` gives today (a signed-out user is redirected to
  `/login`, a signed-in non-admin gets 403).

## The restore

An admin uploads a file and ticks a box confirming that it replaces every user's data
**(call: a confirm checkbox in the same form rather than a second page step, because a
file cannot be carried to a second step without JavaScript)**. The form posts
`multipart/form-data` to the screen's `?/restore` action.

The server, in order:

1. **Writes the upload** to a temporary file next to the database and opens it on its
   own connection. Every temporary file is removed when the action ends, refused or
   not.
2. **Checks it** and refuses with a message, changing nothing, when:

   | Condition | Message |
   |---|---|
   | No file, or an empty one | Choose a backup file. |
   | The box is not ticked | Tick the box to confirm the restore. |
   | Not a SQLite file, `PRAGMA integrity_check` not `ok`, or no `__drizzle_migrations` table | This file is not a time-keep backup. |
   | A migration recorded in it that this app does not have | This backup is from a newer version of time-keep. |
   | After step 3, its tables and columns differ from the running database's | This file is not a time-keep backup. |
   | After step 3, no user who is an admin and not disabled | This backup has no admin who can sign in. |
   | After step 3, `PRAGMA foreign_key_check` reports a row | This file is not a time-keep backup. |

3. **Brings it up to date**: runs the app's migrations on the temporary copy, so a
   backup from an older version restores into the current schema **(call)**.
4. **Keeps the current data**: writes the running database to
   `<directory of DATABASE_PATH>/time-keep.before-restore.db` the same way as a backup
   (sessions and access tokens stripped), replacing the previous one **(call: one
   copy, the last restore's)**.
5. **Copies it in** on the app's own connection: attach the temporary copy (SQLite
   refuses `ATTACH` inside a transaction, so before it), then in one transaction
   delete every row of every table in the running database and insert every row of
   every table from the copy except `session` and `access_token` (`sqlite_sequence`
   too, if present, so counters carry forward), then detach.
   Foreign keys are deferred for the transaction (`PRAGMA defer_foreign_keys = ON`).
   Any error rolls the whole transaction back and the action answers "The restore
   failed; nothing was changed." **(call: copying rows rather than swapping the file
   keeps the one connection and the database file in place, so requests in flight, the
   WAL and a second connection such as the browser tests' seed are never left on a
   replaced file)**.
6. **Signs everyone out**: the copy holds no sessions and no access tokens, so every
   user, the restoring admin included, signs in again with the backup's passwords, and
   agents need new tokens **(call)**. The action redirects to `/login?restored=1`,
   where the login screen shows "Restored. Sign in with the backup's passwords."
   **(call)**.

The first admin from the environment is created only while no admin exists (phase 1);
step 2's admin check means a restore never relies on that.

## The screen

`/admin/backup`, admin only (`requireAdmin`), titled **Backup**, in the PC rail after
Users with Lucide `database-backup` (or `database` if that icon is missing), and not in
the phone's bar **(call: an occasional PC task; the URL works on the phone)**. Three
sections, top to bottom:

- **Backup.** One line: "A backup is the whole database: every user, their time data
  and history. Keep it somewhere safe; it holds password hashes." A **Download backup**
  button (a link styled as the primary button, to the download route).
- **Restore.** "Restoring replaces every user's data with the backup's and signs
  everyone out." A file input labelled **Backup file** (`accept=".db"`, not required
  by the browser so the server's message shows), a checkbox **Replace all data with
  this backup**, and a **Restore** button in the destructive style. A refusal shows
  under the form as the screen's alert, as on Users.
- **Before the last restore.** Only when `time-keep.before-restore.db` exists: "The
  data as it was just before the last restore, <date time in the admin's zone>." and a
  **Download** outline button to `GET /admin/backup/download?before-restore=1`, served
  with the file name `time-keep-before-restore-<that date and time>.db`. Restoring it
  is an ordinary restore of that file.

Without JavaScript everything works: the download is a link, the restore a plain
multipart form. With JavaScript the form may use `use:enhance`, but a successful restore
still ends on `/login?restored=1`.

## Limits

- adapter-node refuses a body over `BODY_SIZE_LIMIT` (512 KB by default) before the
  action runs. The image sets `BODY_SIZE_LIMIT=100M` **(call: years of entries and
  their history fit far below it)**, and the browser tests' web server sets the same.
  A larger upload gets adapter-node's own 413 page **(call)**.
- `/mcp` keeps its documented 512 KB cap by counting the request body's bytes as it
  reads them (a chunked body has no `Content-Length`) and answering 413 above it, so raising the global limit does not change `docs/mcp.md`'s
  contract **(call)**.
- A restore runs synchronously inside one transaction; other requests wait the few
  hundred milliseconds it takes **(call: no maintenance mode)**.

## Where it lives

- `src/lib/server/backup.ts` **(call)**: `writeBackup(db, file)` (the cleaned copy),
  `restoreBackup(db, uploadFile, { beforeRestoreFile })` returning `{ ok: true }` or `{
  ok: false, message }`, and `beforeRestoreInfo(file)` (exists and its time). The
  route files only parse the request and call these.
- `src/routes/(app)/admin/backup/+page.server.ts`, `+page.svelte`, and
  `download/+server.ts`.
- `src/lib/server/db/migrate.ts` gains a way to run the migrations on a given
  connection (it already takes a `DB`) and to list the app's migrations for step 2's
  newer-version check (`drizzle/meta/_journal.json`'s entries, compared by hash or
  `created_at` against `__drizzle_migrations`; the builder chooses which).
- The login screen reads `restored`.

## Tests

- **Unit** (`backup.test.ts`, on real files in a temporary directory): a backup holds
  every table's rows except sessions and tokens, and opens as SQLite; a round trip
  (back up, change data, restore) gives back the backed-up rows exactly, ids and
  history included; a restore deletes every session and token; each refusal in the
  table, and after each the running database is unchanged and no temporary file is
  left; an older backup (made at an earlier migration) is migrated and restored; a
  failure inside the copy (forced) rolls back; the before-restore file holds the data
  from just before.
- **Browser** (phone and PC): a non-admin gets 403 on `/admin/backup` and its download;
  the admin downloads a backup, makes a change, restores the backup, lands on the
  login screen with the message, signs in, and the change is gone; a refusal (no box
  ticked) shows its message and changes nothing; the before-restore section appears
  after a restore and its download is a SQLite file. The restore signs out every
  session, so these tests sign in afresh after it and nothing later relies on a
  session from before it.

## Docs

- `docs/app.md`: the Backup screen and its routes, the layout rows for `backup.ts` and
  the route, `BODY_SIZE_LIMIT` in the environment table and the image, the navigation,
  the login screen's `restored` message, the tests.
- `docs/mcp.md`: the 512 KB cap now enforced by `/mcp` itself.
- A decision record, 7: backups are the whole SQLite file, restored by copying its rows
  into the running database in one transaction.
- `DESIGN.md`: the file input and the confirm checkbox, through impeccable's document
  step if it is used, else edited directly and the sidecar noted stale.
- `docs/roadmap.md`: phase 8's done note.

## Left to the builder

The temporary file names, how the upload is streamed to disk, the exact SQL that lists
tables and columns for the schema comparison, the icon if `database-backup` is
missing, and the test fixtures for an older backup.
