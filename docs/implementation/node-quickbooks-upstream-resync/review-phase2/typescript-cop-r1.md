## typescript-cop — round 1

Phase 2 re-applies the `refreshTokenCallBack` feature onto upstream's axios-based `index.js` —
specifically the `QuickBooks` constructor (11th parameter + field assignment + JSDoc) and the
`refreshAccessToken` `.then` handler (rotation guard, truthiness guard, isolated hook). This is a
JavaScript codebase; TypeScript-Cop's scope focuses on the `.d.ts` public-type contract and any new
type holes or boundary-validation gaps introduced at the changed code paths.

**Scope of review.** Phase 2 touches only `index.js`. The `index.d.ts` constructor is intentionally
left at 10 params (the Phase 3 extension is confirmed deferred by the plan and the implementation
notes). The gap between the 11-param runtime and the 10-param declaration is a known, time-bounded
intermediate state, not a Phase 2 defect.

**Boundary review — `refreshResponse`.** `res.data` from the axios OAuth token response is accessed
as `refreshResponse.access_token` and `refreshResponse.refresh_token` without any runtime shape
validation. This is the pre-existing upstream pattern used consistently throughout `index.js` (see
lines 46, 2413, 2428) and is not a regression introduced by Phase 2. Raising a boundary-validation
finding against it would be out of scope for this phase review and would duplicate upstream's baseline.

**Isolation shape.** `Promise.resolve(this.refreshTokenCallBack(this.refreshToken)).catch(...)` is
correct: it wraps both synchronous and promise-returning hooks, and the `.catch` is chained on that
independent promise rather than inside the outer `.then` chain — satisfying Decision 3. The `|| null`
fallback on `this.refreshTokenCallBack` follows the exact pattern of every other field in the
constructor; no new coercion risk is introduced.

**Error path.** `err.response ? err.response.data : null` in the `.catch` handler is correctly guarded
before dereferencing `.data`. This is upstream's verbatim code, unchanged by Phase 2.

**Public type contract.** No new exports, no new exported types, and no change to the `.d.ts` in this
phase. The `index.d.ts` constructor gap (10 params vs. 11-param runtime) is the planned Phase 3 work,
not a Phase 2 finding.

No actionable type-safety issues are introduced by Phase 2.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation |
|----|----------|--------|----------|----------|---------|----------------|
