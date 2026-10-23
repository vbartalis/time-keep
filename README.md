# time-keep

A personal time tracker, built to replace Kimai for one person's way of working: quick
to capture on the phone, comfortable to organise on the PC, and every change can be
undone. One container, one SQLite file, its own accounts.

The charter is [docs/vision.md](docs/vision.md); the order of the work is
[docs/roadmap.md](docs/roadmap.md).

## What it does

- **Entries** as start and end (or start and duration) on customer › project, with an
  activity, a location, a reference and a description. Overlaps warn, never block.
- **Timers** in a bar on every screen: start, stop and restart; several may run.
- **Calendar**: day, week and month views on phone and PC; on the PC, drag to
  create, move and resize.
- **Entries table**: grouped by day with daily totals, one filter with kept presets,
  search over every field, and bulk edit and delete.
- **Templates** for the entries logged again and again: a tap and a description.
- **History and undo**: every change is recorded; any change, or any batch of
  changes, is undone in one step.
- **Copy-out and reports**: a month as the columns chosen, pasted into Excel or
  downloaded as CSV, rounded to 5 minutes on output only; totals per day, week,
  customer and project.
- **Agents** through an MCP server, as a user, with a bearer token: bulk entry,
  month-end tidying, the Kimai import. Their changes are batches like any other.
- **Admin**: users, and backup and restore of the whole database from the app.

English, 24-hour clock, Monday first, ISO dates. Installable as a web app on the
phone.

## Stack

SvelteKit (adapter-node) and Svelte 5, TypeScript end to end, SQLite through Drizzle
(better-sqlite3), Tailwind and shadcn-svelte, Vitest and Playwright. Node 24.

## Run it locally

Development happens in the devcontainer ([docs/environment.md](docs/environment.md)).

```
npm install
cp .env.example .env    # set ADMIN_USERNAME and ADMIN_PASSWORD
npm run dev
```

Open the address the dev server prints and sign in as the admin from `.env`. The
database is `data/time-keep.db`; delete it to start over. The dev server listens on
every interface, so a phone on the same network reaches it at the Network address.

| Script | Does |
|--------|------|
| `npm run dev` | The dev server. |
| `npm run build` | The production build (`node build` runs it). |
| `npm run check` | Svelte and TypeScript checks. |
| `npm run lint` | Prettier's check and ESLint. |
| `npm run format` | Prettier, writing. |
| `npm run test:unit` | Vitest, against in-memory SQLite. |
| `npm run test:e2e` | Playwright on a production build, at phone and PC sizes. |
| `npm test` | Both test suites. |
| `npm run db:generate` | A migration from a schema change. |

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `DATABASE_PATH` | `./data/time-keep.db` | The SQLite file. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | none | The first admin, read only while no admin exists. |
| `PORT` | `3000` | Listen port. |
| `BODY_SIZE_LIMIT` | `512K` | The largest request; the image sets `100M` so a backup uploads. |
| `PROTOCOL_HEADER`, `HOST_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH` | unset | Behind a reverse proxy; the image sets them. |

Details in [docs/app.md](docs/app.md#configuration).

## Deploy

The `Dockerfile` builds the image; it is deployed on Coolify from this repository.

- Mount a **persistent volume at `/data`**: the database lives there.
- Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` for the first start.
- Serve it on its own domain through Coolify's proxy; the image already reads the
  proxy's headers. The health check is `/healthz`.

Migrations run on start. Backups are taken and restored from the app's Backup screen
(admin only).

## Agents (MCP)

`/mcp` is a Streamable HTTP MCP server with thirteen tools: reads of the reference
data, entries, templates and history, one `change` tool that applies a batch of
operations, and `undo` and `redo`. Make a token on Account under Agent access, then:

```
claude mcp add --transport http time-keep https://<host>/mcp --header "Authorization: Bearer tk_…"
```

The contract is [docs/mcp.md](docs/mcp.md).

## Documentation

| Doc | Covers |
|-----|--------|
| [vision.md](docs/vision.md) | What the app is for and what it is not. |
| [roadmap.md](docs/roadmap.md) | The rounds and items, with a done note for each. |
| [app.md](docs/app.md) | Screens, layout, configuration, tests, image. |
| [core.md](docs/core.md) | The data model and the one write path with its history. |
| [mcp.md](docs/mcp.md) | The MCP server's contract. |
| [DESIGN.md](DESIGN.md) | The look: tokens, components, patterns. |
| [decisions/](docs/decisions/) | One record per real choice. |
| [environment.md](docs/environment.md) | The devcontainer. |
| [autopilot.md](docs/autopilot.md) | How the roadmap is built unattended. |

Commits follow Conventional Commits; see [CLAUDE.md](CLAUDE.md) for the working rules.
