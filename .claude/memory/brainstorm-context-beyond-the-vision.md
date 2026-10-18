---
name: brainstorm-context-beyond-the-vision
description: What the 2026-10-18 discovery conversation settled or rejected that docs/vision.md does not record — read before brainstorming features
metadata:
  type: project
---

The 2026-10-18 discovery session produced `docs/vision.md`. This is the reasoning and
the rejected alternatives behind it, which the vision omits.

**Kimai, concretely.** Dislikes: invoicing (unneeded), no history or Ctrl+Z, managing
new entries and small things is fiddly, weak on the phone. "Not exactly to my needs"
because someone else builds it. Years of Kimai data exist; import is an agent job.

**Real entry shapes the operator gave** (the model must keep these one or two taps):
- consulting CompX, through them for ClientY, on their ProjectZ, taskA for their
  client B, plus a description, at a standard timeframe (support-ticket case,
  three companies deep)
- myself, project X, from y to z, at a café, doing A
- CompX, project Y, for Z hours, doing A (start + duration)
- CompX, through them for CompY, doing Z from A to B, at the client
Research and development work is two deep; support tickets are three.

**Alternatives considered and rejected:**
- A variable-depth "engagement" chain (CompX › ClientY › ProjectZ › ClientB). The
  operator chose flat customer › project with the chain in the project name
  (`CompA` › `CompB – ProjC`) as simpler. Cost accepted: "everything for CompB" is a
  name filter, not a grouping.
- Duration-only entries: rejected; always an interval. Start + duration is an input
  form only.
- "Recent engagements" and "repeat last entry": replaced by user-saved templates
  that may be partial.
- Shared reference data between users: not for now.
- Offline mode: "nice but could overcomplicate things".
- A fixed export to the Excel sheets: the sheets are custom and differ; the operator
  calls copy-out "the least concern and the easiest part".
- PocketBase: seen in Beszel (a separate admin app next to the UI, used mainly for
  backups). Liked for convenience, not a requirement; lost to TypeScript end to end
  (decision 1) because its generic CRUD API fights a single history-recording write
  path.

**What the Excel sheets usually need:** start and end (sometimes only a duration),
task, place, project, and for support work the ticket and the end client.

**MCP intent:** bulk adding, reorganising, rewriting and tidying a month at
month-end; the Kimai import goes through it. This is why batch undo matters most.

**Usage pattern:** phone for really easy access (quick capture); PC for tedious work
(organising, month-end tables). Hosted as a container on Coolify.

**Settled small things:** overlaps allowed with a warning; several timers may run;
starting on a project stops that project's timer; rounding to 5 minutes on output
only; GDPR is a non-issue (fully internal, do not raise it); GPS is planned, not v1.
