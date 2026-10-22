# Account, Users, Backup and the Sign-in Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redo Account, Users, Backup, the sign-in page and the error pages in item 11's
direction and the patterns of items 12–15c (roadmap item 15d), and sweep the app for
anything left in round 1's look.

**Architecture:** Three shared pieces in `src/lib/components/admin/` serve the three
signed-in screens: a section with its head, "+ New …" and surface panel
(`PanelSection`), a row ⋯ menu that is a popover on the PC and the row sheet on the phone
(`ActionMenu`), and a form dialog on Setup's `Sheet` (`FormDialog`). A small server
module (`src/lib/server/screens/accounts.ts`) places a refusal on its field and reads
which dialog a no-JavaScript address opens. The route actions keep their names, fields
and messages; their failures gain the field, the dialog and the typed values. The
sign-in page and the root error page share a card layout; the shell gets its own error
page. Nothing in the core, the database, the auth rules, the backup or the MCP changes.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind 4, shadcn-svelte,
Lucide, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-account-users-backup-design.md` (read it
whole; cited as "spec, <section>", its calls as "call <n>"). Mockups:
`docs/superpowers/specs/2026-10-21-account-users-backup/` (`login`, `account`,
`account-token-made`, `users`, `users-new`, `users-set-password`, `backup`,
`backup-confirm`, each `pc-`/`ph-` and `-light`/`-dark`). Where a mockup differs from the
spec, the spec wins. Two differences the stand-in named at approval
(`.autopilot/agents/15d-standin-spec-r1.md`): a date and time ("2026-10-21 08:14") never
wraps inside itself (the phone token line in the mockup does); every panel's foot puts
its button at the right on the PC, Backup's included (the mockup has them at the left).
Round 1's designs (spec, first paragraph) describe the behaviour kept; `docs/app.md`
(Account, Backup, Accounts and sessions) is the current contract.

## Global Constraints

- Imports use `#lib/...`. No change to `src/lib/server/users.ts`,
  `src/lib/server/auth/**`, `src/lib/server/backup.ts`, the core, the database or the MCP;
  their unit tests keep passing unchanged (spec, Constraints).
