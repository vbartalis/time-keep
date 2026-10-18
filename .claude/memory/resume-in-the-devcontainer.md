---
name: resume-in-the-devcontainer
description: Where the work stands after the 2026-10-18 setup session and what comes next once inside the devcontainer
metadata:
  type: project
---

On 2026-10-18 the setup was finished on the Windows host and work moves into the
devcontainer. Done and committed on `main`, not pushed: Claude Code setup, the
devcontainer, `docs/vision.md`, decisions 1 (SvelteKit + SQLite + Drizzle, Node 24)
and 2 (Tailwind + shadcn-svelte). The container had not been built yet at that point.

**Why:** the session ended before the first container build; the next one starts
inside it.

**How to apply:**
1. Confirm the first-start steps in `docs/environment.md` are done (Claude login,
   `gh auth login -s project`, plugins installed, `dev` works).
2. Next work: scaffold the SvelteKit app per decisions 1 and 2. Brainstorm and plan
   first (superpowers); the design gate is the operator's.
3. Open concern: the repo is bind-mounted from the Windows drive, so `npm` is slow
   and Vite's file watching may need polling. The alternative is cloning into a WSL
   Ubuntu distro; the operator has not chosen yet.
