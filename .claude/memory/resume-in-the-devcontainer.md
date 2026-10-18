---
name: resume-in-the-devcontainer
description: Where the work stands after the 2026-10-18 setup session and what comes next once inside the devcontainer
metadata:
  type: project
---

On 2026-10-18 the setup was finished on the Windows host and work moved into the
devcontainer. Committed and pushed on `main`: Claude Code setup, the devcontainer,
`docs/vision.md`, decisions 1 (SvelteKit + SQLite + Drizzle, Node 24) and 2
(Tailwind + shadcn-svelte). The container has been built and its plugin install
worked (ECC pinned to v2.2.3 from inside it).

**Why:** the next session starts inside the container with no memory of the setup.

**How to apply:**
1. Confirm the first-start steps in `docs/environment.md` are done (Claude login,
   `gh auth login -s project`, plugins installed, `dev` works).
2. Next work: scaffold the SvelteKit app per decisions 1 and 2. Brainstorm and plan
   first (superpowers); the design gate is the operator's. Read
   [[brainstorm-context-beyond-the-vision]] before brainstorming.
3. The operator opens the repo with "Clone Repository in Container Volume", so the
   working tree is in a Docker volume. The compose mount must stay `../..:/workspaces`;
   a deeper target hides the clone (fixed in `ded8784`).
