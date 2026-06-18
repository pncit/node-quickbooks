# node-quickbooks Upstream Re-sync — Design Process Artifact

_This cycle produced a design for re-syncing the stale `pncit/node-quickbooks` fork onto upstream's
axios-based codebase to clear eight npm advisories (issue #3), while re-applying the one local
feature (`refreshTokenCallBack`) the consumer `pncit/fuze` depends on._

## Genesis

`pncit/node-quickbooks` is a fork of `mcohen01/node-quickbooks`, consumed by the private `pncit/fuze`
service via a `#master` git pin. The fork had gone stale and carried the exposure tracked in issue #3:
eight npm advisories (two critical), most flowing transitively through the deprecated `request@2.88.0`
library and its dependents (`form-data`, `tough-cookie`, `qs`, `uuid`). These could not be patched
while `request` remained a dependency, so every `fuze` build inherited unresolvable findings.

The root cause was divergence, not difficulty. Upstream had already replaced `request` with
`axios` + `oauth-1.0a` + `form-data` and added bundled TypeScript types — but the fork's most recent
upstream sync (`2.0.46`) predated that migration, and the fork's only post-merge change was a `mocha`
devDependency bump. The fork therefore sat one trivial commit ahead of an upstream that had already
fixed the expensive part, while missing the fix. The fork was not disposable, however: it carries a
refresh-token persistence hook (`refreshTokenCallBack`) that `fuze` relies on, including a fragile,
undocumented error-isolation contract. The design's job was to inherit upstream's fix without
silently dropping that feature or breaking `fuze`.

## Outcome

The design (`design.md`) commits to making the fork a **thin patch layer over current upstream**:
`git reset --hard` onto upstream `2.0.49` (the released axios head), then re-apply
`refreshTokenCallBack` in three surfaces — `index.js` runtime, the newly-inherited `index.d.ts`
types, and a new regression test — followed by two dependency bumps upstream had not yet made
(`underscore@^1.13.8`, `fast-xml-parser@^5.9.2`) and a regenerated lockfile. The fork's identity
becomes "upstream + one feature + two security bumps," requiring zero changes in `fuze`.

The load-bearing decisions are: re-sync rather than fork-further-or-retire (Decision 1); ship and
extend `index.d.ts` with an 11th optional positional parameter (Decision 2); preserve the callback's
exact invocation and error-isolation semantics on axios (Decision 3); and clear the two residual
advisories with version bumps (Decision 4). All open questions are resolved in the document.

## Process at a glance

Two review tracks ran over the design. A correctness/security track (the **design-auditor**) ran
three rounds; an **architect** and an **engineer** each ran two rounds reviewing architecture and
implementability. The reviser responded in three rounds. The auditor opened five round-1 findings (one
Critical) plus one round-2 follow-on; the architect and engineer together opened thirteen round-1
findings (three High). All were dispositioned `Fixed` and subsequently ratified `Closed`; no finding
was rejected and no escalation to a human ruling occurred. Several reviewer claims were checked
against the live `npm audit` database, the fork's `index.js`, and a fresh clone of upstream.

## Key findings

**The primary security claim was wrong and would have failed the design's only goal.** The original
design asserted that bumping `fast-xml-parser` to `^4.5.6` cleared its advisory and kept the fork on
the 4.x line as a Non-Goal. The auditor's Critical finding showed the live advisory covers the entire
`<=5.6.0` range — no 4.x version clears it; `5.9.2` (a semver-major) is the first fixed release. The
reviser confirmed this directly, verified `5.9.2` ships a dual CommonJS/ESM build and produces
identical default parse output for the fork's single zero-option call site, and rewrote Decision 4 to
bump to `^5.9.2` as version-only churn. The "stay on 4.x" Non-Goal was replaced with a "do not rewrite
the XML code" Non-Goal, and Current State, Risks, and Success Criteria were realigned.

**The error-isolation contract was named but its mechanism was unspecified — the central
implementability risk.** Both the architect (f1) and engineer (f2) independently raised that the
design asserted the outcome ("hook rejection must not reach the node-style callback") without the
mechanism that produces it. The subtlety: today the hook *is* `await`ed, but inside an `async`
callback whose returned promise `request` discards, so a rejection becomes an unhandled rejection and
never reaches `callback`. On axios the equivalent `await`-inside-`.then` does the **opposite** —
routing the rejection straight into `.catch → callback(err)`. A naive port would silently invert the
contract. Decision 3 was rewritten to pin the concrete shape: invoke the hook with its own attached
`.catch()`, never `await`ed into the resolving `.then`, and call the naive in-`.then` `await` out as
the specific wrong answer.

**Three behavioral details of the existing code were missing from the re-apply spec.** The engineer
surfaced that the design omitted (a) the truthiness guard `if (this.refreshTokenCallBack)`, whose
absence would make the 10-argument construction throw on rotation; (b) that `this.token` is assigned
**unconditionally** on success while only `this.refreshToken` and the hook are gated on rotation; and
(c) that step 0 must confirm upstream still supports the object/positional dual construction, since
the field is populated from both forms. Each was added to Decision 3, Current State, and Migration
step 0. The architect separately noted the apparent contradiction between `fuze`'s "does NOT await
this callback" comment and the source that does `await`; Current State now reframes the comment as
describing the *observable* effect, not the literal absence of `await`.

**Verification gates were unfalsifiable as written.** The auditor (f4) showed the audit-cleanliness
criterion was prose against a bare `npm audit` with no enumerated advisory list; Success Criteria now
tabulate all eight issue-#3 advisories with source, what clears each, and expected end state, and
Verification asserts each named advisory is absent. The auditor (r2-f1) and architect (f6) further
showed the rejecting-hook test could pass on a weak "no throw" check; the test spec was tightened to
pin Decision 3's *structure* — assert the rejection is captured by the hook's own `.catch` and is
provably absent from `callback`'s arguments. The engineer (f7) replaced a false-positive-prone
`grep "request"` gate with checks for `require('request')` / `request.post(` / `request(` call sites.

## Key decisions

- **Re-sync (reset) over merge, fork-further, or retire.** Re-syncing inherits upstream's costly
  `request`→axios migration, types, and future maintenance for near-zero cost. `git reset --hard`
  onto upstream `2.0.49` followed by a fresh re-apply was chosen over `git merge` (engineer f3):
  "upstream wins everywhere except two regions," so a clean reset avoids manual conflict resolution
  across the entire axios rewrite. The accepted trade-off is that reset rewrites the fork's branch
  history — acceptable because the fork's value is its `HEAD` state, not its history.

- **Ship and extend the types rather than strip them.** The fork ships no `index.d.ts` today, so
  `fuze` consumes it untyped; re-sync introduces upstream's types into `fuze`'s strict build for the
  first time, where an 11-argument call against a 10-parameter signature is a hard compile error.
  Decision 2 adds the 11th optional positional parameter (`void | Promise<void>`). Only the
  **positional** form is typed (architect f4) — matching upstream's single signature and `fuze`'s
  usage; the object form is left untyped by design, safe because `fuze` constructs positionally. The
  return type was reconciled with the runtime form (engineer f4): `void | Promise<void>` is the
  broadest type compatible with Decision 3's non-awaited, own-`.catch` invocation, so the two surfaces
  agree.

- **`fast-xml-parser` major bump accepted as non-breaking for this codebase.** The 5.x major is
  required to clear the advisory and was accepted over both staying on 4.x (leaves a critical advisory,
  defeating the goal) and rewriting the XML code (avoidable churn). The fork's sole usage is a
  module-load singleton with default options, which 5.9.2 preserves.

- **The merge target was corrected to `2.0.49`.** The design initially named `2.0.50`; the reviser's
  fresh upstream clone showed `2.0.49` is the released head (no `2.0.50`), corrected throughout.
  Relatedly, the architect's f3 example of a `minorversion` default `75` divergence proved false —
  upstream and fork are identical (`|| 75`) — so the false premise was dropped, but the sound
  recommendation (diff `index.js` and enumerate any non-feature delta) was kept as Migration step 0.

- **The divergence narrative was corrected to match git history.** The feature commits predate the
  `2.0.46` merge that carried them across; the mocha bump is the only post-merge change. The net delta
  was always right, but the original ordering ("feature added since the sync") could have mis-planned
  the merge base.

## Known limitations

- **Upstream and `fuze` claims are verified at planning time, not in the design checkout.** The two
  pillars the migration rests on — upstream's axios/hookless `refreshAccessToken` and 10-param
  `index.d.ts`, and `fuze`'s 11-arg positional construction — were unverifiable from the fork checkout
  (no upstream remote configured during early review; `fuze` is a separate private repo). Per the
  auditor's f3, this residual unverifiability is pushed to Migration **step 0** as a hard precondition
  with an explicit stop-and-re-baseline instruction if upstream's shape differs.

- **Consciously deferred (Non-Goals / Future Considerations):** contributing `refreshTokenCallBack`
  upstream (would eventually allow retiring the fork; depends on an external maintainer's timeline);
  improving callback error propagation to surface hook failures through the main callback (a
  behavioral change requiring a coordinated `fuze` update); and dropping `underscore` entirely (the
  `1.13.8` bump resolves its advisory without rewriting ~44 call sites). The current error-isolation
  contract is preserved rather than improved, by design.
