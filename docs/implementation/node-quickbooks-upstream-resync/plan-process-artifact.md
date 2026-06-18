# node-quickbooks Upstream Re-sync — Plan Process Artifact

_This cycle produced a four-phase implementation plan for resetting the `pncit/node-quickbooks` fork onto upstream's axios codebase, re-applying the one local `refreshTokenCallBack` feature, and bumping three dependencies to clear the issue-#3 security advisories — refined across two review rounds until every gate was mechanically falsifiable and the consumer contract was provably locked._

## Genesis

The `pncit/node-quickbooks` fork is consumed by the private `pncit/fuze` service through a `#master` git pin. It had gone stale on the deprecated, unmaintained `request@2.88.0` HTTP library, which drags in eight npm advisories (two critical) tracked as issue #3 — most flowing transitively through `request` (`form-data`, `tough-cookie`, `qs`, `uuid`), plus two direct ones (`underscore`, `fast-xml-parser`). These cannot be patched while `request` remains a dependency, so every `fuze` build inherits unresolvable Dependabot/`npm audit` findings.

The root cause is divergence, not difficulty: upstream `mcohen01/node-quickbooks` already replaced `request` with `axios` + `oauth-1.0a` + `form-data` and added bundled TypeScript types, but the fork's last sync (`2.0.46`) predates that migration. The fork's only genuine value over upstream is one feature — a `refreshTokenCallBack` refresh-token-persistence hook that `fuze` relies on, with a fragile, undocumented error-isolation contract. The approved design (`design.md`) chose to re-sync the fork onto upstream `2.0.49` and re-apply that single feature rather than migrate independently or retire the fork. This cycle turned that design into an executable, gated plan.

## Outcome

The living plan is `docs/implementation/node-quickbooks-upstream-resync/plan.md`. It is a four-phase, exit-gated sequence:

