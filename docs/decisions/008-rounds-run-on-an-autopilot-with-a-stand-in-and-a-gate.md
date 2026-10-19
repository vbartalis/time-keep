# 8. Rounds run on an autopilot with a stand-in and a gate

- date: 2026-10-19
- status: process
- amends: —
- amended-by: —
- superseded-by: —

## Rule

From round 2, the roadmap is worked by the autopilot (`docs/autopilot.md`): a shell
script outside any agent runs fresh headless sessions, a design session and a build
session per unit, the `run-item` runbook tells each session how to run the unchanged superpowers and
impeccable process with no human present, the operator stand-in answers every
question the process would put to the operator from `docs/operator-voice.md` and
approves specs, plans and documents, and the usability gate, not the builder, decides
when a screen unit is done by using the running app on a seeded month. Every pass is
recorded in a verdict file the script checks against `main`. The operator's part is
words in (`docs/operator-voice.md`, added only when they speak), questions out
(`docs/questions.md`, what the stand-in could not ground), and the round's report
(`docs/round-2-report.md`); every call the stand-in made is in the unit's done note
with its source, for the operator to review and overrule.

## Why

Round 1 failed twice over. One agent carried phase after phase in one session until
its context was compacted at a bad moment, and nothing outside it could clear it.
And every step that asks the operator was answered by the builder itself, with only
the builder's own tests at the end of a phase, so the result passed its tests and was
unusable. A script holds no context and cannot lose any; a stand-in grounded in the
operator's words and a gate that sees only the running app put the judgement outside
the builder, and the operator asked for as little supervision as possible.
