## reviser — round 3

Addressing the Open findings in `architect-r1.md` and `engineer-r1.md`. Verified every load-bearing
claim against the fork's `index.js` and against a fresh clone of upstream `mcohen01/node-quickbooks`.
Two source facts shaped these dispositions:

- Upstream's current released head is **`2.0.49`** (March 2026), not `2.0.50`. The design's stated merge
  target was a factual error; corrected throughout (Problem Statement, Current State, Migration).
- At `2.0.49`, upstream's `index.js` matches the fork on the non-feature lines architect-r1-f3 worried
  about — the `minorversion` default is `|| 75` in **both**, and upstream retains the `_.isObject` object-
  form construction. So f3's specific example (a `75` divergence) is not real, but its recommendation
  (diff and enumerate any deltas) is sound and was adopted without the false premise.

| ID | Disposition | Rationale (and, for Fixed, what changed) |
|----|-------------|-------------------------------------------|
| architect-r1-f1 | Fixed | Decision 3 now pins the mechanism: hook invoked with its own attached `.catch()`, **not** `await`ed inside the axios `.then` that resolves `callback`; explicitly names the naive `await`-in-`.then` as the wrong answer and explains the rejection cannot enter the `.then`/`.catch → callback` chain. Migration step 2 updated to reference this. |
| architect-r1-f2 | Fixed | Current State now reconciles the apparent contradiction: the fork *does* `await` the hook, but `request` discards the `async` callback's returned promise, so the caller observes fire-and-forget. The `fuze` quote is reframed as describing the *observable* effect, not the literal absence of `await`. |
| architect-r1-f3 | Fixed | Migration step 0 now requires diffing fork `index.js` against upstream `2.0.49` and enumerating any non-feature delta as an explicit reconciliation decision. Corrected the finding's example: verified against upstream that the `minorversion` default (`75`) and object-form construction are identical, so they are not deltas; the design states this rather than implying a `75` divergence. |
| architect-r1-f4 | Fixed | Decision 2 now states only the positional constructor is typed (matching upstream's single positional `.d.ts` signature, verified — no object overload), the object form remains untyped by design, and that is safe because `fuze` constructs positionally. |
| architect-r1-f5 | Fixed | Corrected the XML call-site description (Non-Goals) to the actual module-load singleton `xmlParser = new (require('fast-xml-parser').XMLParser)()` (zero options, `index.js:17`) reused as `xmlParser.parse(body)[rootTag]`. Verification already covers default parse output; the zero-arg-constructor concern is captured by the corrected description plus the live `npm test`. |
| architect-r1-f6 | Fixed | Success Criteria + Verification now tie the rejecting-hook test to Decision 3's structure: assert the rejection is captured by the hook's own `.catch` and is provably absent from `callback`'s arguments, so the test pins the mechanism, not just the symptom. |
| engineer-r1-f1 | Fixed | Decision 3 and Current State now state the truthiness guard explicitly (`if (this.refreshTokenCallBack)`, nested in the rotation branch); Success Criteria assert the 10-argument construction must not throw on rotation. |
| engineer-r1-f2 | Fixed | Same change as architect-r1-f1: Decision 3 names the concrete isolation mechanism (own-`.catch`, no `await` into the resolving `.then`). |
| engineer-r1-f3 | Fixed | Migration step 1 now chooses `git reset --hard` onto upstream `2.0.49` then re-apply as a fresh patch, with the rationale (clean reset beats merge given "upstream wins everywhere except two regions") and the accepted trade-off (rewrites fork history; the fork's value is its `HEAD`, not its history). |
| engineer-r1-f4 | Fixed | Decision 2 now reconciles the `.d.ts` return type with the runtime form: `void \| Promise<void>` is the broadest type compatible with Decision 3's invocation (hook isolated by its own `.catch`, not `await`ed into the resolving `.then`), so the type and runtime agree. |
| engineer-r1-f5 | Fixed | Current State and Decision 3 now state `this.token` is assigned **unconditionally** on success, while `this.refreshToken` and the hook are gated on rotation — verified against `index.js:151–157` and upstream's unconditional assignment. |
| engineer-r1-f6 | Fixed | Migration step 0 now requires confirming upstream still supports the object/positional dual construction, since the re-apply populates `this.refreshTokenCallBack` from both forms. (Verified present at `2.0.49`.) |
| engineer-r1-f7 | Fixed | Verification gate tightened from a bare `grep "request"` to asserting no `require('request')`/`require('request-debug')` and no `request.post(` / `request(` call sites, avoiding false positives from comments/identifiers/axios config keys. |
