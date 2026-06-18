## project-lead — round 1

### Requirements Coverage

Phase 1 has a narrow, well-defined scope: precondition-gated hard reset onto upstream `2.0.49`, leaving
the `refreshTokenCallBack` feature intentionally absent until Phase 2. The Phase 1 requirements are:

| Requirement | Status | Notes |
|-------------|--------|-------|
| Add/verify `upstream` remote and fetch `2.0.49` | Fully Met | Remote pre-existed; `git fetch upstream` ran; `"version": "2.0.49"` confirmed. |
| Seven mechanical precondition assertions must all pass before reset | Fully Met | All seven pass: no `request.post(`/`require('request')` in upstream; 10-param constructor confirmed; `_.isObject(consumerKey)` dual-form present; `index.d.ts` ends at `refreshToken?`; `refreshTokenCallBack` = 0 in upstream; rotation guard = 0 in upstream; present on fork. |
| Best-effort backstop skim of `git diff upstream/master:index.js HEAD:index.js` | Fully Met | Performed; no unexpected third region found. Advisory-only, per plan. |
| `git reset --hard upstream/master` executed only after gates pass | Fully Met | Confirmed by implementation notes §4 / §12. |
| Post-reset: `request.post(`/`require('request')`/`require('request-debug')` = 0 | Fully Met | Independently verified: all three return 0 in current `index.js`. |
| Post-reset: `index.d.ts` present and `"types": "index.d.ts"` in `package.json` | Fully Met | Both confirmed on disk. |
| Post-reset: `git status` shows clean tree | Partially Met | Working tree is clean of code changes but has one modified (unstaged) docs file (`implementation-phase1-notes.md`) and two untracked files (`implementation-auditor-r3.md`, `reviser-r2.md`). These are in-flight review loop artifacts, not Phase 1 deliverable items, and not a code defect. No action required before Phase 2 code work begins. |
| No module-load smoke test here (deferred to Phase 3) | Fully Met | Correctly deferred. |
| `refreshTokenCallBack` absent from `index.js` (correctly deferred to Phase 2) | Fully Met | Count = 0 confirmed. |
| Planning artifacts survive the reset and are branch-reachable | Fully Met | Restored via `b2aaba3`; `git ls-files docs/` = 26 tracked files; `plan.md` and `design.md` on disk and tracked. The loss-and-recovery is documented in notes §5 and was an unanticipated blast-radius of the reset, not a plan violation. |
| No out-of-scope code edits | Fully Met | `git diff --stat upstream/master HEAD -- . ':(exclude)docs/'` is empty; the tracked production-code tree is byte-for-byte upstream `2.0.49`. |

### Summary

Phase 1 is a read/git-only operation with no fork-authored production code. The deliverable is correct:
the working branch is byte-for-byte upstream `2.0.49` at the production-code level, all preconditions
passed before the destructive reset, and the planning artifacts were recovered and are branch-reachable.
The sole noteworthy event (planning-doc destruction by the reset) was discovered, remediated, and
documented. No delivery, requirements, or rollout concerns remain on the Phase 1 deliverable itself.

One process risk is raised below concerning the recovery of orphaned pre-reset commit history: the plan
authorized discarding the fork's pre-plan *code* history, but the planning commits (`04c4d8c` and its
ancestors) are also now non-ancestors of the branch. The content is intact (copied into `b2aaba3`) and
no data is lost for practical purposes, but a decision about whether the original commit provenance
matters (e.g. for audit trail) has not been made explicit. This is raised as a low-severity escalation
because it requires a human to decide, not a code change.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation |
|----|----------|--------|----------|----------|---------|----------------|
| project-lead-r1-f1 | Low | Escalated | Rollout | `feat/node-quickbooks-upstream-resync` commit graph | The `git reset --hard` orphaned the fork's approved-plan and approved-design commits (`04c4d8c` and ancestors) from the branch lineage. Their *content* is preserved in `b2aaba3`, but the original commit provenance (author, timestamp, approval history embedded in the commit messages) is not reachable from the branch — only from the reflog (expires 90d) or as loose objects pending `gc`. The plan's Assumptions explicitly authorized rewriting the fork's *code* history but were silent on whether the *planning-commit* lineage needs to remain reachable. For a private fork consumed by a single service (`fuze`) via a git pin, losing that lineage is unlikely to matter operationally; but if `pncit` has an audit-trail or change-management requirement that demands the approved-plan commit remain reachable from the branch, the current state does not satisfy it. | Requires a human decision: does `pncit` need the approved-plan/approved-design commit (`04c4d8c`) to remain reachable from the branch (e.g. via a recovery tag or `--graft`)? If no, explicitly document that orphaning the planning lineage is acceptable (add a sentence to `implementation-phase1-notes.md` §5) and this finding closes. If yes, create a lightweight tag (`git tag plan-approved 04c4d8c`) so the approved-plan commit survives `git gc`. No code change needed either way. |
