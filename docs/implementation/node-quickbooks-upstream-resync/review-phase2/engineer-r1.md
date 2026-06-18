## engineer — round 1

Scope: the uncommitted Phase 2 working-tree change to `index.js` only (`git diff HEAD -- index.js`).
Phase 1 (the full axios re-sync of `revokeAccess`/`getUserInfo`/etc.) is already committed at HEAD and
is **not** in scope here; the `git diff master` superset is misleading. The actual Phase 2 footprint is
three hunks: three JSDoc `@param` lines, the 11th constructor param + field assignment, and the
`refreshAccessToken` `.then` rotation/hook block.

The change is small, clean, and follows the plan's prescribed shape. On the engineer axes it is in good
shape: the hook rejection is handled in its own `.catch` (no swallowed error — it logs behind
`this.debug`), the rotation guard and truthiness guard read clearly, naming matches the existing
`refreshToken` field, and there is no dead code, no debug leftovers, and no new magic values. The new
`eval(prefix + 'refreshTokenCallBack')` line is the pre-existing upstream construction idiom (every other
field uses it) — not a new finding.

One real maintainability gap: the single most fragile, non-obvious property of this block — that the hook
must **not** be `await`ed inside the `.then` — is now load-bearing but undocumented in the source. The plan
carried an explicit warning comment at that call site; the implementation copied the code but dropped the
comment.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation / update |
|----|----------|--------|----------|----------|---------|-------------------------|
| engineer-r1-f1 | Medium | Open | Comments & Documentation | `index.js:144-148` (hook `.catch` block) | The `Promise.resolve(this.refreshTokenCallBack(...)).catch(...)` shape encodes a critical, counter-intuitive invariant: the hook is deliberately *not* `await`ed so a rejection cannot reach the node-style `callback` (Decision 3 / the `fuze` error-isolation contract). To a maintainer this reads like an oversight — the obvious "tidy-up" is to `await this.refreshTokenCallBack(...)`, which silently breaks `fuze` and is exactly the wrong answer the plan calls out. The block carries no comment explaining why. The plan's own example (plan.md:154-159) includes a four-line warning comment at this site that was dropped when the code was copied in. | Add a short source comment immediately above the `Promise.resolve(...)` line, e.g. `// Fire-and-forget with its OWN .catch: a hook rejection must NOT reach the node-style callback below. Do NOT await this inside the .then.` Porting the plan's comment verbatim is sufficient. This is the one place a future edit can regress the contract without any test author noticing the intent. |
