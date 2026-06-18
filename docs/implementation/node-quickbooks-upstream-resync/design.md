# node-quickbooks Upstream Re-sync Design

## Problem Statement

`pncit/node-quickbooks` is a fork of `mcohen01/node-quickbooks`, consumed by the private
`pncit/fuze` service through a git pin (`git+https://github.com/pncit/node-quickbooks#master`).
The fork has gone stale and now carries the security exposure tracked in issue #3: **8 npm
advisories, 2 critical**, the bulk of them flowing transitively through the deprecated, unmaintained
`request@2.88.0` library (`form-data`, `tough-cookie`, `qs`, `uuid`). These cannot be patched while
`request` remains a dependency, so every `fuze` build inherits unresolvable Dependabot/`npm audit`
findings.

The root cause is divergence, not difficulty. Upstream is actively maintained (commits through March
2026, currently `2.0.49`) and **already replaced `request` with `axios` + `oauth-1.0a` + `form-data`**
(merged February 2026), plus added bundled TypeScript types. The fork's most recent upstream sync is
the `2.0.46` merge — **before** that migration — and the fork's only local change past that merge is a
`mocha` devDependency bump. So the fork sits one trivial commit ahead of an upstream that already fixed
the expensive part, while missing that fix.

The fork is not, however, disposable: it carries one genuine feature upstream lacks — a refresh-token
persistence hook (`refreshTokenCallBack`) that `fuze` depends on. The cost of inaction is a service
permanently flagged with critical advisories; the cost of a naive "just use upstream" swap is silently
dropping the feature and breaking `fuze`'s build and its token-refresh error handling.

## Vision

`pncit/node-quickbooks` becomes a **thin patch layer over current upstream**: upstream's axios-based
codebase verbatim, plus the `refreshTokenCallBack` feature re-applied in both `index.js` and the
bundled `index.d.ts`, plus two dependency bumps upstream itself has not yet made. A fresh `npm audit`
on the fork is clean, `fuze` compiles and behaves exactly as before, and the next upstream re-sync is
a small, well-understood operation rather than an archaeology project.

### Goals

- Eliminate the issue-#3 advisories: remove `request`/`request-debug` by adopting upstream's axios
  migration, and bump the two dependencies upstream left vulnerable.
- Preserve the `refreshTokenCallBack` feature with **identical observable behavior**, including the
  error-isolation contract `fuze` relies on.
- Keep `fuze`'s strict TypeScript build green after the fork starts shipping `index.d.ts`.
- Require **zero changes in `fuze`**; its existing `#master` git pin picks up the result.
- Add an automated regression test in the fork that locks down the feature and its error contract so
  future re-syncs cannot silently break the consumer.

### Non-Goals

- **Retiring the fork or contributing `refreshTokenCallBack` upstream.** The fork remains the
  consumed artifact; an upstream PR is deferred (see Future Considerations).
- **Changing `fuze`.** No edits to `fuze`'s construction, its callback shim, or its refresh
  coordinator. This includes *improving* callback error propagation — that would require a coordinated
  `fuze` change and is explicitly out of scope.
- **Rewriting the XML-handling code.** The fork's `fast-xml-parser` usage is a single module-load
  singleton — `xmlParser = new (require('fast-xml-parser').XMLParser)()` with zero options
  (`index.js:17`) — reused at one call site as `xmlParser.parse(body)[rootTag]`. The parser is bumped to
  a clean major but neither the instantiation nor the call site is touched.
- **Refactoring or modernizing fork code beyond the feature re-apply.** Everything except the
  constructor and `refreshAccessToken` is taken from upstream unchanged.
- **Migrating `fuze` off the git pin to an npm release.** Out of scope while the fork is maintained.

## Current State

**The fork's divergence is one feature, isolated to two regions of `index.js`.** The
`refreshTokenCallBack` feature was committed on the fork before its most recent upstream sync and was
carried across that `2.0.46` merge intact; the only local commit after the merge is the `mocha`
devDependency bump. So relative to current upstream the fork's net production delta is exactly this one
feature, still present at `HEAD`:

