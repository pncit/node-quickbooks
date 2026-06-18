# node-quickbooks Upstream Re-sync — Implementation Process Artifact

_This cycle re-synced the `pncit/node-quickbooks` fork onto upstream's axios-based codebase, re-applied
the one feature the fork owns (`refreshTokenCallBack`), and cleared the issue-#3 security advisories —
delivering a clean production audit while preserving the exact contract the `fuze` service binds to._

## Genesis

`pncit/node-quickbooks` is a fork of `mcohen01/node-quickbooks`, consumed by the private `fuze` service
through a git pin (`#master`). The fork had gone stale: it still depended on the deprecated, unmaintained
`request@2.88.0` library, dragging in the 8 npm advisories (2 critical) tracked in issue #3 — most of
them transitive through `request` (`form-data`, `tough-cookie`, `qs`, `uuid`). Those could not be patched
while `request` remained a dependency, so every `fuze` build inherited unresolvable findings.

The root cause was divergence, not difficulty. Upstream had already replaced `request` with
`axios` + `oauth-1.0a` + `form-data` and added bundled TypeScript types; the fork's last sync (`2.0.46`)
predated that migration, and its only local change since was a one-line `mocha` devDependency bump. The
fork was not disposable, though — it carries one genuine feature upstream lacks: a refresh-token
persistence hook (`refreshTokenCallBack`) that `fuze` depends on, including a fragile, undocumented
error-isolation property (a hook rejection must not propagate into the QuickBooks node-style callback).
The plan therefore was to reset onto upstream `2.0.49`, re-apply that one feature in both `index.js` and
the newly inherited `index.d.ts`, bump the residual vulnerable dependencies, and lock the feature with an
offline regression test so future re-syncs cannot silently break the consumer.

## Outcome

The implementation landed across four phases on `feat/node-quickbooks-upstream-resync` (tip `351771c`),
matching the plan with one substantive, reviewer-driven divergence (the `uuid` pin — see Key Decisions):

- **Phase 1** — hard reset onto upstream `2.0.49`: the production tree (`index.js`, `index.d.ts`,
  `package.json`, `package-lock.json`, `README.md`) is byte-for-byte upstream, `request`/`request-debug`
  removed, `"types": "index.d.ts"` inherited.
- **Phase 2** — `refreshTokenCallBack` re-applied in `index.js`: 11th constructor parameter + field via
  the existing `eval`-prefix dual-form idiom, and the `refreshAccessToken` success path with unconditional
  `this.token`, a rotation guard, a truthiness guard, and the hook invoked via its **own `.catch()`**
  (never `await`ed into the `.then`) — the design's Decision 3 isolation.
- **Phase 3** — `index.d.ts` constructor extended with the optional 11th param
  `refreshTokenCallBack?: (token: string) => void | Promise<void>` (+ matching instance field), and a new
  offline, credential-free regression test (`test/refreshTokenCallBack.test.js`, four cases) that pins the
  Decision-3 structure with a stubbed `axios.post` and an `unhandledRejection` guard.
- **Phase 4** — dependency bumps and clean lockfile regeneration: `underscore@^1.13.8`,
  `fast-xml-parser@^5.9.2`, `uuid@^11.1.1`; `npm audit --omit=dev` reports zero advisories in the
  production tree.

The final dependency pins are `fast-xml-parser ^5.9.2`, `underscore ^1.13.8`, `uuid ^11.1.1`. The living
documents are `plan.md` and `design.md` in this directory; the per-phase implementor notes are
`implementation-phase{1..4}-notes.md`. The `fuze`-side build/test verification and a live-sandbox smoke
test remain Deferred Validation (the `fuze` checkout was not available to the implementor).

## Process at a glance

Each phase ran a Step-A audit (implementation-auditor) plus a Step-B domain review (architect, engineer,
typescript-cop, project-lead), converging over multiple rounds:

- **Phase 1** — 3 rounds. The most eventful phase, but not because of the code (a verbatim reset has no
  fork-authored production code). The headline issue was a side effect of the destructive reset itself.
- **Phase 2** — 2 rounds. One Medium finding (a missing source comment), quickly fixed.
- **Phase 3** — 3 rounds. Several Low/Medium findings concentrated on the regression test's timing
  strategy and helper documentation; all fixed.
- **Phase 4** — 3 rounds. One High finding (the `uuid@14` module-format regression) drove a deviation
  from the plan's pin, plus follow-on documentation-consistency fixes.

