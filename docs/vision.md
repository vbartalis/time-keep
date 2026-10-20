# Vision

time-keep is a personal time tracker: a replacement for Kimai, built for one person's
way of working. Quick to capture on the phone, comfortable to organise on the PC, and
every change can be undone.

This is the charter. Read it before proposing anything; a feature outside it needs
approval.

## Why not Kimai

Kimai is someone else's product. It carries what is not needed here (invoicing), lacks
what is (history and undo), makes entering and correcting small things slow, and is
weak on the phone.

## Principles

1. **Fast capture.** A new entry is a template tap and a typed description, not a form.
2. **Nothing is lost.** Every change is recorded; any change, or batch of changes, can
   be undone.
3. **One set of rules.** The UI and agents go through the same API and the same
   validation; neither can do what the other cannot.
4. **Store exactly, present flexibly.** Stored data is exact; rounding, durations and
   layouts are applied on the way out.

## Users

One person uses it. There is an admin, created from environment variables on first
start, who manages normal users. Each user's data is their own: entries, customers,
projects, activities, locations and templates are per user, never shared.

## The entry

| Field | What it holds |
|-------|---------------|
| Customer › project | Picked. The two-level reference below. |
| Activity | Picked from the user's list (support, development, research, …). |
| Location | Picked from the user's list (office, home office, café, at the client, …). |
| Start, end | Full date and time at both ends, with the time zone they were entered in. |
| Reference | Optional free text, e.g. a support ticket number. |
| Description | Optional free text: what was done. |

- **Time is always an interval.** It is entered as start + end or as start + duration
  (9:00 for 5½ h); both are stored as start and end. An entry may cross midnight and
  last longer than 24 hours.
- **Overlapping entries are allowed.** The app warns, never blocks.
- **An entry belongs to the day it started.** Splitting at midnight is an output
  option, not storage.

## Customers and projects

Two levels, fixed: **customer › project**. A deeper chain lives in the project's name:
working for CompA, through them for CompB on ProjC, is customer `CompA`, project
`CompB – ProjC`.

Customers, projects, activities and locations are reference data, managed in the app.
Finished ones are **archived, never deleted**: they leave the pickers and stay on the
entries that use them.

## Templates

A template is a saved, partially or fully filled entry: any field may be left blank,
and a duration may stand in for the end. An entry can be saved as a template; a new
entry can start from one, and only what the template left blank is typed.

## Timers

An entry without an end is running. Timers run until stopped; several may run at once.
Starting an entry on a project stops that project's running timer.

## History and undo

Every create, edit, archive and delete is recorded with its old and new values, and
kept forever. Changes made together, by one action in the UI or one agent request, form
a batch, and a batch is undone as one step.

## Agents

An MCP server is a first-class client of the same API, for bulk entry, month-end
reorganising and rewording, and importing from Kimai. The import is an agent reading
Kimai's data and creating entries through the MCP; there is no built-in importer.
Agent changes are batches like any other, so a wrong tidy-up is one undo.

## Two surfaces

- **Phone:** quick capture: start a timer, log an entry from a template, fix today.
- **PC:** dense work: organising, bulk edits, month-end.

## Views

The user's entries are seen and worked on in two kinds of view, on both surfaces:

- **Calendar:** day, week and month views, with entries placed on the time they
  cover.
- **Table:** the entries as rows, the way Kimai's timesheet lists them.

## Output

- **Reports:** totals per day, week, customer and project.
- **Copy-out:** a month view that pastes into Excel as columns, plus CSV. Columns
  are chosen at output time (start and end, duration, customer, project, activity,
  location, reference, description); there is no fixed export to any one sheet.
- Rounding to **5 minutes** applies on output only.

Formats: English, 24-hour clock, Monday first, ISO dates (2026-10-18).

## Hosting and administration

One container on Coolify, reached through its own domain from phone and PC. The MCP
server is behind authentication. Backup and restore are admin-only actions, through a
backend admin UI if the stack has one, otherwise through buttons in the app.

## Out of scope

- Invoicing.
- Offline mode.
- Built-in importers.
- Sharing data between users.

## Decided later

- A native mobile app, beside the installable web app (decision 1).
- GPS: an optional reading at start and end, and location suggestions from saved
  places. Planned, not v1.
- The copy-out view's details.
