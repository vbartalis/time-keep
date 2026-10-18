# 4. Every write goes through one recording path

- date: 2026-10-18
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

Every write to the time data goes through the core's one recording write path, which
stores a change row for each write. One call, or one `batch`, is one batch: all of
its changes are stored or none. Undo writes a new batch of reverting changes and
refuses rather than overwrite a later change. Accounts are outside it.

## Why

Nothing is lost: every change can be read back and reverted, whoever made it, and
one set of rules and checks applies to the UI, tests and the agent alike (vision
principles 2 and 3). A second way to write would skip the record and the rules.
Refusing an undo over a later change keeps newer work from being silently destroyed.
