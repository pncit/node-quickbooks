## engineer — round 1

Design Review Mode. Reviewed against the five axes (maintainability, abstraction
complexity, error/observability strategy, developer experience, success-criteria
concreteness), with the restraint posture: I anchored to the stated Goals/Non-Goals as a
hard scope boundary and weighted findings toward tightening/clarifying over expanding.

I verified the design's factual claims about the current fork code against `index.js`:
the 11-parameter constructor with `refreshTokenCallBack` 11th (line 103), the `eval`-prefix
object/positional dual construction (lines 104–118), the `this.refreshTokenCallBack` field
(line 118), the rotation-gated invocation (lines 152–157), and the surviving
`request.post(...)` (line 147) are all described accurately. The design is well-scoped,
decisive, and its Non-Goals are crisp. Most findings below are clarifications that make the
re-apply unambiguous for the implementor, not expansions.

Two substantive gaps are worth the implementor's attention before this is plannable:

1. The design's prose on Decision 3 / Success Criteria describes the *desired* post-state of
   the callback but never states the **truthiness guard** (`if (this.refreshTokenCallBack)`)
   that exists in the current code (line 154). Since upstream's axios `refreshAccessToken`
   has no hook at all, the re-apply is greenfield against that method, and an implementor
   working only from the design could omit the guard — making every non-rotation-callback
   construction (the 10-arg form, or `refreshTokenCallBack` omitted) throw on rotation. This
   is the kind of "identical observable behavior" detail the design otherwise insists on, so
   its omission is a real gap (engineer-r1-f1).

2. The design never specifies *how* "do not route hook rejection into the node-style
   callback" is to be achieved on the axios `.then(...).catch(...) → callback(err)` shape it
   describes (line 166). It asserts the outcome but leaves the mechanism (e.g. not awaiting
   inside the `.then`, or isolating the hook call with its own `.catch`) entirely to the
   implementor. Given the design explicitly calls the naive `await ... inside .then()`
   approach a trap, naming the intended isolation mechanism is what makes Decision 3
   actionable rather than aspirational (engineer-r1-f2).

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|
| engineer-r1-f1 | High | Open | ErrorHandling | design.md §Decision 3 (157–169); §Migration step 2 (216–217); Success Criteria (254–260) | The design never restates the existing truthiness guard `if (this.refreshTokenCallBack)` (current `index.js:154`). Because upstream's `refreshAccessToken` has no hook, the re-apply is written from scratch against axios; an implementor following only the design could invoke the hook unconditionally, throwing for every construction that omits the callback (the 10-arg form) on token rotation. This silently breaks the "identical observable behavior" goal. | Add an explicit statement to Decision 3 (and/or Migration step 2) that the hook is invoked only when `this.refreshTokenCallBack` is truthy AND the refresh token rotated — both gates preserved from current behavior. |
| engineer-r1-f2 | High | Open | ErrorHandling | design.md §Decision 3 rationale (164–169) | Decision 3 states the *outcome* (hook rejection must not reach the node-style `callback`) and explicitly names the naive `await ... inside .then()` as the wrong approach, but never states the intended *mechanism* for isolation. The implementor is left to invent it, which is exactly where the contract was identified as fragile. | Name the intended mechanism concretely: e.g. "invoke the hook with its own attached `.catch()` (swallow/log) so its rejection cannot enter the chain whose `.catch` routes to `callback(err)`" — or whatever isolation form is intended. Make the how, not just the what, part of the decision. |
| engineer-r1-f3 | Medium | Open | Documentation | design.md §Migration step 1 (212–215); §Decision 1 (128–129) | Step 1 says "merge/reset onto it … merge/reset" without choosing. Merge vs. reset are materially different operations here: a merge preserves fork history but forces manual conflict reconciliation in `index.js`/`package.json`; a reset-onto-upstream-then-reapply is cleaner given the stated "two known regions" but rewrites the branch. The ambiguity leaves the central mechanical step undecided. | Pick one. Given the design's framing ("upstream wins everywhere except two regions"), state whether the intended approach is `git merge 2.0.50` with manual conflict resolution or `git reset --hard 2.0.50` followed by re-applying the feature as a fresh patch, and why. |
| engineer-r1-f4 | Medium | Open | MagicValues | design.md §Decision 2 (144–145) vs current `index.js:118` | The proposed `.d.ts` type is `(token: string) => void \| Promise<void>`, but the current runtime `await this.refreshTokenCallBack(...)` and `fuze`'s shim (per the design, stores a promise and attaches `.catch`) imply the consumer returns a Promise. Typing the success path as possibly-`void` is fine, but the design does not reconcile that the re-applied runtime will `await` a possibly-`void` return — and per f2 the isolation mechanism may change whether it awaits at all. The type and the runtime invocation form must be decided together. | State the final runtime invocation form (awaited vs. fire-and-forget-with-`.catch`) and confirm the `.d.ts` return type matches it. If the hook is no longer awaited (per f2), `void \| Promise<void>` is correct; if still awaited, document that the rejection isolation is handled separately. |
| engineer-r1-f5 | Medium | Open | Documentation | design.md §Current State (70–72) vs current `index.js:151` | The design states the callback fires "only when the refresh token actually rotates," but omits that the current code assigns `this.token = refreshResponse.access_token` *unconditionally* before the rotation check (`index.js:151`), while `this.refreshToken` is assigned only inside the rotation branch (line 153). The re-apply must preserve this ordering (token always updated; refreshToken + hook only on rotation). The design's summary could lead an implementor to gate both assignments on rotation. | Clarify in Current State / Decision 3 that `this.token` is always updated on success, and only `this.refreshToken` and the hook are gated on rotation. |
| engineer-r1-f6 | Low | Open | Documentation | design.md §Migration step 0 (205–211) | Precondition step 0 verifies upstream's constructor is "10 positional parameters ending at `refreshToken`," but does not state what to verify about upstream's *object-form* construction (the `eval`-prefix trick at current `index.js:104`). The re-apply must populate `this.refreshTokenCallBack` from both the positional and object forms (current line 118); if upstream changed or removed the object-form construction, the re-apply's object-path assignment is undefined. | Add to step 0: confirm upstream still supports the object/positional dual construction (the `_.isObject(consumerKey)` prefix), since Decision-noted "object form" population depends on it. |
| engineer-r1-f7 | Low | Open | Documentation | design.md §Verification (269) | The verification `grep -n "request" index.js` "returns no runtime request calls" is imprecise: upstream may legitimately retain the *word* "request" in comments, variable names, or axios config keys. A literal grep will produce false positives and is not a clean pass/fail gate. | Tighten the gate to the falsifiable intent: assert no `require('request')`/`require('request-debug')` and no `request.post(`/`request(` call sites remain, rather than any occurrence of the substring "request". |