- Server actions keep their names (`password`, `createToken`, `revokeToken`, `create`,
  `setPassword`, `disable`, `enable`, `restore`, login's `default`), form fields and
  messages; a failure may add data (`field`, `dialog`, `values`), never drop `error`
  (or Account's `tokenError`).
- DESIGN.md is the visual system: section head (`caps` h2 on a 1 px text-colour rule),
  surface panels (4 px corners, `border` stroke) from `lg` (1024 px), rows on the ground
  edge to edge below; the ruled table's muted head band; `figures` on every date and
  time, and a date with its time never wraps (`whitespace-nowrap`); type 12, 13, 14, 15,
  17, 21, 24 px only; 36 px controls from `lg`, 44 px below; nothing in the phone "+"'s
  column (`max-lg:pr-14` on rows and lines with controls).
- One blue primary per form. Destructive (Revoke…, Revoke, Restore…, Restore) is
  DESIGN.md's red outline: surface fill, red at 60 % stroke, red text, red fill on hover;
  never a solid red fill at rest (call 10). Disable and Enable are not red (call 13).
- Column width on Account, Users and Backup: `max-w-3xl` (48 rem), left-aligned (call 8).
  Sections 32 px apart. Every panel foot's button sits at the right from `lg`, full width
  below.
- Copy, exactly: "+ New token", "New token", "Name it after the agent or machine that
  will use it.", "Create token", "Token made: <name>", "Copy it now: it is not shown
  again.", "Copy", "Copied", "Done", "Revoke…", "Revoke "<name>"?", "Agents using it lose
  access at once. This cannot be undone.", "Revoke", "Agents use a token to reach
  time-keep through the MCP server. A token is shown once, when it is made.", "No tokens
  yet.", "Never used", heads "Name", "Made", "Last used"; "+ New user", "New user", "3 to 32
  characters: a–z, 0–9, dot, underscore, hyphen.", "10 to 256 characters.", "Create user",
  "Set password…", "Set password for <username>", "10 to 256 characters. Signs <username>
  out everywhere; their agent tokens keep working." (own row: "10 to 256 characters. Signs
  you out everywhere else; your agent tokens keep working."), "Set password", "Disable",
  "Enable", heads "Username", "Role", "Created", "Admin", "User", "(you)", "Created
  <date>", "· you", chip "Disabled"; "Restore…", "Restore this backup?", "Restoring
  <file> replaces every user's data with the backup's and signs everyone out, you
  included.", "The data as it is now is kept, and can be downloaded under Before the last
  restore.", "Restore"; "Show password", "Hide password"; "Not found", "Admins only",
  "Back to Today"; "Cancel" on every dialog.
- Without JavaScript every screen works as pages (spec, Shared; calls 14, 19); parts only
  those pages have carry `data-nojs`, script-only parts `data-js` (DESIGN.md, Script-only
  and no-script parts).
- WCAG 2.2 AA in both themes. Dialogs and sheets trap focus, take it on their first field
  (Copy on the made token), close on Escape, the scrim and Back, and return it to their
  opener. Menus follow the menu-button pattern.
- The sign-in page keeps "Username", "Password" and "Sign in". The eye's name contains
  "password", so every e2e sign-in that uses `getByLabel('Password')` changes to
  `getByLabel('Password', { exact: true })` (14 places in `e2e/`).

## Review Focus

1. **A refused dialog after a reload or without JavaScript** (`?/create` posted with
   username "ab" from the no-JS page): the page comes back with the New user form open
   in the page, the username kept, the password empty, the message under Username; not a
   bare alert at the top with the form closed. Tasks 1 and 4 test it.
2. **The made token after the dialog closes**: Done, Escape, the scrim and Back all
   close it for good; a reload, Back into the page, or reopening "+ New token" never
   shows the old token again. Task 3 tests it.
3. **Restore… with JavaScript and no file chosen**: no confirm opens; "Choose a backup
   file." shows in the Restore panel, as the server would say. Task 5 tests it.
4. **The admin's own row**: no Disable in its menu at either width; Set password… on it
   reads "Signs you out everywhere else" and leaves the admin signed in. Task 4 tests it.
5. **A long username or token name** (32 characters, or a 100-character token name, no
   spaces): it wraps inside its cell or line, never pushes the ⋯ off the row or makes the
   phone page scroll sideways, and the dialog title wraps. Tasks 3 and 4 test it.

---

### Task 1: Refusals placed on their fields

**Files:**

- Create: `src/lib/server/screens/accounts.ts`, `src/lib/server/screens/accounts.test.ts`
- Modify: `src/routes/(app)/account/+page.server.ts`,
  `src/routes/(app)/admin/users/+page.server.ts`, `src/routes/login/+page.server.ts`
- Create: `src/routes/(app)/admin/users/users-routes.test.ts`,
  `src/routes/(app)/account/account-routes.test.ts`, `src/routes/login/login-routes.test.ts`
  (in the style of `src/routes/(app)/entries/entries-routes.test.ts`)

**Interfaces:**

- Produces, in `src/lib/server/screens/accounts.ts`:
  - `export type AccountField = 'username' | 'password' | 'current' | 'next' | 'name'`
  - `export function fieldOf(message: string, form: 'user' | 'setPassword' | 'ownPassword' | 'token'): AccountField | null`
    — by the message's subject: a username rule or "Username is taken." → `username`; a
    password rule → `password` (`user`, `setPassword`) or `next` (`ownPassword`);
    "Current password is incorrect." → `current`; "Passwords do not match." → `next`; a
    token name rule or "You already have a token with that name." → `name`; anything else
    ("User not found.", "Token not found.") → `null`.
  - `export type Dialog = { kind: 'token' } | { kind: 'user' } | { kind: 'password'; userId: string } | { kind: 'revoke'; tokenId: string }`
  - `export function dialogOf(params: URLSearchParams): Dialog | null` — the no-JS
    address: `?new=token`, `?new=user`, `?password=<id>`, `?revoke=<id>`; anything else
    null.
- Produces, the actions' failures:
  - Users `create`: `fail(400, { dialog: 'user', error, field, values: { username, isAdmin } })`;
    `setPassword`: `fail(400, { dialog: 'password', userId, error, field })`;
    `disable`/`enable`: as now. Successes as now (`{ message }`).
  - Account `password`: `fail(400, { error, field })`; `createToken`:
    `fail(400, { dialog: 'token', tokenError, field, values: { name } })`;
    `revokeToken` as now (its first press still returns `{ confirmRevoke: id }`).
  - Login: `fail(400, { error, username })`.
  - The Account and Users loads add `dialog: dialogOf(url.searchParams)`.

- [ ] **Step 1: Write the failing tests** in `accounts.test.ts`: `fieldOf('Username is taken.', 'user')` → `'username'`; the messages `createUser` refuses "ab" and a 3-character password with → `'username'` and `'password'`; the password rule with `'ownPassword'` → `'next'`; `'Current password is incorrect.'` → `'current'`; `'Passwords do not match.'` → `'next'`; `'Name must be 1–100 characters.'` and `'You already have a token with that name.'` with `'token'` → `'name'`; `'User not found.'` → `null`. `dialogOf` for `new=token`, `new=user`, `password=u1`, `revoke=t1`, `new=bogus` and an empty query.
- [ ] **Step 2: Write the failing route tests**: Users `create` with username "ab" → status 400, `field: 'username'`, `values.username: 'ab'`, `dialog: 'user'`, no password anywhere in the data; `setPassword` with a short password → `field: 'password'`, `userId` echoed; Account `password` with a mismatched confirm → `field: 'next'`; `createToken` with a duplicate name → `field: 'name'`, `values.name`; login with a wrong password → `error: 'Wrong username or password.'`, `username` echoed, no password; the Account load with `?new=token` → `dialog: { kind: 'token' }`.
- [ ] **Step 3: Run** `npx vitest run src/lib/server/screens/accounts.test.ts src/routes/(app)/admin/users src/routes/(app)/account src/routes/login` → FAIL.
- [ ] **Step 4: Implement** `accounts.ts` and the actions' and loads' additions above.
- [ ] **Step 5: Run** the same → PASS; `npm run check` → clean.
- [ ] **Step 6: Commit** `feat: place account refusals on their fields`.

### Task 2: The shared section, menu and dialog

**Files:**

- Create: `src/lib/components/admin/PanelSection.svelte`,
  `src/lib/components/admin/ActionMenu.svelte`, `src/lib/components/admin/FormDialog.svelte`,
  `src/lib/components/admin/items.ts`, `src/lib/components/admin/items.test.ts`
- Modify: `src/lib/components/setup/CreateDialog.svelte` and `SetupMenu.svelte` only if
  they become thin users of the new pieces; Setup's look and behaviour do not change.

**Interfaces:**

- Produces:
  - `PanelSection.svelte` props `{ title: string; id: string; action?: Snippet; children: Snippet }`
    — an h2 (`id`) in `caps` on the text-colour rule; `action` (the outline "+ New …") at
    the head's right from `lg`, under the rule at the left below; `children` inside the
    surface panel from `lg`, on the ground below (Setup's section; spec, Shared).
  - `items.ts`: `export type MenuItem = { id: string; label: string; icon?: Component; tone?: 'destructive'; ruleBefore?: boolean } & ({ kind: 'pick'; href: string } | { kind: 'post'; action: string; fields: Record<string, string> })`
    — a `pick` opens a dialog with the script and is the link `href` without it.
    `export function userItems(user: { id: string; disabled: boolean }, actorId: string): MenuItem[]`
    — Set password… (`pick`, `href` `?password=<id>`), then with `ruleBefore` Disable or
    Enable (`post` to `?/disable` / `?/enable` with `{ userId }`), none on the actor's own
    row; `export function tokenItems(token: { id: string }): MenuItem[]` — Revoke…
    (`pick`, destructive, `href` `?revoke=<id>`).
  - `ActionMenu.svelte` props `{ rowId: string; label: string; items: MenuItem[]; onpick: (id: string) => void; head: { title: string; sub: string } }`
    — the ⋯ (36 px from `lg`, 44 px below, `data-menu-for={rowId}`, `aria-label` `label`):
    with the script, Setup's 208 px popover from `lg` with the menu-button pattern, below
    `lg` the row sheet (`Sheet`) with `head` and 48 px items; without it a `<details>` of
    links and post buttons. A `pick` closes the menu and calls `onpick(id)`; a `post`
    submits with `use:enhance`.
  - `FormDialog.svelte` props `{ open: boolean; title: string; titleId: string; onclose: () => void; inline?: boolean; body: Snippet; foot: Snippet }`
    — `Sheet` with `dialog` and `narrow` (440 px from `lg`; a bottom sheet below), the
    head (17 px bold title that wraps, ghost × of 36/44 px), the body (16 px padding,
    12 px gaps), the foot pinned on a `border` rule (Cancel and the action: two equal
    halves below `lg`, right-aligned from `lg`). `inline` renders the same as a panel in
    the page (the no-JS address), without ×.

- [ ] **Step 1: Write the failing tests** in `items.test.ts`: `userItems` for another active user → ids `['password', 'disable']`, `disable` has `ruleBefore` and is a `post` to `?/disable` with `{ userId: 'u2' }`; for a disabled one → `['password', 'enable']`; for the actor → `['password']`; `password`'s `href` is `?password=u2`; `tokenItems` → one `revoke` item, `tone: 'destructive'`, label "Revoke…", `href` `?revoke=t1`.
- [ ] **Step 2: Run** `npx vitest run src/lib/components/admin` → FAIL.
- [ ] **Step 3: Implement** `items.ts` and the three components, reusing `Sheet` and Setup's menu-button code. If `SetupMenu` or `CreateDialog` are rewritten on top of the new pieces, `e2e/setup.test.ts` must pass unchanged.
- [ ] **Step 4: Run** the tests → PASS; `npm run check`, `npm run lint` → clean; `npx playwright test e2e/setup.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: add the account screens' section, menu and dialog`.

### Task 3: Account

**Files:**

- Modify: `src/routes/(app)/account/+page.svelte`, `e2e/agent.test.ts`, the Account
  steps of `e2e/accounts.test.ts`
- Replace: `src/lib/components/account/NewToken.svelte`, `TokenList.svelte` (rewrite or
  remove)

**Interfaces:**

- Consumes: Task 1 (`field`, `values`, `dialog`, the load's `dialog`), Task 2.
- The page (spec, Account): `max-w-3xl`; **Change password** in a `PanelSection` (three
  ruled rows, a 12 rem label column from `lg`, the foot's primary; a refusal under its
  field, "Password changed." as a Messages alert at the section's head); **Agent access**
  in a `PanelSection` with "+ New token" as its `action`: a ruled table from `lg` (Name
  semibold and wrapping, Made, Last used, ⋯), rows below (leading ⋯, the name, "Made
  <date> · Last used <date> <time>" or "Made <date> · Never used", each date and time
  unbroken), "No tokens yet." when none, the muted line under the panel.
- The New token dialog (`FormDialog`): Name with its hint, Cancel, Create token. With the
  script the post keeps the dialog open and, on `form.token`, it becomes "Token made:
  <name>": the read-only mono field on `muted` that selects itself on focus, the line,
  primary Copy (writes the clipboard, then reads "Copied"; it takes the focus), outline
  Done. Closed by any means, the token leaves the page's state for good (the page's
  `form` is cleared, e.g. `invalidateAll` plus `applyAction` of nothing, so Back, a
  reopen and a reload never show it). Without the script, `?new=token` shows the form
  inline, and the made token shows in an inline panel at the section's head with Done, a
  link to `/account`.
- Revoke… opens the confirm (`FormDialog`, title "Revoke "<name>"?", the line,
  destructive Revoke posting `?/revokeToken` with `id` and `confirm=yes`). Done: the line
  leaves, "Token revoked.", the focus on "+ New token". Without the script round 1's
  `confirmRevoke` (and `?revoke=<id>`) renders the same confirm inline.

- [ ] **Step 1: Write the failing e2e steps** in `e2e/agent.test.ts` and `e2e/accounts.test.ts` (phone and PC projects): "+ New token" → "kimai-import" → the dialog shows a `tk_` token and Copy; Copy → "Copied"; Done → the list has kimai-import and "Never used"; reload → no `tk_` text on the page; Back after Done → none; reopen "+ New token" → an empty Name, no token (Review Focus 2); a duplicate name → "You already have a token with that name." under Name, the name kept; a 100-character name → `document.documentElement.scrollWidth <= innerWidth` and its ⋯ is visible (Review Focus 5); ⋯ → Revoke… → the confirm names it → Revoke → gone, "Token revoked."; Escape on each dialog returns focus to its opener; a mismatched confirm → "Passwords do not match." under Confirm new password; the made token still opens `/mcp`.
- [ ] **Step 2: Run** `npx playwright test e2e/agent.test.ts e2e/accounts.test.ts` → FAIL.
- [ ] **Step 3: Implement** the page and token pieces as above.
- [ ] **Step 4: Run** the same → PASS; `npm run check`, `npm run lint` → clean.
- [ ] **Step 5: Commit** `feat: redo account with panels and token dialogs`.

### Task 4: Users

**Files:**

- Modify: `src/routes/(app)/admin/users/+page.svelte`, the Users steps of
  `e2e/accounts.test.ts`, `e2e/touch-targets.test.ts` where it measures Users

**Interfaces:**

- Consumes: Tasks 1, 2.
- The page (spec, Users): `max-w-3xl`; one `PanelSection` "Users" with "+ New user";
  from `lg` a ruled table (Username semibold, "(you)" muted on your own, a disabled one
  muted and struck through with the spent chip "Disabled"; Role "Admin" or "User";
  Created; ⋯ from `userItems`), by username; below `lg` rows (leading ⋯, the username
  with the Admin or Disabled chip, "Created <date>" and "· you"). Row sheet head: the
  username over "<Admin|User> · created <date>".
- New user dialog: Username (hint), Password (hint), the Admin checkbox, Cancel, primary
  Create user; a refusal under its field, the username and Admin kept, the password
  empty. Set password dialog: New password and its hint (the own-row wording on your
  own), Cancel, primary Set password. Disable and Enable post at once. Done messages are
  Messages alerts at the section's head ("Created <name>.", "Password set.", "User
  disabled.", "User enabled."); a dialog closes on success and the focus goes to "+ New
  user" (create) or the row's ⋯. Without the script `?new=user` and `?password=<id>`
  show the forms inline, and a refusal re-renders them (Review Focus 1).

- [ ] **Step 1: Write the failing e2e steps** (phone and PC): "+ New user" with "ab" → the message under Username in the dialog, "ab" kept, the password empty; in a `javaScriptEnabled: false` context the same post from `/admin/users?new=user` → the form inline with "ab" and the message (Review Focus 1); create the test user → "Created <name>." and a "User" row; ⋯ → Set password… → set → "Password set."; ⋯ → Disable → struck through with "Disabled", and that user cannot sign in from a second context; ⋯ → Enable → can; the admin's own ⋯ has no Disable item, its Set password… hint says "Signs you out everywhere else", and setting it leaves the admin on Users (Review Focus 4); a 32-character username → no horizontal overflow at 390 px (Review Focus 5); at 390 px no control's box overlaps the "+"'s.
- [ ] **Step 2: Run** `npx playwright test e2e/accounts.test.ts` → FAIL.
- [ ] **Step 3: Implement** the page as above.
- [ ] **Step 4: Run** the same and `npx playwright test e2e/touch-targets.test.ts` → PASS; `npm run check`, `npm run lint` → clean.
- [ ] **Step 5: Commit** `feat: redo users with a row menu and dialogs`.

### Task 5: Backup

**Files:**

- Modify: `src/routes/(app)/admin/backup/+page.svelte`, `e2e/backup.test.ts`

**Interfaces:**

- Consumes: Task 2 (`PanelSection`, `FormDialog`).
- The page (spec, Backup): `max-w-3xl`; three `PanelSection`s. Backup: the text, the
  foot's primary Download backup. Restore: the text, the Backup file row (the input's
  button dressed as an outline button, the chosen name muted beside it, `accept=".db"`),
  the foot's destructive Restore…, the refusal alert in the panel. With the script
  Restore… is `type="button"`: no file → the panel shows "Choose a backup file." and
  nothing is posted (Review Focus 3); a file → the confirm (`FormDialog`, "Restore this
  backup?", the file's name in mono in the first line, the muted second line, Cancel and
  destructive Restore, which submits the form with `confirm=on` and the file). The
  checkbox is `data-nojs` (call 14); without the script Restore… is the submit button.
  Before the last restore: the line and the foot's outline Download, only when the file
  exists.

- [ ] **Step 1: Write the failing e2e steps** (phone and PC): Download backup → a file matching `time-keep-\d{4}-\d{2}-\d{2}-\d{4}\.db`; Restore… with no file → "Choose a backup file." and no dialog (Review Focus 3); choose the downloaded file, Restore… → a dialog containing its name; Cancel → still on Backup; Restore… then Restore → `/login?restored=1` with "Restored. Sign in with the backup's passwords."; sign in as admin → "Before the last restore" with Download; a file that is not a backup → "This file is not a time-keep backup." in the Restore panel; in a `javaScriptEnabled: false` context the checkbox shows and a post without it → "Tick the box to confirm the restore."; Restore…'s computed `background-color` at rest is not the red (it equals its panel's surface).
- [ ] **Step 2: Run** `npx playwright test e2e/backup.test.ts` → FAIL.
- [ ] **Step 3: Implement** the page as above.
- [ ] **Step 4: Run** the same → PASS; `npm run check`, `npm run lint` → clean.
- [ ] **Step 5: Commit** `feat: redo backup with a restore confirm`.

### Task 6: The sign-in page and the error pages

**Files:**

- Create: `src/lib/components/shell/CardPage.svelte`, `src/routes/+error.svelte`,
  `src/routes/(app)/+error.svelte`
- Modify: `src/routes/login/+page.svelte`, `e2e/shell.test.ts`, and every
  `getByLabel('Password')` in `e2e/` → `getByLabel('Password', { exact: true })`

**Interfaces:**

- Consumes: Task 1 (login's `username` on failure), Task 2 (`PanelSection` for the
  shell's error panel).
- Produces: `CardPage.svelte` props `{ title: string; children: Snippet }` — the ground;
  the wordmark (the sidebar's blue ring and "time-keep", 24 px bold) centred; 24 px under
  it the surface card (`border`, 4 px corners, at most 400 px, 32 px padding; 20 px
  padding and full width less 16 px margins below `sm`), its h1 `title` centred at 21 px
  semibold; vertically centred from `sm`, 56 px from the top below.
- The sign-in page (spec, The sign-in page): `CardPage` "Sign in"; the alerts above the
  fields; Username (the echoed `username` after a refusal); Password with the eye
  (`data-js`, a ghost icon button inside the field's right end, Lucide `eye`/`eye-off`,
  36/44 px, `aria-label` "Show password" / "Hide password", `aria-pressed`, toggling the
  field's `type` and leaving the focus where it was); the full-width primary Sign in. A
  refused sign-in focuses Password (call 17). `<title>` "Sign in".
- `src/routes/+error.svelte`: `CardPage` titled "Not found" for a 404, else the error's
  message (e.g. "Admins only"), one sentence, an outline link "Back to Today" to `/`.
  `src/routes/(app)/+error.svelte`: inside the shell, the header's title the same words
  (through whatever the layout reads its title from), one panel with the sentence and
  "Back to Today". Status codes unchanged (spec, The error pages; call 21).

- [ ] **Step 1: Write the failing e2e steps** (phone and PC): `/login` shows the heading "Sign in" and no element with the rail's background colour; a wrong password → "Wrong username or password.", the Username field still holds the name, the focus on Password; the eye → the field's `type` is `text`, again → `password`; as a non-admin, `/admin/users` → status 403, the shell's navigation present, "Admins only", and "Back to Today" leads to `/`; `/no-such-page` → 404, "Not found", a "Back to Today" link.
- [ ] **Step 2: Change** every `getByLabel('Password')` in `e2e/` to the exact form; run `npx playwright test e2e/shell.test.ts` → the new steps FAIL, nothing else.
- [ ] **Step 3: Implement** `CardPage`, the sign-in page and the two error pages.
- [ ] **Step 4: Run** `npm run test:e2e` → PASS (every test signs in through the new page); `npm run check`, `npm run lint` → clean.
- [ ] **Step 5: Commit** `feat: redo the sign-in and error pages as kimai's card`.

### Task 7: The sweep, critique and docs

**Files:**

- Modify: whatever the sweep finds in round 1's look (look-only fixes, call 18);
  `docs/app.md` (Account, Backup, a new Users section after Account, the sign-in and
  error pages); `DESIGN.md` (through impeccable's documenter); `PRODUCT.md`'s "Built
  today" and "Next, in order" lines

**Interfaces:**

- Consumes: Tasks 1–6.

- [ ] **Step 1: Sweep.** Build and run the app on a seeded month as `.claude/agents/usability-gate.md` describes, and screenshot at 390 and 1440 px in both themes, as the seeded user and as admin: every sidebar and More screen, `/entries/new`, an `/entries/<id>`, `/templates/new`, a `/templates/<id>`, `/setup?new=customer`, `/account?new=token`, `/admin/users?new=user`, `/admin/users?password=<id>`, `/login`, a 403 and a 404. List each round 1 leftover found (a round 1 layout or a field grid with a Show button, a form always open where a "+ New …" belongs, a control under the "+", an unstyled page) in `.autopilot/agents/15d-sweep.md`. Fix the look-only ones (a class or layout swap), each in its own `fix:` commit; file each behaviour leftover as a GitHub issue in `vbartalis/time-keep` with the `bug` label and note its number in the sweep file.
- [ ] **Step 2: Critique and audit** the three screens, the sign-in page and the error pages with `impeccable:impeccable` (`critique`, then `audit`) from those screenshots; fix every material finding; record the rest in the sweep file.
- [ ] **Step 3: Docs.** Update `docs/app.md` to what ships; run impeccable's documenter so `DESIGN.md` records the shipped screens, drops "Screen components carried from round 1" and the sentence that Account, Users and Backup keep round 1's layouts, and names `PanelSection`, `ActionMenu`, `FormDialog` and `CardPage`; bring `PRODUCT.md`'s two lines up to date.
- [ ] **Step 4: Run** `npm run check`, `npm run lint`, `npm run test:unit`, `npm run test:e2e` → all pass.
- [ ] **Step 5: Commit** `docs: record account, users, backup and sign-in`.

Approved by the operator stand-in, revision 1, 2026-10-21.
