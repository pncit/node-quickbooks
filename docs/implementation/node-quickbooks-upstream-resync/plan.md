# Plan: node-quickbooks Upstream Re-sync

- **Plan ID:** node-quickbooks-upstream-resync
- **Design Document:** `docs/implementation/node-quickbooks-upstream-resync/design.md`
- **Repo Context Checked:**
  - Confirmed the fork's `package.json` (`version 2.0.46`) still depends on `request@2.88.0`, `request-debug@0.2.0`, `underscore@1.12.1`, `fast-xml-parser@^4.3.2`, `uuid@^8.3.2` — the issue-#3 dependency set. No `axios`/`oauth-1.0a`/`form-data` and no `"types"` field. `scripts.test` is `mocha`.
  - Read the fork's feature regions in `index.js`: the requires block (`request`/`request-debug` at lines 9-17), constructor with 11th param `refreshTokenCallBack` (line 103) stored via `eval(prefix + 'refreshTokenCallBack') || null` (line 118), and `refreshAccessToken` (lines 131-163) — still `request.post(...)`, with the rotation guard (`this.refreshToken !== refreshResponse.refresh_token`), truthiness guard (`if (this.refreshTokenCallBack)`), and `await this.refreshTokenCallBack(...)` nested inside an async node-style callback whose returned promise `request` discards (the incidental fire-and-forget). `this.token` assigned unconditionally on success.
  - No `index.d.ts` in the fork (verified: file absent).
  - Test layout: `test/` holds live-credential mocha integration suites (`test/index.js` does `new QuickBooks(config)` against a sandbox; `test/batch.js`, `cdc.js`, `charge.js` similar). No `.mocharc`, so mocha defaults to `./test/*.spec.js`-style discovery of `test/*.js`. `config.js` ships blank credentials. There is **no** existing unit/mock test and no stubbing harness.
  - `.npmignore` = `build`, `.idea`, `**/junk**` (so `index.d.ts` will be published). `.gitignore` = `node_modules`, `build/generated.txt`, `.idea`, `**/junk**`.
  - Git: `origin` is `pncit/node-quickbooks`; working branch is `feat/node-quickbooks-upstream-resync` off `master`. Added `upstream` remote (`mcohen01/node-quickbooks`) and fetched — `upstream/master` is `2.0.49`, the current axios head (no tags published; no `2.0.50`).
  - Verified upstream `2.0.49` against design claims (all hold): `index.js` requires `axios`/`oauth-1.0a`/`form-data` (no `request`); `refreshAccessToken` is `axios.post(...).then(...).catch(...)`, sets `this.refreshToken` then `this.token` unconditionally inside `.then`, **no hook, no rotation guard**; constructor is 10 positional params ending at `refreshToken`, same `_.isObject(consumerKey)` eval-prefix dual construction, same `minorversion || 75`; `package.json` has `"types": "index.d.ts"`; `index.d.ts` constructor (lines 464-475) declares exactly the 10 positional params ending at `refreshToken?: string | null` with no object overload and no callback.
  - Verified the production-code delta: `git diff upstream/master:index.js HEAD:index.js` is the whole request↔axios rewrite plus exactly the two feature regions — no third reconciliation point. Net non-rewrite feature delta = constructor 11th param + field, and the `refreshAccessToken` hook/guards.
- **External Research:**
  - `underscore@1.13.8` is the current latest (`npm view underscore version`) and the fix for the ReDoS/DoS advisory (CVE-2026-27601 / GHSA family; recursion-without-depth-limit in `.flatten`/`.isEqual`); patched at `1.13.8`, a non-major bump from `1.12.1`.
  - `fast-xml-parser@5.9.2` is the current `latest` dist-tag (`npm view fast-xml-parser dist-tags` → `latest: 5.9.2`, `legacy: 4.5.6`). The entity-expansion advisory family has *grown* since the design was written: beyond CVE-2026-26278 (fixed 5.3.6) there is now CVE-2026-33036 (numeric-entity bypass, vulnerable `<=5.5.5`, fixed 5.5.6). The design's pin `^5.9.2` resolves to `>=5.9.2 <6` and clears the **entire** known advisory range including the newer CVE — so the pin remains correct and robust; no change needed. (Caret on a `5.x` is intentional: it floats forward within the major to absorb future 5.x security patches while staying off the unknown `6.x`.)
  - Node `v24.13.0` locally; axios `^1.13.2`, `oauth-1.0a@^2.2.6`, `form-data@^4.0.5` are upstream's pins (carried verbatim by the reset).
  - **`uuid` is a *direct* upstream dependency that survives the reset, not a `request` transitive.** Verified: upstream `2.0.49` `package.json` declares `"uuid": "^8.3.2"` directly (used at `index.js:12` `uuid = require('uuid')`, called at `index.js:2352` `uuid.v1()` for the `Request-Id` header). The reset therefore does **not** remove `uuid`, and `uuid@^8.3.2` carries advisory `GHSA-w5hq-g745-h8pq` / CVE-2026-41907 (moderate; missing buffer-bounds check in v3/v5/v6). `uuid.v1()` is not itself the vulnerable path (v1 throws `RangeError` on bad bounds), but `npm audit` flags the package, so the advisory must be cleared by a bump. Fixed at `>=11.1.1` (also `12.0.1`, `13.0.1`, `14.0.0`). Verified `require('uuid').v1()` still resolves and returns a valid v1 UUID under the current `uuid@14.0.0` (CommonJS named-property access is unaffected by the v11 ESM/deep-require changes), so the major bump is safe for this one call site. **The bump is pinned `^14.0.0`** — a caret on the *verified* current major — rather than an open-ended `>=11.1.1`: this clears the advisory (`14.0.0` is well past the `>=11.1.1` fix) while bounding the float to the one major whose `v1()` call site was actually tested, consistent with the caret pins used for `underscore`/`fast-xml-parser` and the design's "thin patch layer / pinned, well-understood" posture. An unbounded `>=` would silently admit a future `uuid@15+` with an unverified API.
  - **The `mocha` devDependency tree carries its own (unrelated) advisories**, so a bare `npm audit` is never clean here. Verified against the post-reset + post-bump tree: `npm audit` reports six advisories (`diff`, `js-yaml`, `minimatch`, `mocha`, `nanoid`, `serialize-javascript`), all transitive under the `mocha@10.1.0` devDependency — none of the eight named issue-#3 advisories, and none in the production tree a consumer installs. `npm audit --omit=dev` on the bumped tree reports **0 vulnerabilities**. The audit gate is therefore scoped to the production dependency tree (`--omit=dev`), which is the tree `fuze` actually inherits via the git pin; the design's "clean audit" is read as "clean of the eight named issue-#3 advisories," all of which are production deps.
