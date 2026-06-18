# Implementation Notes — Phase 2

- **Plan:** node-quickbooks-upstream-resync
- **Phase:** 2
- **Date:** 2026-06-18
- **Agent:** Implementor

---

## 1. Phase Scope Confirmation

**In-Scope (Phase 2 only):**
- Constructor: add `refreshTokenCallBack` as the 11th positional parameter to `function QuickBooks(...)`.
- Constructor: add `this.refreshTokenCallBack = eval(prefix + 'refreshTokenCallBack') || null;` immediately after `this.refreshToken`, so both positional and object-form construction populate the field.
- Constructor JSDoc: add the three missing `@param` lines (`oauthversion`, `refreshToken`, `refreshTokenCallBack`) to make the block contiguous through param 11.
- `refreshAccessToken` `.then` handler: replace the two unconditional assignments with `this.token` unconditionally, a rotation guard (`if (this.refreshToken !== refreshResponse.refresh_token)`), a truthiness guard on `this.refreshTokenCallBack`, and an isolated hook call via `Promise.resolve(...).catch(...)`.
- All five Phase 2 exit-gate assertions.

**Explicitly Out-of-Scope:**
- `index.d.ts` update (Phase 3).
- Regression test authoring (Phase 3).
- `npm install` (Phase 3).
- Dependency bumps (Phase 4).
- Any change to upstream code outside the two feature regions (constructor + `refreshAccessToken` `.then` handler).
- Any change to `revokeAccess`, `getUserInfo`, or any other method.
- Any change to the `.catch` error branch of `refreshAccessToken`.
- Any change to `fuze`.

---

## 2. Phase Intent (Interpreted)

Phase 2 re-introduces the `refreshTokenCallBack` feature onto upstream's axios-based codebase. The goal is observable behavior identical to the pre-reset fork: (1) the hook is populated from both positional and object construction; (2) `this.token` is always set on a successful refresh; (3) `this.refreshToken` is only reassigned and the hook only fires when the refresh token actually rotates; (4) a hook rejection is provably isolated — absorbed by the hook's own `.catch`, never routed into the QuickBooks node-style `callback` and never left as an unhandled rejection. The critical design constraint (Decision 3) is that the hook must never be `await`-ed inside the `.then` that calls `callback`, because that would route a hook rejection into `callback` and break `fuze`'s error-isolation assumption.

---

## 3. Files Touched

| File | Change Type | Rationale |
|------|-------------|-----------|
| `index.js` | Modified — constructor + `refreshAccessToken` | Re-applies the `refreshTokenCallBack` feature onto upstream's axios codebase in the two designated regions |

---

## 4. Implementation Summary

**Constructor (Step 1).**

The `QuickBooks` function signature was extended from 10 to 11 parameters by appending `refreshTokenCallBack` after `refreshToken`. The field assignment `this.refreshTokenCallBack = eval(prefix + 'refreshTokenCallBack') || null;` was inserted immediately after the existing `this.refreshToken` line, using the same `eval(prefix + ...)` dual-form pattern that all other fields use. This ensures that both the positional call (`new QuickBooks(..., 'RTOKEN', myCallback)`) and the object call (`new QuickBooks({ ..., refreshTokenCallBack: myCallback })`) correctly populate the field — matching the pre-reset fork's behavior.

The JSDoc block was made contiguous through param 11: upstream's JSDoc stopped at `@param minorversion` (param 8), leaving params 9 (`oauthversion`) and 10 (`refreshToken`) undocumented. Three `@param` lines were added in order: `oauthversion`, `refreshToken`, and `refreshTokenCallBack`. These additions are inside the constructor region already being edited and are the feature's documentation footprint; no other constructor line was touched.

**`refreshAccessToken` `.then` handler (Step 2).**

Upstream's `.then` was:
```js
this.refreshToken = refreshResponse.refresh_token;
this.token = refreshResponse.access_token;
if (callback) callback(null, refreshResponse);
```

The re-applied handler:
1. Sets `this.token = refreshResponse.access_token` unconditionally (access token always updated on success).
2. Enters the rotation branch only when `this.refreshToken !== refreshResponse.refresh_token` (the new token differs from the stored one).
3. Inside the rotation branch, reassigns `this.refreshToken = refreshResponse.refresh_token`.
4. If `this.refreshTokenCallBack` is truthy, invokes it via `Promise.resolve(this.refreshTokenCallBack(this.refreshToken)).catch(...)` — the `.catch` is bound to `this` (for `this.debug` access) and is entirely independent of the outer chain. The hook is not `await`-ed inside the `.then`.
5. Calls `if (callback) callback(null, refreshResponse)` exactly once, unconditionally with respect to hook outcome.

The upstream `.catch((function (err) { if (callback) callback(err, ...) }).bind(this))` error branch was left byte-for-byte unchanged. Nothing else in `refreshAccessToken` was touched (no change to `postBody`, `axios.post`, `revokeAccess`, or the Authorization header).

**Error isolation shape — why `Promise.resolve(...).catch(...)` and not `await`.**

`Promise.resolve(this.refreshTokenCallBack(this.refreshToken))` handles both a void-returning (sync) and a `Promise<void>`-returning (async) hook. The `.catch(...)` is chained directly onto that resolved promise's own chain, making the rejection path entirely local — it terminates in the `.catch` handler (with optional `console.log` behind `this.debug`) and does not propagate. Because the hook is not `await`-ed, the outer `.then` body proceeds synchronously to `if (callback) callback(null, refreshResponse)` without waiting for or observing the hook's settlement. This is the isolation shape required by Decision 3 and the only shape that prevents a hook rejection from reaching `callback`.

