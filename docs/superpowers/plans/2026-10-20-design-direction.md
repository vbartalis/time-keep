# Design direction, round 2 — implementation plan

Approved by the operator stand-in, revision 1, 2026-10-20.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace round 1's punch-card look and shell with Kimai's structure in Kimai's
skin: new tokens and type, a sidebar and header on the PC, a top bar, timer strip and
bottom bar with More on the phone, and a timer bar on every screen that shows and stops
the running timers.

**Architecture:** The tokens live in `src/routes/layout.css` (Tailwind theme and shadcn
variables, light and dark by the device setting). The shell's pure parts (navigation
lists, screen titles, which screens draw their own undo strip, project colour positions)
live in `src/lib/shell.ts` and `src/lib/project-colour.ts`; its server parts (running
timers for the bar, the flash for screens without a strip) in
`src/lib/server/screens/shell.ts` and `src/routes/(app)/+layout.server.ts`. Stop posts
to a new `/timers/stop` action from every screen. The layout draws the shell from small
components in `src/lib/components/shell/`.

**Tech Stack:** SvelteKit 3, Svelte 5 runes, Tailwind 4, shadcn-svelte, Vitest,
Playwright, `@fontsource-variable/public-sans`.

**Spec:** `docs/superpowers/specs/2026-10-20-design-direction-design.md` (the `A2-*`
renders beside it are the composition the build matches). The shell's direction
contract: `.impeccable/surfaces/src-routes-app-layout-svelte.md`.

## Global Constraints

- Everything in the shell works without JavaScript (forms post, `<details>` opens).
- Fonts self-hosted from npm; no external host at runtime.
- WCAG 2.2 AA contrast in light and dark; visible focus; 44 px touch targets on the phone.
- PC shell from 1024 px (Tailwind `lg`); phone below it.
- One blue for the running timer and the primary action; red only for irregular or
  destructive; running is never red.
- No placeholder: no "not built yet", no link to a screen that does not exist.
- English, 24-hour clock, ISO dates, Monday first.
- Screens keep round 1's layouts; only their `h1`, Today's Timers section and what the
  new tokens break change.
- Conventional Commits, no scope, no attribution.

## Review Focus

1. A long customer › project and description in the timer bar: truncated on one line,
   Stop never pushed off screen (test in Task 5, at 390 px).
2. A timer that started on an earlier day: the bar shows its start date beside the time
   (test in Task 3, `shellTimers`).
3. Stop on a screen opened with a query (`/entries?from=…`): returns to that exact URL
   (test in Task 5 e2e).
4. A refused stop (the timer was already stopped in another tab): the message shows on
   the screen, not a crash or a silent redirect (test in Task 5 e2e).
5. Content behind the phone's fixed bottom bar: the edit screen's Save is reachable and
   not covered once scrolled to the bottom (test in Task 5 e2e).

---

### Task 1: Tokens, type and the utility rename

**Files:**

- Modify: `src/routes/layout.css` (whole token block, the two utilities)
- Modify: `package.json`, `package-lock.json` (fonts)
- Modify: every `src/**/*.svelte` using `punch` or `printed` (rename only)
- Test: `src/lib/theme.test.ts` (create)

**Interfaces:**

- Produces: CSS utilities `figures` and `caps`; Tailwind colours `live`, `irregular`,
  `sidebar*` (kept names), and `project-1` … `project-8` with `project-N-fill` and
  `project-N-ink` (classes `bg-project-N`, `bg-project-N-fill`, `text-project-N-ink`).

- [ ] **Step 1: Write the failing test** `src/lib/theme.test.ts`, reading
      `src/routes/layout.css` as text:
  - `uses Public Sans and none of round 1's faces`: contains `Public Sans`; contains
    neither `Archivo` nor `Martian`.
  - `defines eight project colours with fill and ink`: for N in 1..8, contains
    `--project-N:`, `--project-N-fill:` and `--project-N-ink:`.
  - `drops the punch-card utilities`: contains `@utility figures` and `@utility caps`;
    contains neither `@utility punch` nor `@utility printed`.
- [ ] **Step 2: Run** `npx vitest run src/lib/theme.test.ts` — FAIL.
- [ ] **Step 3: Fonts.** `npm install -D @fontsource-variable/public-sans`;
      `npm uninstall @fontsource-variable/archivo @fontsource-variable/martian-mono`;
      import `@fontsource-variable/public-sans` in `layout.css`.
