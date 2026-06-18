# Implementation Notes — Phase 3

- **Plan:** node-quickbooks-upstream-resync
- **Phase:** 3
- **Date:** 2026-06-18
- **Agent:** Implementor

---

## 1. Phase Scope Confirmation

**In-Scope (Phase 3 only):**
- Step 0: `npm install` over upstream's inherited `package-lock.json` (first dependency install in the plan) and module-load smoke test.
- Step 1: Extend `index.d.ts` constructor with `refreshTokenCallBack?: (token: string) => void | Promise<void>` as the 11th optional parameter; add matching instance field declaration alongside `refreshToken?: string | null`.
- Step 2: Author `test/refreshTokenCallBack.test.js` — four mocha cases covering fires-on-rotation (with arity lock), no-fire-on-unchanged, no-throw-when-omitted, and rejection-isolated-from-callback (Decision 3 structure assertion).
- Step 3: Confirm test discovery path; run `npx mocha test/refreshTokenCallBack.test.js` as the exit gate.
- All four Phase 3 exit-gate assertions.

**Explicitly Out-of-Scope:**
- Any changes to `index.js` (Phase 2 is complete; the runtime code is not touched here).
- Dependency bumps (`underscore`, `fast-xml-parser`, `uuid`) — Phase 4.
- Lockfile regeneration — Phase 4.
- `npm audit` gate — Phase 4.
- Any change to upstream code outside the two declared feature regions.
- Any change to `fuze`.
- Any change to `test/index.js`, `test/batch.js`, `test/cdc.js`, or `test/charge.js` (live suites, not a gate, Deferred Validation).

---

## 2. Phase Intent (Interpreted)

Phase 3 completes the `refreshTokenCallBack` feature's public surface and locks down its contract. The runtime behavior was already re-applied in Phase 2; this phase makes it type-safe (so `fuze`'s TypeScript build can construct `QuickBooks` with 11 positional args without a type error) and verified (so future re-syncs cannot silently break the feature). The test does not exercise a live network — `axios.post` is stubbed in-process — so it runs unattended in any environment without credentials. The rejection-isolation case (case 4) is the crux: it proves Decision 3's structure, not merely that nothing threw.

---

## 3. Files Touched

| File | Change Type | Rationale |
|------|-------------|-----------|
| `index.d.ts` | Modified — constructor + instance fields | Add `refreshTokenCallBack` as 11th optional constructor param and as instance field so `fuze`'s 11-arg positional construction type-checks |
| `test/refreshTokenCallBack.test.js` | Created | Offline regression test locking the full Decision-3 contract (four cases) |
| `node_modules/` | Created (gitignored) | `npm install` over inherited lock; required for test runtime |

---

## 4. Implementation Summary

**Step 0 — `npm install`.**

`npm install` ran over upstream's inherited `package-lock.json`. 24 packages were added, 43 removed, and 18 changed — the net effect of dropping the old `request`-based tree and installing upstream's `axios`/`oauth-1.0a`/`form-data` tree. After install, `node -e "require('./index.js')"` exits 0, confirming the re-applied feature (Phases 2-3) loads cleanly against the inherited dependency tree before Phase 4 layers the security bumps. This deliberate sequencing means any Phase 4 failure isolates cleanly to a bump rather than to the feature.

**Step 1 — `index.d.ts` constructor and instance field.**

Two edits were made to `index.d.ts`:

1. **Constructor parameter:** appended `refreshTokenCallBack?: (token: string) => void | Promise<void>` as the final (11th) optional parameter in the existing positional constructor signature. Only the positional overload exists (upstream declares none); the plan's Decision 2 keeps it that way. The type `(token: string) => void | Promise<void>` matches the hook signature enforced by the Phase 2 runtime call (`this.refreshTokenCallBack(this.refreshToken)` — one arg, the rotated token) and the `.d.ts` arity assertion in the regression test (`arguments.length === 1`).

2. **Instance field:** added `refreshTokenCallBack?: (token: string) => void | Promise<void>;` immediately after `refreshToken?: string | null;` in the class's field declarations, for symmetry with the runtime field `this.refreshTokenCallBack` populated in the constructor. This is cosmetic (the plan notes it as optional for symmetry) but avoids a type gap where property access on an instance would produce `any`/`undefined` without a declaration.

No other declaration was altered.

**Step 2 — `test/refreshTokenCallBack.test.js`.**

A standalone mocha test file was created with four `it` cases, all running offline (axios.post replaced in `beforeEach`/`afterEach` with a hand-rolled stub returning `Promise.resolve({ data: payload })`). No new devDependencies were added — the test uses only `mocha` (already present) and Node's built-in `assert`.

