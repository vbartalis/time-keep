# Merges on "generally ok", defers defects

When a branch reaches a working state, the operator merges on a broad "generally ok"
verdict and explicitly defers known-but-undescribed bugs to later. Asking them to
enumerate those bugs before merging gets refused.

**Why:** 2026-08-04, closing a branch after a browser check: "we have some bugs, but
we will solve those later"; asked for one line each: "no. you will do what i just
said."

**How to apply:** ask once at most, then merge. Record the deferral honestly in the
artifact that already exists (a `bug` issue, or a comment on the branch's issue),
noting that bugs were observed but not characterised so a later reader knows a
re-discovery pass is needed. Do not re-raise it, and do not withhold the merge.
