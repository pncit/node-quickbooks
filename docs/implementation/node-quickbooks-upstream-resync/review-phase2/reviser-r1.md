## reviser — round 1

| ID | Disposition | Rationale (and, for Fixed, what changed) |
|----|-------------|-------------------------------------------|
| engineer-r1-f1 | Fixed | Added a three-line comment immediately above the `Promise.resolve(this.refreshTokenCallBack(...)).catch(...)` call in `index.js` (inside the rotation guard block) explaining that the hook is deliberately fire-and-forget with its own `.catch`, that a rejection must not reach the node-style `callback`, and that `await`-ing it inside the `.then` would silently break the error-isolation contract. The comment captures the "do NOT" intent the plan carried at that site. |