---

## 5. Deviations From Plan

No deviations. The implementation follows the plan's example exactly, including the `Promise.resolve(...).catch(...)` isolation shape, the `this.debug`-gated `console.log` on hook rejection, and the three-`@param` JSDoc addition.

---

## 6. Ambiguities & Decisions

**`Promise` alias.** `index.js` binds `Promise = require('bluebird')` at the top. Using `Promise.resolve(...)` therefore uses bluebird's `Promise.resolve`, which is functionally identical to native `Promise.resolve` for this purpose (both wrap a value/promise into a settled promise). The plan notes "A native `Promise.resolve` would be equivalent; do not add a new import either way." No new import was added; the existing binding was reused as the plan prescribes.

**Hook invocation argument.** The hook is called as `this.refreshTokenCallBack(this.refreshToken)` — exactly one argument, the rotated refresh token. This matches the `.d.ts` signature `(token: string) => void | Promise<void>` that will be added in Phase 3. The Phase 3 regression test will assert `arguments.length === 1` to lock this call site to that signature.

---

## 7. Tests

No tests added in Phase 2. Per plan, the regression test that proves the runtime behavior of this phase lands in Phase 3 — immediately following, in the same change-set window. The Phase 3 exit gate runs the test against this phase's code. The absence of a Phase 2 test is deliberate and documented in the plan.

---

## 8. Security & Best-Practices Review

- **Error isolation.** The hook's rejected promise is absorbed by its own `.catch` and cannot reach `callback`. No unhandled rejection can escape: the `.catch` consumes it.
- **Observability.** A hook rejection (meaning the rotated token was not persisted) logs to `console.log` if `this.debug` is set. An empty catch that silently discarded the error would leave operators blind to a real failure; the debug-gated log balances isolation and observability.
- **No new eval usage.** The `eval(prefix + 'refreshTokenCallBack')` pattern is the existing dual-form construction idiom; this phase adds one additional use of it, consistent with all other field assignments. No new security surface is introduced beyond what was already present in the constructor.
- **No network or credential exposure.** This phase is source-only edits; no credentials or keys are touched.
- **Scope contained.** No lines outside the two designated feature regions (`QuickBooks` constructor and `refreshAccessToken` `.then` handler) were modified.

---

## 9. Self-Review Scoring

| Element | Score | Comments |
|---------|-------|----------|
| Extensibility | 10 | `Promise.resolve(...)` tolerates both sync and async hooks; `|| null` fallback cleanly supports the 10-arg (omitted hook) construction; the isolation shape does not constrain future hook signatures. |
| Understandability | 9.5 | Implementation follows the plan's example exactly; JSDoc is contiguous through param 11; the hook's own `.catch` is visually distinct from the outer error `.catch`. The `eval(prefix + ...)` pattern (inherited from upstream, not introduced here) is inherently indirect but is the established idiom for this constructor. |
| Best Practices | 9.5 | `this.token` set unconditionally; rotation guard prevents spurious hook invocations; truthiness guard prevents calling null/undefined; hook rejection isolated with own `.catch`; `this.debug`-gated log preserves observability without breaking isolation. The `eval` idiom is the pre-existing upstream pattern, not a new practice introduced by this phase. |
| Plan Adherence | 10 | Every plan step executed exactly as specified. All five exit-gate assertions pass. No lines outside the two feature regions touched. No new imports. `.catch` error branch left unchanged. JSDoc gap filled with all three missing `@param` lines in order. |
| Test Quality | 10 | No tests in Phase 2 per plan; the regression test lands in Phase 3 against this phase's code. Absence is intentional and documented. |

---

## 10. Iterative Improvements Made

Initial implementation matched the plan's prescribed shape. No deficiencies found during self-review that required iteration. The `this.debug`-gated `console.log` in the hook's `.catch` was included in the first pass (the plan identifies it as the preferred shape over an empty catch).

---

## 11. Remaining Risks or Follow-Ups

- **`index.d.ts` not yet updated.** The constructor type declaration still shows 10 params; `fuze`'s 11-argument positional construction will not type-check until Phase 3 extends it.
- **No regression test yet.** The runtime behavior is unverified until Phase 3's `npx mocha test/refreshTokenCallBack.test.js` gate runs.
- **`node_modules` not installed.** No module-load smoke test is possible until Phase 3 runs `npm install`.
- **Deferred Validation: `fuze` build + sandbox live tests.** Cannot be performed without a `fuze` checkout; tracked as Deferred Validation in the plan.

---

## 12. Commands Run

```sh
# Exit gate — all run after edits, all passed:
grep -qF "refreshTokenCallBack" index.js                                          # PASS
grep -qF "refreshToken, refreshTokenCallBack) {" index.js                         # PASS
grep -qF "this.refreshTokenCallBack = eval(prefix + 'refreshTokenCallBack')" index.js  # PASS
grep -qF "this.refreshToken !== refreshResponse.refresh_token" index.js           # PASS
[ "$(grep -cF 'await this.refreshTokenCallBack' index.js)" = "0" ]               # PASS
[ "$(grep -cF 'request.post(' index.js)" = "0" ]                                 # PASS
```

---

## 13. Final Assertion

I assert that:
- Only Phase 2 has been implemented.
- No unnecessary scope expansion occurred.
- All quality scores are >= 9.5.