- **Constructor** (`index.js:103,118`) — an 11th parameter `refreshTokenCallBack`, stored as
  `this.refreshTokenCallBack`. Because construction also supports an object form (an `eval`-based
  prefix trick), the field is populated either positionally or from a config object.
- **`refreshAccessToken`** (`index.js:147–162`) — on success, `this.token` is assigned
  **unconditionally**, and then **only when the refresh token actually rotates**
  (`this.refreshToken !== refreshResponse.refresh_token`) are `this.refreshToken` reassigned and the
  hook invoked. The hook invocation is doubly gated: `if (this.refreshTokenCallBack)` (truthiness) is
  nested inside the rotation check, and the call is `await this.refreshTokenCallBack(this.refreshToken)`.
  This lets the caller persist a rotated refresh token outside the object (e.g. a key vault).

  The hook is `await`ed, yet the caller observes it as **fire-and-forget**, and that observable
  property — not the literal `await` — is what `fuze` depends on. The reason is the host: the `await`
  sits inside an `async` function passed as `request.post`'s node-style callback, and `request`
  **discards that function's returned promise**. A hook rejection therefore becomes an *unhandled
  rejection* and never reaches the QuickBooks node-style `callback`. (This is why `fuze`'s comment says
  the package "does NOT await this callback": it describes the effect, not the source.) Reproducing this
  isolation on axios — where the equivalent `.then` *is* awaited and its rejection flows to `.catch` —
  is the crux of Decision 3.

Critically, **this method still calls `request.post(...)`** — the fork never received upstream's axios
migration, which is precisely why issue #3 exists. The fork also ships **no `index.d.ts`**, so `fuze`
currently imports it untyped.

**Upstream (`2.0.49`) is axios-based and typed.** Its `refreshAccessToken` uses
`axios.post(...).then(callback).catch(callback)`, unconditionally sets `this.refreshToken` and
`this.token` inside the `.then` (no rotation guard), and has **no callback hook**. Its constructor is
**10 positional parameters ending at `refreshToken`**, preserving the same `_.isObject(consumerKey)`
prefix/`eval` dual (object-or-positional) construction the fork uses, and the same `minorversion`
default of `75`. It ships `index.d.ts` (`"types": "index.d.ts"`) whose constructor declares a single
**10-positional-parameter** signature ending at `refreshToken` — no object-form overload and no
`refreshTokenCallBack`.

**Two issue-#3 advisories remain even at upstream:** `underscore@1.12.1` (exact-pinned; ReDoS;
patched at `1.13.8`, a non-major bump) and `fast-xml-parser@4.3.2` (critical; advisory range
`<=5.6.0`, sole fix `5.9.2` — a semver-major bump). `underscore` is used ~44 times across `index.js`,
so it is retained and bumped, not removed. `fast-xml-parser` cannot be cleared anywhere on the 4.x
line; the 5.x major is required (Decision 4).

**The consumer contract (`pncit/fuze`).** `fuze` is a strict-TypeScript ESM service. In
`src/models/api.qbo/qboApi.ts` it imports the package as a default import and constructs it
**positionally with an 11th argument** — the `refreshTokenCallBack` — then casts the result to its own
local `IQuickBooksBase` interface via `as {} as IQuickBooksBase`. Two facts follow directly:

1. The return-value cast insulates `fuze` from the package's *method* types, but the **constructor
   arguments are still type-checked** against whatever `.d.ts` ships. An 11-argument call against a
   10-parameter signature is a compile error.
2. `fuze`'s callback is a deliberate **error-isolation shim**. Its own comment records the *observable*
   contract above: *"node-quickbooks does NOT await this callback, so any thrown error or rejection
   becomes an unhandled rejection that crashes the server."* The shim therefore never throws — it
   stores the pending promise, attaches `.catch()`, and surfaces any error to a separate refresh
   *coordinator*. This contract is fragile and undocumented in the package, and `fuze` has live tests
   exercising it (`src/factories/api.test.ts`, `src/models/api.qbo/qboApi.emitExternalCall.test.ts`).

## Proposed Design

### Overview

