## architect — round 2

Design Review Mode, round 2. Re-verified each of my six round-1 findings against the current
design text and against `index.js` source. All six were dispositioned `Fixed` by reviser-r3; I
confirmed each fix is genuinely present in the design and consistent with source — no fix was
claimed-but-absent, and the reviser correctly stripped the one false premise (the `minorversion`
`75` "divergence") from f3 while keeping its sound recommendation.

Source re-checks (all confirm the prior load-bearing claims):
- `index.js:103` — 11-param positional ctor (`...refreshToken, refreshTokenCallBack`) with the
  `_.isObject(consumerKey)` `eval`-prefix object form; `index.js:118` populates
  `this.refreshTokenCallBack` via the same prefix path. (f4)
- `index.js:115` — `this.minorversion = eval(prefix + 'minorversion') || 75`. (f3)
- `index.js:147` — `request.post(postBody, (async function ...).bind(this))`; the hook is
  `await`ed at `index.js:155` *inside* that async callback whose returned promise `request`
  discards; `this.token` set unconditionally, `this.refreshToken`/hook gated on rotation
  (`!==`) then truthiness. (f1, f2)
- `index.js:17` — `xmlParser = new (require('fast-xml-parser').XMLParser)()` module-load
  singleton, zero options. (f5)

Each fix verified in the current design:
- f1 — Decision 3 (l.195–197) now pins the mechanism (own attached `.catch`, never `await`ed
  into the resolving `.then`) and names the naive in-`.then` `await` as the specific wrong answer.
- f2 — Current State (l.80–84) reconciles "does NOT await" as the *observable* effect produced by
  `request` discarding the async callback's promise.
- f3 — Migration step 0 (l.250–256) requires the fork↔upstream `index.js` diff and explicit
  enumeration of any non-feature delta; the `75` default is confirmed identical, not a divergence.
- f4 — Decision 2 (l.168–174) states only the positional form is typed; object form left untyped
  by design, safe because `fuze` constructs positionally.
- f5 — Non-Goals (l.51–54) correctly describe the module-load singleton and its single call site.
- f6 — Success Criteria (l.309–316) and Verification (l.328–331) tie the rejecting-hook test to
  Decision 3's *structure* (rejection captured by the hook's own `.catch`, provably absent from
  `callback`'s arguments), not merely the symptom.

No new findings. The design is internally consistent, scope-contained against its Non-Goals, and
the one genuinely subtle point (axios re-applies the inverse of the incidental fire-and-forget
isolation) is now correctly pinned with a falsifiable test. Convergence reached from the architect
axis.

### Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|
| architect-r1-f1 | High | Closed | Architecture | Decision 3 (l.193–208); Migration step 2 (l.266–268) | Ratified. Decision 3 now states the concrete re-apply shape — hook invoked with its own attached `.catch()`, never `await`ed inside the axios `.then` that resolves `callback` — and explicitly names the naive in-`.then` `await` as the wrong answer, explaining the rejection cannot enter the `.then`/`.catch → callback` chain. Verified against `index.js:147,155`. | None — fix accepted. |
| architect-r1-f2 | Medium | Closed | Architecture | Current State (l.80–84) | Ratified. Current State reconciles the apparent contradiction: the fork *does* `await` the hook, but `request` discards the async callback's returned promise, so the caller observes fire-and-forget; the `fuze` quote is reframed as the observable effect, not the literal absence of `await`. | None — fix accepted. |
| architect-r1-f3 | Medium | Closed | Architecture | Migration step 0 (l.250–256) | Ratified. Precondition now requires diffing fork `index.js` against upstream `2.0.49` and enumerating any non-feature delta as an explicit reconciliation decision. The finding's `75` example was correctly retired — verified `minorversion || 75` is identical in both fork (`index.js:115`) and upstream — without dropping the (sound) diff-and-enumerate requirement. | None — fix accepted. |
| architect-r1-f4 | Medium | Closed | PublicAPI | Decision 2 (l.168–174) | Ratified. Decision 2 states only the positional constructor is typed (matching upstream's single positional signature), the object form remains untyped by design, and that is safe because `fuze` constructs positionally — closing the gap against the "object form stays the same" claim. | None — fix accepted. |
| architect-r1-f5 | Low | Closed | Architecture | Non-Goals (l.51–54) | Ratified. Call-site description corrected to the module-load singleton `xmlParser = new (require('fast-xml-parser').XMLParser)()` with zero options at `index.js:17`, reused as `xmlParser.parse(body)[rootTag]` — matches source. | None — fix accepted. |
| architect-r1-f6 | Low | Closed | Migration | Success Criteria (l.309–316); Verification (l.328–331) | Ratified. The rejecting-hook test is now tied to Decision 3's structure: assert the rejection is captured by the hook's own `.catch` and provably absent from `callback`'s arguments, so the test pins the mechanism and fails if an implementor routes the rejection through `callback` yet masks it. | None — fix accepted. |
