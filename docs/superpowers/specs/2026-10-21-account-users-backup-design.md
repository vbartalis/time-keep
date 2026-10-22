# Account, Users, Backup and the sign-in page — design

Roadmap item 15d, the last part of item 15. Written 2026-10-21 in an autopilot design
session; the operator stand-in answered in the operator's place (see the last section).
The mockups it judged are in
[`2026-10-21-account-users-backup/`](2026-10-21-account-users-backup/), each at 1440 px
(`pc-`) and 390 px (`ph-`) in light and dark (`-light.png`, `-dark.png`): `login`,
`account`, `account-token-made`, `users`, `users-new`, `users-set-password`, `backup`,
`backup-confirm`. They are static, drawn into the real shell with invented data; where
this text and a mockup differ, this text wins. Round 1's designs, whose behaviour this
keeps, are [`2026-10-18-foundation-design.md`](2026-10-18-foundation-design.md) (accounts
and sessions), [`2026-10-19-mcp-server-design.md`](2026-10-19-mcp-server-design.md)
(agent access) and [`2026-10-19-backup-restore-design.md`](2026-10-19-backup-restore-design.md).

## Intent

These are the screens nobody opens often. A token is made when an agent is set up (the
Kimai import, a month-end tidy-up), a password changes now and then, a user is made or
a password reset, a backup is taken before a risky change; mostly at the desk, on the
PC, and they must still work fully on the phone (calls 1, 2). The sign-in page is the
first thing seen on every new device.

Round 1 built them (items 1, 7, 8) and they work; item 11 only re-dressed them in its
tokens. What fails is round 1's pattern: forms always open on the page, a password
field and two buttons on every user's row, a "Disable" under the phone's "+", a token
revoked by turning its line into a question, a restore guarded by a checkbox, a sign-in
page that is a dark bar over a bare form, and error pages that are two lines of
unstyled text with no way back. DESIGN.md says it plainly: "Only Account, Users and
Backup keep round 1's layouts". This part redoes them in the patterns of items 12–15c:
Setup's section heads with an outline "+ New …", its surface panels of ruled rows, the
row ⋯ menu and row sheet, the create dialog and bottom sheet, and Kimai's sign-in card.
It is also the part that checks no screen still uses round 1's look or patterns
(roadmap, 15d).

What the screens do stays round 1's (docs/app.md, Account, Backup, and Accounts and
sessions): the same actions, checks, messages, sessions, tokens, backup file and
restore. Nothing in the core, the database, the auth rules or the MCP changes.

## Shared by the three admin and account screens

- **Width:** a column of about 48 rem, left-aligned on the content edge like every
  other screen (call 8).
- **Sections** stack 32 px apart. Each is the section head (an h2 in `caps` on a 1 px
  text-colour rule) with its outline "+ New …" at the head's right on the PC, under the
  rule at the left on the phone (Setup's). Under it, on the PC, a surface panel (4 px
  corners, `border` stroke) holding the section's ruled rows; on the phone the rows run
  on the ground, ruled, edge to edge (call 7).
- **Lists** (tokens, users) are the ruled table in the panel on the PC: the muted head
  band of `caps` heads, 40 px rows, the ⋯ in the last column. On the phone each is a
  row of at least 48 px: the 44 px ⋯ leading, the name in 15 px semibold, a 13 px muted
  line under it, 56 px kept clear at the right for the "+".
- **The ⋯** opens Setup's row menu: on the PC the 208 px popover under it, right-aligned,
  following the menu-button pattern; on the phone the row sheet with a head naming the
  row. Without JavaScript it is a disclosure, as Setup's.
- **Forms in a panel** (Change password, Restore) are ruled rows of a label column
  (12 rem) and the field, and a foot row with the form's button at the right on the PC;
  on the phone the label over the field and the button full width.
