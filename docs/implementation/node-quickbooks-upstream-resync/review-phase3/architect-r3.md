## architect — round 3

### Scope

Phase 3 = re-apply the `refreshTokenCallBack` feature in `index.d.ts` + add the offline regression
test. Rounds 1 and 2 raised zero architectural findings. This round re-verifies the reviser's
round-2 dispositions and re-checks the post-fix working tree for any new structural issue, then adds
new findings if any.

### In-progress review

- **No prior architect findings to carry.** Both `architect-r1.md` and `architect-r2.md` had empty
  findings tables. Nothing to re-verify as `Fixed`/`Rejected`, nothing to escalate, nothing to
  carry forward.
- **Reviser round-2 fixes are non-architectural and confirmed.** `reviser-r2.md` dispositioned
  `engineer-r2-f1` and `engineer-r2-f2` as Fixed — both pure JSDoc/comment prose corrections to
  `afterHookSettles` in `test/refreshTokenCallBack.test.js` (lines 27-52, 161-164). Verified: no
  change to type declarations, runtime, test logic, module boundary, import graph, or public API.
  The other reviewers (engineer-r3, typescript-cop-r3) have converged with all findings
  ratified-Closed.
- **Public-API delta re-verified directly.** `index.d.ts:462` (instance field) and `:476` (11th
  optional constructor param) are both exactly
  `refreshTokenCallBack?: (token: string) => void | Promise<void>`. Additive and non-breaking: the
  optional 11th positional param and optional field leave the existing 10-arg construction and all
  prior fields type-checking unchanged; no required-arg shape changed, no object overload added
  (Decision 2 honored). The type is structurally aligned three ways — the single-arg runtime call
  site `this.refreshTokenCallBack(this.refreshToken)` (`index.js:148`), the single `token` param in
  the `.d.ts`, and the test's `argCount === 1` arity lock (`test/refreshTokenCallBack.test.js:98`).
  The `void | Promise<void>` return matches the runtime `Promise.resolve(this.refreshTokenCallBack(...))`
  wrapping (`index.js:148`) that tolerates both sync and async hooks.
- **Case-4 ordering assumption still holds at the runtime call site.** The deterministic
  `afterHookSettles(hookPromise, ...)` chain depends on the hook being invoked (and `hookPromise`
  assigned) before `callback(null, refreshResponse)` runs. Re-confirmed in `index.js:144-153`: the
  rotation block fires `this.refreshTokenCallBack(...)` first (line 148), then
  `if (callback) callback(null, refreshResponse)` on line 153. The test's contract lock cannot
  silently desynchronize from the runtime.
- **Error-isolation contract intact.** `index.js:148-150` wraps the hook in
  `Promise.resolve(...).catch(...)` so a hook rejection cannot reach the node-style `callback` and
  cannot surface as an unhandled rejection — exactly the Decision-3 / fuze-consumer contract the
  test's case 4 pins (`hookSettled === true`, `callbackArgs[0] === null`, `unhandled.length === 0`).
  No structural drift between the runtime isolation and the test.
- **No new boundary, coupling, or package-quality risk.** The test imports only `assert`, `axios`,
  `../index` — no deep import into internals, no new devDep. The `.npmignore` inclusion of the test
  file is an inherited upstream property (every existing `test/*.js` ships the same way) and embeds
  no secrets; not a Phase-3-introduced risk.

### Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|

No architectural findings. Rounds 1 and 2 were clean; the round-2 fixes are comment-only and
introduce no boundary, coupling, public-API, or data-model risk; the case-4 ordering and the
error-isolation contract both confirm against the runtime call site; and the public-API delta
remains the two declared, additive, non-breaking lines. Converged.
