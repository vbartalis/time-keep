# 3. Accounts are the app's own, with server-side sessions

- date: 2026-10-18
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

Users sign in with a username and password held by the app, hashed with argon2id.
Sessions are server-side rows in SQLite keyed by the hash of a random token, carried
in an httpOnly cookie. The first admin is created from the environment while no admin
exists. The admin flag is fixed at creation. Users are disabled, never deleted.

## Why

The app owns every write (decision 1), so identity lives in the same database and
needs no external service; there is no email, so no reset flow, and an admin sets
passwords. Server-side sessions can be revoked at once on disable or password change,
and a stolen database holds no usable tokens. Disabling instead of deleting keeps
every entry attributed, so nothing is lost.