Reset the fork onto upstream's current code, then re-apply the `refreshTokenCallBack` feature as a
small, well-contained patch in three files: `index.js` (runtime), `index.d.ts` (types, newly inherited
from upstream), and a new test that guards the behavior. Finish with the two dependency bumps and a
regenerated lockfile. The fork's identity becomes "upstream + one feature + two security bumps."

### Key Concepts

- **Thin patch layer.** The fork holds the minimum delta over upstream: one feature and two version
  bumps. Everything else is upstream verbatim, so future re-syncs reconcile only these known points.
- **Feature parity across runtime and types.** `refreshTokenCallBack` now exists in *two* surfaces —
  `index.js` and `index.d.ts` — because the fork inherits upstream's bundled types. The feature is not
  fully re-applied unless both carry it.
- **The error-isolation contract.** The observable behavior `fuze` depends on — the hook fires on token
  rotation, and a hook rejection does **not** propagate into the QuickBooks node-style callback — is a
  first-class part of the feature, preserved and test-locked, not an implementation accident.

### Design Decisions

#### Decision 1: Re-sync onto upstream and re-apply the feature, rather than fork further or retire

**Decision:** Adopt upstream's axios codebase wholesale and re-apply only the `refreshTokenCallBack`
feature on top of it. Keep the fork as the consumed artifact.

**Rationale:** Upstream already did the costly `request`→axios migration that clears most of issue #3.
The fork's delta is a single, isolated feature. Re-syncing inherits the fix (and upstream's types and
future maintenance) for near-zero cost, while re-applying preserves the one thing the fork adds.

**Alternatives considered:**
- *Migrate the fork off `request` independently:* re-implements work upstream already shipped and
  perpetuates divergence. Rejected.
- *Retire the fork; point `fuze` at upstream and persist tokens differently:* upstream has no callback
  hook, so this forces non-trivial token-handling changes into `fuze` and loses the feature. Rejected
  for this iteration (see Future Considerations for the upstream-PR path).

#### Decision 2: Re-apply the feature in `index.d.ts`, and keep shipping types

**Decision:** Extend the inherited `index.d.ts` constructor with an 11th optional parameter,
`refreshTokenCallBack?: (token: string) => void | Promise<void>`, and keep `"types": "index.d.ts"`.

**Rationale:** The fork currently ships no types, so `fuze` consumes it untyped. Re-sync introduces
upstream's `index.d.ts` into `fuze`'s strict build for the first time. Because `fuze` constructs with
11 positional arguments, a 10-parameter signature is a hard compile error. Adding the parameter keeps
`fuze` green *and* makes the types accurate for the feature the fork actually provides.

Only the **positional** constructor is typed. Upstream's `index.d.ts` declares a single positional
signature with no object-form overload, and the re-apply extends exactly that signature; the runtime's
object form (the `_.isObject(consumerKey)` prefix path) remains untyped, as it already is upstream. This
is safe because `fuze` constructs positionally, so the object form is never type-checked against the
package. The declared return type `void | Promise<void>` is the broadest type compatible with the
runtime invocation form fixed in Decision 3 (the hook may return either a value or a promise, and the
re-apply tolerates both), so the two surfaces agree.

**Alternatives considered:**
- *Strip types from the fork (remove `index.d.ts` / the `"types"` field):* preserves `fuze`'s current
  untyped consumption with less effort, but discards a real benefit upstream now provides and leaves
  the feature untyped. Rejected.

#### Decision 3: Preserve the exact callback invocation/error semantics `fuze` relies on

**Decision:** Re-apply the hook on upstream's axios `refreshAccessToken` so its behavior is observably
identical to today. Three gates and one isolation rule define the re-apply:

- **Assignment order.** On the success path, assign `this.token = refreshResponse.access_token`
  **unconditionally** (matching both fork and upstream). Reassign `this.refreshToken` and invoke the
  hook **only inside the rotation branch** (`this.refreshToken !== refreshResponse.refresh_token`). Do
  not gate the `this.token` assignment on rotation.