- **Dialogs:** "+ New …", Set password… and the confirms open Setup's create dialog
  (440 px on the PC; a wider one is the builder's call) or the bottom sheet on the
  phone: the head (17 px bold title, a ghost ×), the body, the foot pinned on a rule
  with outline Cancel and the action, two equal halves on the phone, right-aligned on the
  PC. The first field takes the focus; Escape, the scrim and Back close it; focus returns
  to the opener. A refusal stays in the dialog beside its field, the typed values kept
  (passwords are never sent back; their fields come back empty). Without JavaScript the
  same form shows as a panel in the page, as Setup's `?new=` page does.
- **Messages:** a done action that closes its dialog says so in a Messages alert at its
  section's head ("Password changed.", "Created anna.", "Password set.", "User
  disabled.", "User enabled.", "Token revoked."), as now. There is no undo strip:
  accounts are outside the history (decision 4; call 16).
- **Red** is only for Revoke, Restore and refusals, in DESIGN.md's destructive style
  (surface fill, red at 60 % stroke, red text; fills red on hover), never a solid red
  fill (call 10). Blue is the one primary per form.
- 36 px controls on the PC, 44 px on the phone; nothing under the "+"; no sideways
  scroll at 390 px.

## Account (`/account`)

`account`, `account-token-made`. In the sidebar and under More, as now; header title
"Account". One page with two sections (call 6):

### Change password

The panel: Current password, New password, Confirm new password, each a ruled row; the
foot's primary **Change password**. The checks and messages are round 1's ("Passwords
do not match.", the length rule and the wrong current password as the server words
them, "Password changed."); it keeps the current session and ends the others.

### Agent access

The head's outline **+ New token**. The panel's table: **Name** (semibold), **Made**
(the date), **Last used** (date and `HH:mm` in figures, or "Never used" muted), ⋯. Newest
first. None: "No tokens yet." muted, in the panel. Under the panel one muted 13 px line:
"Agents use a token to reach time-keep through the MCP server. A token is shown once,
when it is made."

- **+ New token** opens the dialog "New token": Name (with the muted hint "Name it after
  the agent or machine that will use it."), outline Cancel and primary **Create token**.
  The name rules and refusals are round 1's ("Name must be 1–100 characters.", "You
  already have a token with that name.").
- **Made:** the same dialog becomes "Token made: <name>" (call 9): the token in a
  read-only mono field on the muted fill that selects itself on focus, the line "Copy it
  now: it is not shown again.", and in the foot a primary **Copy** ("Copied" after;
  Copy takes the focus) and an outline **Done** that closes it. The list behind already
  holds the new token. Closing it by any means is final: the next load does not have the
  token. Without JavaScript the page shows the same panel at the section's head, with
  the field and Done (a link back to `/account`) and no Copy.
- **⋯ → Revoke…** (red, its 14 px icon) opens the confirm "Revoke "<name>"?" with the
  line "Agents using it lose access at once. This cannot be undone." and outline Cancel
  and a destructive **Revoke** (call 4). Done: the line leaves the list, "Token revoked."

## Users (`/admin/users`)

`users`, `users-new`, `users-set-password`. Admin only, as now (signed out → sign-in, a
non-admin → the error page, 403). Header title "Users". One section, **USERS**, with the
head's outline **+ New user**.

- **PC table:** **Username** (semibold; "(you)" muted after your own), **Role** ("Admin"
  or "User"), **Created** (the date in figures), ⋯. By username. A disabled user's name
  is muted and struck through, with the spent chip "Disabled" after it.
- **Phone list:** the leading ⋯, the username (15 px semibold) with the Admin chip or the
  Disabled chip after it, and under it "Created 2026-10-01" muted ("· you" on your own).
- **⋯ menu:** **Set password…**; a rule; **Disable** or **Enable**. Your own row has no
  Disable (the server refuses it anyway). Neither is red: Disable is undone by Enable
  (call 13). The row sheet's head is the username over "Admin · created 2026-10-01".
  - **Set password…** opens "Set password for <username>": New password, the muted hint
    "10 to 256 characters. Signs <username> out everywhere; their agent tokens keep
    working." (on your own row: "Signs you out everywhere else; …"), outline Cancel and
    primary **Set password**. Round 1's rules: it ends that user's sessions (yours: the
    others), leaves tokens alone.
  - **Disable** acts at once, as now, and says "User disabled."; the row turns struck
    through with the chip. Disabling still ends their sessions and deletes their
    tokens (round 1); **Enable** brings back sign-in, not tokens.
- **+ New user** opens "New user": Username (hint "3 to 32 characters: a–z, 0–9, dot,
  underscore, hyphen."), Password (hint "10 to 256 characters."), the Admin checkbox,
  outline Cancel and primary **Create user**. Round 1's refusals, as the server words
  them, show in the dialog.

## Backup (`/admin/backup`)

`backup`, `backup-confirm`. Admin only, as now. Header title "Backup". Three sections,
each a panel:

- **BACKUP:** round 1's text, and the foot's primary **Download backup** (the same link
  and file).
- **RESTORE:** round 1's text; a row Backup file with the file input (its button dressed
  as an outline button, the chosen name muted beside it, `accept=".db"`); the foot's
  destructive **Restore…**. With no file chosen, Restore… says so as now ("Choose a
  backup file.") without opening the confirm. With one, it opens the confirm (call 5)
  "Restore this backup?": "Restoring <file name, mono> replaces every user's data with the
  backup's and signs everyone out, you included." and the muted "The data as it is now is
  kept, and can be downloaded under Before the last restore.", outline Cancel and a
  destructive **Restore**, which posts the form. The checkbox goes. A refusal ("This file
  is not a time-keep backup." and the rest) shows as a red alert in the Restore panel,
  as now. Done: the sign-in page with "Restored. Sign in with the backup's passwords."
  Without JavaScript there is no dialog: the form keeps round 1's checkbox and its
  "Tick the box to confirm the restore." (call 14).
- **BEFORE THE LAST RESTORE**, only when that file exists: round 1's line and the foot's
  outline **Download**.

## The sign-in page (`/login`)

`login`. Kimai's sign-in (call 3): no dark bar. On the ground, centred on the PC (near
the top on the phone, 56 px down), the wordmark (the sidebar's blue ring and
"time-keep", 24 px bold) and 24 px under it a surface card (`border` stroke, 4 px
corners, at most 400 px wide, 32 px padding; 20 px on the phone, full width less 16 px
margins): the h1 "Sign in" centred (21 px semibold), Username, Password, and a
full-width primary **Sign in**. The page's title stays "Sign in".

- **The eye** (call 11): a ghost icon button inside the password field's right end
  (Lucide eye / eye-off, 44 px target on the phone, 36 px on the PC), "Show password" /
  "Hide password" to assistive technology (`aria-pressed`); it switches the field
  between hidden and shown and keeps the focus where it was. Script-only.
- No "forgot password" (there is no mail; the admin sets passwords on Users).
- The refusal "Wrong username or password." and "Restored. Sign in with the backup's
  passwords." show as Messages alerts in the card above the fields, as now. A refused
  sign-in keeps the username and focuses the password (call 17).
- Signed in already → Today, as now.

## The error pages

An unknown address and a refused one show today as SvelteKit's bare "404 / Not Found"
text with no way back (call 15). Inside the signed-in shell (a non-admin on `/admin/…`,
a missing entry) the error shows in the shell: the header's title "Not found" or
"Admins only", and one panel with a sentence and an outline link "Back to Today".
Outside it (an unknown address before the shell's load, signed out) the sign-in page's
wordmark and card hold the same. The status codes stay.

## The sweep

The last part checks that no screen still uses round 1's look or patterns (roadmap,
15d). The builder walks every route in the sidebar and More, the no-JavaScript pages
(`/entries/new`, `/entries/[id]`, `/templates/new`, `/templates/[id]`, Setup's `?new=`),
the error pages and the sign-in page, at both widths and themes, and lists each
leftover found (a round 1 layout, a field grid with a Show button, a control under the
"+", an unstyled page). Leftovers on this part's screens are fixed here; a leftover
elsewhere is fixed here when it is round 1's look (a class or layout swap), and becomes
a GitHub issue when it is behaviour (call 18). `DESIGN.md`'s "Screen components carried
from round 1" goes.

## The reference each part follows

| Part | Follows | Departs from |
|------|---------|--------------|
| Sections, "+ New …", panels of ruled rows | Setup (item 15a) | round 1's always-open forms on the ground |
| ⋯ row menu and row sheet | Setup and Templates (15a); Entries' row menu (14) | round 1's password field and buttons on every row |
| Create, set password and confirms in a dialog or sheet | Setup's create dialog (15a); the bottom sheet | round 1's in-line revoke question and the restore checkbox |
| Token shown once in its dialog | the dialog that made it | round 1's token panel above the list |
| The sign-in card, wordmark above, the eye | Kimai's sign-in (demo.kimai.org, seen 2026-10-21) | round 1's dark bar over a bare form; Kimai's "I forgot my password" |
| Error pages in the shell or the card | the shell; the sign-in card | SvelteKit's default text |

The reference study (`docs/reference-study.md`) covers none of these screens; Kimai's
profile and user pages could not be seen past the demo's sign-in, so only its sign-in
page was a reference.

## Goals

- Make an agent's token, copy it, see when it was last used, revoke it; change your
  password: in a few clicks on the PC, fully on the phone.
- As the admin: make a user, set a user's password, disable and enable a user.
- Take a backup and restore one, with one clear confirm before the restore.
- Sign in on a phone or a PC on a page that looks like Kimai's.
- No screen left in round 1's look.

## Non-goals

- Any change to the auth rules, sessions, tokens, user rules, the backup file, the
  restore, the core, the database or the MCP.
- Deleting users, renaming them, changing the admin flag, per-token scopes or expiry,
  "forgot password", tabs on Account, a last-sign-in column.
- The `--input` stroke contrast (GitHub issue #1): left to its issue (call 12).

## Anti-goals

- A control under the phone's "+"; a page wider than the phone.
- A solid red button; red for anything but Revoke, Restore and refusals.
- A token that can be seen again after its dialog closes.
- A restore that runs (with JavaScript) without a confirm naming the file.
- Any round 1 layout left: a form always open on the page where a "+ New …" belongs, a
  field on every row, a page of unstyled text.

## Constraints

- SvelteKit, server-rendered; usable without JavaScript as pages (PRODUCT.md). Tailwind
  and shadcn-svelte (decision 2); item 11's tokens and shell (decision 9, DESIGN.md);
  Setup's components (`components/setup/`: the create dialog, the menu, the list) and the
  bottom sheet (`components/timesheet/Sheet.svelte`) reused or generalised, not copied.
- The server actions keep their names, fields and messages, except Backup's `confirm`,
  which the dialog's Restore sends; the action keeps refusing without it.
- The sign-in page keeps its labels ("Username", "Password") and button ("Sign in"),
  which every e2e test signs in through.
- WCAG 2.2 AA in both themes; 44 px targets on the phone, 36 px on the PC.
- English, 24-hour clock, ISO dates.
- Round 1's `accounts`, `agent` and `backup` e2e tests are rewritten for the new screens,
  keeping their behaviours; the unit tests of the users, tokens and backup modules keep
  passing unchanged.
- `docs/app.md`'s Account and Backup sections, and a Users section, are updated;
  `DESIGN.md` is recorded from what ships (impeccable's documenter), dropping "Screen
  components carried from round 1" and the sentence that Account, Users and Backup keep
  round 1's layouts.

## Gate tasks

On a seeded month (`scripts/seed-month.ts`: the 30 days before today, customers CompX
and Myself, the user `gate-user`), with the app's admin `admin` (password
`admin-password-1`), at 390 px and 1440 px, in light and in dark.

1. **Sign in.** Open the app signed out: the sign-in page is the wordmark over a
   centred card, no dark bar. Sign in as gate-user with a wrong password: "Wrong
   username or password." in the card, the username kept. Type the right password,
   press the eye: the password shows; press it again: hidden. Sign in: Today.
2. **Make and revoke a token.** As gate-user open Account. "+ New token", name it
   "kimai-import", Create token: the dialog shows the token once with Copy; Copy, then
   Done. The list shows kimai-import, made today, "Never used". Reload: the token is not
   shown anywhere. Make a second one with the same name: refused in the dialog. ⋯ on
   kimai-import → Revoke…: the confirm names it; Revoke: it leaves the list, "Token
   revoked."
3. **Change your password.** On Account change gate-user's password with a mismatched
   confirm (refused), then properly: "Password changed." Sign out and sign in with the
   new password.
4. **Manage a user (admin).** Sign in as admin, open Users from the sidebar (PC) or More
   (phone). "+ New user": try "ab" (refused in the dialog, the username kept), then
   "anna" with a 10-character password, not admin: "Created anna." and anna in the list
   as User. ⋯ on anna → Set password…: set a new one, "Password set.". ⋯ → Disable: anna
   struck through with Disabled; in another browser context, anna cannot sign in. ⋯ →
   Enable: she can. Your own row has no Disable.
5. **Back up and restore (admin).** On Backup, Download backup: a file named
   `time-keep-<date>-<time>.db`. Press Restore… with no file: "Choose a backup file.".
   Choose the downloaded file, Restore…: the confirm names it; Cancel: nothing happens.
   Restore… again, Restore: the sign-in page with "Restored. Sign in with the backup's
   passwords."; sign in as admin: Backup now shows Before the last restore with its
   Download.
6. **Not an admin.** As gate-user open `/admin/users`: the error page in the shell,
   "Admins only", with Back to Today, which works. Open `/no-such-page`: a styled "Not
   found" with a way back.
7. **The phone.** Every task above at 390 px: the dialogs are bottom sheets with Cancel
   and the action in two halves, nothing under the "+", no sideways scroll, every
   target at least 44 px.
8. **Keys and look.** Tab reaches every control in order; each dialog and sheet takes
   the focus on its first field, closes on Escape and returns focus to its opener; the
   ⋯ menus follow the arrows. Both themes, both widths: the panels on the PC, one blue
   button per form, Revoke and Restore red-outlined, never solid red.
9. **No round 1 left.** Visit every screen in the sidebar and More, and the sign-in
   page: none shows a round 1 layout (a form always open where a "+ New …" belongs, a
   password field on a row, a bare unstyled page, a control under the "+").

## Builder's latitude

The plan decides, within the above: the component structure and what Setup's dialog,
menu and list become to serve all three screens; the dialogs' widths; how the no-JS
pages carry the dialogs' forms (Setup's `?new=` shape or another); how the made token
reaches the dialog; the error pages' exact sentences; icons in the menus. Server logic
is unit-tested; the interactions are covered by browser tests.

## Calls made in the operator's place

The stand-in's answers (`docs/questions.md` holds what it queued); its rounds are in
`.autopilot/agents/15d-standin-r1.md` and `-r2.md`.

1. **Account is opened rarely, mostly on the PC (a token when an agent is set up, a
   password now and then); PC first, fully usable on the phone.** Source: vision,
   Agents; operator's voice (2026-10-18, the PC for tedious work); roadmap item 15's
   exit. Confidence: device inferred, frequency ungrounded, queued.
2. **Users and Backup are opened rarely, on the PC; they stay in the sidebar and More.**
   Source: vision, Users and Hosting; operator's voice (2026-10-18). Confidence: device
   inferred, frequency ungrounded, queued.
3. **The sign-in page is Kimai's centred card with the wordmark above, without "I forgot
   my password".** Source: operator's voice (2026-10-19, "nothing like kimai"); Kimai's
   sign-in (screenshots of the demo); item 11's choice of Kimai's structure.
   Confidence: inferred.
4. **Users' set password and disable, and a token's revoke, go in a ⋯ row menu opening
   a dialog (PC) or sheet (phone); a revoke keeps a confirm, since it cannot be undone.**
   Source: roadmap item 15 ("the patterns of 12–14", none in round 1's look); Setup's and
   Templates' row menus; the study (confirms only where undo cannot replace them).
   Confidence: inferred.
5. **Creating a user or a token is an outline "+ New …" at the section head opening a
   dialog or sheet; Restore opens a confirm dialog naming the file, replacing the
   checkbox.** Source: roadmap item 15; Setup's create; roadmap item 8 (the before-restore
   copy kept, the checkbox a round 1 call). Confidence: inferred.
6. **Account stays one page of two sections, not tabs.** Source: none; Setup was kept one
   screen in 15a. Confidence: ungrounded, queued.
7. **On the PC each section's rows sit in a surface panel, as Setup's (over ruled lines
   on the ground).** Source: DESIGN.md (Setup, Today, Templates); roadmap item 15.
   Confidence: inferred.
8. **The column is about 48 rem wide, not the full measure.** Source: none; round 1's
   42 rem. Confidence: ungrounded, queued.
9. **A new token is shown once in the dialog that made it, with Copy and Done.** Source:
   roadmap item 15; Setup's create dialog. Confidence: inferred.
10. **Destructive buttons are DESIGN.md's red outline, never a solid red fill.** Source:
    DESIGN.md, Buttons; item 11 (red kept rare). Confidence: grounded.
11. **An eye in the password field shows and hides the password.** Source: Kimai's
    sign-in. Confidence: inferred.
12. **GitHub issue #1 (the `--input` stroke below 3:1) is left to its issue, not fixed
    in this part.** Source: docs/questions.md (2026-10-20 — 12, still unanswered); item
    14 kept `--input`. Confidence: ungrounded; the 2026-10-20 entry covers it.

The builder's:

13. Disable is not red and has no confirm; Enable undoes it (round 1's behaviour, under
    the stand-in's menu of Set password…, Disable or Enable).
14. Without JavaScript the restore keeps round 1's checkbox: a two-step confirm would
    lose the chosen file between the two posts.
15. The error pages are redone (in the shell when signed in, in the sign-in card
    otherwise): they are pages a user reaches, and round 1's bare text fails the
    item's exit.
16. Success messages stay Messages alerts at the section's head; accounts have no
    history, so no undo strip.
17. A refused sign-in keeps the username and focuses the password.
18. The sweep fixes look-only leftovers anywhere and files behaviour leftovers as
    issues, so the item's exit is met without this part growing into other screens'
    behaviour.

From the builder check (`.autopilot/agents/15d-builder-check.md`, nothing left for the
operator):

19. The dialogs' Revoke and Restore send the fields the actions already read
    (`confirm=yes`, `confirm=on`); without JavaScript, Revoke keeps the action's two-step
    confirm as an in-page panel and Restore its checkbox.
20. A refusal is placed beside the field it names by the route or the page; the users and
    tokens modules keep returning a bare message. One that names no field shows at the
    dialog's top.
21. An unknown address shows the root error page in the sign-in card, signed in or not;
    a 403 or a missing entry shows the shell's error page.

Approved by the operator stand-in, revision 1, 2026-10-21.
