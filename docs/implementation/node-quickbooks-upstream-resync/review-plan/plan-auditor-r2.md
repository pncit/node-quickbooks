## plan-auditor — round 2

Reconciled all five round-1 findings against the revised plan and the reviser's dispositions, then
hunted for new issues. Every disposition was verified empirically, not taken on the reviser's word:

- **f1 (uuid bump):** Reproduced a clean install of the bumped production tree (`underscore@^1.13.8`,
  `fast-xml-parser@^5.9.2`, `uuid@>=11.1.1`, plus upstream's axios/form-data/oauth-1.0a). Resolved
  versions: `underscore@1.13.8`, `fast-xml-parser@5.9.2`, `uuid@14.0.0`. `require('uuid').v1()`
  returns a valid v1 UUID under v14, confirming the sole call site (`index.js:2352`) survives the
  semver-major. Confirmed `uuid` is a *direct* upstream dep (`git show upstream/master:package.json`
  → `"uuid": "^8.3.2"`; used at `index.js:12`/`:2352`) that survives the reset. The Phase 4 plan
  bumps it and re-verifies the call site. Ratified.
- **f2 (audit gate):** On the bumped tree, `npm audit --omit=dev --json` →
  `.metadata.vulnerabilities.total === 0`, `.vulnerabilities` keys empty. Full `npm audit` → total 6,
  all in the mocha devDep tree (`diff`, `js-yaml`, `minimatch`, `mocha`, `nanoid`,
  `serialize-javascript`) — exactly as the plan documents; none among the eight named issue-#3
  advisories. The structural `.metadata`/`.vulnerabilities|keys` gate is sound; the old unsound
  substring scan is gone. `jq` is present on this host (1.7); the plan's exit-code fallback note is a
  reasonable hedge. Ratified.
- **f3 (rejection-isolation test):** Built a harness mirroring the plan's Phase 2 `.then` isolation
  shape and the Phase 3 case-4 test. The correct shape passes (`callbackArgs[0]===null`,
  `hookSettled===true`, `unhandled.length===0`); the *wrong* `await`-in-`.then` shape correctly
  **fails** the gate by routing the rejection into `callbackArgs[0]`. The test is genuinely
  discriminating and pins Decision 3's structure, not just the symptom. The mandatory
  `process.on('unhandledRejection',…)` guard and `setTimeout(…,20)` sequencing are in the plan.
  Ratified.
- **f4 (install ordering):** Phase 3 now has an explicit Step 0 `npm install` over the inherited
  lockfile as the first dependency-availability point, with the first module-load smoke test there;
  Phase 4 keeps its clean regen. Phases 1-2 gate only on git/grep. No gate runs before its deps
  exist. Ratified.
- **f5 (grep conventions):** Global "Gate-grep conventions" note added; every gate converted to
  `grep -qF` (13 occurrences) or `[ "$(grep -cF …)" = "0" ]` (11 occurrences). Verified the failure
  mode the finding named (`grep -c` zero-match exits non-zero, breaking `&&`) is now avoided.
  Ratified.

Design-alignment re-spot-check (all hold against `upstream/master` 2.0.49): constructor is 10
positional params ending at `refreshToken`; `refreshAccessToken` is axios `.post().then().catch()`
with no hook and no rotation guard; `index.d.ts` has a single positional constructor ending at
`refreshToken?: string | null` with no object overload; `_.isObject(consumerKey)` dual construction
present; `minorversion || 75`. The plan's Phase 2/Phase 3 examples match these exactly. The plan's
`makeClient` 11-positional construction (`oauthversion '2.0'`) reaches the refresh path without the
`tokenSecret` throw — verified. Mocha's default glob (`./test/*.{js,cjs,mjs}`) does pick up the
`.test.js` file, and the gate uses explicit-file invocation regardless — both confirmed.

No new blocking issues. The single imprecision found (Repo-Context line 9 calls mocha's default
discovery `./test/*.spec.js`-style, whereas the operative Phase 3 Step 3 correctly states
`./test/*.{js,cjs,mjs}`) has zero functional impact — the gate is explicit-file — and does not meet
the actionability/non-deferrable bar for a finding.

## Findings

| ID | Severity | Status | Category | Finding | Recommendation / update |
|----|----------|--------|----------|---------|-------------------------|
| plan-auditor-r1-f1 | High | Closed | Completeness | — | ratified: `uuid` confirmed a direct upstream dep surviving the reset; Phase 4 now bumps it to `>=11.1.1` (resolves `14.0.0`) and re-verifies `uuid.v1()`; reproduced clean install + `v1()` works + prod audit total 0. |
| plan-auditor-r1-f2 | High | Closed | Test | — | ratified: unsound substring scan replaced by structural `npm audit --omit=dev --json` (`.metadata.vulnerabilities.total===0` + `.vulnerabilities\|keys` empty); reproduced on the bumped tree (prod total 0; full audit's 6 are all mocha-devtree, out of scope). |
| plan-auditor-r1-f3 | High | Closed | Test | — | ratified: rejection-isolation case rewritten with mandatory `unhandledRejection` guard, `hookSettled` assertion, and `setTimeout(…,20)` sequencing; harness shows the correct shape passes and the wrong `await`-in-`.then` shape fails the gate — it pins Decision 3's structure. |
| plan-auditor-r1-f4 | High | Closed | Consistency | — | ratified: Phase 3 Step 0 `npm install` added as the first dependency-availability point with the first module-load smoke test; Phases 1-2 gate only on git/grep; no gate runs before its deps exist. |
| plan-auditor-r1-f5 | Medium | Closed | Clarity | — | ratified: global gate-grep convention added; all literal gates use `grep -qF` and all count gates use `[ "$(grep -cF …)" = "0" ]`, avoiding the zero-match `grep -c` non-zero-exit `&&`-break. |