- **Hook gating.** Within the rotation branch, invoke the hook only when `this.refreshTokenCallBack` is
  truthy (`if (this.refreshTokenCallBack)`). This preserves correctness for every construction that
  omits the callback (the 10-argument form), which must not throw on rotation.
- **Rejection isolation (the mechanism).** Invoke the hook with **its own attached `.catch()`** and do
  **not** `await` it inside the axios `.then` that resolves the caller's node-style `callback`. The
  hook's promise is thereby isolated: its rejection is handled by its own `.catch` (swallowed/logged)
  and **cannot enter** the `.then`/`.catch` chain that feeds `callback(err, …)`. The success path still
  calls `callback(null, refreshResponse)` exactly once, with no error, regardless of hook outcome.

**Rationale:** `fuze`'s error-isolation shim and refresh coordinator are built on the current contract
(hook is effectively fire-and-forget from the caller's perspective; the caller self-manages hook
errors). That fire-and-forget property is produced today only incidentally — `request` discards the
returned promise of the `async` callback the hook is `await`ed in (see Current State). On axios the
equivalent structure is the opposite: a hook `await`ed inside the `.then` flows its rejection straight
to `.catch → callback(err, …)`. A naive `await this.refreshTokenCallBack(...)` inside the `.then` is
therefore the **specific wrong answer** — it would route hook rejections into `callback` and cause
`fuze`'s coordinator to double-handle errors. Replacing the incidental isolation with the explicit
own-`.catch` isolation above reproduces the observable contract deterministically and keeps `fuze`
correct with zero changes on its side.

**Alternatives considered:**
- *Improve error propagation (surface hook failures through the main callback):* arguably cleaner, but
  it is a behavioral change requiring a coordinated update to `fuze`'s shim and coordinator. Out of
  scope (Non-Goal).

#### Decision 4: Bump `underscore` to `^1.13.8` and `fast-xml-parser` to `^5.9.2`

**Decision:** Set `underscore` to `^1.13.8` and `fast-xml-parser` to `^5.9.2`; regenerate the lockfile.

**Rationale:** These are the two issue-#3 advisories upstream has not addressed.

- `underscore`: patched at `1.13.8` (non-major), used throughout `index.js`, so it is bumped, not
  removed.
- `fast-xml-parser`: the advisory (entity-expansion family) covers the **entire `<=5.6.0` range**, so
  **no 4.x version clears it** — `5.9.2` is the first fixed release. Although 5.x is a semver-major, it
  is not breaking *for this codebase*: the fork's only usage is `new XMLParser()` with default options
  and `xmlParser.parse(body)[rootTag]`, and `5.9.2` keeps that API and its default parse output
  identical. The 5.x package ships a dual CommonJS/ESM build, so the fork's CommonJS
  `require('fast-xml-parser').XMLParser` continues to resolve. The major bump is therefore version-only
  churn with no code change.

**Alternatives considered:**
- *Drop `underscore` entirely (replace its call sites with plain JS):* removes a dependency permanently
  but adds avoidable code churn and regression surface for no security gain beyond the bump. Rejected.
- *Stay on `fast-xml-parser` 4.x with a residual advisory:* would leave a critical advisory unresolved
  and defeat the design's primary goal of a clean audit, in exchange for avoiding a major bump that
  carries no actual breaking change here. Rejected.

## Migration Strategy

The base is upstream `mcohen01/node-quickbooks` at version **`2.0.49`** (the current released axios-based
head; upstream publishes no `2.0.50`). Take upstream as authoritative for the whole tree except the two
feature regions, then layer the bumps:

0. **Precondition (must pass before any reset).** Add the upstream remote and fetch its `2.0.49` head,
   then confirm from the fetched tree the facts the re-apply depends on:
   - upstream's `refreshAccessToken` is axios-based with no callback hook;
   - upstream's `index.d.ts` constructor is the 10 positional parameters ending at `refreshToken`;
   - upstream still supports the object/positional dual construction (the `_.isObject(consumerKey)`
     prefix path), since the re-apply must populate `this.refreshTokenCallBack` from both forms.

   Then **diff the fork's `index.js` against upstream `2.0.49`** and confirm the *only* production deltas
   are the two known feature regions (constructor 11th parameter + field; `refreshAccessToken` rotation
   guard, truthiness guard, and hook call). At `2.0.49` the non-feature lines match (including the
   `minorversion` default of `75` and the object-form construction), so no other reconciliation is
   expected; **if any additional delta surfaces, enumerate it as an explicit reconciliation decision**
   rather than letting "upstream wins" silently apply it. In a `fuze` checkout, confirm
   `src/models/api.qbo/qboApi.ts` constructs the package positionally with the 11th `refreshTokenCallBack`
   argument. If upstream's constructor arity, hook surface, or object-form support differs from the
   above, stop and re-baseline Decisions 2 and 3 before proceeding.
1. **`git reset --hard` the fork branch onto upstream `2.0.49`**, then re-apply the feature as a fresh
   patch (steps 2–3). Reset rather than merge: the design's framing is "upstream wins everywhere except
   two regions," so a clean reset followed by a small re-apply is simpler and leaves no merge artifacts,
   whereas a merge would force manual conflict resolution across the entire `request`→axios `index.js`
   rewrite. The trade-off — reset rewrites the fork's branch history — is acceptable because the fork's
   value is its current `HEAD` state, not its history. After reset, no `request.post(...)` may survive.
2. Re-apply `refreshTokenCallBack` onto upstream's axios `refreshAccessToken` and constructor per
   Decision 3 (unconditional `this.token`; rotation- and truthiness-gated hook; hook isolated by its own
   `.catch`, never `await`ed into the `.then` feeding `callback`).
3. Re-apply the feature to `index.d.ts` per Decision 2.
4. Apply the dependency bumps (Decision 4), then regenerate `package-lock.json` from a clean install.
5. Add the regression test (see Success Criteria) and validate against `fuze`.

### Breaking Changes

- **The fork begins shipping `index.d.ts`.** This is new typing surface for `fuze`'s strict build.
  Constructor-argument breakage is handled by Decision 2. Should the now-typed *method* surface produce
  unrelated type errors in `fuze`, they are contained by `fuze`'s existing `as {} as IQuickBooksBase`
  return cast; any residual is resolved on the `fuze` side at integration without changing the fork's
  public behavior.
- **No runtime breaking changes.** The public runtime contract — constructor arity/shape and
  `refreshTokenCallBack` behavior — is preserved exactly.

### Data Migration

None. No persisted data formats change. Refresh-token persistence remains the caller's responsibility
via the unchanged hook.

## Success Criteria

- `npm audit` on the fork reports **none** of the issue-#3 advisories enumerated below; `request` and
  `request-debug` are absent from `package-lock.json`.

  | Advisory | Source today | Cleared by | Expected end state |
  |----------|--------------|------------|--------------------|
  | `request` (critical) | direct dep | axios migration removes it | absent |
  | `request-debug` | direct dep | axios migration removes it | absent |
  | `form-data` (critical) | via `request` | removed with `request` | absent |
  | `tough-cookie` | via `request` | removed with `request` | absent |
  | `qs` | via `request` | removed with `request` | absent |
  | `uuid` | via `request` | removed with `request` | absent |
  | `underscore` (high) | direct dep | bump to `^1.13.8` | absent |
  | `fast-xml-parser` (critical) | direct dep | bump to `^5.9.2` | absent |

  All eight are expected **cleared** — the design retains no advisory.
- `index.js` contains no `request` usage; `refreshAccessToken` is axios-based, assigns `this.token`
  unconditionally, and invokes `refreshTokenCallBack` only on token rotation (when truthy) with the
  preserved error-isolation semantics of Decision 3.
- `index.d.ts` constructor includes the optional `refreshTokenCallBack` parameter.
- A regression test passes, asserting: the hook fires with the new token when the refresh token
  rotates; it does **not** fire when the token is unchanged (nor when `refreshTokenCallBack` was omitted —
  the 10-argument construction must not throw on rotation); and when the hook **rejects**, the QuickBooks
  node-style `callback` is still invoked exactly once with the refreshed-token success result and **no
  error**. The rejecting-hook assertion must pin the *structure* of Decision 3's isolation, not only the
  symptom: assert that the hook rejection is captured by the hook's own `.catch` (e.g. observe the
  swallow/log path) and is provably absent from the arguments passed to `callback` — so the test fails if
  an implementor routes the rejection through `callback` yet happens to mask it.
