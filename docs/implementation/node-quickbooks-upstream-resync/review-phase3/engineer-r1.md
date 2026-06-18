## engineer — round 1

Scope: Phase 3 changes only. Per the plan/notes the in-scope edits are (a) the two
`refreshTokenCallBack` lines in `index.d.ts` (constructor param + instance field) and (b) the new
`test/refreshTokenCallBack.test.js`. The rest of `index.d.ts` (1406 lines) and `index.js` are
inherited-upstream / Phase-2 material respectively and are out of scope for this phase; I confine
maintainability findings to the Phase-3 surface. No prior `engineer` turn exists in this review
dir (the only prior file is `implementation-auditor-r1.md`, a different agent), so all findings are
new.

The two `index.d.ts` additions are correct and minimal: param order matches the runtime constructor
(`index.js:97`), the hook type `(token: string) => void | Promise<void>` matches the single-arg
runtime call site (`index.js:148`) and the test's arity lock, and the instance field mirrors the
param. `"types": "index.d.ts"` is wired in `package.json`. No DRY, dead-code, or naming problems in
the declarations.

The test is well-structured and genuinely offline. My findings target test robustness and
consistency, where the timing strategy is the weakest point.

### Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|--------------------------|
| engineer-r1-f1 | Medium | Open | Complexity & Readability / test robustness | `test/refreshTokenCallBack.test.js:125-135` | Case 4 ("rejection-isolated") sequences its assertions off a hard-coded `setTimeout(..., 20)`. A wall-clock delay to "outlast the microtask chain" is inherently timing-dependent: on a loaded CI box the hook's `.catch` could still settle within 20 ms most of the time but is not *guaranteed* to, and `unhandledRejection` delivery timing is environment-dependent — making this the one case that can flake. The comment itself admits "a single `setImmediate` can run before the hook's `.catch` resolves," i.e. the author knows ordering is being approximated by a sleep rather than awaited. | Replace the wall-clock sleep with a deterministic settle. Have the test's hook expose a promise it can await (e.g. the hook stores its own settled promise on a closure variable, and the test does `hookPromise.catch(() => {}).then(() => setImmediate(checkAssertions))`), or drain microtasks with a couple of chained `await Promise.resolve()` / `queueMicrotask` before scheduling one `setImmediate` for the `unhandledRejection` tick. Eliminate the magic `20`. |
| engineer-r1-f2 | Low | Open | Magic Numbers & Config | `test/refreshTokenCallBack.test.js:135` | The `20` (ms) in case 4 is an unexplained magic timing constant — its value is arbitrary (why not 5 or 50?) and load-sensitive. If f1's deterministic-settle fix is adopted the constant disappears; if any timer is retained it should be a named constant with a comment justifying the chosen value. | Folds into f1's fix (preferred — remove it). If a timer must remain, hoist to `var HOOK_SETTLE_MS = 20;` with a one-line rationale. |
| engineer-r1-f3 | Low | Open | Complexity & Readability / consistency | `test/refreshTokenCallBack.test.js:66, 81, 96, 125` | The four cases use two different sequencing primitives for the same purpose (waiting out the hook's async chain): cases 1–3 use `setImmediate`, case 4 uses `setTimeout(…, 20)`. Same intent, two mechanisms, no stated reason for the divergence — a reader must reverse-engineer why case 4 is special. The inconsistency also signals that `setImmediate` was found insufficient for the rejection path, which undercuts confidence in cases 1–3 using it. | After fixing f1, converge all four cases on one settle helper (e.g. a single `afterHookSettles(fn)` used everywhere) so the suite reads uniformly and the "why is case 4 different" question disappears. |
| engineer-r1-f4 | Low | Open | Error Handling / test robustness | `test/refreshTokenCallBack.test.js:66-71, 81-86, 96-99, 125-135` | Assertions run inside `setImmediate`/`setTimeout` callbacks. A failing `assert` there throws *outside* mocha's `it` try/catch and surfaces as a process-level `uncaughtException`, not a clean per-test failure attributed to the case — and because the suite installs a `process.on('unhandledRejection', …)` listener, a thrown assertion can interact badly with diagnosis (mocha may report a vague uncaught error rather than the specific assertion). This makes a regression in any case harder to triage than necessary. | Wrap the deferred assertion body in `try { … ; done(); } catch (e) { done(e); }` so failures are reported against the owning test. This is the standard mocha pattern for assertions inside async callbacks and is independent of the f1 timing fix. |

No findings on the `index.d.ts` additions, on dead code, on naming, or on documentation — those
are clean. f1 is the substantive one; f2–f4 are quality/robustness improvements on the new test
file.
