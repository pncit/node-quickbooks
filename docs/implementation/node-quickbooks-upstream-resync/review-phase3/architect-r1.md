## architect — round 1

### Scope

Phase 3 = re-apply the `refreshTokenCallBack` feature in `index.d.ts` + add the offline regression
test. Reviewed against the working tree (the Phase 1 reset to `dfc6375` plus uncommitted Phase 2/3
edits): `index.d.ts` modified (`M`), `test/refreshTokenCallBack.test.js` untracked. The `git diff
master` "new file" framing for `index.d.ts` is an artifact of `master` predating upstream's bundled
`.d.ts`; the load-bearing comparison is working-tree vs `upstream/master`, and `git diff
upstream/master:index.d.ts <working>` is exactly the two declared lines below.

### Axis review

- **Architecture & boundaries / ownership.** Both `.d.ts` edits sit inside the one owned feature
  region (the `QuickBooks` class constructor + its instance fields). No new module, import, layer, or
  cross-package surface is introduced. The test imports only `assert`, `axios`, and `../index` — no
  new boundary, no deep import into internals.
- **Public API surface.** The `.d.ts` adds a single optional 11th constructor parameter
  `refreshTokenCallBack?: (token: string) => void | Promise<void>` and a matching optional instance
  field. Verified against `upstream/master:index.d.ts` (zero `refreshTokenCallBack` occurrences there,
  two here): the change is **additive and safe** — the existing 10-arg positional construction still
  type-checks, no required-arg shape changed, no object overload added (Decision 2 honored). The hook
  type is structurally aligned three ways: the runtime call site `this.refreshTokenCallBack(this.refreshToken)`
  (one arg, `index.js:148`), the `.d.ts` single-`token` param, and the test's `argCount === 1` arity
  lock — so the surface and the implementation cannot silently diverge.
- **Data model / contract.** No DB/DTO/domain change. `RefreshTokenResponse` and `QuickBooksCallback<T>`
  are untouched upstream types; `refreshAccessToken(callback: QuickBooksCallback<RefreshTokenResponse>)`
  matches the runtime `callback(null, refreshResponse)` success shape.
- **Test as the contract lock.** The four cases pin the full Decision-3 contract, not just "nothing
  threw": fires-on-rotation (with arity lock), no-fire-on-unchanged, no-throw-when-omitted, and
  rejection-isolated (callback gets `(null, resp)` + `hookSettled === true` + `unhandled.length === 0`).
  The `process.on('unhandledRejection', …)` guard is registered in `beforeEach` / removed in
  `afterEach` for all four cases, and case 4 sequences off a 20 ms `setTimeout` to outlast both the
  microtask chain and the later `unhandledRejection` macrotask tick. The stub overrides `axios.post`,
  which is the real call form in `refreshAccessToken`, so interception is genuine. Offline,
  credential-free, zero new devDeps.
- **NPM package quality.** `test/refreshTokenCallBack.test.js` is not excluded by `.npmignore`
  (`build`/`.idea`/`**/junk**`) so it ships to npm — but every existing upstream `test/*.js` already
  ships the same way, the consumer (`fuze`) pulls via git pin not the published tarball, and the test
  embeds no credentials or secrets. This is an inherited upstream property, not a risk Phase 3
  introduces; no finding.
- **Performance / security.** No hot path touched; the only runtime code is Phase 2's (out of this
  phase's scope, reviewed in review-phase2). The test makes no network call.

### Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|

No actionable architectural findings. The Phase 3 surface change is minimal, additive, and
boundary-clean; the public-API delta is exactly the two declared lines and is non-breaking; the hook
type is locked to the runtime call site and the test's arity assertion; and the offline regression
test structurally pins the Decision-3 error-isolation contract `fuze` depends on. The pre-existing
`minorversion` field/param type discrepancy in `index.d.ts` is upstream-authored and outside both the
feature region and this phase's scope, so it is not raised here.
