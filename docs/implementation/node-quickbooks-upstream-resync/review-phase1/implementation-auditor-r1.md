## implementation-auditor — round 1

Phase 1 is a precondition-gated `git reset --hard upstream/master`. The plan/design files named in the
orchestrator prompt (`docs/implementation/node-quickbooks-upstream-resync/plan.md` and `design.md`) do
**not exist on disk** — they were read from the orphaned pre-reset commit `04c4d8c` via
`git show 04c4d8c:…`. That fact is itself the headline finding of this review (see f1/f2 below).

### What I verified

- **Source-level exit gates all PASS.** Against the working tree: `package.json` has
  `"version": "2.0.49"` and `"types": "index.d.ts"`; `index.js` has `request.post(` = 0,
  `require('request')` = 0, `require('request-debug')` = 0; `index.d.ts` exists; `refreshTokenCallBack`
  count in `index.js` = 0 (correctly absent, to be re-applied in Phase 2). Constructor is the upstream
  10-param signature ending at `refreshToken`; `_.isObject(consumerKey)` dual-form present;
  `index.d.ts` constructor ends at `refreshToken?: string | null`. `git status` clean (only untracked
  `docs/`).
- **Tracked tree is byte-for-byte upstream `2.0.49`.** `git diff --quiet upstream/master HEAD` →
  identical; `git diff HEAD --stat` empty. No out-of-scope code edits. HEAD = `f5baf5d`.
- **Precondition gate ran as documented** (notes §4 / §12); the seven assertions match the plan's
  Step-2 list and resolve correctly against the fetched `upstream/master`.

So the *code* outcome of Phase 1 is correct. The findings below concern the **destruction of the
project's own planning/design/review history** by the reset, plus a process-integrity gap the plan did
not cover.

### Phase Coverage Checklist
| Step | Status | Notes |
|------|--------|-------|
| 1. Add upstream remote + fetch; confirm 2.0.49 | ✅ Implemented | Remote pre-existed; version confirmed. |
| 2. Precondition checks (7 assertions) | ✅ Implemented | All pass; matches plan Step 2 + backstop skim. |
| 3. `git reset --hard upstream/master` | ⚠️ Partial | Reset landed upstream code correctly, but as a side effect destroyed all tracked planning docs from the working tree and orphaned the planning commits — see f1, f2. |
| 4. Post-reset sanity checks | ✅ Implemented | All seven source-only assertions pass; module-load correctly deferred to Phase 3. |

