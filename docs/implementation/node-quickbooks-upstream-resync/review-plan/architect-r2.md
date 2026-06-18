## architect — round 2

In-progress Plan Review. I re-read my round-1 turn, the reviser-r2 disposition, and the current
`plan.md` end to end, and re-verified the load-bearing facts directly against `upstream/master`
(`2.0.49`) and the fork `HEAD`:

- Upstream `package.json` is `"version": "2.0.49"`, `"uuid": "^8.3.2"` (direct, survives reset),
  `"mocha": "10.1.0"`, `"test": "mocha"` — confirmed.
- Fork `HEAD` `refreshAccessToken` classifies on the HTTP **body** (`index.js:149`:
  `if (r && r.body && !(r.body.error && r.body.error === "invalid_grant"))`), confirming the f1
  divergence the reviser dispositioned — upstream's axios path is status-based — confirmed.

All six round-1 findings (f1–f6) were dispositioned `Fixed`. I re-verified each edit is present and
adequate in the current plan:

- **f1 (ratified → Closed):** Assumptions bullet (plan.md:24) now scopes "identical observable
  behavior" to the success/rotation/hook path and states the failure-path classification
  intentionally becomes upstream's status-based `.catch` shape; Phase-2 Step-2 scope note
  (plan.md:133) forbids re-creating the body-based `invalid_grant` branch; the Deferred-Validation
  item (plan.md:420) calls out confirming `fuze`'s indifference to the changed failure-arg shape.
  The "identical observable behavior" claim is no longer overstated.
- **f2 (ratified → Closed):** Test case 1 now captures `arguments.length` and asserts
  `argCount === 1` (plan.md:269), with a matching Phase-3 Step-2 note — runtime arity is locked to
  the `.d.ts` single-`token` signature.
- **f3 (ratified → Closed):** The "no third feature region" check is now two mechanical fixed-string
  token gates (plan.md:71-74, 96-99) with the broad `git diff` skim demoted to an explicitly
  advisory backstop. Falsifiable as required.
- **f4 (ratified → Closed):** Assumptions bullet (plan.md:26) states `npm test` is credential-gated
  and names the isolated `npx mocha` invocation as the de-facto gate, with the `test`/`test:unit`
  split named as a deferred follow-up.
- **f5 (ratified → Closed):** `uuid` is now caret-pinned `^14.0.0` consistently across Summary goal,
  Phase-4 Step-1/2, example block, and exit gate (plan.md:36, 358, 360, 379, 410-411). Consistent
  with the other two caret pins.
- **f6 (ratified → Closed):** Phase-3 Step-0 (plan.md:197) now states the `fast-xml-parser@4.x`
  install is deliberate sequencing, not redundant churn.

The reviser's f1 disposition rests on the `fuze` memory claim that `fuze` binds only to the
success-path rotation hook and is indifferent to the failure-arg shape. The plan correctly does not
*assert* that as fact — it routes the end-to-end confirmation to Deferred Validation (plan.md:420)
and the success/rotation contract is locked by the fork-side Phase-3 test. That is the right
disposition; I concede f1.

No new findings. The round-2 edits are internally consistent: the `argCount === 1` arity assertion
(f2), the string `minorversion: '75'` in `makeClient` (engineer-r1-f3), the `this.debug`-gated
`.catch` logging (engineer-r1-f1), and the `^14.0.0` pin (f5) are mutually compatible and do not
introduce cross-cutting contradictions. I checked the one place an f2/engineer-r1-f1 interaction
could bite — the logging `.catch` body in case 1 does not run (case 1's hook resolves, not rejects),
so the `argCount`/`seen` assertions are unaffected by the logging change. The plan converges.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|
| architect-r1-f1 | Medium | Closed | PublicAPI | plan.md:24,133,420 | Conceded/ratified. The reset's adoption of upstream's HTTP-status-based failure classification (replacing the fork's body-based `invalid_grant` detection) is now explicitly disclosed in Assumptions, scope-noted in Phase-2 Step-2, and routed to Deferred Validation against `fuze`'s token-refresh tests. The "identical observable behavior" claim is correctly scoped to the success/rotation/hook path. | No further action. |
| architect-r1-f2 | Low | Closed | PublicAPI | plan.md:269 | Ratified. Test case 1 asserts `argCount === 1`, locking the runtime call site `this.refreshTokenCallBack(this.refreshToken)` to the `.d.ts` `(token: string) => …` single-arg signature. | No further action. |
| architect-r1-f3 | Low | Closed | Migration | plan.md:71-74,96-99 | Ratified. The "no third feature region" precondition is now two mechanical fixed-string token gates (the `refreshTokenCallBack` token and the rotation-guard string, asserted fork-only and inside the two known regions); the broad rewrite-diff skim is demoted to an explicit advisory backstop, not a gate. | No further action. |
| architect-r1-f4 | Low | Closed | Migration | plan.md:26 | Ratified. Assumptions now states `npm test` remains credential-gated (inherited, not introduced), names the isolated `npx mocha` invocation as the de-facto unattended/CI gate, and names the `test`/`test:unit` split as a deferred follow-up. | No further action. |
| architect-r1-f5 | Low | Closed | DataModel | plan.md:36,358,360,379,410 | Ratified. `uuid` is caret-pinned `^14.0.0` consistently everywhere, bounding the float to the one major whose `uuid.v1()` call site was verified, matching the `underscore`/`fast-xml-parser` caret posture. | No further action. |
| architect-r1-f6 | Low | Closed | Migration | plan.md:197 | Ratified. Phase-3 Step-0 now states the 4.x install/verify is deliberate sequencing (prove the feature loads before layering the bumps so a Phase-4 failure localizes to a bump), not redundant churn. | No further action. |