- [ ] **Step 4: Tokens.** Rewrite the `:root` and dark blocks with these values (sRGB
      hex is fine; keep every shadcn variable name):

  | Variable                                                                                                     | Light                            | Dark      |
  | ------------------------------------------------------------------------------------------------------------ | -------------------------------- | --------- |
  | `--background`                                                                                               | `#f7f7f8`                        | `#141516` |
  | `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `#1d2025`                        | `#e6e7e9` |
  | `--card`, `--popover`                                                                                        | `#ffffff`                        | `#1c1d1f` |
  | `--muted`, `--secondary`                                                                                     | `#f2f3f5`                        | `#222326` |
  | `--accent` (hover fill)                                                                                      | `#eef0f3`                        | `#26282b` |
  | `--muted-foreground`                                                                                         | `#5d636c` (≥4.5:1 on the ground) | `#9a9fa7` |
  | `--border`                                                                                                   | `#e4e5e8`                        | `#2b2d30` |
  | `--input`                                                                                                    | `#c8cbd0`                        | `#43464b` |
  | `--primary`, `--ring`                                                                                        | `#0b63c9`                        | `#5aa0ff` |
  | `--primary-foreground`                                                                                       | `#ffffff`                        | `#08213f` |
  | `--destructive`                                                                                              | `#c4291c`                        | `#ff7b6e` |
  | `--sidebar`                                                                                                  | `#262626`                        | `#0f0f10` |
  | `--sidebar-foreground`                                                                                       | `#c8c8c8`                        | `#b4b4b4` |
  | `--sidebar-primary` (current item fill)                                                                      | `#1b1b1b`                        | `#1c1d1f` |
  | `--sidebar-primary-foreground`, `--sidebar-accent-foreground`                                                | `#ffffff`                        | `#ffffff` |
  | `--sidebar-accent` (hover)                                                                                   | `#333333`                        | `#1a1b1d` |
  | `--sidebar-border`                                                                                           | `#333333`                        | `#232427` |
  | `--sidebar-ring` (also the current item's bar)                                                               | `#3d8bfd`                        | `#5aa0ff` |

  `--radius: 0.25rem`. `--color-live` stays `var(--primary)`, `--color-irregular` stays
  `var(--destructive)`. `--chart-1` the primary, `--chart-2..5` project colours 1–4.
  `--font-sans: 'Public Sans Variable', ui-sans-serif, system-ui, sans-serif`; drop
  `--font-mono`. Sizes: `--text-xs` 0.75rem/1.35 (table heads, meta), `--text-sm`
  0.875rem/1.45 (PC body), `--text-base` 0.9375rem/1.45 (phone body), `--text-xl`
  1.3125rem/1.25 (titles).

- [ ] **Step 5: Project palette.** Eight edges, light / dark: 1 teal `#1a7f95`/`#4fbad0`,
      2 ochre `#b8680f`/`#e8a052`, 3 plum `#8c3f9a`/`#c98ad6`, 4 green `#2f8a4c`/`#62c283`,
      5 indigo `#4f5bd5`/`#8e97f0`, 6 rose `#c2417a`/`#ef86b4`, 7 olive `#7a7a12`/`#c3c35a`,
      8 brown `#8a5a3c`/`#c99a7a`. Fill and ink by `color-mix`: light fill
      `color-mix(in oklch, var(--project-N) 16%, white)`, light ink
      `color-mix(in oklch, var(--project-N), black 45%)`; dark fill
      `color-mix(in oklch, var(--project-N) 26%, #1c1d1f)`, dark ink
      `color-mix(in oklch, var(--project-N), white 75%)`. Expose each as a Tailwind colour.
      Check each ink on its fill is ≥4.5:1 in both themes; adjust the mix, not the hue, if
      one fails.
- [ ] **Step 6: Utilities.** `@utility figures` = `font-variant-numeric: tabular-nums`
      (confirm Public Sans aligns `0:15` over `1:30`). `@utility caps` = 0.75rem, weight
      600, uppercase, letter-spacing 0.04em. Replace every `punch` class with `figures`
      and every `printed` with `caps` in `src/`; `git grep -wn 'punch\|printed' src` is
      empty afterwards. Keep the checkbox rules on the new variables. Rewrite the file's
      header comment for Kimai's skin.
- [ ] **Step 7: Run** `npx vitest run src/lib/theme.test.ts` — PASS; `npm run check` and
      `npm run lint` — clean.
- [ ] **Step 8: Commit** `feat: replace the punch-card tokens with kimai's skin`.

### Task 2: Navigation, titles and project colours (pure)

**Files:**

- Create: `src/lib/shell.ts`, `src/lib/shell.test.ts`
- Create: `src/lib/project-colour.ts`, `src/lib/project-colour.test.ts`

**Interfaces:**

- Produces:
  - `type NavItem = { route: string; label: string; icon: 'today' | 'entries' | 'copy-out' | 'reports' | 'templates' | 'setup' | 'history' | 'account' | 'users' | 'backup' }`
    (`route` is the SvelteKit route id, e.g. `/(app)/entries`).
  - `sidebarItems(isAdmin: boolean): NavItem[]` — Today, Entries, Copy-out, Reports,
    Templates, Setup, History, Account, then Users and Backup for an admin.
  - `barItems(): NavItem[]` — Today, Entries, Templates.
  - `moreItems(isAdmin: boolean): NavItem[]` — Setup, Copy-out, Reports, History,
    Account, then Users and Backup for an admin (Sign out is a form, not an item).
  - `screenTitle(routeId: string | null): string` — `/(app)` Today, `/(app)/entries`
    Entries, `/(app)/entries/[id]` Edit entry, `/(app)/copy-out` Copy-out,
    `/(app)/reports` Reports, `/(app)/templates` Templates, `/(app)/templates/new` New
    template, `/(app)/templates/[id]` Edit template, `/(app)/setup` Setup,
    `/(app)/history` History, `/(app)/account` Account, `/(app)/admin/users` Users,
    `/(app)/admin/backup` Backup; anything else `time-keep`.
  - `currentItem(routeId: string | null, back: string | null): string | null` — the
    route of the item to mark current: the route itself or its screen
    (`/(app)/templates/new` → `/(app)/templates`); the entry edit screen → Entries when
    `back` starts with `/entries`, else Today (round 1's rule, moved here).
  - `ownsStrip(routeId: string | null): boolean` — true for `/(app)`, `/(app)/entries`,
    `/(app)/setup`, `/(app)/templates`, `/(app)/history`.
  - `PROJECT_COLOURS = 8`;
    `colourOf(projects: { id: string; createdAt: number }[]): Map<string, number>` —
    1-based palette index by position in creation order (ties by `id`), wrapping after 8.

- [ ] **Step 1: Write the failing tests.**
  - `shell.test.ts`: `sidebarItems(false)` labels are the eight listed; `(true)` adds
    Users, Backup last; `barItems()` labels `['Today', 'Entries', 'Templates']`;
    `moreItems(false)` labels `['Setup', 'Copy-out', 'Reports', 'History', 'Account']`;
    every `sidebarItems(true)` route is in `barItems()` ∪ `moreItems(true)`;
    `screenTitle` for each route above and `null` → `time-keep`;
    `currentItem('/(app)/entries/[id]', '/entries?from=2026-10-01')` →
    `'/(app)/entries'`, with `'/'` → `'/(app)'`;
    `currentItem('/(app)/templates/new', null)` → `'/(app)/templates'`; `ownsStrip`
    true for the five, false for `/(app)/reports`.
  - `project-colour.test.ts`: three projects created at t=3, 1, 2 get 3, 1, 2; nine
    projects → the newest gets 1; equal `createdAt` ordered by `id`; empty → empty map.
- [ ] **Step 2: Run** `npx vitest run src/lib/shell.test.ts src/lib/project-colour.test.ts`
      — FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: add the shell's navigation and project colours`.

### Task 3: Running timers for the bar, and the stop action

**Files:**

- Create: `src/lib/server/screens/shell.ts`, `src/lib/server/screens/shell.test.ts`
- Create: `src/routes/(app)/timers/stop/+page.server.ts`
- Create: `src/lib/components/shell/types.ts`

**Interfaces:**

- Consumes: `colourOf` (Task 2); `formatTime`, `earlierDate` from `screens/today.ts`;
  `done`, `text` from `screens/actions.ts`; `safeBack`; `setFlash`.
- Produces:
  - `type BarTimer = { id: string; customerName: string; projectName: string; activityName: string | null; description: string | null; startAt: number; start: string; startDate: string | null; colour: number }`
    in `components/shell/types.ts`.
  - `shellTimers(core: Core, now: number): BarTimer[]` — running entries, newest start
    first; `start` in the entry's start zone; `colour` from `colourOf` over all the
    user's projects, archived included.
  - Route `POST /timers/stop` (default action), fields `id`, `back`: stops via
    `core.timers.stop({ id })`; success → `done(core, cookies, r, safeBack(back))`;
    refusal → `setFlash(cookies, { label: '', batchId: null, warnings: [], error: <the
    core's message> })` then `redirect(303, safeBack(back))`. A GET redirects to `/`.
    The refusal shows in the alert strip at the top of the content, directly under the
    bar, not inside the bar itself (a builder's call against the spec's "in the bar",
    recorded in the done note: one place for every message).

- [ ] **Step 1: Write the failing tests** in `shell.test.ts` with `createTestDb()` and
      `openCore(db, userId, 'ui', () => NOW)`:
  - two running timers started 09:00 and 10:00 (Europe/Budapest) → newest first, `start`
    `'10:00'` then `'09:00'`;
  - a timer started yesterday → `startDate` is yesterday's ISO date; today's → `null`;
  - projects created A then B, timers on B and A → B's `colour` 2, A's 1;
  - a stopped entry is not listed.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/screens/shell.test.ts` — FAIL.
- [ ] **Step 3: Implement** `shellTimers` and the stop route (the route is covered by
      Task 5's e2e).
- [ ] **Step 4: Run** — PASS; `npm run check` clean.
- [ ] **Step 5: Commit** `feat: add the timer bar's data and stop action`.

### Task 4: The shell: sidebar, header, phone bars, titles

**Files:**

- Modify: `src/routes/(app)/+layout.server.ts`, `src/routes/(app)/+layout.svelte`
- Create: `src/lib/components/shell/Sidebar.svelte`, `BottomBar.svelte` (with More),
  `NavIcon.svelte`
- Modify: the 13 screens under `src/routes/(app)/` with an `h1`: remove it, keep what sat
  beside it (Today's date and zone lines, the Templates and Setup links)
- Modify: `e2e/copy-out.test.ts`, `e2e/reports.test.ts` (the rail tests)
- Test: `e2e/shell.test.ts` (create)

**Interfaces:**

- Consumes: Task 2's functions; Task 3's `shellTimers`, `BarTimer`.
- Produces: layout data `{ user, timers: BarTimer[], now: number, flash: Flash | null }`
  (`flash` taken only when `!ownsStrip(route.id)`); the layout renders
  `<h1>{screenTitle(page.route.id)}</h1>` once, placed in the PC header (≥ `lg`) and in
  the phone top bar (< `lg`) by the grid, not duplicated.

- [ ] **Step 1: Write the failing e2e** `e2e/shell.test.ts` (seed with `e2e/seed.ts`'s
      helpers; both Playwright projects):
  - `every screen is reachable from the navigation`: PC — click each `sidebarItems`
    label in `navigation "Main"`; expect the level-1 heading with that title and the
    link `aria-current="page"`. Phone — Today, Entries, Templates from the bottom bar;
    the rest via `More` then the item; the same heading check. `Sign out` exists on both
    (on the phone inside More).
  - `an admin also reaches Users and Backup` (signed in as `admin`).
  - `the screen's title is its one h1`: on Reports, level-1 headings count 1, named
    Reports.
- [ ] **Step 2: Run** `npx playwright test e2e/shell.test.ts` — FAIL.
- [ ] **Step 3: Implement** to the spec's Shell section and the `A2` renders: PC grid
      `lg:grid-cols-[14.5rem_minmax(0,1fr)]`; sidebar `sticky top-0 h-dvh overflow-y-auto
      bg-sidebar` with the wordmark, the list (`aria-current` from `currentItem`; current
      item `bg-sidebar-primary` with a 3 px left bar in `--sidebar-ring`), the user's name
      and Sign out at the foot; header 60 px on `bg-card` with a bottom rule, title left,
      the timer bar's place right (Task 5). Phone: top bar `bg-sidebar` with the title;
      content padded so nothing sits under the fixed bottom bar
      (`pb-[calc(5rem+env(safe-area-inset-bottom))]`); bottom bar `bg-card` with three
      links and a `<details>` More whose panel is a sheet fixed above the bar (its links,
      then Sign out), the `<summary>` the fourth cell, 44 px minimum. Both navs are
      `<nav aria-label="Main">`; More's list sits inside the phone's. Lucide icons as
      round 1. Remove each screen's `h1` and now-unused imports.
- [ ] **Step 4: Update** the rail tests in `copy-out.test.ts` and `reports.test.ts`: on
      the phone the item is reached through More (not absent); the PC assertions stay.
- [ ] **Step 5: Run** `npx playwright test e2e/shell.test.ts e2e/copy-out.test.ts e2e/reports.test.ts`
      — PASS; then `npm run test:e2e`, fixing any test that depended on where a screen's
      `h1` sat (it is still level 1 with the same name).
- [ ] **Step 6: Commit** `feat: draw kimai's shell on phone and pc`.

### Task 5: The timer bar, the shell's undo strip, Today without Timers

**Files:**

- Create: `src/lib/components/shell/TimerBar.svelte`
- Modify: `src/lib/components/today/Elapsed.svelte` (class `figures`, no colour of its own)
- Modify: `src/routes/(app)/+layout.svelte` (the bar in the header and as the phone strip;
  the strip for screens that do not own one)
- Modify: `src/routes/(app)/+page.svelte`, `+page.server.ts` (Today: drop `Timers`, its
  data and the `stop` action); delete `src/lib/components/today/Timers.svelte` and
  `TimerRow` if unused
- Modify: `e2e/phone.test.ts` (Timers section → the bar)
- Test: `e2e/shell.test.ts` (add)

**Interfaces:**

- Consumes: layout data from Task 4; `/timers/stop` from Task 3; `UndoStrip`.
- Produces: `TimerBar.svelte` props
  `{ timers: BarTimer[]; now: number; back: string; variant: 'header' | 'strip' }`; the
  bar is a `region` named `Timer`.

- [ ] **Step 1: Write the failing e2e** in `shell.test.ts`:
  - `the bar says when nothing runs`: on Today, Entries and Reports, region `Timer`
    contains `No timer running`.
  - `a timer is stopped from the bar and undone where it was stopped`: start one on Today
    ("Start a timer"); go to Reports; region `Timer` shows the project and an elapsed
    time; click its Stop; URL still `/reports`; `status` contains `Done: Stop timer`;
    click `Undo`; the bar shows the project running again.
  - `several timers show as the newest plus a count`: start two on different projects;
    on `/entries?from=` plus any date the bar shows the newer and a `+1` control; open it,
    stop the older; the URL is unchanged, query included; the newer still shows.
  - `a refused stop is shown`: two pages in one context with the bar; stop in the first,
    then Stop in the second → an `alert` with the core's message, URL unchanged.
  - `the bar never hides Stop or Save`: at 390 px with a 120-character description
    running, Stop is inside the viewport; on an entry's edit screen scrolled to the
    bottom, Save's box ends above the bottom bar's top.
  - `the bar uses the project's colour`: two running timers on different projects have
    colour dots with different computed `background-color`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `TimerBar` to the spec's "The timer bar" and the `A2` renders.
      Header variant: a bordered pill on `bg-primary/8`; blue live dot; `Elapsed`; project
      dot `bg-project-{colour}`; customer › project (semibold); activity · description
      (muted, truncated); Stop (outline, blue square icon,
      `aria-label="Stop <project> started <start>"` as round 1). Strip variant:
      `bg-sidebar` band; project, then "activity · since HH:mm" (with `startDate` when
      set); elapsed; Stop at 44 px. Several: the first in full, then `<details>` with
      summary `+N` listing the others, each with elapsed and Stop. None: "No timer
      running" at the same height. Each Stop is
      `<form method="POST" action="/timers/stop" use:enhance>` with hidden `id` and `back`
      (`page.url.pathname + page.url.search`). The layout renders `UndoStrip` from its
      `flash` (with `back` the current URL) at the top of the content on screens that do
      not own one.
- [ ] **Step 4: Today.** Remove the Timers section, its data and its `stop` action; move
      `phone.test.ts`'s Timers locators to region `Timer` (the Stop buttons keep their
      names); the "only its working sections" test drops `Timers` from its list.
- [ ] **Step 5: Run** `npm run test:e2e` — PASS; `npm run check`, `npm run lint`,
      `npm run test:unit` — clean.
- [ ] **Step 6: Commit** `feat: add the timer bar to every screen`.

### Task 6: Every screen in the new tokens, checked on a seeded month

**Files:**

- Modify: only what the check finds.

- [ ] **Step 1: Run the app** as `.claude/agents/usability-gate.md` "Run the app"
      describes (build, `node build` on a free port,
      `TZ=Europe/Budapest npx tsx scripts/seed-month.ts <db> gate-user gate-password-1`).
- [ ] **Step 2: Capture** Today, Entries, an entry's edit screen, Copy-out, Reports,
      Templates, a template, Setup, History, Account, and as admin Users and Backup, plus
      the sign-in page, at 390 and 1440 px, light and dark, into
      `.autopilot/screenshots/11/build/`, with a timer running. Open each. On the PC, Tab
      from the top of Today through the sidebar's links to the bar's Stop and check the
      focus ring is visible on each, in both themes (gate task 6).
- [ ] **Step 3: Fix** only what the tokens or the shell broke: text below AA contrast,
      anything hidden by the bar or the bottom bar, a running state drawn red, a leftover
      round 1 colour (`git grep -n 'oklch(' src -- ':!src/routes/layout.css'` is empty).
      No layout changes.
- [ ] **Step 4: Run** `npm run check`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` — pass. Stop the server.
- [ ] **Step 5: Commit** `fix: carry every screen into the new tokens` (skip if nothing
      changed).

### Task 7: Records: decision, product, app doc

**Files:**

- Create: `docs/decisions/009-the-ui-follows-kimais-structure-and-skin.md`
- Modify: `docs/decisions/005-the-ui-looks-like-a-punch-clock-time-card.md` (status
  `superseded`, `superseded-by: 9`)
- Modify: `PRODUCT.md`, `docs/app.md`

- [ ] **Step 1: Decision 9** in `docs/decisions/README.md`'s format. Rule: the interface
      follows Kimai's structure and skin — the shell as built here (near-black sidebar;
      header with the title and the timer bar; phone top bar, timer strip and bottom bar
      with More), near-white or near-black ground, one blue for running and the primary
      action, red only for irregular or destructive, project colour the one strong colour
      (derived from creation order over an eight-colour palette), Public Sans self-hosted,
      light and dark by the device. Why: the operator judged round 1 "nothing like kimai"
      and its theming "horrendous"; chosen by the operator stand-in from three rendered
      options, its skin pulled back to Kimai's.
- [ ] **Step 2: PRODUCT.md.** Keep the schema marker; rewrite "Capabilities and
      Constraints" to what is built and items 12–15 next; "Brand Commitments" gains: looks
      and is laid out like Kimai, with the calendar apps' colour by project, no themed
      concept (the stand-in's call, 2026-10-20).
- [ ] **Step 3: docs/app.md.** The shell row and a "Shell" section (sidebar, header,
      phone bars and More, the timer bar and `/timers/stop`, the shell's undo strip for
      screens without one, titles from `screenTitle`); Today without Timers;
      `punch`/`printed` renamed; the e2e list gains `shell.test.ts`.
- [ ] **Step 4: Run** `npx prettier --write` on the changed docs and `npm run lint` —
      clean.
- [ ] **Step 5: Commit** `docs: record the round 2 design direction`.

### Task 8: Impeccable finish: detector, review, DESIGN.md

**Files:**

- Modify: whatever the review's material fixes name
- Rewrite: `DESIGN.md`, `.impeccable/design.json` (by the documenter)

- [ ] **Step 1: Detector.** Run the impeccable skill's `scripts/impeccable detect --json`
      over `src/routes/(app)/+layout.svelte`, `src/lib/components/shell/` and
      `src/routes/layout.css`; fix what is mechanical.
- [ ] **Step 2: Captures.** `desktop.png` (1440, full page, Entries with a running timer)
      and `mobile.png` (390, Today with a running timer) into `.impeccable/review/` from
      the seeded app; open each to check it is valid.
- [ ] **Step 3: Finish review.** Spawn `impeccable:impeccable-finish-reviewer` fresh with:
      the spec, the direction contract (the surface brief), the artifact
      (`src/routes/(app)/+layout.svelte`), both captures (required), the detector's
      remaining findings, `docs/superpowers/specs/2026-10-20-design-direction/A2-*.png` as
      the critique reference (code-led; no approved comp), and the skill's
      `reference/craft-floor.md`. Act on its disposition (fix: one batch, recapture,
      verdict pass; two rounds at most).
- [ ] **Step 4: Documenter.** Spawn `impeccable:impeccable-documenter` with the project
      root, the artifact, the direction contract, `PRODUCT.md`, the skill's
      `reference/document.md`, and the write boundary `DESIGN.md` and
      `.impeccable/design.json`. Verify both exist, carry tokens, and that `DESIGN.md`
      names none of round 1's world (card stock, ribbon, punch, rack), and that it states
      the dark sidebar is darker than Kimai's `#262626` (`#0f0f10`, near-black on the dark
      ground).
- [ ] **Step 5: Run** `npm run check`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` — pass.
- [ ] **Step 6: Commit** any fix as `fix: …`, then `docs: write DESIGN.md for kimai's skin`.