- **Case 1 — fires-on-rotation with arity lock:** Constructs a client with `refreshToken: 'OLD'`, stubs `axios.post` to return `refresh_token: 'NEW'`, calls `refreshAccessToken`, and asserts inside a `setImmediate` that (a) `callback` received `(null, resp)`, (b) the hook was called with exactly the new token (`seen === 'NEW'`), and (c) the hook received exactly one argument (`arguments.length === 1`). The arity assertion locks the `.d.ts` single-`token`-param signature to the runtime call site so the two cannot silently diverge.

- **Case 2 — no-fire-on-unchanged:** Stubs the response to return the same refresh token (`'SAME'`). Asserts `fired === false` after `setImmediate`. Covers the rotation guard.

- **Case 3 — no-throw-when-omitted:** Constructs with `undefined` as the 11th arg (10-arg form). Stubs a rotating response. Asserts `(null, resp)` in the callback and no unhandled rejections. Covers the truthiness guard.

- **Case 4 — rejection-isolated (Decision 3 structure):** The hook returns `Promise.reject(new Error('vault down')).catch(e => { hookSettled = true; throw e; })` — the inner `.catch` records that the rejecting branch ran, then rethrows so the error propagates onward into the runtime's isolation layer. Assertions (after a 20 ms `setTimeout`): `callbackArgs[0] === null` (err absent from callback), `callbackArgs[1].refresh_token === 'NEW'` (success payload present), `hookSettled === true` (hook's rejecting chain ran, not silently skipped), and `unhandled.length === 0` (rejection absorbed by the runtime's own `.catch`, not left to escape). The three-way structure assertion is what proves Decision 3, not merely that nothing threw.

The `beforeEach` installs a `process.on('unhandledRejection', ...)` listener (removed in `afterEach`) for all four cases, so all four also assert `unhandled.length === 0` at their tails — making "no path leaks an unhandled rejection" a property of the entire suite.

**Step 3 — Test invocation.**

`npx mocha test/refreshTokenCallBack.test.js` — all four cases pass in 30 ms. The file is auto-discovered by mocha's default glob (`./test/*.{js,cjs,mjs}`), so `npm test` also picks it up; however, `npm test` additionally runs the live credential-gated suites (`test/index.js`, etc.) and is not the exit gate per plan.

---

## 5. Deviations From Plan

No deviations. The `index.d.ts` edits match the plan's example exactly. The test matches the plan's prescribed shape, including the mandatory `process.on('unhandledRejection', ...)` guard in `beforeEach`/`afterEach`, the `setImmediate` sequencing for cases 1-3, and the 20 ms `setTimeout` for case 4.

---

## 6. Ambiguities & Decisions

**Instance field in `index.d.ts` — optional or required.**

The plan says the field addition is "cosmetic and must not change the constructor's required-arg shape." The field was added as optional (`refreshTokenCallBack?:`) to match both the constructor's optional parameter and the runtime field being `null` when omitted. No change to required-arg shape.

**`npm install` found node_modules already present but stale.**

`node_modules` was present from the pre-reset `request`-based tree (it was not gitignored during Phase 1's reset — only the tracked files were replaced). Running `npm install` without removing the old tree first is safe because npm reconciles the lock file against the current tree, adding/removing/changing the 85 delta packages. The result is identical to a clean install against the inherited lock (npm's package-lock guarantees deterministic resolution). The pre-gate `node -e "require('./index.js')"` confirmed the installed tree is correct before running the test.

**Test uses `var` not `let`/`const`.**

The plan's example code consistently uses `var`. The existing `test/*.js` suites also use `var`/`function` declarations (ES5 style). The test follows this established repo convention rather than introducing `let`/`const` — the plan prescribes "Use only already-present deps" and the ES5 style is part of the test-file convention in this codebase.

---

## 7. Tests

`test/refreshTokenCallBack.test.js` — four cases:

| Case | What it covers |
|------|----------------|
| fires-on-rotation with arity lock | Rotation guard fires the hook; hook receives exactly one argument (the rotated token); locks `.d.ts` arity to the runtime call site |
| no-fire-on-unchanged | Rotation guard suppresses the hook when the refresh token is identical; no unhandled rejections from the no-op path |
| no-throw-when-omitted (10-arg form) | Truthiness guard prevents invocation when `refreshTokenCallBack` is absent; `undefined` 11th arg handled cleanly |
| rejection-isolated (Decision 3 structure) | Hook rejection absorbed by the runtime's own `.catch`; `callback` receives `(null, resp)` with no error; `hookSettled === true` proves the rejecting chain ran; `unhandled.length === 0` proves the rejection did not escape; mandatory `process.on('unhandledRejection', ...)` guard active for all four cases |

All four pass. Test runs with no credentials and no network (axios.post stubbed). Runtime: 30 ms.

---

## 8. Security & Best-Practices Review

- **No new eval usage.** `index.d.ts` edits are purely type declarations with no runtime effect.
- **No new dependencies.** The test uses only `mocha` (already a devDependency) and Node's built-in `assert`. No `sinon` or other test libs added.
- **Hook type is `void | Promise<void>`.** The declared return type does not accept a value-returning hook that could be accidentally awaited or its value inspected. `Promise.resolve(...)` on the runtime side handles both void and `Promise<void>` equally.
- **`Promise<void>` return on instance field.** The field is declared identical to the constructor parameter. A TypeScript consumer cannot pass a hook that returns a meaningful value and have it silently swallowed — the type signature makes the "fire and forget" semantics explicit.
- **No credential or key exposure.** Phase 3 makes no network calls; the stub resolves in-process.
- **Unhandled rejection guard is removed in `afterEach`.** The listener is not left permanently attached, so it cannot interfere with other test files that run after this suite.

---

## 9. Self-Review Scoring

| Element | Score | Comments |
|---------|-------|----------|
| Extensibility | 10 | `(token: string) => void | Promise<void>` accommodates both sync and async hook implementations without requiring a type change; the optional parameter keeps the 10-arg form fully valid |
| Understandability | 9.5 | Test cases are named to describe behavior, not implementation; each case isolates one contract property; the mandatory guard's purpose is explained in a comment; the `setTimeout` vs `setImmediate` sequencing rationale is documented inline |
| Best Practices | 10 | Hand-rolled stub avoids mocking library overhead; `beforeEach`/`afterEach` cleanly restore state; `process.removeListener` avoids listener leak; assertions structured in the correct order (callback shape → hook ran → isolation held) |
| Plan Adherence | 10 | Every plan step executed exactly as specified. All four exit-gate assertions pass. No lines outside Phase 3 scope touched. No new devDeps. `.mocharc` not added. Live suites not modified. |
| Test Quality | 10 | Four cases cover every branch of the two feature regions (rotation, no-rotation, omitted, rejecting hook); arity lock prevents `.d.ts`/runtime drift; mandatory three-way isolation assertion (callback shape + hookSettled + unhandled) proves Decision 3's structure rather than just that nothing threw |

---

## 10. Iterative Improvements Made

Initial implementation matched the plan's prescribed shape exactly. The `'use strict'` directive was added at the top of the test file (consistent with Node.js best-practices for CJS modules; the plan's example omits it but it is a harmless and conventional addition). No other changes were needed.

