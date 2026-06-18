## implementation-auditor — round 1

Phase 2 re-applies the `refreshTokenCallBack` feature onto upstream's axios `refreshAccessToken`
and the `QuickBooks` constructor in `index.js`. The change is small (13 insertions, 2 deletions, one
file) and confined to exactly the two designated feature regions. I reviewed it against the plan
(Phase 2 Steps 1–2, exit gate), the design's Decision 3 isolation requirement, and the pre-reset
fork's observable behavior (recovered from `git show master:index.js`) to confirm the re-applied
feature preserves the success/rotation/hook contract `fuze` binds to.

### Phase Coverage Checklist
| Step | Status | Notes |
|------|--------|-------|
| Step 1 — constructor 11th param `refreshTokenCallBack` | ✅ Implemented | `index.js:97` signature ends `..., refreshToken, refreshTokenCallBack) {`. |
| Step 1 — field assignment via dual-form `eval(prefix + ...)` | ✅ Implemented | `index.js:112` `this.refreshTokenCallBack = eval(prefix + 'refreshTokenCallBack') || null;` placed immediately after `this.refreshToken`; populates from both positional and object forms. |
| Step 1 — JSDoc contiguous through param 11 | ✅ Implemented | `index.js:92–94` adds `@param oauthversion`, `@param refreshToken`, `@param refreshTokenCallBack` in order, closing the upstream 9–10 gap. |
| Step 2 — `this.token` unconditional | ✅ Implemented | `index.js:141` set before the rotation branch. |
| Step 2 — rotation guard | ✅ Implemented | `index.js:142` `if (this.refreshToken !== refreshResponse.refresh_token)`; `this.refreshToken` reassigned only inside it. |
| Step 2 — truthiness guard + isolated hook (own `.catch`, not awaited) | ✅ Implemented | `index.js:144–148` `Promise.resolve(this.refreshTokenCallBack(this.refreshToken)).catch((function(e){...}).bind(this))`; hook called with exactly one arg; `.catch` logs behind `this.debug`; not `await`ed. |
| Step 2 — `callback(null, refreshResponse)` left as upstream | ✅ Implemented | `index.js:150` unchanged, single call, regardless of hook outcome. |
| Step 2 — upstream `.catch` error branch untouched | ✅ Implemented | `index.js:151–153` byte-for-byte upstream; `postBody`/`axios.post`/`revokeAccess` untouched. |
| Exit gate (5 assertions) | ✅ Pass | Re-ran all five: g1–g4 grep `-qF` succeed; `await this.refreshTokenCallBack` count = 0; `request.post(` count = 0. |

Behavioral equivalence to the pre-reset fork (recovered source) holds for the in-scope success path:
`this.token` unconditional, rotation guard `this.refreshToken !== refreshResponse.refresh_token`,
truthiness guard, and single-arg hook call (`this.refreshTokenCallBack(this.refreshToken)`) all match
the old fork. The one intended improvement over the old fork is the error-isolation shape: the old
fork's `await this.refreshTokenCallBack(...)` (fire-and-forget inside a node-style callback) is
replaced by the design-mandated own-`.catch` shape — exactly Decision 3, the only correct answer the
plan calls out. The failure-path arg shape correctly remains upstream's (`callback(err, err.response,
...)`) per the Assumptions/Scope note; no fork body-based `invalid_grant` branch was re-created.

The `Promise` reference at `index.js:145` resolves to the bluebird binding at `index.js:16`
(`Promise = require('bluebird')`), as the plan prescribes; no new import added. `this.debug` inside
the bound `.catch` resolves correctly because the handler is `.bind(this)`. The `.then` handler
remains `.bind(this)` so `this.token`/`this.refreshToken`/`this.refreshTokenCallBack` resolve.

### Drift Report
**Out-of-scope changes:** None. `git diff HEAD` touches only `index.js`, only three hunks, all inside
the constructor and `refreshAccessToken` `.then` handler. No `index.d.ts`, no test, no `package.json`,
no `npm install` artifacts — all correctly deferred to Phases 3–4.
**Acceptable Phase X necessities:** The three added JSDoc `@param` lines (params 9–11). Adding
`oauthversion`/`refreshToken` alongside the new `refreshTokenCallBack` is in-scope per the plan's
explicit instruction (avoid shipping a block that documents param 11 while skipping 9–10); this is the
feature's documentation footprint, not an upstream tidy.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation |
|----|----------|--------|----------|----------|---------|----------------|
| _none_ | — | — | — | — | Phase 2 is implemented completely, correctly, within scope, and matches the plan's prescribed shape and the design's Decision 3 isolation. No actionable issue found. | — |
