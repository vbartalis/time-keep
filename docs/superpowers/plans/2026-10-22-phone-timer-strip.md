# The phone's timer strip with several timers running Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The phone's timer strip and its "+N" list show every running timer's
customer › project in full at 390 px, in a two-row strip.

**Architecture:** A layout change to the `strip` variant of
`src/lib/components/shell/TimerBar.svelte` (the PC `header` variant is untouched),
plus the two places that size against the phone's sticky top band
(`src/routes/layout.css`'s `scroll-margin-top`, the start sheet's `max-h`), which move
to the measured `--bars-height` the layout already sets.

**Tech Stack:** SvelteKit 2 / Svelte 5, Tailwind 4, Vitest (`svelte/server` render),
Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-phone-timer-strip-design.md`

## Global Constraints

- The strip is two rows whenever a timer runs, the same for one, two or three timers
  ("+N" absent with one). Row 1: live dot, project dot, customer › project (15 px
  semibold), elapsed time (17 px bold) at the right edge on the name's first line.
  Row 2: "activity · since HH:MM" under the name at the left; "+N", ▶, Stop at the
  right, each 44 px, in that order and today's look.
- No timer running: today's one 64 px row ("No timer running" and ▶), unchanged.
- A name never ends in "…": no `truncate`, no ellipsis, no line clamp, no clipping;
  it wraps between words and the strip grows.
- The "+N" list rows show customer › project (not the project alone), wrapping.
- Unchanged: the link to the running entry's form (name and elapsed time, a target
  ≥ 44 px tall), `data-entry-form`, `data-shown-stop`, Stop's form and aria-label,
  the start sheet's content, the strip's colours, the screen reader text, the PC
  header pill.
- Works without JavaScript (CSS layout; `<details>` for "+N" and the start sheet).
- Spacing on the 4 px grid. Every new or changed style uses existing tokens.
- Commits: Conventional Commits, no scope, lowercase imperative, no attribution.

## Review Focus

1. A long customer › project (the spec's gate task 6: "ClientY – ProjectZ – Phase 2
   data migration and reporting") wraps in the strip and in the list, the elapsed time
   stays on its first line, and nothing is cut. Pinned in Task 1's e2e.
2. A timer begun on an earlier day ("since 2026-10-19 22:10") in row 2 beside three
   44 px controls: the text wraps, the controls do not shrink. Pinned in Task 1's unit
   test and e2e.
3. Focus scrolled under the taller band (a wrapped name makes it taller still): a
   focused control lands below the band. Pinned in Task 2's e2e.
4. The start sheet opened with many templates under the two-row strip: its ▶ stays
   visible and closes it without JavaScript. Pinned in Task 2's e2e.
5. The "+N" list's lower edge in dark reads apart from the page below (the stand-in's
   note on the spec). Checked in Task 3's critique.

---

### Task 1: The two-row strip and full names in the list

**Files:**
- Modify: `src/lib/components/shell/TimerBar.svelte` (the `{:else}` strip branch at the
  end, and the `others()` snippet's row name)
- Test: `src/lib/components/shell/TimerBar.test.ts`
- Test: `e2e/shell.test.ts`

**Interfaces:**
- Consumes: `BarTimer` (`src/lib/components/shell/types.ts`), unchanged.
- Produces: in the strip, the shown name's element carries `data-timer-name`; each
  "+N" list row's name carries `data-timer-name` too (both variants). Tasks 2 and 3
  and the gate's checks find names by it.

- [ ] **Step 1: Write the failing unit tests** in `TimerBar.test.ts`, a new
  `describe('TimerBar, the phone strip', …)`:
  - `'shows customer › project in the strip and in every row of +N'`: render
    `variant: 'strip'` with three timers (`CompX`/`ClientY – ProjectZ`,
    `CompX`/`CompY – Support`, `Myself`/`time-keep`); expect the text to contain all
    three `"<customer> › <project>"` strings, and the body to have exactly three
    `data-timer-name` elements.
  - `'never truncates a name'`: same render; every element with `data-timer-name`
    has no `truncate`, `text-ellipsis` or `line-clamp-` in its class (parse with a
    regex over the `<… data-timer-name …>` tags).
  - `'keeps the earlier-day since in the strip'`: one timer with
    `activityName: 'Development', start: '22:10', startDate: '2026-10-19'`; text
    matches `/Development · since 2026-10-19 22:10/`.

- [ ] **Step 2: Run them, expect the first two to fail**

  Run: `npx vitest run src/lib/components/shell/TimerBar.test.ts`
  Expected: FAIL (list rows show the project alone; names have `truncate`).

- [ ] **Step 3: Write the failing e2e** in `e2e/shell.test.ts`, a
  `test.describe('the phone strip', …)` skipped on `pc`, viewport 390 × 844. Seed with
  `seedEmptyUser`, `seedCustomer`, `seedProject` (CompX › ClientY – ProjectZ,
  CompX › CompY – Support, Myself › time-keep) and `startElsewhere` at 08:00, 09:00,
  10:00 (newest shown). A helper `expectWhole(name: Locator)` asserts, via
  `evaluate`: `scrollWidth <= clientWidth`, `scrollHeight <= clientHeight`,
  computed `text-overflow` is not `ellipsis`, computed `-webkit-line-clamp` is `none`.
  Tests:
  - `'one, two and three timers show their whole names'`: start them one at a time
    (reload between); after each, the strip's `[data-timer-name]` has the newest's
    full `"customer › project"` text and passes `expectWhole`; with two and three,
    open "+N" and every list `[data-timer-name]` passes `expectWhole` and has its
    full text. "+N", the start ▶ (`[data-start-list] > summary`) and the shown Stop
    are each 44 × 44 (±0.5) and lie within x ≤ 390; the elapsed time's box top is
    within 4 px of the name's top.
  - `'a long name wraps whole'`: project
    `ClientY – ProjectZ – Phase 2 data migration and reporting`, one timer; the name
    passes `expectWhole`, its box is taller than one line (> 24 px), and the elapsed
    time's top is within 4 px of the name's top. With a newer timer on time-keep, the
    long name in the open "+1" list passes `expectWhole`.
  - Under `test.describe('without JavaScript')`'s `javaScriptEnabled: false`: the
    three-timer case's strip name passes `expectWhole`.

- [ ] **Step 4: Run them, expect failure**

  Run: `npx playwright test e2e/shell.test.ts -g "phone strip|long name" --project phone`
  Expected: FAIL (names cut).

- [ ] **Step 5: Implement the strip branch** of `TimerBar.svelte`: the section loses
  `h-16 items-center`; with a timer it is two rows (grid or flex, builder's choice)
  with about 8 px padding above and below; row 1 holds the live dot and the link
  (project dot, name with `data-timer-name`, wrapping, `text-wrap: pretty` or
  `balance`; elapsed `text-lg font-bold` at the right, aligned to the name's first
  line); row 2 holds `since(first)` under the name and `others()`, `startSheet()`,
  `stop(first, true)` at the right. The link spans the name row and the
  "activity · since" line so its target is ≥ 44 px (the controls are not inside it).
  With no timer keep `h-16` and today's content. In `others()`, the strip row's name
  becomes `${t.customerName} › ${t.projectName}` with `data-timer-name`, no `truncate`;
  its since line may wrap. The header variant's list row name gets `data-timer-name`
  only (keeps `truncate`; the PC is out of scope).

- [ ] **Step 6: Run unit and e2e, expect pass;** also run the whole
  `e2e/shell.test.ts` on both projects (`npx playwright test e2e/shell.test.ts`) so
  the existing bar tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/shell/TimerBar.svelte src/lib/components/shell/TimerBar.test.ts e2e/shell.test.ts
git commit -m "feat: give the phone strip's names two rows of room"
```

