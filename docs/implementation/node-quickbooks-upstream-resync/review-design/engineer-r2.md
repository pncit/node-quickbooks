## engineer — round 2

Design Review Mode, round 2 (in-progress review). Re-verified each of my seven round-1 findings
against the current `design.md` and the reviser's round-3 dispositions (all seven marked `Fixed`).
I re-read the relevant `index.js` regions (`index.js:147–162`) to confirm the design's restated
behavioral claims still match the source the re-apply must preserve.

All seven prior findings are genuinely resolved in the current design:

- **f1 (truthiness guard):** Decision 3 now carries an explicit "Hook gating" bullet (lines 190–192)
  stating the hook fires only when `this.refreshTokenCallBack` is truthy, nested in the rotation
  branch; Success Criteria assert the 10-arg construction must not throw on rotation (lines 309–311).
  Matches `index.js:154`. Closed (ratified).
- **f2 (isolation mechanism):** Decision 3 "Rejection isolation (the mechanism)" (lines 194–197) now
  names the concrete mechanism — invoke with its own attached `.catch()`, never `await`ed into the
  `.then` that resolves `callback`. Closed (ratified).
- **f3 (merge vs reset):** Migration step 1 (lines 260–265) decisively chooses `git reset --hard`
  onto upstream `2.0.49` with rationale and the accepted history-rewrite trade-off. Closed (ratified).
- **f4 (`.d.ts` return type vs runtime):** Decision 2 (lines 172–174) reconciles
  `void | Promise<void>` as the broadest type compatible with Decision 3's non-awaited,
  own-`.catch` invocation form. The two surfaces now agree. Closed (ratified).
- **f5 (unconditional `this.token`):** Decision 3 "Assignment order" (lines 186–189) and Current
  State (lines 72–74) now state `this.token` is assigned unconditionally on success, with only
  `this.refreshToken` and the hook gated on rotation. Matches `index.js:151–157`. Closed (ratified).
- **f6 (object-form construction in step 0):** Migration step 0 (lines 247–249) now requires
  confirming upstream still supports the `_.isObject(consumerKey)` dual construction, since the
  re-apply populates the field from both forms. Closed (ratified).
- **f7 (grep precision):** Verification (lines 325–327) now asserts no `require('request')` /
  `require('request-debug')` and no `request.post(` / `request(` call sites, rather than a bare
  substring grep. Closed (ratified).

No new findings. The design is tightly scoped, decisive, and internally consistent; its Non-Goals
remain crisp and its restated source-behavior claims match `index.js`. I considered whether the
current `callback(e, refreshResponse)` (`index.js:158`, passing the possibly-non-null request error
`e`) conflicts with Decision 3's "calls `callback(null, refreshResponse)`" (line 197): on the
success branch `e` is null, and axios has no equivalent `e` in the resolving `.then`, so the design's
phrasing is observably equivalent and not a defect. Converged.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|
| engineer-r1-f1 | High | Closed | ErrorHandling | design.md §Decision 3 (190–192); §Current State (74); §Success Criteria (309–311) | Truthiness guard `if (this.refreshTokenCallBack)` now explicitly restated as a first-class gate, nested in the rotation branch; Success Criteria pin that the 10-arg construction must not throw on rotation. | Ratified — fix matches `index.js:154`. No action. |
| engineer-r1-f2 | High | Closed | ErrorHandling | design.md §Decision 3 (194–197) | Isolation mechanism is now named concretely (own attached `.catch()`, never `await`ed into the resolving `.then`), with the naive `await`-in-`.then` explicitly called the wrong answer. | Ratified. No action. |
| engineer-r1-f3 | Medium | Closed | Documentation | design.md §Migration step 1 (260–265) | Merge/reset ambiguity resolved: `git reset --hard` onto upstream `2.0.49`, re-apply as fresh patch, with rationale and accepted history-rewrite trade-off. | Ratified. No action. |
| engineer-r1-f4 | Medium | Closed | MagicValues | design.md §Decision 2 (172–174) | `.d.ts` return type `void \| Promise<void>` now reconciled with Decision 3's non-awaited own-`.catch` runtime form; surfaces agree. | Ratified. No action. |
| engineer-r1-f5 | Medium | Closed | Documentation | design.md §Decision 3 (186–189); §Current State (72–74) | `this.token` now stated as unconditionally assigned on success; only `this.refreshToken` and the hook gated on rotation. Matches `index.js:151–157`. | Ratified. No action. |
| engineer-r1-f6 | Low | Closed | Documentation | design.md §Migration step 0 (247–249) | Step 0 now requires confirming upstream retains the object/positional dual construction, on which the field population depends. | Ratified. No action. |
| engineer-r1-f7 | Low | Closed | Documentation | design.md §Verification (325–327) | Grep gate tightened to falsifiable `require(...)` / `request.post(` / `request(` call-site checks, avoiding substring false positives. | Ratified. No action. |