- **Assumptions:**
  - The fork's value is its current `HEAD` state, not its branch history, so a history-rewriting `git reset --hard` onto upstream is acceptable (design Migration Strategy step 1). Implementation happens on the working branch `feat/node-quickbooks-upstream-resync`, not directly on `master`.
  - The reset legitimately reverts the fork's lone post-merge local change (`mocha` devDep `^10.8.2` → upstream's `10.1.0`). This is intended ("upstream wins everywhere except the two feature regions") and harmless — `mocha` is dev-only and the new regression test runs on either. The plan does **not** re-bump mocha. Consequently the `mocha@10.1.0` devDependency tree carries its own unrelated advisories, so a bare `npm audit` is never clean; the audit gate is scoped to the *production* tree (`npm audit --omit=dev`), which is the tree `fuze` inherits via the git pin and the tree the eight named issue-#3 advisories all live in. Cleaning the mocha devDep tree is out of scope for this design (issue-#3 is about the production exposure `fuze` ships).
  - `axios.post` is stubbable in-process without network, so the regression test (Phase 3) runs fully offline/unattended. The existing `test/*.js` live suites still require credentials and are **not** part of any exit gate (they are Deferred Validation).
  - **"Identical observable behavior" is scoped to the success/rotation/hook path, not the failure path.** The pre-reset fork classified success/failure on the **HTTP body** (`if (r && r.body && !(r.body.error === 'invalid_grant'))` → `callback(e, refreshResponse)`, else `callback(e, r, data)`), whereas upstream's axios path classifies on **HTTP status** (non-2xx → `.catch` → `callback(err, err.response, err.response ? err.response.data : null)`). The reset therefore intentionally adopts upstream's status-based classification and `.catch` error-callback shape, **replacing** the fork's body-based `invalid_grant` detection. This is in scope of "upstream wins everywhere except the two feature regions" and consistent with the design's Non-Goal of not improving/altering error propagation: the re-applied feature preserves the *success/rotation/hook* contract `fuze` binds to (Decision 3, the memory's contract #2), and `fuze`'s shim/coordinator observes only the success path's rotation hook, not the error-arg shape. The plan does **not** re-create the body-based branch. The end-to-end confirmation that `fuze` is indifferent to the changed failure-arg shape is a Deferred-Validation item (its token-refresh tests).
  - A `fuze` checkout is **not** available to the Implementor in this environment; the `fuze`-side build/test verification is therefore Deferred Validation, not a phase gate. The fork-side regression test fully encodes the contract `fuze` depends on.
  - **`npm test` remains credential-gated (inherited, intentionally not "fixed").** The reset inherits upstream's `"test": "mocha"` with no `.mocharc`, so `npm test` runs the live `test/*.js` suites and is **red offline / in CI without sandbox credentials** — a pre-existing upstream property, not introduced here. Per the "upstream verbatim" scope, the plan does **not** add a `.mocharc` or a `test:unit` script split. Consequently the **de-facto unattended/CI gate for this work is the isolated invocation `npx mocha test/refreshTokenCallBack.test.js`** (Phase 3/4 exit gates), not `npm test`; a future maintainer (or `fuze` CI) should not treat a green `npm test` as required, because it cannot be green without credentials. Splitting `test`/`test:unit` is a named, deferred follow-up — out of scope for issue-#3 (the production-tree security re-sync), tracked here so it is a deliberate choice rather than a silently broken script.
- **Quality Bar:** Extensibility and best practices prioritized. Backwards compatibility not prioritized unless explicitly stated. (Here, exact preservation of the `refreshTokenCallBack` observable contract **is** explicitly required by the design and is treated as a hard requirement.)

---

## Summary
- **Executive Summary:** Our private QuickBooks library (`pncit/node-quickbooks`, used by the `fuze` service) is stuck on an old, unmaintained HTTP library that drags in 8 security advisories — 2 critical — that we cannot patch in place. The public project we forked from has already done the hard work of replacing that library, so this plan resets our fork onto the current public code, then re-adds the one feature we own (a refresh-token-saving hook that `fuze` relies on) plus two small version bumps the public project hasn't made yet. The end result is a clean security audit, a `fuze` build that keeps working with no changes on its side, and a test that locks down our one feature so future updates can't silently break it.
- **Goals:**
  - Remove `request`/`request-debug` (and their transitive `tough-cookie`/`qs` advisories) by adopting upstream `2.0.49`'s axios codebase. (`form-data` and `uuid` are re-declared by upstream as *direct* deps and survive the reset: `form-data@^4.0.5` resolves clean at `4.0.6`; `uuid@^8.3.2` retains a moderate advisory and is bumped — see below.)
  - Re-apply the `refreshTokenCallBack` feature with **identical observable behavior** — fires only on refresh-token rotation, and a hook rejection is isolated from the QuickBooks node-style callback — in both `index.js` and the newly inherited `index.d.ts`.
  - Bump `underscore` to `^1.13.8`, `fast-xml-parser` to `^5.9.2`, and `uuid` to `^14.0.0`; regenerate the lockfile so `npm audit` (production tree) is clean of all eight named advisories.
  - Add an offline regression test that locks the feature and its error-isolation contract.
- **Non-Goals (from design):**
  - No changes to `fuze` (construction, callback shim, or refresh coordinator).
  - No rewriting of XML handling, no refactoring of fork code beyond the two feature regions, no dropping of `underscore`, no upstream PR, no migration off the git pin.
  - No *improvement* to callback error propagation — the existing contract is preserved exactly, not "fixed."

---

## Implementation Notes for the Implementor(s)
- **Implement one phase at a time** and run the phase's exit gate before proceeding.
- **Reset, don't merge** (Phase 1). The framing is "upstream wins everywhere except two regions." A merge would force manual conflict resolution across the entire request↔axios rewrite; a clean reset + small re-apply is correct and leaves no merge artifacts.
- **Do not touch any code outside the two feature regions** in `index.js`/`index.d.ts`. Everything else is upstream verbatim. Specifically: do not reorder or "tidy" upstream's `refreshAccessToken`, do not change the `xmlParser` instantiation or its one call site, do not alter the object/positional `eval`-prefix construction.
- **The error-isolation rule is the crux** (design Decision 3): the hook must be invoked with its **own attached `.catch()`** and **never `await`ed inside the axios `.then`** that calls `callback(null, refreshResponse)`. A naive `await this.refreshTokenCallBack(...)` inside the `.then` is the *specific wrong answer* — it routes hook rejections into `callback` and breaks `fuze`. Implement exactly the shape in Phase 2's example.
- **Preconditions must pass before the reset** (Phase 1) — if upstream's arity/hook/object-form differs from what the design assumed, stop and surface it rather than proceeding (already verified true at `2.0.49` during planning, but re-assert mechanically so the gate is falsifiable).
- Expected commands: `git fetch upstream`, `git reset --hard`, `npm install`, `npm audit`, `node -e "require('./index.js')"`, `npx mocha <path>`, `grep`/`rg`.
- **When dependencies become available:** Phases 1-2 are pure source/`git` edits and gate only on `git`/`grep` (no installed `node_modules` required). **`node_modules` is first installed at the start of Phase 3** (`npm install` over upstream's inherited `package-lock.json`), because Phase 3's regression-test gate `require`s `axios` and `../index` at runtime. Phase 4 then does a clean lockfile regen (`rm -rf node_modules package-lock.json && npm install`) after the bumps. No phase gate runs before its dependencies exist.
- **Gate-grep conventions (apply to every `grep` exit-gate in this plan):** use `grep -qF` (fixed-string) for literal-text assertions so regex metacharacters (`.`, `(`) match literally and don't false-match; for count assertions, capture the number explicitly — `[ "$(grep -c PATTERN FILE)" = "0" ]` — rather than relying on `grep`'s exit code (a `grep -c` that finds zero matches exits non-zero and would break an `&&` chain).
- Work on branch `feat/node-quickbooks-upstream-resync`. Do not push or open a PR unless explicitly asked.

---

## Phase 1: Reset fork onto upstream 2.0.49 (precondition-gated)

### Goal
Replace the fork's stale `request`-based tree with upstream `2.0.49`'s axios-based tree via a hard reset, after mechanically confirming the three facts the feature re-apply depends on. At the end of this phase the working tree is byte-for-byte upstream `2.0.49` (axios codebase, bundled `index.d.ts`, `"types"` field), with the `refreshTokenCallBack` feature **temporarily absent** — it is restored in Phases 2-3.

### Steps
1. **Add upstream remote and fetch.** Ensure the `upstream` remote points at `https://github.com/mcohen01/node-quickbooks.git` and fetch it.
   - Notes: `git remote get-url upstream || git remote add upstream https://github.com/mcohen01/node-quickbooks.git`, then `git fetch upstream`. Confirm `git show upstream/master:package.json` reports `"version": "2.0.49"`. (Upstream publishes no tags; `upstream/master` is the authoritative head.)
2. **Precondition checks (must all pass before the reset).** From the fetched tree, mechanically assert the design's re-baseline facts. If any fails, **stop and report** — do not reset.
   - `[ "$(git show upstream/master:index.js | grep -cF 'request.post(')" = "0" ]` and `[ "$(git show upstream/master:index.js | grep -cF "require('request')")" = "0" ]` (upstream is axios-based, no callback hook to collide with).
   - `git show upstream/master:index.js` constructor line is exactly `function QuickBooks(consumerKey, consumerSecret, token, tokenSecret, realmId, useSandbox, debug, minorversion, oauthversion, refreshToken) {` — 10 params ending at `refreshToken`, no `refreshTokenCallBack`.
   - `git show upstream/master:index.js | grep -qF "_.isObject(consumerKey)"` succeeds (object/positional dual construction preserved — the re-apply must populate the field from both forms).
   - `git show upstream/master:index.d.ts` constructor ends at `refreshToken?: string | null` with no `refreshTokenCallBack` and no object overload.
   - **Mechanical "no third feature region" gate (falsifiable, not eyeballed).** The reset discards the fork's `index.js` wholesale, so the only risk is silently dropping a fork-only *behavior* beyond the two known regions. Assert mechanically that the fork's only feature-bearing token absent from upstream is `refreshTokenCallBack` itself. Compute the set of fork-only identifiers and confirm it reduces to the known feature:
     - `[ "$(git show upstream/master:index.js | grep -cF 'refreshTokenCallBack')" = "0" ]` (token is fork-only — upstream has none) **and** `[ "$(git show HEAD:index.js | grep -cF 'refreshTokenCallBack')" != "0" ]` (present on the fork). This is the one feature token the reset must re-apply.
     - The rotation guard is the feature's only other behavioral marker: `git show HEAD:index.js | grep -qF 'this.refreshToken !== refreshResponse.refresh_token'` succeeds and `[ "$(git show upstream/master:index.js | grep -cF 'this.refreshToken !== refreshResponse.refresh_token')" = "0" ]` (fork-only). Both markers live inside the two known regions (constructor + `refreshAccessToken`); nothing else is re-applied.
   - **Best-effort backstop (NOT a hard gate):** additionally skim `git diff upstream/master:index.js HEAD:index.js` for any fork-only line outside those two regions. This is an unstructured read of a large request↔axios rewrite and is explicitly *advisory* — the two mechanical token checks above are the gate. If the skim surfaces an unexpected fork-only behavior, **stop** and enumerate it as an explicit reconciliation decision rather than letting the reset silently drop it. (At `2.0.49`, verified during planning, no such third delta exists.)
   - Files: none modified in this step (read-only assertions).
3. **Hard-reset the working branch onto upstream.** On `feat/node-quickbooks-upstream-resync`, run `git reset --hard upstream/master`.
   - Notes: This rewrites the branch to upstream `2.0.49` exactly: axios `index.js`, bundled `index.d.ts`, upstream `package.json` (with `axios`/`oauth-1.0a`/`form-data`, no `request`/`request-debug`, `"types": "index.d.ts"`), upstream `package-lock.json`, upstream devDeps (`mocha@10.1.0`). The fork's `request`-based `index.js` and its lone `mocha@^10.8.2` bump are intentionally discarded (design Migration step 1 + Assumptions).
   - Files: whole tree (driven by git, not hand-edits).
4. **Sanity-check the reset.** Confirm the tree is clean upstream using source-only assertions (no `node_modules` is installed yet — module-load smoke tests are deferred to Phase 3, where `npm install` first runs):
   - `[ "$(grep -cF 'request.post(' index.js)" = "0" ]` (no axios-vs-request regression), `grep -qF '"types": "index.d.ts"' package.json` succeeds, and `test -f index.d.ts`.
   - Do **not** run `node -e "require('./index.js')"` here; `axios` is not yet installed, so it would throw `MODULE_NOT_FOUND`. The first module-load smoke test runs in Phase 3 (after its `npm install`) and again in Phase 4 (after the clean regen).
   - Files: none modified.

### Opinionated Implementation Notes (Examples)
```sh
# Precondition gate (all must pass before reset). Note: -F = fixed-string (literal . and ( ),
# and count checks compare the captured number so a zero-count grep doesn't break the chain.
git fetch upstream
git show upstream/master:package.json | grep -qF '"version": "2.0.49"'
[ "$(git show upstream/master:index.js | grep -cF 'request.post(')" = "0" ]   # expect 0
git show upstream/master:index.js | grep -qF "function QuickBooks(consumerKey"  # 10 params, ends refreshToken
git show upstream/master:index.js | grep -qF "_.isObject(consumerKey)"          # dual construction present
git show upstream/master:index.d.ts | grep -A12 -F "constructor("               # ends refreshToken?: string | null

# Mechanical "no third feature region" gate (replaces eyeballing the rewrite diff):
[ "$(git show upstream/master:index.js | grep -cF 'refreshTokenCallBack')" = "0" ]                       # fork-only token, absent upstream
[ "$(git show HEAD:index.js          | grep -cF 'refreshTokenCallBack')" != "0" ]                        # present on the fork
git show HEAD:index.js | grep -qF 'this.refreshToken !== refreshResponse.refresh_token'                  # rotation guard present on fork
[ "$(git show upstream/master:index.js | grep -cF 'this.refreshToken !== refreshResponse.refresh_token')" = "0" ]  # fork-only

# Reset (only after the gate passes):
git reset --hard upstream/master
```

### Tests (in this phase)
- No new tests authored here (the regression test lands in Phase 3, with the feature it guards). The reset brings in upstream's `test/` live suites verbatim; they are not run as a gate (they need credentials — Deferred Validation).

### Documentation (if needed)
- None in this phase. (`README.md` is reset to upstream's; the feature's doc footprint is the JSDoc/`.d.ts` comment re-applied in Phases 2-3.)

### Exit Gate
- `git show upstream/master:package.json` contains `"version": "2.0.49"` (base confirmed; `grep -qF`).
- All Step-2 precondition assertions pass (each is a concrete fixed-string `grep -qF`, or a captured-count comparison for the count checks).
- After reset, each returns `0` via captured-count comparison: `[ "$(grep -cF 'request.post(' index.js)" = "0" ]`; `[ "$(grep -cF "require('request')" index.js)" = "0" ]`; `[ "$(grep -cF "require('request-debug')" index.js)" = "0" ]`.
- After reset: `test -f index.d.ts` succeeds and `grep -qF '"types": "index.d.ts"' package.json` succeeds.
- `git status` shows a clean tree (reset completed; no stray modifications).
- No module-load smoke test here: `node_modules` is not installed until Phase 3.

---

## Phase 2: Re-apply refreshTokenCallBack in index.js (runtime)

### Goal
Re-apply the `refreshTokenCallBack` feature onto upstream's axios `refreshAccessToken` and constructor so the runtime behavior is observably identical to the pre-reset fork: the hook is constructed from both positional and object forms; on success `this.token` is set unconditionally; the hook fires **only** on refresh-token rotation and **only** when present; and a hook rejection is isolated by its own `.catch()` and never reaches the QuickBooks node-style `callback`.

### Steps
1. **Constructor: add the 11th parameter and field.** In `index.js`, change the `QuickBooks` constructor signature to append `refreshTokenCallBack` after `refreshToken`, and add the field assignment alongside `this.refreshToken`, using the same `eval(prefix + ...)` dual-form pattern so it populates from both positional and object construction.
   - Files: `index.js`
   - Notes: Add `this.refreshTokenCallBack = eval(prefix + 'refreshTokenCallBack') || null;` immediately after the existing `this.refreshToken = ... || null;` line. For the JSDoc, note that upstream's constructor JSDoc (verified at `2.0.49`) stops at `@param minorversion` and documents neither `oauthversion` (param 9) nor `refreshToken` (param 10). To avoid shipping a JSDoc that skips params 9-10 but documents param 11, add **all three** missing `@param` lines in order so the block is contiguous through param 11: `@param oauthversion - the OAuth version ('1.0a' or '2.0')`, `@param refreshToken - the OAuth 2.0 refresh token`, and `@param refreshTokenCallBack - callback to cache refresh token outside of the object` (the last mirrors the pre-reset fork). These additions are inside the constructor region already being edited (the feature's documentation footprint), not an out-of-scope upstream tidy. Do not alter any other constructor line.
2. **`refreshAccessToken`: re-apply the rotation guard, truthiness guard, and isolated hook.** Modify upstream's `.then` handler so it (a) sets `this.token` unconditionally, and (b) reassigns `this.refreshToken` and invokes the hook **only** when the refresh token rotates, with the hook invoked via its **own `.catch()`** and **not** `await`ed into the `.then`.
   - Files: `index.js`
   - Notes: Upstream's `.then` currently does `this.refreshToken = refreshResponse.refresh_token; this.token = refreshResponse.access_token; if (callback) callback(null, refreshResponse);`. Replace the two assignments with: unconditional `this.token`, then a rotation-branch (`if (this.refreshToken !== refreshResponse.refresh_token)`) that reassigns `this.refreshToken` and, when `this.refreshTokenCallBack` is truthy, calls it with its own `.catch`. Leave `if (callback) callback(null, refreshResponse);` exactly as upstream (single call, no error, regardless of hook outcome). Do not touch upstream's `.catch((err) => ...)` error branch, the `postBody`/`axios.post` call, or `revokeAccess`.
   - **Scope note (failure path is upstream's, not the fork's):** Do **not** re-create the fork's pre-reset body-based `invalid_grant` detection or its `callback(e, r, data)` else-branch. Upstream's status-based `.then`/`.catch` split is kept verbatim; the only edits here are the rotation guard, the truthiness guard, and the isolated hook on the *success* path. The failure-path callback-arg shape intentionally changes to upstream's (`callback(err, err.response, …)`) — see Assumptions; `fuze`'s coordinator observes only the success-path rotation hook, and the end-to-end indifference to the failure-arg shape is a Deferred-Validation check.

### Opinionated Implementation Notes (Examples)
Constructor (only the two added lines shown in context):
```js
function QuickBooks(consumerKey, consumerSecret, token, tokenSecret, realmId, useSandbox, debug, minorversion, oauthversion, refreshToken, refreshTokenCallBack) {
  // ... upstream lines unchanged ...
  this.refreshToken = eval(prefix + 'refreshToken') || null;
  this.refreshTokenCallBack = eval(prefix + 'refreshTokenCallBack') || null;   // <-- added
  // ... upstream tokenSecret guard unchanged ...
}
```

`refreshAccessToken` `.then` handler — the **only** correct isolation shape (note: hook is NOT awaited inside `.then`; it carries its own `.catch`):
```js
}).then((function (res) {
  var refreshResponse = res.data;
  this.token = refreshResponse.access_token;            // unconditional
  if (this.refreshToken !== refreshResponse.refresh_token) {   // rotation branch only
    this.refreshToken = refreshResponse.refresh_token;
    if (this.refreshTokenCallBack) {                    // truthiness guard
      // Own .catch isolates a hook rejection from the node-style callback below.
      // Do NOT `await` this inside the .then — that would route rejections into `callback`.
      // Log (don't erase): a hook rejection means the rotated refresh token was NOT persisted,
      // a real failure the operator must be able to see. Reuse the constructor's `this.debug`
      // flag for consistency with upstream's HTTP logging. Swallow semantics are unchanged
      // (no rethrow, no await) so Decision 3 isolation holds.
      Promise.resolve(this.refreshTokenCallBack(this.refreshToken)).catch((function (e) {
        if (this.debug) console.log('refreshTokenCallBack failed to persist rotated token:', e);
      }).bind(this));
    }
  }
  if (callback) callback(null, refreshResponse);        // exactly once, no error, regardless of hook
}).bind(this)).catch((function (err) {
  if (callback) callback(err, err.response, err.response ? err.response.data : null);
}).bind(this));
```
- `Promise.resolve(...).catch(...)` tolerates both a value-returning and a promise-returning hook (matching the `void | Promise<void>` type in Phase 3) and guarantees the rejection lands in the hook's *own* `.catch`. **The recommended `.catch` body logs the failure** (gated on `this.debug`, as shown) rather than no-op'ing: a hook rejection means the rotated refresh token was not persisted — a real, otherwise-silent failure mode the operator needs to see. An empty `.catch(function () {})` is an acceptable **fallback** that still satisfies Decision 3 isolation, but it destroys observability of that failure and is not the preferred shape. Either way the rejection must be provably *handled here* (not propagated, not `await`ed into the `.then`); Phase 3's test asserts the rejection is captured here and absent from `callback`'s arguments, so both the logging and empty-catch forms pass the gate.
- `Promise` is upstream's bound `bluebird` require already present at the top of `index.js`; `Promise.resolve` is acceptable. (A native `Promise.resolve` would be equivalent; do not add a new import either way.)

### Tests (in this phase)
- None added here; the regression test that proves this runtime behavior lands in **Phase 3** (kept in the same change-set window as the feature, immediately following). This split is deliberate: Phase 2 is the `index.js` edit and Phase 3 is `index.d.ts` + the test, so each phase stays within the 1–5-file / single-session bound while the test still ships with the feature work (not deferred to a separate "tests project"). The Phase 3 exit gate runs the test against this phase's code.

### Documentation (if needed)
- Constructor JSDoc made contiguous through param 11: the missing `@param oauthversion` and `@param refreshToken` lines plus the new `@param refreshTokenCallBack` line are added (Step 1), so the block documents params 1-11 without a 9-10 gap. No README change.

### Exit Gate
- `grep -qF "refreshTokenCallBack" index.js` succeeds; the constructor signature line ends `..., refreshToken, refreshTokenCallBack) {`.
- `grep -qF "this.refreshTokenCallBack = eval(prefix + 'refreshTokenCallBack')" index.js` succeeds.
- `grep -qF "this.refreshToken !== refreshResponse.refresh_token" index.js` succeeds (rotation guard present).
- `index.js` contains **no** `await this.refreshTokenCallBack` (the wrong, await-in-`.then` shape is absent): `[ "$(grep -cF 'await this.refreshTokenCallBack' index.js)" = "0" ]`.
- `[ "$(grep -cF 'request.post(' index.js)" = "0" ]` (no regression of Phase 1).
- No module-load smoke test here: `node_modules` is still not installed until Phase 3. This phase gates purely on source `grep`s.

---

## Phase 3: Re-apply the feature in index.d.ts + add the offline regression test

### Goal
Make the inherited `index.d.ts` declare the 11th optional `refreshTokenCallBack` parameter (so `fuze`'s 11-argument positional construction type-checks), and add a standalone, credential-free regression test (stubbing `axios.post`) that locks the full Decision-3 contract: fires-on-rotation, no-fire-when-unchanged, no-throw-when-omitted, and rejection-isolated-from-callback (asserting the *structure*, not just the symptom).

### Steps
0. **Install dependencies (first install in the plan).** Run `npm install` over upstream's inherited `package-lock.json` so `node_modules` exists — Step 2's regression-test gate `require`s `axios` and `../index` at runtime and cannot run without it. This is the point in the plan where dependencies first become available.
   - Files: `node_modules/` (created, gitignored); `package-lock.json` unchanged (install honors the inherited lock; the bumps + clean regen happen in Phase 4).
   - Notes: `npm install`. After it completes, `node -e "require('./index.js')"` should exit 0 (the first module-load smoke test in the plan — exercises upstream's `new XMLParser()` against `fast-xml-parser@4.x` at this point; the 5.x bump and its re-verification land in Phase 4). **This 4.x install/verify is deliberate sequencing, not redundant churn:** it proves the re-applied *feature* (Phases 2-3) loads and its regression test passes *before* Phase 4 layers the dependency bumps, so any Phase 4 failure localizes cleanly to a bump rather than the feature. Phase 4 then discards this tree (`rm -rf node_modules package-lock.json`) and re-verifies against the bumped 5.x/14.x tree.
1. **Extend the `index.d.ts` constructor.** Add `refreshTokenCallBack?: (token: string) => void | Promise<void>` as the final optional parameter of the constructor declaration (after `refreshToken?: string | null`).
   - Files: `index.d.ts`
   - Notes: Extend **only** the existing single positional constructor signature (upstream declares no object overload; design Decision 2 keeps it that way — `fuze` constructs positionally). Optionally add a matching `refreshTokenCallBack?: ...` property declaration alongside the other instance fields (e.g. near `refreshToken?: string | null;`) for symmetry with the runtime field; this is cosmetic and must not change the constructor's required-arg shape. Do not alter any other declaration.
2. **Add the regression test.** Create `test/refreshTokenCallBack.test.js` — a mocha test that loads the real `index.js`, stubs `axios.post` to resolve with a controlled token payload, and asserts the four behaviors below. It must run with **no credentials and no network**.
   - Files: `test/refreshTokenCallBack.test.js`
   - Notes: Stub by overriding the `axios` module's `post` for the duration of each case. The fires-on-rotation case (case 1) **must** also assert the hook is invoked with **exactly one argument** (the rotated token) via `arguments.length === 1`, locking the runtime call site (`this.refreshTokenCallBack(this.refreshToken)`) to the `.d.ts` single-`token`-param signature so the two cannot silently diverge (e.g. an implementor passing `(token, refreshResponse)`). The cleanest approach that avoids adding a mocking dependency: require `axios` in the test, save `axios.post`, replace it with a stub returning `Promise.resolve({ data: <payload> })`, restore in an `afterEach`. Because `index.js` captured `axios` at module load via `require('axios')` (same singleton the test mutates), reassigning `axios.post` is observed by `refreshAccessToken`. Construct the client with `oauthversion: '2.0'` (object form) or 11 positional args so the `tokenSecret` guard doesn't throw and the refresh path is reachable. Use only already-present deps (`mocha`; Node's built-in `assert`). Do **not** add `sinon` or other test libs — a hand-rolled stub keeps the fork's zero-extra-devDep posture and is sufficient here. The rejection-isolation case (case 4) **must** register a `process.on('unhandledRejection', …)` guard (in `beforeEach`, removed in `afterEach`) and assert it never fires for the hook rejection, **must** assert the hook's own chain settled (`hookSettled === true`), and **must** sequence its final assertions after the hook's microtask chain and the later `unhandledRejection` tick have settled (a short `setTimeout`, not a single `setImmediate`) — see the example. This is not optional: it is what proves Decision 3's *structure* (rejection contained by the hook's own `.catch`) rather than merely that nothing threw.
3. **Wire the test into discovery.** Mocha's default spec glob is `./test/*.{js,cjs,mjs}` (no `.mocharc` present), so `test/refreshTokenCallBack.test.js` is auto-discovered by `npm test`. But `npm test` (`mocha`) also picks up the live `test/*.js` suites which fail without credentials. Run the new test **in isolation** for the gate: `npx mocha test/refreshTokenCallBack.test.js`.
   - Files: none (invocation only).
   - Notes: Do **not** modify the live suites or add a `.mocharc` that would change upstream's `npm test` behavior (out of scope: "upstream verbatim"). The gate command targets the single file explicitly.

### Opinionated Implementation Notes (Examples)
`index.d.ts` constructor (added final param):
```ts
  constructor(
    consumerKey: string,
    consumerSecret: string,
    oauthToken: string,
    oauthTokenSecret: string | false,
    realmId: string,
    useSandbox: boolean,
    debug?: boolean,
    minorversion?: string | null,
    oauthversion?: string,
    refreshToken?: string | null,
    refreshTokenCallBack?: (token: string) => void | Promise<void>   // <-- added
  );
```

`test/refreshTokenCallBack.test.js` (shape — fill in all four cases):
```js
var assert = require('assert'),
    axios  = require('axios'),
    QuickBooks = require('../index');

function makeClient(refreshToken, cb) {
  // 11 positional args; oauthversion '2.0' so the tokenSecret guard is skipped.
  // minorversion is '75' (string) to match the .d.ts type `minorversion?: string | null`
  // and upstream's `minorversion || 75` default — keeps the example consistent with the
  // types shipped in the same change-set.
  return new QuickBooks('ck', 'cs', 'tok', false, 'realm', true, false, '75', '2.0', refreshToken, cb);
}

describe('refreshTokenCallBack', function () {
  var origPost, unhandled;
  beforeEach(function () {
    origPost = axios.post;
    // Mandatory unhandled-rejection guard: if the hook rejection ever escapes the
    // hook's own .catch (i.e. Decision 3's isolation is broken), this records it
    // and the rejection-isolation case asserts it never fired.
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
  });
  afterEach(function () {
    axios.post = origPost;
    process.removeListener('unhandledRejection', onUnhandled);
  });
  function onUnhandled(err) { unhandled.push(err); }

  function stubPost(payload) {
    axios.post = function () { return Promise.resolve({ data: payload }); };
  }

  it('fires the hook with exactly the new token as its single argument when rotated', function (done) {
    var seen = null, argCount = -1;
    var qbo = makeClient('OLD', function (t) { seen = t; argCount = arguments.length; });
    stubPost({ access_token: 'A2', refresh_token: 'NEW' });
    qbo.refreshAccessToken(function (err, resp) {
      assert.strictEqual(err, null);
      assert.strictEqual(resp.refresh_token, 'NEW');
      setImmediate(function () {
        assert.strictEqual(seen, 'NEW');       // hook received the rotated token...
        assert.strictEqual(argCount, 1);       // ...as its ONE and only argument (locks the .d.ts arity)
        assert.strictEqual(unhandled.length, 0);  // no path leaks an unhandled rejection
        done();
      });
    });
  });

  it('does NOT fire the hook when the refresh token is unchanged', function (done) {
    var fired = false;
    var qbo = makeClient('SAME', function () { fired = true; });
    stubPost({ access_token: 'A2', refresh_token: 'SAME' });
    qbo.refreshAccessToken(function () {
      setImmediate(function () {
        assert.strictEqual(fired, false);
        assert.strictEqual(unhandled.length, 0);  // no path leaks an unhandled rejection
        done();
      });
    });
  });

  it('does NOT throw on rotation when the hook was omitted (10-arg form)', function (done) {
    var qbo = makeClient('OLD', undefined);   // refreshTokenCallBack absent
    stubPost({ access_token: 'A2', refresh_token: 'NEW' });
    qbo.refreshAccessToken(function (err, resp) {
      assert.strictEqual(err, null);
      assert.strictEqual(resp.refresh_token, 'NEW');
      setImmediate(function () {
        assert.strictEqual(unhandled.length, 0);  // omitted-hook rotation leaks nothing
        done();
      });
    });
  });

  it('isolates a hook rejection from the node-style callback (Decision 3 structure)', function (done) {
    var hookSettled = false, callbackArgs = null;
    // The hook returns a rejected promise. The test's own .catch records that the hook
    // chain settled, then rethrows so the rejection continues to propagate — it MUST be
    // absorbed by the runtime's own .catch on the hook (Decision 3), not by `callback`
    // and not as an unhandled rejection.
    var qbo = makeClient('OLD', function () {
      return Promise.reject(new Error('vault down'))
        .catch(function (e) { hookSettled = true; throw e; });
    });
    stubPost({ access_token: 'A2', refresh_token: 'NEW' });
    qbo.refreshAccessToken(function () { callbackArgs = Array.prototype.slice.call(arguments); });

    // Sequence assertions AFTER the hook's microtask chain has fully settled. A single
    // setImmediate can run before the hook's .catch resolves; allow extra turns via a
    // short timer so `hookSettled` and any unhandled-rejection delivery are observable.
    // (process 'unhandledRejection' is delivered on a later tick, so the timer must
    // outlast it — a small setTimeout is the simple, deterministic choice here.)
    setTimeout(function () {
      // structure: callback fired exactly once, success result, NO error in its args
      assert.strictEqual(callbackArgs[0], null);                 // err === null
      assert.strictEqual(callbackArgs[1].refresh_token, 'NEW');  // success payload
      // the hook's promise chain actually ran and settled (rejection path exercised)
      assert.strictEqual(hookSettled, true);
      // and the rejection was contained by the hook's OWN .catch — it neither reached
      // `callback` (asserted above) NOR escaped as an unhandled rejection:
      assert.strictEqual(unhandled.length, 0);
      done();
    }, 20);
  });
});
```
- The rejecting-hook case pins the *structure* per design Success Criteria, three ways: (1) `callback` fired once with `(null, successPayload)` and no error — fails if an implementor routes the rejection through `callback`; (2) `hookSettled === true` — proves the hook's rejecting chain actually ran (not silently skipped); (3) `unhandled.length === 0` — proves the rejection was absorbed by the runtime's *own* `.catch` on the hook, **not** left to escape as an unhandled rejection. The mandatory `process.on('unhandledRejection', …)` guard (registered in `beforeEach`, removed in `afterEach`) is what makes (3) a real assertion rather than a reliance on the runner; if the implementor writes the wrong `await`-in-`.then` shape or omits the hook's `.catch`, one of these three fails. Because the guard is registered for **all four** cases, each case also asserts `unhandled.length === 0` at its tail — turning "no path leaks an unhandled rejection" into a property of the whole suite (a future regression that escapes the hook's `.catch` on the no-rotation or omitted path is caught, not silently collected and discarded).
- **Timing:** the final assertions are sequenced off a short `setTimeout` rather than a single `setImmediate`, because the hook's `.catch` settles on the microtask queue and `unhandledRejection` is delivered on a later macrotask tick — the timer must outlast both so `hookSettled` and `unhandled` are observable. The other three cases keep their `setImmediate`/direct assertions (their observed state settles within one turn). If an implementor prefers, the success-rotation case (case 1) can likewise be tightened to a `setTimeout`, but it is not required there.

### Tests (in this phase)
- `test/refreshTokenCallBack.test.js` — the four cases above (fires-on-rotation, no-fire-on-unchanged, no-throw-when-omitted, rejection-isolated). Proves both the happy path and the failure-mode (hook rejection) contract. The rejection-isolated case asserts the full Decision-3 structure: callback fired once with no error, the hook chain settled (`hookSettled`), and zero unhandled rejections (mandatory `process.on('unhandledRejection', …)` guard).

### Documentation (if needed)
- The `.d.ts` carries the type as self-documentation. No README change required.

### Exit Gate
- `npm install` has run (Step 0); `node -e "require('./index.js')"` exits `0` (module loads against the installed deps).
- `grep -qF "refreshTokenCallBack?: (token: string) => void | Promise<void>" index.d.ts` succeeds.
- `npx mocha test/refreshTokenCallBack.test.js` passes all four cases — including the rejection-isolation case's `hookSettled === true` and zero-unhandled-rejection assertions.
- The test runs with **no** `config.js` credentials and makes **no** network call (axios stubbed) — confirm by running with networking unavailable / credentials blank; it must still pass.
- `[ "$(grep -cF 'await this.refreshTokenCallBack' index.js)" = "0" ]` (guards the isolation shape didn't regress).

---

## Phase 4: Dependency bumps, lockfile regeneration, and clean-audit gate

### Goal
Apply the three security bumps the reset did not carry (`underscore` → `^1.13.8`, `fast-xml-parser` → `^5.9.2`, `uuid` → `^14.0.0`), regenerate `package-lock.json` from a clean install, and prove via `npm audit --omit=dev` that the production dependency tree is clean of all eight issue-#3 advisories and that `request`/`request-debug` are absent from the lockfile — with the module still loading and the regression test still green.

### Steps
1. **Bump the three dependencies in `package.json`.** Change `"underscore": "1.12.1"` → `"underscore": "^1.13.8"`, `"fast-xml-parser": "^4.3.2"` → `"fast-xml-parser": "^5.9.2"`, and `"uuid": "^8.3.2"` → `"uuid": "^14.0.0"`. Leave every other dependency at upstream's pin (axios, oauth-1.0a, form-data, etc., untouched).
   - Files: `package.json`
   - Notes: These are the only three dependency edits in the whole plan. Do not bump or add anything else (no mocha re-bump — Assumptions; the mocha devDep tree's own advisories are out of scope and are excluded by the `--omit=dev` audit gate, since `fuze` does not install devDeps). The `uuid` bump is a semver-major (8.x → 14.x); it is required because upstream re-declares `uuid` as a *direct* dep that survives the reset and `uuid@^8.3.2` carries advisory `GHSA-w5hq-g745-h8pq` (moderate). `^14.0.0` clears the advisory (well past the `>=11.1.1` fix) and is **caret-pinned to the verified current major** rather than an open-ended `>=11.1.1`, bounding the float to the major whose sole call site was tested — consistent with the `underscore`/`fast-xml-parser` caret pins. Verified during planning that `require('uuid').v1()` (the sole call site, `index.js:2352`) still resolves and returns a valid v1 UUID under `uuid@14.0.0`, so the major bump is safe for this codebase. Step 4 re-verifies the resolved `uuid.v1()` at runtime.
2. **Regenerate the lockfile from a clean install.** Remove `node_modules` and the inherited `package-lock.json`, then `npm install` to produce a fresh lockfile resolving the bumped versions.
   - Files: `package-lock.json` (regenerated), `node_modules/` (rebuilt, gitignored)
   - Notes: `rm -rf node_modules package-lock.json && npm install`. A clean regen (vs `npm install` over the old lock) ensures no stale `request` transitive tree lingers. Confirm the resolved versions: `npm ls underscore fast-xml-parser uuid` shows `underscore@1.13.8`+, `fast-xml-parser@5.9.2`+, and `uuid@14.x` (the caret resolves within major 14).
3. **Run the falsifiable audit gate.** Assert the production dependency tree is clean of advisories (which subsumes "each of the eight named advisories is absent"), and that `request`/`request-debug` do not appear in the lockfile.
   - Files: none (verification).
   - Notes: Key the gate on **advisory presence in the production tree**, not on raw name occurrence in the JSON. A bare substring scan (`grep "\"uuid\"" audit.json`) is unsound: clean modules don't appear at all, and a package name can appear as a dependency-path key or `via` reference of an *unrelated* advisory — so the substring loop both false-positives and gives no signal on the actual advisory IDs. Instead:
     - `npm audit --omit=dev --json` and assert `.metadata.vulnerabilities.total === 0` (production tree has zero advisories of any severity). The `--omit=dev` is deliberate: the `mocha@10.1.0` devDependency tree carries its own unrelated advisories (`diff`, `js-yaml`, `minimatch`, `mocha`, `nanoid`, `serialize-javascript`) that are out of scope here and that `fuze` never installs (consumers install production deps only). Verified during planning: `npm audit --omit=dev` on the post-bump tree reports `0 vulnerabilities`; a full `npm audit` reports 6, all in the mocha devDep tree, none among the eight named issue-#3 advisories.
     - As an explicit per-module belt-and-suspenders check, assert none of the eight named modules appears as a key under `.vulnerabilities`: `npm audit --omit=dev --json | jq -r '.vulnerabilities | keys[]'` must contain none of `request request-debug form-data tough-cookie qs uuid underscore fast-xml-parser`. (With `.metadata.vulnerabilities.total === 0` this list is empty, so this is a redundant guard that also localizes any future regression to a named module.)
     - Lockfile absence: `[ "$(grep -cF '"node_modules/request"' package-lock.json)" = "0" ]` and `[ "$(grep -cF 'request-debug' package-lock.json)" = "0" ]`.
4. **Re-verify module load, the `uuid.v1()` call site, and the regression test on the final tree.** With deps installed, confirm `index.js` loads, `uuid.v1()` resolves under the new major, and the Phase 3 test still passes against the bumped `fast-xml-parser`/`underscore`/`uuid`.
   - Files: none.
   - Notes: `node -e "require('./index.js')"` exits 0 (exercises `new XMLParser()` at module load against `fast-xml-parser@5.x`). Confirm the `uuid` major bump didn't break the one call site: `node -e "var u=require('uuid'); if (typeof u.v1 !== 'function' || !u.v1()) process.exit(1)"` exits 0. Then `npx mocha test/refreshTokenCallBack.test.js`.

### Opinionated Implementation Notes (Examples)
```sh
# package.json edits (the only three dep changes in the plan):
#   "underscore": "1.12.1"        -> "underscore": "^1.13.8"
#   "fast-xml-parser": "^4.3.2"   -> "fast-xml-parser": "^5.9.2"
#   "uuid": "^8.3.2"              -> "uuid": "^14.0.0"

rm -rf node_modules package-lock.json
npm install
npm ls underscore fast-xml-parser uuid   # underscore@1.13.8, fast-xml-parser@5.9.2, uuid@14.x

# Falsifiable audit gate — production tree must be advisory-free (subsumes the eight named ones).
# --omit=dev excludes the mocha devDep tree's own, out-of-scope advisories (not installed by fuze).
[ "$(npm audit --omit=dev --json | jq '.metadata.vulnerabilities.total')" = "0" ]
# Belt-and-suspenders: none of the eight named modules appears as a vulnerability key.
npm audit --omit=dev --json | jq -r '.vulnerabilities | keys[]' \
  | grep -Ex 'request|request-debug|form-data|tough-cookie|qs|uuid|underscore|fast-xml-parser' \
  && { echo "NAMED ADVISORY STILL PRESENT"; exit 1; } || true
# request / request-debug absent from the lockfile:
[ "$(grep -cF '"node_modules/request"' package-lock.json)" = "0" ]
[ "$(grep -cF 'request-debug' package-lock.json)" = "0" ]

node -e "require('./index.js')"                                              # exit 0
node -e "var u=require('uuid'); if(typeof u.v1!=='function'||!u.v1())process.exit(1)"  # uuid.v1 OK under new major
npx mocha test/refreshTokenCallBack.test.js                                  # green on 5.x parser
```
- `jq` is used to read `npm audit --json` structurally. It is standard in CI images and on the planning host; if unavailable, the equivalent is `npm audit --omit=dev` exiting `0` with "found 0 vulnerabilities" (npm's audit exit code is non-zero when advisories at/above the configured level remain), but the `jq` `.metadata.vulnerabilities.total === 0` assertion is the precise, falsifiable form.
- `fast-xml-parser@5.x` ships a dual CommonJS/ESM build, so `require('fast-xml-parser').XMLParser` in `index.js:17` still resolves and `new XMLParser()` with default options keeps identical parse output for the one call site — verified during planning that `5.9.2` is the current `latest` and preserves the `XMLParser` API. The `node -e require` load is the smoke test for this.

### Tests (in this phase)
- No new test files; re-run `test/refreshTokenCallBack.test.js` (Phase 3) against the bumped deps as part of the gate. The XML-parser bump's only runtime exposure is module load + the single `xmlParser.parse(body)[rootTag]` call site (not hit by the offline refresh test); the live parse path is covered by Deferred Validation. The `uuid` major bump's only runtime exposure is the `uuid.v1()` call site (`index.js:2352`), covered by the Step-4 `node -e` smoke check (and the live `Request-Id` header in Deferred Validation).

### Documentation (if needed)
- None.

### Exit Gate
- `package.json` shows `"underscore": "^1.13.8"`, `"fast-xml-parser": "^5.9.2"`, and `"uuid": "^14.0.0"`; no other dependency changed from upstream.
- `npm ls underscore fast-xml-parser uuid` resolves `underscore@1.13.8`+, `fast-xml-parser@5.9.2`+, and `uuid@14.x`.
- `npm audit --omit=dev --json` reports `.metadata.vulnerabilities.total === 0` (production tree advisory-free, which subsumes the eight named advisories `request`, `request-debug`, `form-data`, `tough-cookie`, `qs`, `uuid`, `underscore`, `fast-xml-parser`), and `.vulnerabilities | keys` contains none of those eight modules.
- `[ "$(grep -cF '"node_modules/request"' package-lock.json)" = "0" ]` and `[ "$(grep -cF 'request-debug' package-lock.json)" = "0" ]`.
- `node -e "require('./index.js')"` exits `0`; `node -e "var u=require('uuid'); if(typeof u.v1!=='function'||!u.v1())process.exit(1)"` exits `0`.
- `npx mocha test/refreshTokenCallBack.test.js` passes.

---

## Deferred Validation (run after implementation is complete)
- **`fuze` build + token-refresh tests against the re-synced fork.** In a `pncit/fuze` checkout, update its `node-quickbooks` `#master` pin to the re-synced commit, run `fuze`'s type-check/build and its QuickBooks token-refresh tests (`src/factories/api.test.ts`, `src/models/api.qbo/qboApi.emitExternalCall.test.ts`) with **no changes to `fuze` source**. Pass = green build (the now-shipped `index.d.ts` accepts the 11-argument positional construction) and passing token-refresh tests (the error-isolation contract holds end-to-end). **Also confirm here that `fuze` is indifferent to the changed *failure-path* callback-arg shape** — the reset replaces the fork's body-based `invalid_grant` classification (`callback(e, r, data)`) with upstream's status-based `.catch` shape (`callback(err, err.response, err.response ? err.response.data : null)`); `fuze`'s token-refresh tests should still pass, confirming its shim/coordinator binds only to the success-path rotation hook, not the error-arg shape. — Deferred because the `fuze` repo is a separate private checkout not available to the Implementor in this environment; the fork-side Phase 3 test encodes the success/rotation/hook contract for unattended coverage (the failure-arg shape is upstream's and out of the fork-side test's scope).
- **Live QuickBooks sandbox smoke test of the axios migration.** Populate `config.js` with real sandbox credentials and run `npm test` (the live `test/*.js` suites) to confirm the request→axios migration and the `fast-xml-parser@5.x` bump did not regress real API calls / XML response parsing. Pass = the live CRUDQ suites succeed. — Deferred because it requires real Intuit sandbox credentials and network access to a third-party service, which cannot run unattended in CI.
