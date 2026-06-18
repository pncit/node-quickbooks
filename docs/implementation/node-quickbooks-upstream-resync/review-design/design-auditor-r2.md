## design-auditor — round 2

Re-verified all five round-1 findings against the revised design and the live repo state. Each
fix is genuine and the supporting claims now match reality:

- **f1 (fast-xml-parser):** Live `npm audit --json` confirms `fast-xml-parser` is **critical**,
  vulnerable range **`<=5.6.0`**, sole fix `5.9.2` (`isSemVerMajor: true`). The revised Decision 4
  (`^5.9.2`), the rewritten "do not rewrite XML code" Non-Goal, the updated Current State, risk
  row, and the Success-Criteria table all align with the live DB. The fork's actual call site is
  `new (require('fast-xml-parser').XMLParser)()` (`index.js:17`), matching the design's
  default-options / CommonJS-resolution rationale. Ratified.
- **f2 (divergence ordering):** Git confirms the feature commits `deb64fe`/`8de037b` predate the
  `2.0.46` merge `8e070aa`, with `4b95907` (mocha bump) as the only post-merge commit. The revised
  Problem Statement and Current State now state the feature was committed before the most recent
  upstream sync and carried across the merge, with the mocha bump as the sole post-merge change.
  Ratified.
- **f3 (unverifiable upstream/fuze pillars):** Still unverifiable from this checkout (`git remote`
  shows only `origin → pncit`; no tags; `fuze` is a separate repo). But the design now names the
  merge target as upstream tag `2.0.50` and adds Migration **step 0** as a hard precondition that
  re-confirms upstream's axios/hookless `refreshAccessToken`, the 10-param `index.d.ts`, and
  `fuze`'s 11-arg positional call, with an explicit stop-and-re-baseline instruction. That is
  exactly the gate f3 asked for; the residual unverifiability is correctly pushed to a planning-time
  precondition rather than left as a buried assumption. Ratified.
- **f4 (audit gate falsifiable):** Success Criteria now enumerate all eight issue-#3 advisories in a
  table with source / cleared-by / end-state, and Verification asserts each named advisory is absent
  rather than running a bare `npm audit`. Ratified.
- **f5 (security-goal risk):** Risks table now has the "selected dependency versions do not clear
  all issue-#3 advisories" row (Low/High) with the live-DB mitigation. Ratified.

Current-state spot checks all pass: `index.js:103` (11-param signature), `:118`
(`this.refreshTokenCallBack` assignment), `:152–156` (rotation-guarded `await` hook), `:147`
`request.post`; no `index.d.ts`; no `"types"` field; underscore call-sites = 44. No new
blocking issues. One note for the Planner is captured as a Low finding below.

## Findings

| ID | Severity | Status | Category | Where | Finding | Recommendation |
|----|----------|--------|----------|-------|---------|----------------|
| design-auditor-r1-f1 | Critical | Closed | DesignDecision | — | ratified: live `npm audit` confirms `fast-xml-parser` critical across `<=5.6.0`, sole fix `5.9.2` (semver-major); Decision 4 now bumps to `^5.9.2` with the version-only-churn rationale, and Non-Goals/Current State/Success Criteria/Risks were updated consistently. |
| design-auditor-r1-f2 | Low | Closed | CurrentState | — | ratified: git confirms feature commits `deb64fe`/`8de037b` predate merge `8e070aa`, mocha bump `4b95907` is the only post-merge commit; Problem Statement and Current State now state this ordering correctly. |
| design-auditor-r1-f3 | Medium | Closed | CurrentState | — | ratified: merge target named as upstream tag `2.0.50`; Migration step 0 makes confirming upstream's constructor arity / hook surface and `fuze`'s 11-arg call a hard precondition with a stop-and-re-baseline instruction. Residual unverifiability is correctly deferred to a planning-time gate. |
| design-auditor-r1-f4 | Medium | Closed | SuccessCriteria | — | ratified: the eight issue-#3 advisories are enumerated with expected end state, and Verification asserts each named advisory is absent rather than running a bare audit. |
| design-auditor-r1-f5 | Medium | Closed | Risk | — | ratified: Risks table now carries the "versions do not clear all advisories" row with the live-DB-verification mitigation. |
| design-auditor-r2-f1 | Low | Open | SuccessCriteria | Verification / Success Criteria | The regression-test verification says to stub `axios.post`, but the success criterion "a rejecting hook does **not** surface as an error through the QuickBooks node-style callback" is only meaningful if the test also asserts the callback was invoked with a success result *despite* the hook rejection — a test that merely checks "no throw" would pass even if the hook never fired or the callback was skipped. As written, a Planner could build a test that locks down less than the contract f1/Decision 3 protects. | Tighten the third regression assertion to state the positive expectation: on a rejecting hook, the node-style `callback` is still invoked once with the refreshed token / success result and no error. Refine the existing bullet; do not add a new section. |
