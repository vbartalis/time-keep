# The operator's voice

What the operator has said about time-keep and how it is built: their corrections and
preferences, grouped by subject. The operator stand-in
(`.claude/agents/operator-stand-in.md`) reads this file as the operator when the
autopilot runs with no one at the keyboard.

- Quotes are verbatim, typos included, each with its date.
- Lines marked "discovery, 2026-10-18" paraphrase the discovery conversation that
  produced [the vision](vision.md); they are not quotes.
- Lines marked "rule" summarise a standing correction in `.claude/rules/`; the rule
  file holds the full text.
- This file is added to only when the operator speaks, in the session where they say
  it. The autopilot never adds to it, and neither does the stand-in.

## Scope

- 2026-10-19: "after all the goal is what. to create an app that does what i need with
  good ui/ux. right?"
- 2026-10-19: "this app is not fitting the needs at all. unusable. UX seems awful. no
  idea if you have studied kimai at all, but i suspect not."
- 2026-10-19: "about the backend. i believe that should be mostly ok"
- Discovery, 2026-10-18: Kimai is "not exactly to my needs" because someone else builds
  it. Disliked in Kimai: invoicing (not needed), no history or Ctrl+Z, managing new
  entries and small things is fiddly, weak on the phone.
- Discovery, 2026-10-18: offline mode is "nice but could overcomplicate things"; not
  for now. Shared reference data between users: not for now.
- Discovery, 2026-10-18: GDPR is a non-issue (fully internal); do not raise it. GPS is
  planned, not in v1.
- Discovery, 2026-10-18: years of Kimai data exist; the import is a job for an agent
  through the MCP server.

## Process and autonomy

- 2026-10-19: "round 2 is to make sure tha app is usable first."
- 2026-10-19: "we still want to try to make this work withouth as much supervison from
  me as possible."
- 2026-10-19: "if impeccable has something liek a question we spin up a subagent to do
  the independent mimicing of the developer, how would he choose."
- 2026-10-19: "it should forget about pushes. that is not its responsibility at all.
  shouldnt even htink about it."
- 2026-10-19: "normal web browsing for research can be done. for example seeng how a
  cerain app looks for inspiration or searching up a documentatiion. or researching
  some topic on some forums. but no posting or similar to the web, or downloading
  things fro muntrusted sources etc."
- 2026-10-19, asked to choose how a plan is executed: "subagent driven always. note it
  down"
- 2026-08-11: "no docker command line utilities… never docker."
- 2026-08-23: "no pr and similar shit. we dont want to contribute to a project with
  100k+ stars. thats just polluting it. dont suggest these things again."
- Rule, 2026-08-01 and 2026-08-11: never act without permission. A question is not an
  instruction to act; answer it and change nothing. Never write to memory unasked.
  Never disable a hook or gate to get past it.
- Rule, 2026-10-18: GitHub issue and Project writes in `vbartalis/time-keep` are
  standing-authorized; the tracking layer is maintained by the agent.

## Interface and design

- 2026-10-19: "i can tell with certainity this is nothing like kimai. looks completely
  different."
- 2026-10-19: "kimai had a calendar like structure in it. this is quite different from
  a goodle or samsung calendar, but those are actually also good inspiration materials
  how to make a good time keeping app in terms of design. then kimai also has different
  views liek those mobile calendars like day or week or mont view. and kimai also hs
  anothr view that is more like a table not a calendar that is not in those mobile
  calendars. these are all quite important things."
- 2026-10-19: "we have to redo the look of the app completely as its not just
  functionally bad ie ux, but in terms of design like ui and theaming it is also
  horrendous."
- Discovery, 2026-10-18: the phone is for really easy access (quick capture); the PC
  is for tedious work (organising, month-end tables).

## Data and entries

- Discovery, 2026-10-18: the real entry shapes, which must stay one or two taps:
  - consulting CompX, through them for ClientY, on their ProjectZ, taskA for their
    client B, plus a description, at a standard timeframe (a support ticket, three
    companies deep)
  - myself, project X, from y to z, at a café, doing A
  - CompX, project Y, for Z hours, doing A (start plus duration)
  - CompX, through them for CompY, doing Z from A to B, at the client
- Discovery, 2026-10-18: research and development work is two deep; support tickets
  are three. A flat customer › project, with the chain in the project name
  (`CompA` › `CompB – ProjC`), was chosen over a variable-depth chain as simpler.
- Discovery, 2026-10-18: an entry is always an interval; start plus duration is only
  an input form. User-saved templates, which may be partial, replace "recent" and
  "repeat last entry".
- Discovery, 2026-10-18: the Excel sheets usually need start and end (sometimes only a
  duration), task, place, project, and for support work the ticket and the end client.
  The sheets are custom and differ; copy-out is "the least concern and the easiest
  part".
- Discovery, 2026-10-18: the MCP server is for bulk adding, reorganising, rewriting and
  tidying a month at month-end; that is why batch undo matters most.
- Discovery, 2026-10-18: overlaps are allowed with a warning; several timers may run;
  starting on a project stops that project's timer; rounding to 5 minutes is on output
  only.

## Working style

- 2026-10-19: "Do not try to blame me ever."
- 2026-08-04, closing a branch after a browser check: "we have some bugs, but we will
  solve those later"; asked for one line each: "no. you will do what i just said."
- Rule, 2026-08-04: the operator merges on a broad "generally ok" and defers bugs they
  have not described. Ask once at most, then merge, and record the deferral.
