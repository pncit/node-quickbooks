## architect — round 2

### Scope

Phase 3 = re-apply the `refreshTokenCallBack` feature in `index.d.ts` + add the offline regression
test. Round 1 raised zero architectural findings; this round re-verifies the reviser's round-1
dispositions (all `Fixed` against engineer/typescript-cop findings, none of which were architect
findings) and re-checks the post-fix working tree for any new structural issue introduced by the
fix itself.

### In-progress review

- **No prior architect findings to carry.** `architect-r1.md` had an empty findings table. There is
  nothing to re-verify as `Fixed`/`Rejected`, nothing to escalate.
- **Reviser's round-1 fixes are non-architectural and benign.** The reviser replaced the case-4
  `setTimeout(..., 20)` wall-clock sleep with a deterministic settle chain (`afterHookSettles`) and
  routed deferred assertions through `done(e)`. Verified in `test/refreshTokenCallBack.test.js`
  (lines 45-49, 78-180). The helper `Promise.resolve(hookPromise).catch(noop).then(() => setImmediate(fn))`
  is sound and introduces no new module, import, boundary, or coupling; it is test-internal
  sequencing only.
- **Case-4 ordering assumption holds at the runtime call site.** The helper relies on the hook being
  invoked (and `hookPromise` assigned) before `callback(null, refreshResponse)` runs. Confirmed in
  `index.js:144-152`: the rotation block fires `this.refreshTokenCallBack(...)` first, then
  `if (callback) callback(null, refreshResponse)` on the next line. The test's contract lock cannot
  silently desynchronize from the runtime here.
- **Public-API delta unchanged and still safe.** `index.d.ts:462` (instance field) and `:476` (11th
  optional constructor param) remain exactly `refreshTokenCallBack?: (token: string) => void | Promise<void>`,
  structurally aligned with the one-arg runtime call site (`index.js:148`) and the test's
  `argCount === 1` arity lock. Additive, non-breaking; 10-arg construction still type-checks.

### Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|

No architectural findings. The round-1 review was clean; the reviser's round-1 fixes are
test-internal sequencing changes that introduce no boundary, coupling, public-API, or data-model
risk, and the case-4 ordering they depend on is confirmed at the runtime call site. The Phase 3
surface remains minimal, additive, and boundary-clean. Converged.
