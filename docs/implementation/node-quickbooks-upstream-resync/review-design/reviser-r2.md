## reviser — round 2

| ID | Disposition | Rationale (and, for Fixed, what changed) |
|----|-------------|------------------------------------------|
| design-auditor-r2-f1 | Fixed | Genuine in-scope clarity gap: the "does not surface as an error" assertion could be satisfied by a weaker "no throw" test that passes even if the hook never fired or the callback was skipped, locking down less than Decision 3 / the f1 contract protects. Tightened the third regression bullet in Success Criteria to state the positive expectation — on a rejecting hook the node-style `callback` is still invoked exactly once with the refreshed-token success result and no error (rejection isolated, not merely not thrown). Mirrored the strengthened assertion in the Verification rejecting-hook step. Refined the existing bullets; no new section added. |
