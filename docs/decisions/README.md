# Decision records

One file per decision, `NNN-slug.md`, three-digit number, kebab-case slug.
Numbers are never reused or renumbered.

```markdown
# 1. A short normative title

- date: 2026-10-18
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

One paragraph. Normative. What holds.

## Why

One paragraph. Why this and not the alternative.
```

- Header keys in exactly this order. `—` where a key has no value.
- `status`: `active`; `amended` (still holds, read with `amended-by`);
  `superseded` (replaced by `superseded-by`; never cited); `process` (a rule
  about how the project works).
- `amends` and `amended-by` are `—` or a comma-separated list of decision
  numbers, reciprocal member by member; `superseded-by` is `—` or one number
  naming a record that is not itself superseded. A later decision that changes
  an earlier one, whatever its own text calls the change, `amends` it, and the
  earlier one becomes `amended`.
- No narrative, no history, no measurements. History is git.