Reviewers consistently scoped each phase tightly — distinguishing the genuine per-phase delta from the
large `git diff master` superset (which is dominated by the Phase 1 upstream reset) and from
upstream-verbatim code that the plan explicitly forbade tidying.

## Key findings

**The reset destroyed the project's own planning record (Phase 1, Critical).** The implementation-auditor
found that `git reset --hard upstream/master` deleted every tracked planning artifact from the working
tree — `plan.md`, `design.md`, the design/plan process artifacts, and all of `review-design/` and
`review-plan/` (22 files) — and orphaned the approved-plan commit `04c4d8c` from the branch lineage. The
plan's Assumptions had sanctioned rewriting the fork's *code* history but never anticipated that the
in-repo planning docs lived on the same branch being reset. The docs were restored and committed
(`b2aaba3`); the self-review's inflated "No deviations / 10/10" scoring was corrected to acknowledge the
side effect (`74357e1`); and a follow-on Low finding about a stale "all scores >= 9.5" assertion was
reconciled. A related gap — that the planning *commit graph* (not just file content) survived only via the
reflog — was raised independently by the architect and project lead and escalated for a human decision
(see Known Limitations).

**Missing isolation comment (Phase 2, Medium).** The engineer found that the implementation copied the
plan's `Promise.resolve(hook).catch(...)` shape but dropped the plan's four-line warning explaining *why*
the hook must not be `await`ed inside the `.then`. Since `await`-ing it is the "specific wrong answer" that
silently breaks `fuze`, and the obvious "tidy-up" a future maintainer would attempt, the load-bearing
invariant was undocumented at the one site where a future edit could regress it. A three-line comment was
added at the call site.

**Regression-test timing fragility (Phase 3, Medium + Lows).** The engineer flagged that case 4
(rejection-isolation) sequenced its assertions off a hard-coded `setTimeout(..., 20)` wall-clock sleep —
inherently flaky under load and inconsistent with the `setImmediate` the other three cases used. The fix
replaced the sleep with a deterministic `afterHookSettles` helper (chaining off the hook's own promise,
then one `setImmediate` for the `unhandledRejection` tick), converged all four cases on it, removed the
magic constant, and wrapped deferred assertions in `try/catch → done(e)` so failures attribute to the
owning test. The typescript-cop added a null-guard so a never-fired callback produces a named assertion
failure instead of a `TypeError`. Two subsequent rounds corrected JSDoc that misdescribed the helper's
microtask mechanics.

**`uuid@14` is ESM-only — a hidden consumer-contract regression (Phase 4, High).** The architect found
that the plan's chosen `uuid@^14.0.0` pin ships no CommonJS build (`"type": "module"`, ESM-only exports),
yet the codebase loads it via `require('uuid')`. This works only on Node with stable `require(esm)`
(≥20.19/≥22); on an older `fuze`/CI runtime, `require('node-quickbooks')` would throw `ERR_REQUIRE_ESM` at
load time. The phase had verified `uuid.v1()` only on the Node 24 build host, so the gate could not see
the regression. The fix down-pinned to `uuid@^11.1.1` — the last major shipping a real CJS `require`
conditional that still clears the advisory (fixed `>=11.1.1`) — preserving the CJS load contract `fuze`
binds to. This is the run's one deliberate divergence from the approved plan (see Key Decisions). A
related Medium (no `engines` floor) was closed as moot once the down-pin removed the ESM-only premise, and
the engineer caught stale `uuid@14.0.0` references left in the phase notes, which were reconciled to
`11.1.1`.

**Metadata pointed at upstream (Phase 4, Low).** The project lead found `repository.url`, `bugs.url`, and
`homepage` in `package.json` still pointing at `mcohen01/node-quickbooks` (inherited from the reset);
corrected to the `pncit` fork.

## Key decisions

**Down-pin `uuid` from the plan's `^14.0.0` to `^11.1.1`.** This is the most consequential decision of the
run. The approved plan had carefully argued `^14.0.0` as "a caret on the verified current major" and
confirmed `uuid.v1()` resolves under 14 — but that verification ran only on the Node 24 build host and did
not test the CommonJS module-resolution path on the consumer's runtime. The architect's finding showed the
plan's reasoning had a real gap: `uuid@14` is ESM-only, so a working `require` becomes a load-time throw on
any older Node. `^11.1.1` clears the same advisory (`GHSA-w5hq-g745-h8pq`, fixed `>=11.1.1`) while keeping
a dual CJS/ESM build with a `require` conditional, satisfying the design's hard "zero changes to `fuze`"
and CJS-`require` constraints. The down-pin was accepted and re-ratified against the live installed package
across two further rounds. Contrast `fast-xml-parser@5`, which ships a genuine `require` export and is
CJS-safe — so this risk was `uuid`-specific, and the other two bumps were accepted as planned.

