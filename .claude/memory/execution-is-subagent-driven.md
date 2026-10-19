---
name: execution-is-subagent-driven
description: Plans are always executed subagent-driven; do not ask which execution method to use
metadata:
  type: feedback
---

Every implementation plan is executed with superpowers:subagent-driven-development: a
fresh subagent per task and a fresh reviewer per task, then a whole-branch review.

**Why:** operator, 2026-10-19, asked to choose between subagent-driven and native for
phase 5a: "subagent driven always. note it down".

**How to apply:** after writing a plan, ask only whether it captures what they want,
not which execution method; then run it subagent-driven. Recommending native is off
the table.