- `fuze`, after updating its `#master` pin, **type-checks and builds**, and its QuickBooks
  token-refresh tests pass with no changes to `fuze` source.

### Verification

- `node -e "require('./index.js')"` exits 0 (module loads clean).
- `npm install` (clean) then `npm audit`; assert that **each of the eight named advisories above is
  absent** from the output (not merely an overall count), so the audit gate is falsifiable.
- Assert `index.js` retains no `require('request')` / `require('request-debug')` and no `request.post(`
  / `request(` call sites — a falsifiable gate, rather than grepping the bare substring "request", which
  upstream may legitimately keep in comments, identifiers, or axios config keys.
- Run the new unit test (stubbing `axios.post`) for the callback assertions above; the rejecting-hook
  case must assert the node-style `callback` fired once with the success result and no error **and** that
  the rejection was captured by the hook's own `.catch` (per Decision 3's structure), not merely that
  nothing threw.
- In a `fuze` checkout: update `node-quickbooks`, run its type-check/build and its `api.qbo`
  token-refresh tests.
- *(Optional, requires credentials)* populate `config.js` with sandbox credentials and run `npm test`
  to confirm the axios migration did not regress live API calls.

### What Stays the Same

- The `refreshTokenCallBack` signature, invocation timing (on rotation only), and error-isolation
  contract.
- The package's public constructor shape (positional and object forms) and default ESM import.
- `fuze`'s source: construction, callback shim, and refresh coordinator are untouched.
- The fork's distribution channel: a git `#master` pin, no npm publish.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Naive axios re-apply changes the callback error contract, breaking `fuze`'s coordinator | Medium | High | Decision 3 preserves semantics exactly; regression test locks the contract; verify against `fuze`'s token-refresh tests before landing |
| New `index.d.ts` surfaces unexpected type errors in `fuze`'s strict build beyond the constructor | Medium | Medium | Add the 11th param (Decision 2); rely on `fuze`'s existing return-type cast; resolve residual typing on the `fuze` side at integration |
| Merge mis-resolution leaves `request` code or drops the feature | Low | High | Success criteria assert no `request` usage and feature presence in both `index.js` and `index.d.ts`; reconciliation is confined to two known regions |
| `fast-xml-parser` 4.x→5.9.2 major bump changes XML parsing or CommonJS resolution | Low | Medium | 5.x preserves the default `XMLParser` API and parse output and ships a CommonJS build; the fork's two call sites are unchanged; covered by live `npm test` when credentials are available |
| Selected dependency versions do not clear all issue-#3 advisories, leaving the service still flagged | Low | High | Versions chosen against the live advisory DB (`underscore@^1.13.8`, `fast-xml-parser@^5.9.2`); Verification asserts the named advisories are absent from `npm audit` before landing |
| A future upstream re-sync silently re-breaks the feature or its contract | Medium | Medium | The regression test in the fork fails loudly on any such regression |

## Future Considerations

### Enabled by This Design

- Routine, low-cost upstream re-syncs: the fork's delta is reduced to one feature plus two bumps, all
  test-guarded.
- A clean path to eventually retire the fork, by contributing `refreshTokenCallBack` upstream.

### Deferred Decisions

- **Contribute `refreshTokenCallBack` upstream via PR:** out of scope now. If accepted and released, the
  fork could be retired and `fuze` moved to an npm release. Deferred because it depends on an external
  maintainer's timeline and is not required to clear the advisories.
- **Improve callback error propagation (surface hook failures through the main callback):** deferred as
  a coordinated `fuze`-plus-package change; the current contract is preserved instead.
- **Drop `underscore`:** deferred; the `1.13.8` bump resolves its advisory without the churn of
  replacing every call site.

### Open Questions

None — every question and assumption this design depends on is resolved.