**Planning-doc orphaning resolved by tags, fork code-history left orphaned by design.** The escalated
commit-graph question was ruled by a human: lightweight tags `plan-approved → 04c4d8c` and
`design-approved → e9b1aee` were created so the approval commits survive `git gc` and fresh clones
independent of the reflog (both verified present on the branch). The decision that the fork's *pre-plan
code* lineage remains intentionally orphaned (per the plan's Assumptions, which sanctioned rewriting the
fork's code history) was recorded explicitly rather than left as an undecided deferral.

**Failure-path callback shape is upstream's, not the fork's — accepted, not "fixed."** The reset
intentionally replaces the pre-reset fork's body-based `invalid_grant` classification with upstream's
status-based `.catch` shape (`callback(err, err.response, ...)`). The typescript-cop's Phase 1 findings
about the resulting type/runtime mismatch on the error path (f2) were rejected as out of scope: the plan's
Assumptions explicitly adopt upstream's classification and the design's Non-Goal forbids "improving"
error propagation, which would require a coordinated `fuze` change. The re-applied feature preserves only
the success/rotation/hook contract `fuze` actually observes; the failure-arg indifference is a
Deferred-Validation check.

**Phase 1 type-safety findings deferred to "when the `.d.ts` is edited" — and then not re-pursued.** The
typescript-cop raised four findings in Phase 1 about pervasive `any` at public boundaries
(`QuickBooksCallback.res`, `refreshAccessToken` error arg, `upload`'s `stream`, `createTaxService`'s
`taxService`). All four were rejected for Phase 1 on the "upstream verbatim, no `.d.ts` edits" scope lock,
with the reviewer's own recommendation pointing to Phase 3. When Phase 3 arrived, the typescript-cop
scoped its review strictly to the two added feature lines, treating the rest of `index.d.ts` as upstream
verbatim, and did not re-raise them. The net effect: these are accepted as inherited upstream type debt,
not addressed by this work (see Known Limitations).

**Mocha devDep advisories and the credential-gated `npm test` accepted as out of scope.** The reset
reverted the fork's `mocha` bump to upstream's `10.1.0`, whose transitive tree carries its own unrelated
advisories. The audit gate was deliberately scoped to the production tree (`--omit=dev`) — the tree `fuze`
inherits via the git pin — and reviewers consistently declined to raise the dev-tree advisories or the
credential-gated `npm test` as findings, consistent with the plan's "issue-#3 is about production
exposure" framing.

## Known limitations

- **Inherited `index.d.ts` type holes are not addressed.** The four typescript-cop boundary findings
  (`any` on `QuickBooksCallback.res`, the `refreshAccessToken` error-path arg, `upload`'s `stream` param,
  and `createTaxService`'s `taxService` param) were deferred in Phase 1 and never re-pursued in Phase 3.
  They remain as upstream-inherited type debt; a future maintainer narrowing these would do so outside the
  "thin patch layer" scope of this work.
- **`fuze`-side and live-sandbox validation deferred.** The `fuze` build/type-check, its QuickBooks
  token-refresh tests (including end-to-end indifference to the changed failure-path callback-arg shape),
  and a live QuickBooks sandbox smoke test of the axios migration / `fast-xml-parser@5.x` bump are all
  Deferred Validation — the `fuze` checkout and Intuit sandbox credentials were unavailable in the
  implementation environment. The fork-side regression test fully encodes the success/rotation/hook
  contract for unattended coverage.
- **Fork pre-plan code history is intentionally orphaned.** Recoverable only via reflog (90-day default)
  or loose objects until GC; the approved plan/design commits are preserved via the `plan-approved` /
  `design-approved` tags, but the fork's earlier code lineage was a deliberate, human-ruled casualty of
  the reset.
- **Splitting `test` / `test:unit` deferred.** `npm test` remains credential-gated (inherited upstream
  property); the de-facto unattended gate is the isolated `npx mocha test/refreshTokenCallBack.test.js`.
  A `.mocharc`/script split was a named, out-of-scope follow-up.
