# The autopilot

The autopilot works the roadmap with no one at the keyboard. A shell script runs
fresh headless Claude Code sessions one after another. Each session follows the
`run-item` runbook: it picks the next unfinished unit in the current round, works it
through the superpowers stages (impeccable for anything on screen), and writes an
outcome file. Where the manual process would ask the operator, the operator stand-in
answers from the operator's own words; a unit is finished only when the usability
gate (a screen) or the stand-in (a document) passes it. The script reads the outcome
and decides whether to start the next session. It never pushes. Decision 8.

## The pieces

| File | What it is |
|------|------------|
| `scripts/autopilot.sh` | The loop. Holds no context; starts each session and reads its outcome. |
| `.claude/skills/run-item/SKILL.md` | The runbook every session follows: orient, the stages, who answers, the finish. |
| `.claude/agents/operator-stand-in.md` | Answers for the operator, approves specs and plans, makes the round's big calls, writes a document unit's verdict. |
| `.claude/agents/usability-gate.md` | Builds and runs the app on a seeded month, does the unit's tasks in Chromium, writes a screen unit's verdict. |
| `docs/operator-voice.md` | The operator's words, dated, as the stand-in reads them. Only the operator adds to it, never a run. |
| `docs/questions.md` | What the stand-in could not ground, with the call it made. Newest first. |
| `scripts/seed-month.ts` | Seeds a realistic month for one user: `TZ=Europe/Budapest npx tsx scripts/seed-month.ts <db> <user> <password>`. |
| `docs/roadmap.md` | The units. A unit is the first item or part in the current round without a done note. |

## Units and sessions

A unit is a roadmap item, or a part of one (`10a`) when a brainstorm splits it. It
lives on one branch, `feat/<unit>-<slug>` or `docs/<unit>-<slug>`, and takes two
sessions: a design session (brainstorm, spec, plan, each approved by the stand-in)
that ends with `continue`, and a build session (subagent-driven build, the checks,
the gate, the finish) that ends with `passed` or `failed`. A document unit, such as
item 10, finishes in one session. Each stage is committed on the branch, so a session
always leaves the tree clean. The finish squash-merges the branch into `main`
locally as one commit, keeps the branch, and writes the done note with every call
made in the operator's place.

The loop stops before item 9 (go-live); that one is the operator's.

## Starting a run

From a clean working tree, in a tmux window (the `dev` session's `misc` window, or a
new one):

```
scripts/autopilot.sh [max-sessions]
```

`max-sessions` defaults to 10. The script needs nothing from the terminal; it keeps
running when the window is detached. Each session starts with
`claude -p "Invoke the run-item skill and follow it." --disallowedTools <rules>
--permission-mode auto` (the rules are under Permissions below).

Two environment variables exist for testing the script: `AUTOPILOT_CLAUDE` (the CLI
to run, default `claude`) and `AUTOPILOT_DIR` (default `.autopilot`).

## Watching

Everything a run writes is under `.autopilot/`, which git ignores:

| Path | What |
|------|------|
| `runs.md` | One line per session: time, session number, unit, status, summary, log. |
| `logs/<run-start>-<n>.log` | Session `n`'s full output, as stream-json. |
| `outcome.json` | The last session's outcome: `status`, `unit`, `summary`. |
| `verdicts/<unit>.json` | The gate's or the stand-in's verdict: pass, the tree judged, findings, screenshots. |
| `screenshots/<unit>/` | The gate's screenshots, and the design screenshots under `design/`. |
| `agents/<unit>-<name>.md` | Each dispatched agent's full result. The session waits for these files with a blocking command, because a headless session that ends its turn to wait kills its background agents. |

The script also prints one line per session in its window. The branch's commits show
where a session is.

## Braking

```
touch .autopilot/stop
```

The script checks for the file before each session: the session running now finishes,
and no new one starts. The script then exits with 0. Remove the file before the next
run, or that run starts nothing.

## Resuming after a crash

Run the script again. A unit resumes at its first unfinished stage, found from what
its branch has committed (the spec, the plan, the ledger's completion lines, the
verdict). Approval revisions and gate attempts are commit subjects on the branch
(`docs: revise the <unit> spec (revision 2)`, `chore: record gate attempt 1 on
<unit>`), so a resumed session continues those counts instead of restarting them. The
script refuses to start when the tree is not clean, and prints what is
dirty: commit or discard those changes first, then run it again.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | The round is complete (the next unit is item 9), or the stop file was found. |
| 1 | A session failed, wrote no valid outcome, or reported `passed` without a verdict that passes for the tree now on `main`. |
| 2 | The working tree was dirty before a session. |
| 3 | `max-sessions` sessions ran and work is left. |

A `passed` is checked, not trusted: the script accepts it only when
`.autopilot/verdicts/<unit>.json` passes and its `tree` equals
`git rev-parse main^{tree}`.

## Permissions and the web

A headless session cannot ask, so the script gives it `--permission-mode auto`: what
the permission classifier approves, plus the allow list, runs; a risky action is
refused rather than asked, and the session records the refusal and works around it
or fails the unit. The operator's settings are not changed for a run.

Forbidden in every session, by the deny list in `.claude/settings.json` and restated
in the runbook: docker, `git push`, `rm -rf`, sudo and ssh. The repo's allow list
approves `git branch *` and `git checkout *`, so the script also denies, by
`--disallowedTools` on every session (a flag, not a settings change):
`Bash(git branch -D *)`, `Bash(git branch -d *)`, `Bash(git branch --delete *)`,
`Bash(git pull *)`, `Bash(git fetch *)`, `Write`/`Edit` on `.claude/memory/**`, and
`Write`/`Edit` on `docs/operator-voice.md`. The runbook restates all of them. The
only remote writes are the unit's GitHub issue and Project updates in
`vbartalis/time-keep`.

The web is for reading: search, documentation, forums, articles, and looking at apps
and public demos in Playwright's Chromium. Nothing is written to it: no posting,
commenting or signing up, no form submitted except a public demo's sign-in, and
nothing downloaded or run from an untrusted source. Dependencies come only from the
npm registry, through `npm install`.

## Afterwards

The operator reads:

- `.autopilot/runs.md`, for what ran and how it ended;
- the done notes in `docs/roadmap.md`, for what each unit built and every call made
  in the operator's place, the stand-in's marked with their sources;
- `docs/questions.md`, for what the stand-in could not ground. An answer goes into
  `docs/operator-voice.md` in the operator's words, and becomes a roadmap item if it
  changes built work;
- `docs/round-2-report.md`, written by item 16 at the end of round 2: what was built,
  the calls made in the operator's place, and the open questions.

On a `failed` outcome, its summary and the unit's branch say what stopped it; `main`
is untouched. Questions the stand-in queued on that branch stay on it until the unit
merges: when the branch changed `docs/questions.md`, the summary says so, and the
operator reads them there (`git show <branch>:docs/questions.md`).
