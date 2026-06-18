## engineer — round 1

First engineer review of this plan. The prior `plan-auditor` round (f1–f5) is all `Closed`/ratified by
the reviser and plan-auditor-r2; I do not re-raise those. I reviewed for engineering quality only —
DRY/reuse, abstraction & complexity, error-handling & logging strategy, naming & intent, and
config/magic values — reading `plan.md`, `design.md`, and the upstream `2.0.49` source the examples
patch (`refreshAccessToken`, the constructor, and its JSDoc) directly.

The plan is unusually thorough and the structural correctness is already locked down by the auditor.
My findings are narrower: the canonical Phase-2 example swallows a persistence failure with **zero
operator signal**, one type/value mismatch in the test helper, a JSDoc-symmetry gap, and a
shared-guard hygiene issue in the test. None are blockers; the swallow-with-no-log one is the only one
that touches a real observability gap the design itself flagged as a choice the plan must make.

### Axis notes

- **DRY & reuse:** Clean. The plan correctly reuses upstream's bound `Promise`/axios machinery and the
  existing `eval(prefix + …)` dual-construction idiom rather than introducing a parallel path, and
  explicitly forbids adding `sinon` (reuses Node's built-in `assert` + a hand-rolled stub). No
  duplication introduced.
- **Abstraction & complexity:** Appropriately thin. The feature is two localized edits; no new
  modules/abstractions are proposed, matching the "thin patch layer" intent. The four test cases are
  the right granularity. No over-engineering.
- **Config & magic values:** The three version strings are the *subject* of the change and live in
  `package.json` where they belong; the `setTimeout(…, 20)` is documented with rationale (microtask +
  `unhandledRejection` macrotask tick). No stray magic values to flag. See f3 for the one value that
  is mistyped, not mis-placed.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|
| engineer-r1-f1 | Medium | Open | ErrorHandling | plan.md Phase 2 example, line 144 (`.catch(function () {})`); notes lines 152, 301 | The canonical re-apply example swallows a hook rejection with a **bare empty `.catch`** and the notes explicitly bless "a no-op or a `console`-log both pass." The hook's purpose is persisting a *rotated* refresh token to an external store (e.g. a vault); a rejection there means the rotated token was **not** persisted — a silent failure that, after this refresh, leaves the caller holding a stale refresh token with no operator signal at all. Decision 3 requires the rejection be *isolated* from `callback`, not *erased*. An empty catch satisfies isolation but destroys observability of a real failure mode. | Make the canonical example **log** rather than no-op: `.catch(function (e) { if (this.debug) console.log(...); })` (or an unconditional `console.error` of a fixed message + the error), so the persistence failure is observable. The constructor already carries a `this.debug` flag that gates HTTP logging — reuse it for consistency. Keep the swallow semantics (no rethrow, no `await`) so Decision 3 isolation is unchanged; only add the log. State in the Step-2 notes that the empty-catch form is the *fallback*, not the recommended shape. |
| engineer-r1-f2 | Low | Open | ErrorHandling | plan.md Phase 3 test, lines 221-233 (`process.on('unhandledRejection', …)` in `beforeEach`/`afterEach`) | The `unhandledRejection` guard is registered for **all four** cases but only case 4 asserts `unhandled.length === 0`. In cases 1-3 a stray unhandled rejection (e.g. a future regression where the hook escapes its `.catch` on the *no-rotation* or *omitted* path) is silently collected and discarded — the guard gives those cases no protection despite the per-test setup cost. | Either (a) add `assert.strictEqual(unhandled.length, 0)` to the tail of cases 1-3 as well (cheap, and turns the shared guard into a real assertion for every case), or (b) move the guard's registration into case 4 only and drop it from `beforeEach`/`afterEach`. Prefer (a): the guard already runs everywhere, so asserting on it everywhere closes the gap for free and makes "no path leaks an unhandled rejection" a property of the whole suite. |
| engineer-r1-f3 | Low | Open | MagicValues | plan.md Phase 3 test helper `makeClient`, line 216 (`…, false, 75, '2.0', …`) vs `index.d.ts` type, line 202 (`minorversion?: string \| null`) | The test helper passes `minorversion` as the **number** `75`, but the re-applied `index.d.ts` types it as `string \| null` (upstream's signature) and upstream's runtime default is `minorversion \|\| 75`. The example is internally inconsistent with the types it ships in the same change-set: a copy-paste of `makeClient` into typed `fuze`-style code would not type-check. It works at runtime only because the number is truthy and never re-serialized in the offline path. | Pass `'75'` (string) in `makeClient` to match the declared `minorversion?: string \| null` type and upstream's own string default, so the example is consistent with the `.d.ts` shipped alongside it. Functionally equivalent for the test; removes a latent type mismatch. |
| engineer-r1-f4 | Low | Open | Documentation | plan.md Phase 2 Step 1, line 118 (add `@param refreshTokenCallBack` JSDoc) | The plan instructs adding a `@param refreshTokenCallBack` line to the constructor JSDoc, but upstream's constructor JSDoc (verified at `2.0.49`, lines 78-92) stops at `@param minorversion` — it documents **neither `oauthversion` nor `refreshToken`** (params 9 and 10). Adding only `@param refreshTokenCallBack` (param 11) produces a JSDoc that documents params 1-8 and 11 but skips 9-10 — a confusing gap that reads as an oversight to the next maintainer. | When adding the `refreshTokenCallBack` `@param`, also add the two missing `@param oauthversion` and `@param refreshToken` lines so the constructor JSDoc is contiguous through param 11. This is inside the constructor region already being edited (not an out-of-scope upstream tidy) and is the difference between "complete docs for the feature" and "docs with a visible hole." If the planner wants to hold the line on "touch nothing extra," explicitly note in the plan that the JSDoc is intentionally left non-contiguous so a reviewer does not flag it as incomplete. |
</content>
</invoke>