### Drift Report
**Out-of-scope changes:** None in tracked code — the tree is identical to `upstream/master`.
**Acceptable Phase-X necessities:** The stale `node_modules/` (axios absent) left on disk is harmless
(gitignored; Phase 3 installs, Phase 4 clean-regens) — not raised as a finding.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation |
|----|----------|--------|----------|----------|---------|----------------|
| implementation-auditor-r1-f1 | Critical | Open | Completeness | working tree `docs/` vs commit `04c4d8c` | `git reset --hard upstream/master` **deleted from the working tree** every tracked planning artifact: `plan.md` (421 lines), `design.md` (376 lines), `design-process-artifact.md`, `plan-process-artifact.md`, and all 20 files under `review-design/` and `review-plan/` (`git diff --stat 04c4d8c -- docs/` shows 22 files / 1620 deletions). The **only** file present in `docs/` on disk is `implementation-phase1-notes.md` (re-created after the reset, untracked). These artifacts now exist **only** in the unreachable commit `04c4d8c`; the orchestrator prompt's own pointers to `plan.md`/`design.md` resolve to non-existent files. Phases 2–4 and Deferred Validation all reference these docs, and the historian/future maintainer needs them. The plan's Assumptions sanctioned rewriting the fork's *code* history, not destroying the in-repo planning record — that was an unanticipated blast-radius of resetting the branch the docs were committed on. | Before any further phase work, restore the planning docs into the post-reset tree and commit them so they are reachable from `feat/node-quickbooks-upstream-resync` again, e.g. `git checkout 04c4d8c -- docs/` then commit. Verify `git ls-files docs/ \| wc -l` is non-zero and `plan.md`/`design.md` exist on disk. (The on-disk copies still match `04c4d8c`, so no content is lost *yet* — but they are tracked nowhere and one `git clean -fdx`/fresh checkout would erase them.) |
| implementation-auditor-r1-f2 | Critical | Open | Completeness | branch ref `feat/node-quickbooks-upstream-resync` / commit graph | The reset advanced the branch ref to `f5baf5d` (upstream's tip). `git merge-base --is-ancestor 04c4d8c HEAD` → **NO**: the approved-plan commit and the entire fork lineage are now **unreachable from the branch**, surviving only in the reflog (which expires, default 90d) and as loose objects pending `git gc`. The plan/design were *approved artifacts of this very effort*; leaving them reclaimable-only-by-reflog means a routine `git gc --prune=now` or a clone of the branch loses them permanently. The phase notes (§3 "HEAD is now f5baf5d", §5 "No deviations") do not acknowledge that the planning history was orphaned — the self-review scored Plan Adherence 10/10 without noticing this. | When committing the restored docs (f1), ensure the resulting branch tip has those docs reachable; do not rely on the reflog. If the fork's prior non-planning history must also be preserved (per repo policy), confirm with the orchestrator/human whether a recovery ref is needed — otherwise document explicitly that orphaning the fork's pre-plan code history is the intended outcome (the plan's Assumptions cover code, not the planning docs). |
| implementation-auditor-r1-f3 | High | Open | PlanAdherence | `implementation-phase1-notes.md` §3, §5, §9 | The notes assert "No deviations" and self-score every dimension 10/10, but the reset produced a material, unplanned side effect (f1/f2: destruction of the planning-doc record) that the plan never authorized and the notes never surface. This is self-review inflation: a 10/10 "Plan Adherence" is not defensible when the destructive step had an un-enumerated consequence the plan did not sanction. The phase cannot be marked done while the planning artifacts it depends on are unrecoverable from the branch. | Add a Deviations/Risks entry acknowledging that the reset removed the tracked `docs/` tree and orphaned the planning commits, with the remediation taken (per f1/f2). Re-score Plan Adherence to reflect the gap. This finding closes once f1/f2 are resolved and the notes reflect them. |
| implementation-auditor-r1-f4 | Medium | Open | Completeness | plan.md Phase 1 Step 4 "Sanity-check the reset" | Phase 1's exit gate verifies the *post-reset upstream code* (request absent, types field, `index.d.ts` present, clean status) but has **no check that the repo's own planning/process artifacts survived the destructive operation**. Because the docs were committed on the branch being reset, a gate that asserted "`plan.md` and `design.md` still exist on disk after reset" would have caught f1 immediately. This is a plan deficiency: a precondition-gated destructive reset listed every code invariant to re-assert but omitted the artifact-survival invariant. | Flag to the Planner: Phase 1's post-reset sanity checks should include an artifact-survival assertion (e.g. `test -f docs/implementation/node-quickbooks-upstream-resync/plan.md` and `design.md`) so a future re-run of this phase fails loudly instead of silently discarding the planning record. Not strictly required to re-run Phase 1 if f1/f2 are remediated, but the gate gap should be recorded. |

### Notes on items I deliberately did NOT raise
- **Stale `node_modules/` (axios absent):** gitignored; Phase 3 `npm install` and Phase 4 clean regen
  supersede it. Harmless, not a finding.
- **`refreshTokenCallBack` absent from `index.js`/`index.d.ts`:** correct and intended for end-of-Phase-1
  (re-applied in Phases 2–3). Not a finding.
- **`mocha@10.1.0` devDep reverted from the fork's `^10.8.2`, live `test/*.js` credential-gated:**
  explicitly in scope per plan Assumptions ("upstream wins everywhere except the two feature regions").
  Not a finding.
- **`fast-xml-parser@^4.3.2` / `uuid@^8.3.2` / `underscore@1.12.1` still un-bumped:** correct — bumps are
  Phase 4. Not Phase-1 drift.
