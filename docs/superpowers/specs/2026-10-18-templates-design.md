# Phase 2c, templates — design

Date: 2026-10-18. Roadmap item 2c. Written without the operator under the continuous
development experiment (operator, 2026-10-18); every choice not taken from the vision,
the roadmap or decisions 1–4 is marked **(call)**.

## Intent

The vision's first principle is fast capture: "a new entry is a template tap and a
typed description, not a form." A template is a saved entry with any field left blank,
where a duration may stand in for the end. The phone taps one and types only what it
left blank; an entry can be saved as a template. The operator's real entries make the
shapes concrete: the same customer, project, place and activity day after day, often
the same standard hours. This part adds templates to the core, and the one command that
turns a template plus what was typed into an entry, through the same rules, timers,
warnings and history as any other entry.

## Goals

- Templates in the core: create, edit, delete, list, get; recorded and undoable.
- `entries.fromTemplate`: a template plus the typed fields become an entry (or a
  running timer), in one batch.
- `templates.fromEntry`: save an entry as a template.

## Non-goals

- Screens (phases 4, 5), sharing templates between users (out of scope), suggested or
  "recent" templates (rejected in discovery for user-saved templates).

## Anti-goals

- A second way to make entries: `fromTemplate` goes through 2b's entry creation, so
  every entry rule, timer rule and warning applies unchanged.

## Decided

### The template

| Field | Stored as | Notes |
|---|---|---|
| `name` | text, required | trimmed 1–100, unique per user (Unicode case-insensitive, as 2a) **(call)** |
| `customerId` | text, nullable | the user's customer |
| `projectId` | text, nullable | the user's project; if `customerId` is also set, the project must be that customer's **(call)** |
| `activityId`, `locationId` | text, nullable | the user's |
| `startTime` | text `HH:mm`, nullable | a local time of day **(call)** |
| `endTime` | text `HH:mm`, nullable | a local time of day; needs `startTime` (`invalid` `An end time needs a start time.`) and excludes `durationMinutes` **(call)** |
| `durationMinutes` | integer, nullable | 1 to 2 628 000 as in 2b |
| `timeZone` | text, nullable | IANA; when blank, the zone given at use **(call)** |
| `reference` | text, nullable | ≤200, as entries |
| `description` | text, nullable | ≤2000, as entries |

Plus `id`, `userId`, `version`, `createdAt`, `updatedAt`. Every field but `name` may be
blank. Templates are the user's own conveniences, not reference data: they can be
deleted (recorded and undoable) and have no archive **(call)**. A template may point
at archived references; entries allow them too (2b).

### Commands

- `templates.create`, `templates.update` (partial, `expectedVersion`, any field may be
  set to null), `templates.delete`, `templates.list` (sorted by name, with the
  referenced names), `templates.get`.
- `templates.fromEntry({ entryId, name })`: a template with the entry's project, its
  customer, activity, location, reference, description and zone, and its times as
  local `startTime` and `endTime` in the entry's start zone when it ends on the same
  local day, otherwise `startTime` and `durationMinutes`; a running entry gives no end
  **(call)**.
- `entries.fromTemplate({ templateId, date?, start?, timeZone?, end?,
  durationMinutes?, endTimeZone?, projectId?, activityId?, locationId?, reference?,
  description? })`: every given field wins over the template's **(call)**. Then:
  - Zone: the given `timeZone`, else the template's; neither → `invalid` with
    `fields.timeZone` `Pick a time zone.` (the phone sends the device's zone; a
    template's own zone only applies when none is sent) **(call)**.
  - Start: the given `start` (2b's input forms); else the template's `startTime` on
    `date` (`YYYY-MM-DD`, default today in the zone) read as a local time; else, when
    an end or duration is known, the end is now and the start is now minus the
    duration, since a tap usually logs work just done; else now, as a running timer
    **(call)**.
  - End: the given `end` or `durationMinutes`; else the template's `endTime` on the
    start's local date, the next day when it is not after the start; else the
    template's `durationMinutes`; else none, which makes it a running timer **(call)**.
  - A resolved running start in the future (a start-time-only template tapped before
    its time) is refused by 2b's future limit; the caller can send a `start`
    **(call)**.
  - A given `description` or `reference` replaces the template's; it is not appended
    **(call)**.
  - Project: the given one, else the template's. A template with only a customer and
    no project needs a project at use: missing → `invalid` with `fields.projectId`
    `Pick a project.`; a given project must belong to the template's customer when it
    has one **(call)**.
  - The entry is created through 2b's entry creation in the same batch, so timer
    auto-stop, the future limit, rules and warnings all apply.
- Labels: `Create template "<name>"`, `Edit template "<name>"`, `Delete template
  "<name>"`, `Save entry as template "<name>"`, `Create entry from template "<name>"`
  (or `Start timer from template "<name>"` when the result is running).

### Data and docs

- A `template` table and migration; `template` added to `Entity`, `SHAPES` (1) and the
  write path's table map; unique `(user_id, name_key)`; per-write rule for references,
  the project–customer match, the end/duration exclusion and the `HH:mm` format.
- `docs/core.md` gains templates; no new decision record.

## Exit

Templates are created, edited, deleted, listed, saved from entries and used to make
entries and start timers through the core, each recorded and undoable, with every
entry rule applying to entries made from templates; check, lint and all tests pass.

## Left to the builder

Module layout, zod schemas, exact messages beyond those given, test helpers.
