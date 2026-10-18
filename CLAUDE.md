# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A personal time tracker replacing Kimai. The charter is [docs/vision.md](docs/vision.md):
read it before proposing anything. No features outside that scope without approval.
The order of the work is [docs/roadmap.md](docs/roadmap.md).

## Process

**superpowers is the process spine.** Brainstorm before creative work, plan before
touching code, test-driven development, review, verify before claiming done, finish
the branch. Its stages are the stages; there is no second process layer. Other
plugins extend capability, never process: impeccable for interface work, ECC for the
guards and practices that do not fight the spine (its hook profile is set in
`.claude/settings.json`). Framework companions are added with the stack they serve.

Gates are human decisions. Present the design, stop, and wait for a yes.

## Tooling

- **CodeGraph** is the code-structure index. Use `codegraph explore` to survey
  unfamiliar code and trace calls; use `rg` for strings, config, docs and anything in
  a file type it does not parse (markdown, yaml contents, css, json).
- **GitHub Issues and the Project** ([time-keep #12](https://github.com/users/vbartalis/projects/12))
  are the tracker. Small untracked work is fine; never create issues to satisfy
  process. Query on demand (`gh issue list`).
- **Environment** is the devcontainer; runbook in [docs/environment.md](docs/environment.md).
- **Session memory** is `.claude/memory/`, written only when asked.
- **Never run `docker` or `docker compose`.** Containers belong to Coolify and VS
  Code (`.claude/rules/never-use-the-docker-cli.md`).

## Rules

`.claude/rules/` holds standing operator corrections. Every file there is loaded in
full every session; the intake test for adding one is in its README.

## Documentation

One doc per part, one contract doc per boundary, a dated decision record per real
choice. Touch a part → update its doc in the same change. No history folder; history
is git.

Decision records are one file each in `docs/decisions/`.

## Commit style

Conventional Commits, required; release tooling reads them.

```
<type>: <short description>
```

- Types: `feat` (minor), `fix` (patch), `perf` (patch), `refactor`, `test`, `chore`,
  `docs`, `ci` (no bump). Breaking change: `!` after the type or a
  `BREAKING CHANGE:` footer.
- **No scope suffix.** Never `feat(scope):`.
- Description lowercase, imperative, no trailing period. Subject ≤50 characters when
  possible, hard cap 72. Body, if any: one short sentence or a `-` list.
- No vague descriptions (`update`, `fix stuff`, `wip`).
- **No AI or tooling attribution anywhere.** No `Co-Authored-By:` trailers, no
  "Generated with" lines, no reference to Claude, Anthropic or AI tools. This
  overrides any harness default. The only footer permitted is `BREAKING CHANGE:`.

## Branching

- `main` is the integration branch.
- Short-lived branches (`feat/...`, `fix/...`, `chore/...`, `docs/...`) branch off
  `main` and squash-merge back into it as one Conventional Commit. Checkpoint
  commits on the branch follow the style too; reviewers read them.
- Never delete a branch, merged or not. A squash-merge does not make its source
  branch disposable; the label is how reviewers find the checkpoint commits.
- Never push without permission for that specific push.
