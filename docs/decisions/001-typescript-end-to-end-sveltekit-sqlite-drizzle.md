# 1. TypeScript end to end: one SvelteKit app over SQLite with Drizzle

- date: 2026-10-18
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

time-keep is one SvelteKit application on Node.js 24, written in TypeScript, serving
the UI, the API and the MCP server (official TypeScript SDK) from one process in one
container. Data lives in SQLite on a volume, accessed through Drizzle. Authentication
is the app's own, session-based. The frontend ships first as an installable web app
for phone and PC from one codebase.

## Why

History with batch undo must be the single path every write takes; owning every write
path makes that the design rather than a fence around a framework's generic API, which
PocketBase would require. One language spans UI, API and MCP, and the MCP server uses
the reference SDK in the same process. SQLite fits one user's data and keeps the
deployment to one container. The cost is building user management and backup and
restore, both small.
