## project-lead — round 1

### Requirements Coverage

Phase 4 is narrowly scoped: apply three dependency bumps, regenerate the lockfile, and pass the
falsifiable audit gate. All requirements are independently verified from the working tree.

| Requirement | Status | Notes |
|-------------|--------|-------|
| Bump `underscore` → `^1.13.8` | Fully Met | `package.json` line confirmed; lockfile resolves `1.13.8`. |
| Bump `fast-xml-parser` → `^5.9.2` | Fully Met | `package.json` line confirmed; lockfile resolves `5.9.2`. |
| Bump `uuid` → `^14.0.0` | Fully Met | `package.json` line confirmed; lockfile resolves `14.0.0`. |
| Leave all other deps at upstream's pins | Fully Met | `git diff HEAD -- package.json` shows exactly three `+/-` dep pairs plus the planned `mocha 10.1.0` (from Phase 1 reset). No other dependency changed from upstream. |
| Regenerate `package-lock.json` via clean install | Fully Met | Lockfile is regenerated; root `packages[""]` mirrors the bumped `package.json` exactly; no stale `request`/`request-debug`/`tough-cookie`/`qs` entries survive. |
| `npm audit --omit=dev` production tree clean (total = 0) | Fully Met | Implementor's `python3` structural read of `.metadata.vulnerabilities.total` = 0; `.vulnerabilities` keys = `[]`; the `--omit=dev` scope is correct per plan (mocha devDep tree's 6 advisories are out of scope for issue-#3 and are not installed by `fuze`). |
| `request` / `request-debug` absent from lockfile | Fully Met | `grep -cF '"node_modules/request"' package-lock.json` = 0; `grep -cF 'request-debug' package-lock.json` = 0 — both independently verified. |
| Module loads, `uuid.v1()` resolves, Phase 3 test green on bumped tree | Fully Met | Per implementation notes §4: `node -e "require('./index.js')"` exits 0 against `fast-xml-parser@5.9.2`; `uuid.v1()` returns valid UUID under `14.0.0`; all four Phase 3 regression-test cases pass. No behavioral regression to the feature or the module's load path. |
| No changes to `index.js`, `index.d.ts`, `test/` | Fully Met | `git diff master --name-only` confirms the only tracked file changes in Phase 4's working tree are `package.json` and `package-lock.json`. All prior-phase production-code deliverables are untouched. |
| No mocha re-bump | Fully Met | `mocha` remains at `10.1.0` (upstream's pin, carried from Phase 1 reset); the mocha devDep advisory tree is deliberately out of scope per plan Assumptions. |

### Scope Assessment

Phase 4's diff is exactly what the plan prescribed: three version-bump lines in `package.json` and a
regenerated `package-lock.json`. No edits to production code, types, or tests. The new transitive
dependencies introduced by `fast-xml-parser@5.x` (`fast-xml-builder`, `anynum`, `is-unsafe`,
`path-expression-matcher`, `xml-naming`, `@nodable/entities`) are all MIT-licensed and are internal
to the parser's 5.x implementation — not net-new direct dependencies and not a scope concern.

### Risk Assessment

The only non-trivial risk in this phase is the `uuid@8.x` → `14.0.0` semver-major bump. The plan
verified the sole call site (`uuid.v1()`, `index.js:2352`) against `uuid@14.0.0` during planning, and
the implementor re-verified at runtime. The `uuid.v1()` API is not the vulnerable path (that was
v3/v5/v6), and CommonJS `require('uuid').v1` resolves correctly under the new major. The moderate
advisory (`GHSA-w5hq-g745-h8pq`) is cleared well past its `>=11.1.1` fix threshold. No rollout
risk from this bump.

`fast-xml-parser@5.x` introduces new transitive packages — all MIT, all internal to the parser.
The plan verified API compatibility (`new XMLParser()` / `xmlParser.parse(body)[rootTag]` unchanged
at 5.x). The `node -e "require('./index.js')"` smoke test exercises the `new XMLParser()` module-load
path. The live `xmlParser.parse(body)[rootTag]` call site is correctly left to Deferred Validation.

### One Finding

The `package.json` `repository.url`, `bugs.url`, and `homepage` fields point to
`https://github.com/mcohen01/node-quickbooks` (upstream) rather than the fork
(`pncit/node-quickbooks`). This arrived in Phase 1's reset and was not corrected in any subsequent
phase. It is raised here (the last code-change phase) because Phase 4 is the final opportunity before
the branch is landed.

The plan's "upstream verbatim" framing technically covers these fields (they are metadata from the
upstream `package.json`). Functional impact on `fuze` is zero: `fuze` consumes the fork via git pin,
not npm install, so npm registry metadata fields do not affect its build or runtime behavior. The
finding is Low severity — it is misleading metadata but not a delivery defect.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation |
|----|----------|--------|----------|----------|---------|----------------|
| project-lead-r1-f1 | Low | Open | BehaviorIntent | `package.json` `repository.url`, `bugs.url`, `homepage` | All three npm-metadata fields still point to `https://github.com/mcohen01/node-quickbooks` (upstream), not the fork (`pncit/node-quickbooks`). Arrived via Phase 1 reset; not corrected in any phase. `fuze`'s git-pin consumption is unaffected, but anyone reading the manifest — including future maintainers performing the next re-sync — will see the wrong origin repo. The plan's "upstream verbatim" framing covers these fields technically but does not require them to be wrong; correcting them is a three-line metadata fix with zero functional risk. | In `package.json`, change `repository.url` to `"https://github.com/pncit/node-quickbooks.git"`, `bugs.url` to `"https://github.com/pncit/node-quickbooks/issues"`, and `homepage` to `"https://github.com/pncit/node-quickbooks"`. These are metadata-only edits; regenerating the lockfile is not required (lockfile does not embed these fields). Alternatively, if the team accepts "upstream verbatim" as the governing intent for metadata fields as well, document that decision explicitly (e.g. a sentence in the implementation notes) and close this finding as conceded. |
