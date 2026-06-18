## architect — round 1

**Scope.** Phase 2 re-applies the `refreshTokenCallBack` feature onto upstream's axios-based
`index.js` in exactly the two designated regions (the `QuickBooks` constructor and the
`refreshAccessToken` `.then` handler). The Phase 2 delta lives in the working tree (committed HEAD
`23bc8a4` is the Phase 1 upstream-`2.0.49` reset, with `refreshTokenCallBack` absent; the feature is
the unstaged `index.js` modification). I scoped the review to `git diff` of the working tree against
that committed upstream baseline — that isolates the true Phase 2 change rather than the whole Phase 1
request->axios rewrite, which is out of scope here. I read the full constructor (`index.js:97-116`) and
`refreshAccessToken` (`index.js:125-154`) in context, the design's Decision 3, the plan's Phase 2
steps/exit gate, the pre-reset fork's `refreshAccessToken` (`git show master:index.js`), and the prior
implementation-auditor r1 turn.

**Architectural assessment (all axes).**

- **Ownership / scope containment.** The diff touches only the two regions named in the plan and design
  Migration step 2. `revokeAccess`, the `axios.post`/`postBody` call, the `.catch` error branch,
  `getUserInfo`, and the `xmlParser`/`OAuth`/`FormData` setup are all upstream-verbatim. No business
  logic drifted into an adjacent method; no out-of-scope "tidy." Confirmed against the upstream baseline
  diff — three hunks, one file.

- **Data flow & side-effect isolation (the crux — Decision 3).** The hook is invoked as
  `Promise.resolve(this.refreshTokenCallBack(this.refreshToken)).catch(...)` and is *not* `await`ed
  inside the `.then` that calls `callback(null, refreshResponse)`. This is the correct, deterministic
  isolation: the hook's rejection is confined to its own attached `.catch` and cannot enter the
  `.then`/`.catch` chain feeding the node-style `callback`. The success path still calls
  `callback(null, refreshResponse)` exactly once, regardless of hook outcome. This is the precise
  structure the design mandates and the `fuze` shim/coordinator binds to. The "specific wrong answer"
  (`await this.refreshTokenCallBack(...)` in the `.then`) is absent.

- **Boundary / contract preservation.** The success-path logic — `this.token` set unconditionally,
  rotation guard `this.refreshToken !== refreshResponse.refresh_token`, truthiness guard
  `if (this.refreshTokenCallBack)`, single-argument call `this.refreshTokenCallBack(this.refreshToken)`
  — is behaviorally identical to the pre-reset fork (`git show master:index.js`). The only intended
  delta is the isolation mechanism (own `.catch` replacing the incidental request-discards-the-promise
  fire-and-forget), which is exactly the observable-equivalence target. The failure-path arg shape is
  upstream's status-based `callback(err, err.response, ...)`, correctly left unchanged per the plan's
  scope note and the design Non-Goal of not altering error propagation.

- **Constructor / public API surface.** The 11th positional parameter `refreshTokenCallBack` is appended
  after `refreshToken` and populated via the existing `eval(prefix + ...)` dual-form idiom
  (`index.js:112`), so both positional and object construction populate `this.refreshTokenCallBack`. This
  extends, not breaks, upstream's 10-arg constructor: the new param is trailing and falls back to `null`,
  so existing 10-arg callers are unaffected. The runtime/`.d.ts` arity skew (the `.d.ts` still declares
  10 params) is correctly deferred to Phase 3 and is flagged in the implementor's notes; it is not a
  Phase 2 defect.

- **`this` binding & `Promise` reference.** The hook's `.catch` is `.bind(this)`, so the `this.debug`
  gate resolves to the constructed client; the outer `.then`/`.catch` remain `.bind(this)` so
  `this.token`/`this.refreshToken`/`this.refreshTokenCallBack` resolve. `Promise` is the pre-existing
  bluebird binding (`index.js:16`); no new import was added, consistent with the plan.

- **JSDoc.** Three `@param` lines (`oauthversion`, `refreshToken`, `refreshTokenCallBack`) were added in
  order so the block is contiguous through param 11 rather than documenting param 11 over a 9-10 gap.
  This is the feature's documentation footprint and is in-scope per the plan's explicit instruction.

- **Maintainability / pattern risk.** The change does not introduce a pattern that will be copy-pasted
  wrongly; the isolation shape is documented inline (the comment on the hook `.catch`) and locked by the
  Phase 3 regression test (which asserts the *structure*: callback fired once with no error, hook chain
  settled, zero unhandled rejections). The `eval(prefix + ...)` idiom is upstream's pre-existing
  construction mechanism, not introduced here, and is out of scope to change.

- **Performance / security.** No hot-path concern (refresh is an infrequent, network-bound operation).
  No new input-validation surface; the hook receives only the rotated token string. No
  credential/secret leakage — the debug-gated log emits the error object, not tokens.

**Conclusion.** The Phase 2 implementation is correct, scope-contained, and faithful to design
Decision 3 and the plan's prescribed shape. No architectural, boundary, data-flow, public-API, or
maintainability issue is actionable at this phase. The one residual (runtime arity ahead of the
`.d.ts`) is a planned Phase 3 item, not a Phase 2 finding.

### Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|
| _none_ | — | — | — | — | No actionable architectural finding. Phase 2 is confined to the two designated feature regions; the hook is isolated by its own `.catch` and never `await`ed into the success `.then` (design Decision 3); the constructor 11th param is a safe trailing, null-defaulted, dual-form extension; the failure-path arg shape correctly stays upstream's. Behavioral equivalence to the pre-reset fork holds on the success/rotation/hook path. | — |
