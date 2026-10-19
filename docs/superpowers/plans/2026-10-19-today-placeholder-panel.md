# Today's Placeholder Panel Implementation Plan

Approved by the operator stand-in, revision 1, 2026-10-19.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "At the desk — Not built yet" panel from Today on phone and PC, changing nothing else.

**Architecture:** One Svelte page loses one section, its data array and an import; the two-column grid wrapper stays so the PC's main column keeps its width. One end-to-end test pins the panel's absence and the remaining sections' presence at both widths (the Playwright config already runs every test at phone and 1440 px).

**Tech Stack:** SvelteKit, Svelte 5, Tailwind, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-today-placeholder-panel-design.md`

## Global Constraints

- Nothing else on Today changes, on either surface: heading block, undo strip, Timers, Templates, Start a timer, Today's entries.
- Keep the wrapper `grid gap-10 xl:grid-cols-[minmax(0,1fr)_19rem]` exactly as it is (the main column must not widen or move on the PC).
- Nothing takes the panel's place.
- Touch a part, update its doc in the same change (`docs/app.md`, Today).
- `DESIGN.md`'s "Not built yet" chip example stays as written; item 11 rewrites `DESIGN.md` (builder's call, after the stand-in's non-blocking note at plan approval).
- Commits: Conventional Commits, no scope, lowercase imperative, no attribution.

## Review Focus

- The PC at 1440 px: the main column's width and left edge are the same as before the change (the empty side track is kept, not collapsed).
- The phone at 390 px: the page ends with Today's entries; no leftover heading, border or gap where the panel was.
- No JavaScript: the page still renders without the panel (it is static markup, so the same test without JS is not needed; the existing no-JS tests stay green).
- `Badge` stays used elsewhere (`TodayEntries`, Entries, Setup, History, Users); only this page's import goes.

---

### Task 1: Remove the panel from Today

**Files:**
- Modify: `src/routes/(app)/+page.svelte` (the `Badge` import, the `desk` array and its comment, the `<section aria-labelledby="desk-heading">`)
- Modify: `docs/app.md` (Today, the line "In thumb order, one column on the phone (the PC adds a side column):")
- Test: `e2e/phone.test.ts`

**Interfaces:**
- Consumes: the file's existing `signIn(page, username)` and `section(page, name)` helpers and `user`.
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing test** in `e2e/phone.test.ts`, after the template-undo test:

```ts
test('Today shows no placeholder panel, only its working sections', async ({ page }) => {
	await signIn(page, user.username);

	await expect(page.getByRole('heading', { name: 'At the desk' })).toHaveCount(0);
	await expect(page.getByText('Not built yet')).toHaveCount(0);
	for (const name of ['Timers', 'Templates', 'Start a timer', 'Today’s entries'])
		await expect(section(page, name)).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/phone.test.ts -g "no placeholder panel"`
Expected: FAIL on both projects (the "At the desk" heading has count 1).

- [ ] **Step 3: Remove the panel** in `src/routes/(app)/+page.svelte`: delete the `Badge` import, the `// Not features: …` comment with the `desk` array, and the whole `<section aria-labelledby="desk-heading">…</section>`. Leave the grid wrapper and its first child untouched.

- [ ] **Step 4: Update `docs/app.md`**, Today: replace "In thumb order, one column on the phone (the PC adds a side column):" with "In thumb order, one column; on the PC it keeps the width of a two-column layout, the side track left empty:".

- [ ] **Step 5: Run the test to verify it passes, then the checks**

Run: `npx playwright test e2e/phone.test.ts` — expected: all pass on both projects.
Run: `npm run check && npm run lint` — expected: 0 errors, lint clean.

- [ ] **Step 6: Commit**

```bash
git add 'src/routes/(app)/+page.svelte' docs/app.md e2e/phone.test.ts
git commit -m "feat: remove the placeholder panel from today"
```