1. **Phase 1** — precondition-gated `git reset --hard` onto upstream `2.0.49` (mechanically asserting upstream's arity, hook absence, and dual-construction before resetting; the feature is temporarily absent after this phase).
2. **Phase 2** — re-apply `refreshTokenCallBack` in `index.js`: the 11th constructor param + field, and the rotation-/truthiness-gated hook on upstream's axios `.then`, isolated by its **own `.catch()`** and never `await`ed into the `.then` (Decision 3, the crux).
3. **Phase 3** — extend the inherited `index.d.ts` with the optional 11th param and add an offline, credential-free regression test (stubbing `axios.post`) covering fires-on-rotation, no-fire-when-unchanged, no-throw-when-omitted, and rejection-isolated-from-callback. Dependencies are first installed here.
4. **Phase 4** — bump `underscore` → `^1.13.8`, `fast-xml-parser` → `^5.9.2`, `uuid` → `^14.0.0`; regenerate the lockfile; and gate on a production-tree-clean `npm audit --omit=dev`.

Takeaway: the plan is faithful to the design's "upstream + one feature + three security bumps" posture, with every assertion converted to a falsifiable `git`/`grep`/`jq` gate and the `fuze` end-to-end check explicitly routed to Deferred Validation (no `fuze` checkout is available to the Implementor).

## Process at a glance

Two review rounds, three reviewers each round (a plan-auditor focused on repo-fact grounding and executability, an architect on the five plan axes, an engineer on code quality), with one reviser pass after each. Round 1 surfaced fifteen findings (five auditor, six architect, four engineer); the reviser fixed all of them. Round 2 was entirely ratification — every reviewer empirically reproduced the fixes (clean installs, an isolation-shape harness, grep-convention checks) and closed their findings with no new issues. The plan converged cleanly; no finding was escalated to a human ruling.

## Key findings

**The audit gate was not achievable as originally scoped (the most material finding).** The plan-auditor reproduced the exact post-reset + post-bump dependency tree and found that `uuid` is a *direct* upstream dependency (used at `index.js:2352` for the `Request-Id` header), not a `request` transitive — so the reset does **not** remove it, and `uuid@^8.3.2` retains a moderate advisory (`GHSA-w5hq-g745-h8pq`). The original plan (and the design's success-criteria table) mis-attributed `uuid` and `form-data` to "via request." Resolution: add a third bump, `uuid`, and re-verify the sole `uuid.v1()` call site survives the semver-major.

**The audit gate's verification was also unsound.** It used a substring grep over `npm audit --json`, which both false-positives (package names appear as dependency-path keys / `via` references of unrelated advisories) and gives no signal on clean modules (which don't appear at all). Replaced with a structural check: `npm audit --omit=dev --json` asserting `.metadata.vulnerabilities.total === 0`, plus a belt-and-suspenders check that none of the eight named modules appears under `.vulnerabilities | keys`. The `--omit=dev` scoping is deliberate — the `mocha@10.1.0` devDep tree carries six unrelated advisories that `fuze` never installs, so a bare `npm audit` is never clean.

**The "identical observable behavior" claim was overstated.** The architect found that the fork's pre-reset success/failure branching is HTTP-**body**-based (`invalid_grant` detection on `r.body`), whereas upstream's axios path is HTTP-**status**-based (`.then` vs `.catch`). The reset therefore intentionally changes the *failure*-path callback-arg shape. The plan now scopes "identical observable behavior" to the success/rotation/hook path only, forbids re-creating the body-based branch, and routes the end-to-end confirmation that `fuze` is indifferent to the failure-arg shape to Deferred Validation.

**The regression test did not prove Decision 3's structure.** Round 1's rejection-isolation case asserted only `callbackArgs[0] === null` inside a single `setImmediate` — proving nothing escaped, not that the hook's *own* `.catch` contained the rejection. The fix made a `process.on('unhandledRejection', …)` guard mandatory (asserting it never fires), added a `hookSettled === true` assertion, and sequenced final assertions off a `setTimeout(…, 20)` that outlasts both the microtask chain and the later `unhandledRejection` macrotask tick. Round 2 built a harness confirming the correct shape passes and the wrong `await`-in-`.then` shape fails the gate — proving it discriminating.

**No phase gate could run before its dependencies existed.** No `npm install` ran before Phase 4, yet Phase 3's `npx mocha` gate `require`s `axios` and `../index`. The plan now installs at the start of Phase 3 (the explicit dependency-availability point), with Phase 4 doing a clean lockfile regen after the bumps.

**Engineering-quality refinements.** The canonical hook `.catch` was changed from a bare empty no-op to a `this.debug`-gated log — an unobserved persistence failure means a rotated refresh token was silently not saved; the empty catch is demoted to an acceptable fallback (isolation semantics unchanged either way). The runtime hook-call arity is now pinned to the `.d.ts` single-`token` signature via an `argCount === 1` assertion. Grep gates were standardized to `grep -qF` (fixed-string) and `[ "$(grep -cF …)" = "0" ]` to avoid regex-metacharacter false matches and the zero-count `grep -c` non-zero-exit that breaks `&&` chains. The constructor JSDoc is made contiguous through param 11 (upstream documents neither `oauthversion` nor `refreshToken`), and the test helper's `minorversion` was corrected from the number `75` to the string `'75'` to match the shipped `.d.ts` type.

## Key decisions

- **Bump `uuid` rather than accept a residual advisory.** Faced with the surviving `uuid` advisory, the reviser chose to add a third bump (option a) over re-scoping the gate to tolerate it (option b), because the design's success criterion is "all eight cleared / clean audit" — accepting a residual would have contradicted the design and required human disposition. The bump is `^14.0.0`, caret-pinned to the *verified current major* (not an open-ended `>=11.1.1`), bounding the float to the one major whose `v1()` call site was actually tested, consistent with the `underscore`/`fast-xml-parser` caret pins.

- **The failure-path divergence is in scope, disclosed not re-created.** The reviser cross-checked the `fuze`-consumer-contract memory: `fuze` binds only to the success-path rotation hook and the rejection-isolation contract, not the failure-path error-arg shape. So the body-vs-status divergence falls under the design's Non-Goal of not altering error propagation, and is dispositioned as a disclosure/scope fix — the plan keeps upstream's failure path verbatim and does not re-create the fork's body-based `invalid_grant` branch. The architect explicitly conceded this finding once the disposition routed the end-to-end check to Deferred Validation.

- **Scope the audit gate to the production tree.** `npm audit --omit=dev` is the gate because `fuze` inherits only production deps via the git pin, and all eight named issue-#3 advisories live there. Cleaning the mocha devDep tree's own unrelated advisories is consciously out of scope for issue #3.

- **Keep the "no third feature region" check mechanical.** The original precondition relied on eyeballing the large request↔axios rewrite diff. It was replaced with two falsifiable fixed-string token gates (the `refreshTokenCallBack` token and the rotation-guard string, asserted fork-only and inside the two known regions), with the broad diff skim demoted to an explicitly advisory backstop.

- **Reset, don't merge.** Carried from the design and reaffirmed: "upstream wins everywhere except two regions," so a clean reset + small re-apply is correct; a merge would force manual conflict resolution across the entire rewrite. The trade-off (rewriting branch history) is accepted because the fork's value is its current `HEAD`, not its history.

## Known limitations

- **`fuze` integration is Deferred Validation, not a phase gate.** No `fuze` checkout is available to the Implementor, so updating `fuze`'s `#master` pin, running its type-check/build and token-refresh tests, and confirming its indifference to the changed failure-path callback-arg shape are all deferred. The fork-side Phase 3 regression test encodes the success/rotation/hook contract for unattended coverage; the failure-arg shape is upstream's and out of that test's scope.

- **Live QuickBooks sandbox smoke test is deferred.** `npm test` runs upstream's live `test/*.js` suites, which require real Intuit sandbox credentials and network access and cannot run unattended. Confirming the request→axios migration and the `fast-xml-parser@5.x` bump did not regress real API calls / XML parsing is deferred to a credentialed run.

- **`npm test` remains credential-gated (inherited, intentionally not "fixed").** The reset inherits upstream's `"test": "mocha"` with no `.mocharc`, so `npm test` is red offline. The de-facto unattended/CI gate for this work is the isolated `npx mocha test/refreshTokenCallBack.test.js`. Splitting `test`/`test:unit` (or adding a `.mocharc`) is a named, deferred follow-up — out of scope for the issue-#3 production-tree re-sync, but recorded so a future maintainer treats it as a deliberate choice rather than a silently broken script.

- **One cosmetic imprecision left unfixed.** A Repo-Context line describes mocha's default discovery as `./test/*.spec.js`-style, whereas the operative Phase 3 step correctly states `./test/*.{js,cjs,mjs}`. The plan-auditor judged this below the actionability bar (the gate uses explicit-file invocation regardless, so it has zero functional impact) and did not raise it as a finding.
