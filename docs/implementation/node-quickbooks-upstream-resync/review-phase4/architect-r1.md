## architect — round 1

Scope: Phase 4 only — the three dependency bumps in `package.json` (`underscore` →
`^1.13.8`, `fast-xml-parser` → `^5.9.2`, `uuid` → `^14.0.0`) and the regenerated
`package-lock.json`. `index.js` / `index.d.ts` / `test/` are Phase 1-3 territory and
untouched in this phase; I treat them as fixed context, not under review here.

Verified state (read-only, no tests run):
- Lockfile (`lockfileVersion: 3`) resolves `underscore@1.13.8`, `fast-xml-parser@5.9.2`,
  `uuid@14.0.0`; `axios@1.18.0`, `form-data@4.0.6`, `oauth-1.0a@2.2.6`. `request`,
  `request-debug`, `tough-cookie`, `qs` are all absent. Root `packages[""].dependencies`
  mirror `package.json`. Every entry has an `integrity` hash and resolves to
  `registry.npmjs.org` — no tampered/local refs.
- `npm audit --omit=dev` production tree is advisory-free (`total: 0`, empty
  `.vulnerabilities`). The audit gate holds as the implementor and auditor reported.

The audit-clean goal is met and the mechanical exit gates pass. The findings below are
architectural risks the gate's structure does not catch, centered on the `uuid` major bump.

### Principal concern — the `uuid@14` major bump silently changes the package's module format

The gate proves the production tree is *advisory-free* and that `uuid.v1()` resolves *on the
build host* (Node v24.13.0). It does **not** prove the bump is compatible with the contract
`fuze` binds to. `uuid@14.0.0` is `"type": "module"` and ships **no CommonJS build**: its
`exports["."]` is `{ "node": "./dist-node/index.js", "default": "./dist/index.js" }`, and
`dist-node/index.js` is ESM (`export { default as v1 } from './v1.js'`) with no sibling
`package.json` CJS marker. The codebase consumes it via `uuid = require('uuid')` at
`index.js:12` and `uuid.v1()` at `index.js:2366`. This only works because Node ≥22 (and
≥20.19) ships stable synchronous `require(esm)`; on any older runtime `require('uuid')` throws
`ERR_REQUIRE_ESM` at module load — i.e. `require('node-quickbooks')` itself throws, before any
QuickBooks call. The package declares **no `engines` floor**, so nothing communicates or
enforces the new Node requirement this bump introduces. Contrast `fast-xml-parser@5`, which
ships a real `require` conditional export (`./lib/fxp.cjs`) and is genuinely CJS-safe across
Node versions — so this risk is `uuid`-specific, not generic to the phase.

This is exactly the kind of consumer-contract regression the design's Non-Goal ("no changes to
`fuze`") and the memory's fuze-consumer-contract are meant to protect: the bump can convert a
working `require` into a load-time throw on a fuze/CI runtime older than the build host, and the
phase's verification (run only on Node 24) cannot see it.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|
| architect-r1-f1 | High | Open | Boundaries | `package.json` `dependencies.uuid` (`^14.0.0`); consumed at `index.js:12`, `index.js:2366` | `uuid@14` is ESM-only (`"type":"module"`, no CJS export — only `node`/`default` both pointing at ESM). The package is loaded via CommonJS `require('uuid')`. This succeeds only on Node with stable `require(esm)` (≥20.19 / ≥22); on older runtimes `require('node-quickbooks')` throws `ERR_REQUIRE_ESM` at load. The phase verified `uuid.v1()` only on Node v24.13.0, so the gate cannot detect a regression on an older fuze/CI Node. The audit-driven bump thus introduces a runtime-floor change to the consumer contract that is neither tested against the consumer's Node nor declared. | Pin `uuid` to the **last major that ships a CommonJS build** that also clears `GHSA-w5hq-g745-h8pq` (fixed `>=11.1.1`) — `uuid@11.x` is dual CJS/ESM and clears the advisory without forcing ESM-only `require`. Bump to `^11.1.1` (or the latest dual-format major ≤13 that still has a `require` export — verify the chosen major's `exports` has a `require`/CJS condition) instead of `^14.0.0`, regenerate the lockfile, and re-run the audit gate. This keeps the same advisory-clearing outcome while preserving CommonJS load across all Node versions fuze may run, with no `fuze`-side change. |
| architect-r1-f2 | Medium | Open | Boundaries | `package.json` (no `engines` field) | If the maintainers consciously choose to keep `uuid@14` (ESM-only) rather than down-pin per f1, the new hard Node floor (`require(esm)` support) is undeclared. Nothing prevents installation/use on a runtime where the module fails to load, and the failure surfaces as an opaque `ERR_REQUIRE_ESM` at `require` time rather than an install-time engine warning. This is the boundary-enforcement gap that should accompany any decision to ship an ESM-only transitive load path through a CJS entrypoint. | Resolve in tandem with f1. If f1 is applied (down-pin to a dual-format `uuid`), this is moot — close it. If `uuid@14` is retained, add `"engines": { "node": ">=20.19" }` (or `>=22`) to `package.json` so the runtime floor introduced by the bump is declared and enforced at install, and confirm that floor is compatible with fuze's deployment Node. |
