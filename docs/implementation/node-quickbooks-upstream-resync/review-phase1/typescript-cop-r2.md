## typescript-cop — round 2

All four round-1 findings were rejected by the reviser (reviser-r3.md) on the same phase-scope
rationale: Phase 1 is upstream-verbatim, the plan explicitly prohibits code edits to `index.d.ts`
outside the two feature regions, and in each case my own round-1 recommendation named Phase 3 as the
correct fix point. I re-verified the rationale and concede all four.

The current diff (`git diff master...HEAD -- index.js index.d.ts package.json package-lock.json`)
confirms the code/package tree is byte-for-byte upstream 2.0.49 with no Implementor-authored code
edits — the rejection rationale holds. No new type-safety issues arise from the Phase 1 deliverable
(a pure git reset plus docs remediation); the round-1 findings remain real issues but belong in the
Phase 3 review loop, not here.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation |
|----|----------|--------|----------|----------|---------|----------------|
| typescript-cop-r1-f1 | High | Closed | BoundaryValidation | `index.d.ts:5-9` (`QuickBooksCallback<T>`) | Conceded: phase-scope rejection is valid. Phase 1 is upstream-verbatim; no code edits to `index.d.ts` are in scope. My own recommendation said "apply in Phase 3." Phase 3's review loop must surface this if it is not addressed when the `.d.ts` is edited for the 11th constructor parameter. | — |
| typescript-cop-r1-f2 | High | Closed | BoundaryValidation | `index.d.ts:486` (`refreshAccessToken`) + `index.js:140-142` | Conceded: phase-scope rejection is valid, and the plan's Assumptions explicitly accept the changed error-path shape as intentional (upstream's status-based `.catch` replaces the fork's body-based classification). No code edits are in scope for Phase 1. | — |
| typescript-cop-r1-f3 | Medium | Closed | PublicTypes | `index.d.ts:508` (`upload`) | Conceded: phase-scope rejection is valid. Phase 1 is upstream-verbatim; `stream: any` is outside both feature regions. My own recommendation said "apply in Phase 3." | — |
| typescript-cop-r1-f4 | Medium | Closed | PublicTypes | `index.d.ts:1165` (`createTaxService`) | Conceded: phase-scope rejection is valid. Phase 1 is upstream-verbatim; `taxService: any` is outside both feature regions. My own recommendation said "apply in Phase 3." | — |
