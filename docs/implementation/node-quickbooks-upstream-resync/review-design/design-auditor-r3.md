## design-auditor — round 3

Re-verified the one finding the reviser marked `Fixed` (r2-f1) against the current design and the
live repo. No new blocking issues. All round-1 findings remain settled (closed in r2) and are not
re-listed.

- **r2-f1 (rejecting-hook assertion strength):** The reviser tightened both surfaces. Success
  Criteria now reads: "when the hook **rejects**, the QuickBooks node-style `callback` is still
  invoked exactly once with the refreshed-token success result and **no error** — proving the
  rejection is isolated rather than merely not thrown" (design.md:258–260). The Verification step
  mirrors it: "the rejecting-hook case must assert the node-style `callback` fired once with the
  success result and no error, not merely that nothing threw" (design.md:271–272). This is the
  positive expectation f1 asked for; a "no throw"-only test would no longer satisfy the criterion.
  Ratified.

Current-state spot checks re-confirmed against the live tree: `index.js:103` carries the 11-param
constructor signature ending at `refreshTokenCallBack`; `:118` assigns `this.refreshTokenCallBack`;
`:147` still calls `request.post`; `:152–156` is the rotation-guarded `await` hook with the
`this.refreshToken !== refreshResponse.refresh_token` guard. All match the design's Current State.
The error-isolation contract the design preserves is consistent with the actual code: the hook
`await` sits inside the `request.post` callback, and a hook rejection there propagates as an
unhandled rejection rather than into `callback(e, refreshResponse)` (line 158) — which is exactly
the fire-and-forget-from-the-caller behavior Decision 3 commits to keeping. No contradiction found.

No new findings.

## Findings

| ID | Severity | Status | Category | Where | Finding | Recommendation |
|----|----------|--------|----------|-------|---------|----------------|
| design-auditor-r2-f1 | Low | Closed | SuccessCriteria | — | ratified: Success Criteria (design.md:258–260) and Verification (design.md:271–272) now state the positive expectation — on a rejecting hook the node-style `callback` is invoked exactly once with the refreshed-token success result and no error, "not merely that nothing threw." A weaker no-throw test no longer satisfies the criterion; the contract Decision 3 protects is fully locked down. |