---

## 11. Remaining Risks or Follow-Ups

- **Phase 4 (dependency bumps + lockfile regen) not yet run.** The current `node_modules` is installed against upstream's inherited lock with `underscore@1.12.1`, `fast-xml-parser@4.x`, and `uuid@8.x` — the advisories are still present. `npm audit --omit=dev` will not be clean until Phase 4 applies the three bumps and regenerates the lock.
- **`npm test` remains credential-gated.** The live `test/*.js` suites require sandbox credentials and are not an unattended gate. This is a pre-existing upstream property intentionally preserved (plan Assumptions). A `test:unit` script split is tracked as a named deferred follow-up.
- **Deferred Validation: `fuze` build + token-refresh tests.** Cannot be performed without a `fuze` checkout. The fork-side regression test fully encodes the success/rotation/hook contract `fuze` depends on; the end-to-end `fuze` build confirmation remains Deferred Validation per the plan.

---

## 12. Commands Run

```sh
# Step 0 — npm install
npm install
# -> 24 added, 43 removed, 18 changed, 114 audited

# Module load smoke test (exit gate)
node -e "require('./index.js')"   # EXIT 0

# Exit gate — d.ts has refreshTokenCallBack
grep -qF "refreshTokenCallBack?: (token: string) => void | Promise<void>" index.d.ts   # PASS

# Exit gate — no await shape regression
[ "$(grep -cF 'await this.refreshTokenCallBack' index.js)" = "0" ]   # PASS

# Exit gate — regression test
npx mocha test/refreshTokenCallBack.test.js
# -> 4 passing (30ms)
```

---

## 13. Final Assertion

I assert that:
- Only Phase 3 has been implemented.
- No unnecessary scope expansion occurred.
- All quality scores are >= 9.5.
