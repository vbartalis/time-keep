# Product

<!-- impeccable:product-schema 1 -->

Written 2026-10-18 from `docs/vision.md`, `docs/roadmap.md` and the discovery notes,
without an interview: the operator told the session to make design calls in their
place. Facts marked **(inferred)** are calls drawn from those documents, not answers
the operator gave.

## Platform

web

An installable web app reached through its own domain from a phone and a PC. A native
app is decided later (decision 1); nothing here assumes one.

## Users

One person tracking their own work time: a consultant and developer who works for
several customers, sometimes three companies deep (CompA, through them for CompB, on
ProjC), and fills monthly Excel sheets from the result. There is also an admin, created
from the environment, who manages accounts; in practice the same person **(inferred)**.

Two situations, one user:

- **Phone, in the moment:** between tasks, at the client, in a café. Start or stop a
  timer, log an entry from a template with one typed description, fix today. Seconds,
  one hand, often standing **(inferred)**.
- **PC, at the desk:** organising reference data, correcting and rewording entries in
  bulk, month-end tables. Minutes to an hour, keyboard and mouse.

## Product Purpose

time-keep replaces Kimai for one person's way of working: quick to capture on the
phone, comfortable to organise on the PC, and every change can be undone. Success is
the operator tracking time here instead of Kimai, with years of Kimai data imported.

## Positioning

Built for exactly one way of working, with a full change history: every create, edit,
archive and delete is recorded and any batch, including an agent's month-end tidy-up,
is one undo. Kimai has invoicing and no undo; this has undo and no invoicing.

## Operating Context

- Entries are intervals (start and end with their time zone), entered as start + end
  or start + duration. Overlaps warn, never block. An entry belongs to the day it
  started; several timers may run at once.
- Reference data is two levels, customer › project, plus activities and locations;
  finished ones are archived, never deleted.
- Templates are partial entries; a new entry from a template asks only for the blanks.
- An MCP server lets agents do bulk entry, rewording and the Kimai import through the
  same API; their changes appear in the same history.
- Output: reports, a month copy-out that pastes into Excel with columns chosen at
  output time, CSV, rounding to 5 minutes on output only.
- Formats: English, 24-hour clock, ISO dates (2026-10-18), weeks start on Monday.

## Capabilities and Constraints

- Built today: sign-in, account (change password, agent access), admin user
  management and backup, the core (entries, timers, templates, reference data, history,
  undo), the MCP server, and the screens Today, Entries, Edit entry, Setup, Templates,
  History, Copy-out and Reports, inside the shell with its always-visible timer bar.
- Next, in order (roadmap items 12-15): starting timers and the entry form, the
  calendar views, the table, and every screen redone in the shell's direction with the
  sign-in page.
- SvelteKit with server-rendered forms; screens work without JavaScript where they do
  today **(inferred as a standing constraint)**.
- Tailwind and shadcn-svelte, components copied into the repo (decision 2).
- No external hosts at runtime: fonts and assets are self-hosted **(inferred)**.
- Out of scope: invoicing, offline mode, built-in importers, sharing between users.

## Brand Commitments

The name is `time-keep` (shown as "Time Keep" in the page title). No logo, mascot or
marketing voice exists, and none is wanted for a one-person tool **(inferred)**.

It looks and is laid out like Kimai, with the calendar apps' colour by project
(decision 9). There is no themed concept: no world, mascot or motif laid over the tool
(the operator stand-in's call, 2026-10-20).

## Evidence on Hand

Real entry shapes from the operator (`.claude/memory/brainstorm-context-beyond-the-vision.md`):
consulting CompX through them for ClientY on ProjectZ with a ticket number; myself,
project X, from y to z at a café; CompX, project Y, for Z hours. No screenshots,
testimonials or usage data exist; none may be invented.

## Product Principles

1. **Fast capture.** A new entry is a template tap and a typed description, not a form.
2. **Nothing is lost.** Every change is recorded and can be undone, singly or as a batch.
3. **One set of rules.** The UI and agents use the same API and validation.
4. **Store exactly, present flexibly.** Rounding, durations and layouts happen on output.
5. **The tool disappears.** It is used dozens of times a day for seconds at a time; it
   should never ask for attention it has not earned **(inferred)**.

## Accessibility & Inclusion

No product-specific requirement was stated. WCAG 2.2 AA contrast and keyboard access
as a floor; touch targets of at least 44 px on the phone **(inferred)**.
