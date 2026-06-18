## architect — round 1

First architect turn on Phase 1 (no prior `architect-r*` turn in this review dir; the existing
`implementation-auditor-r{1,2,3}` and `reviser-r{1,2}` files are a *different* reviewer's lane —
I read them for context but do not reconcile against them). Phase 1 is a precondition-gated
`git reset --hard upstream/master` onto upstream `2.0.49` with the `refreshTokenCallBack` feature
deliberately absent until Phases 2–3.

### Scope verification (Architect lens)

- **Tracked code tree is byte-for-byte upstream `2.0.49`.** `git diff --quiet upstream/master HEAD --
  index.js index.d.ts package.json package-lock.json README.md` → identical; `git diff --stat
  upstream/master HEAD -- . ':(exclude)docs/'` is empty. No out-of-scope production edits — the only
  branch deltas vs upstream are under `docs/`. This is exactly what the phase should produce.
- **Boundaries / layering / coupling:** nothing to evaluate — no new modules, exports, imports, or
  integration points were authored; the deliverable is upstream code adopted wholesale. The
  request→axios boundary, the `xmlParser` instantiation, and the positional/object eval-prefix
  construction are upstream's and untouched. No new circular deps, no cross-layer imports introduced
  by this phase.
- **Package-quality / publish surface:** `.npmignore` (`build`, `.idea`, `**/junk**`) and the absent
  `"files"` field are upstream-verbatim; `"types": "index.d.ts"` is correctly inherited and `index.d.ts`
  is present and would publish. The `bluebird` dual-declaration (`dependencies` `3.3.4` /
  `devDependencies` `2.9.25`) is upstream's own `package.json` verbatim and explicitly in scope per the
  plan's "upstream wins everywhere except the two feature regions" — **not** a Phase-1 finding.
- **Things I deliberately did NOT raise** (in scope per plan Assumptions / deferred to later phases,
  not architectural defects of Phase 1): un-bumped `underscore`/`fast-xml-parser`/`uuid` (Phase 4);
  `mocha@10.1.0` devDep reverted from the fork's `^10.8.2` (intended); credential-gated `npm test`
  (inherited upstream property); stale gitignored `node_modules` (Phase 3/4). The four
  implementation-auditor r1 findings (planning-doc *content* destruction/restoration and the self-review
  scoring) are that reviewer's closed items; I do not re-raise their content concern.

### The one durable architectural concern

The reset orphaned commit `04c4d8c` — the *approved plan/design commit of this very effort* — and the
entire pre-plan fork lineage: `git merge-base --is-ancestor 04c4d8c HEAD` → NO. The
implementation-auditor closed its f1/f2 on the basis that the doc **content** is now branch-reachable
(true — `b2aaba3` re-tracked it). But content-reachability and **commit-graph integrity** are different
properties. The branch tip now descends from `upstream/master` (`f5baf5d`) with *no* recorded ancestry
to either the fork's origin or its own approved-plan commit; the approval record and the fork's
provenance survive **only** as loose objects pending `git gc` / reflog expiry. That is a
maintainability/history-as-artifact matter squarely in the Architect lane, it was explicitly punted to
"human/orchestrator judgment" in the auditor's f2 recommendation, and it was never actually decided.
It is one `git gc --prune=now` (or a fresh clone, which carries no reflog) away from permanent loss of
the approved-plan commit and the fork's lineage. The fix is cheap and falsifiable (a tag/recovery ref),
so I raise it as an actionable finding rather than leaving it as an open deferral. This is the only
issue I surface; the code deliverable itself is correct and in-scope.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|--------------------------|
| architect-r1-f1 | Medium | Open | History / Maintainability | branch `feat/node-quickbooks-upstream-resync` commit graph; orphaned commit `04c4d8c` | The hard reset orphaned `04c4d8c` (the **approved plan/design commit of this effort**) and the entire pre-plan fork lineage: `git merge-base --is-ancestor 04c4d8c HEAD` → NO. The implementation-auditor's f1/f2 closed only the doc *content* concern (content was re-tracked in `b2aaba3`), and f2 explicitly deferred the commit-graph question to "human/orchestrator judgment" — a decision that was never made. As it stands, the approval record and the fork's provenance exist only as loose objects reachable via reflog (default 90-day expiry) and survive **no** fresh clone and **no** `git gc --prune=now`. Commit-graph integrity (an approved-design effort should leave its approval commit reachable, and a fork rebased onto upstream should not silently sever all recorded ancestry to its own origin) is distinct from "the .md files are present on disk." | Create a durable, branch-independent ref so the approved-plan commit and fork lineage cannot be GC'd: e.g. `git tag pre-resync-plan-approved 04c4d8c` and (if the fork's pre-plan code history must be preserved per repo policy) `git tag pre-resync-fork-head <old-origin-tip>`, then push the tag(s) to `origin`. Record the chosen disposition in `implementation-phase1-notes.md` §5/§11 so "orphaning the fork's pre-plan code history is intended, approval commit preserved via tag `pre-resync-plan-approved`" is an explicit, documented decision rather than an unresolved deferral. If the human/orchestrator decides no recovery ref is wanted, that explicit "let it be GC'd" decision — recorded in the notes — also closes this finding; what is not acceptable is leaving it undecided. |
