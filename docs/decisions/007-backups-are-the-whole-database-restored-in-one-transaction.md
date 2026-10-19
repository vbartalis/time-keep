# 7. Backups are the whole database, restored in one transaction

- date: 2026-10-19
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

A backup is the whole SQLite database as one file, without its sessions or access
tokens. A restore checks the upload (a SQLite file of this app's schema, not from a
newer version, with an admin who can sign in), migrates it to the current schema,
keeps the data as it was just before in one before-restore copy, and copies every row
into the running database in one transaction on the app's own connection, which signs
everyone out. A failed restore changes nothing. Only an admin can do either.

## Why

The database is the format, so there is no export format to keep in step with the
schema and a backup carries its own migration history, which tells a newer backup from
an older one. Drizzle's own journal table is neither compared nor copied: its DDL text
belongs to drizzle-orm, and once the upload is migrated both sides hold the same set. Copying rows, rather than
swapping the file, leaves the connection, the WAL and the file in place for requests
in flight. Credentials never travel in a backup, so a backup opens nothing on the
running app and a restore cannot revive a revoked token.