### Task 2: The top band's measured height

**Files:**
- Modify: `src/routes/layout.css` (`main * { scroll-margin-top: 7.5rem }` and its
  comment)
- Modify: `src/lib/components/shell/TimerBar.svelte` (the start sheet's
  `max-h-[calc(100dvh-8rem)]`)
- Test: `e2e/shell.test.ts`

**Interfaces:**
- Consumes: `--bars-height` (set in `src/routes/(app)/+layout.svelte` from the sticky
  band's `offsetHeight`, unset without JavaScript); Task 1's two-row strip.
- Produces: nothing new.

- [ ] **Step 1: Write the failing e2e tests** (phone only, 390 × 844):
  - extend `'focus lands clear of the sticky bars'` with a second case: a running timer
    on the long project from Task 1 (two-line name), then the same refused-save and
    `scrollIntoView({ block: 'nearest' })` checks with `expectClear`.
  - `'the start sheet leaves its ▶ in view'`: a user with 12 templates
    (`seedTemplate`) and one running timer; open the strip's ▶; the summary
    (`[data-start-list] > summary` in the strip) is in the viewport and not covered
    (`elementFromPoint` at its centre is the summary or inside it); clicking it closes
    the sheet. The same under `javaScriptEnabled: false` (the click closes it).

- [ ] **Step 2: Run them, expect failure**

  Run: `npx playwright test e2e/shell.test.ts -g "focus lands|start sheet" --project phone`
  Expected: FAIL (the 7.5rem margin and the 8rem sheet clearance are under the new
  band).

- [ ] **Step 3: Implement.** Measure the two-row band with a one-line name at 390 px
  (top bar 56 px plus the strip) and round up to the next 0.25 rem as the fallback
  `F`. `main * { scroll-margin-top: var(--bars-height, F); }` on the phone (the
  `min-width: 64rem` rule keeps `3.75rem`); update the comment's measurement. The
  sheet: `max-h-[calc(100dvh-var(--bars-height,F)-0.5rem)]`.

- [ ] **Step 4: Run the shell e2e on both projects, expect pass.**

- [ ] **Step 5: Commit**

```bash
git add src/routes/layout.css src/lib/components/shell/TimerBar.svelte e2e/shell.test.ts
git commit -m "fix: clear the taller timer strip when focusing and in the start sheet"
```

### Task 3: Critique, audit and the docs

**Files:**
- Modify: `src/lib/components/shell/TimerBar.svelte` (only what the critique and audit
  find)
- Modify: `DESIGN.md` ("Phone strip" under the timer bar, the `strip-phone` size
  token, the strip list), `.impeccable/design.json` if it carries the strip's size
- Modify: `docs/app.md` (Timer bar: the phone strip's two rows; the "+N" rows'
  customer › project)

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: nothing new.

- [ ] **Step 1:** Build and run the app on a seeded month as
  `.claude/agents/usability-gate.md` describes (`TZ=Europe/Budapest npx tsx
  scripts/seed-month.ts <db> <user> <password>`), start one, two and three timers on
  the seeded projects, and screenshot the strip and the open "+N" list at 390 px in
  light and dark into `.autopilot/screenshots/20/build/`.
- [ ] **Step 2:** Run impeccable's critique and audit on the strip from those
  screenshots, including the "+N" list's lower edge in dark against the page below
  (Review Focus 5). Fix what they find in `TimerBar.svelte`, with a test where the
  fix is behaviour; screenshot again.
- [ ] **Step 3:** Update DESIGN.md, `.impeccable/design.json` (if the strip's size is
  there) and `docs/app.md` to the shipped strip.
- [ ] **Step 4:** Run `npm run check`, `npm run lint`, `npm run test:unit`; expect
  pass.
- [ ] **Step 5: Commit**

```bash
git add -A src DESIGN.md .impeccable docs/app.md
git commit -m "docs: record the two-row phone timer strip"
```

Approved by the operator stand-in, revision 1, 2026-10-22.
