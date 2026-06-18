## typescript-cop — round 1

Phase 1 is a pure `git reset --hard upstream/master` — no code was authored by the Implementor. The
deliverable changes are the entire tree replacing the fork's `request`-based code with upstream `2.0.49`
verbatim: a new `index.d.ts` (first time the fork ships TypeScript declarations), a rewritten `index.js`
(axios-based), and an updated `package.json` / `package-lock.json`. The planning-doc restoration commits
touch only `docs/` and carry no type-safety surface.

**Review scope:** The newly introduced `index.d.ts` is the primary type-safety surface — it is the first
public TypeScript declaration the fork ships and `fuze`'s strict build will now compile against it.
`index.js` is upstream verbatim and is reviewed only where its runtime behaviour disagrees with the
declared types. No new code was authored, so generics, async/await patterns, and narrowing in the
implementation are not in scope for this phase beyond what the `.d.ts` contracts declare.

**Finding triage rationale.** Several `[key: string]: any` escape hatches and `QuickBooksCallback<any>`
usages appear throughout the entity interfaces and method declarations. These are pervasive upstream
design choices for an HTTP-wrapper library whose QuickBooks entity shapes are too large and too varied to
fully enumerate in a fork-maintained `.d.ts`; the plan's Non-Goal explicitly excludes refactoring beyond
the two feature regions, and an `any`-for-entity-body design decision is outside TypeScript-cop scope
(architecture/project-lead). Those usages are not raised individually. The findings below are the ones
that (a) represent a concrete safety failure at a defined boundary rather than an omitted detail, or (b)
block the consumer (`fuze`) in ways not acknowledged as a planned transient.

**Note on the missing 11th constructor parameter.** The `index.d.ts` constructor declares 10 positional
parameters ending at `refreshToken?: string | null`; `fuze` calls it with 11 arguments. This is the
planned transient state for Phase 1 — the plan explicitly documents the feature as "temporarily absent"
and gates its restoration on Phase 3. Because the plan acknowledges this gap and Phase 3's exit gate
requires it to be fixed before the branch can land, it does not appear as a finding here. If Phase 3
ships without the 11th parameter this reviewer will raise it then.

## Findings

| ID | Severity | Status | Category | Location | Finding | Recommendation |
|----|----------|--------|----------|----------|---------|----------------|
| typescript-cop-r1-f1 | High | Open | BoundaryValidation | `index.d.ts:5-9` (`QuickBooksCallback<T>`) | `res?: any` is the third parameter of the core public callback type. Every method that delivers a response object to callers goes through this parameter (e.g. `revokeAccess` passes `res` as the raw axios response; error paths pass `err.response`). Callers receive an escape hatch — the type promise is "this is any shape" — so TypeScript cannot catch misuse of the response object. This is the outermost boundary of every API call in the library. | Replace `res?: any` with a narrower type that reflects what callers actually receive. For the success path, the response is an axios `AxiosResponse`; if the fork does not want an `axios` type dependency in `.d.ts`, `res?: unknown` is safer than `any` (callers must narrow before use). At minimum, apply this fix when the Phase 3 `.d.ts` edit lands, so the narrowing ships alongside the feature param. |
| typescript-cop-r1-f2 | High | Open | BoundaryValidation | `index.d.ts:486` (`refreshAccessToken`) + `index.js:140-142` | The declared return type of the callback is `QuickBooksCallback<RefreshTokenResponse>`, so callers see `data?: RefreshTokenResponse` in the second argument position. On the **error path** the runtime calls `callback(err, err.response, err.response ? err.response.data : null)` — passing an axios `AxiosResponse` object (not a `RefreshTokenResponse`) as `data`, and `err.response.data` as `res`. A caller who inspects `data` when `err` is non-null receives an `AxiosResponse` object but TypeScript tells them it is `RefreshTokenResponse | undefined`. This is a type lie at the HTTP boundary: the declared type and the runtime value disagree for the error path. | The error-path second argument should be typed as the response container, not the response body. Options: (a) change the declared callback to `(err: QuickBooksError | null, data?: RefreshTokenResponse, res?: AxiosResponse) => void` and accept the axios type dep; (b) change `refreshAccessToken` to accept `(err: QuickBooksError | null, response?: RefreshTokenResponse | unknown, raw?: unknown) => void` which is honest about the error path; (c) keep the current signature but fix the runtime to pass `refreshResponse` (not `err.response`) on the error path (but that changes observable behavior — see plan Assumptions). The cleanest fix for Phase 3 is approach (b): widen the second parameter type to `RefreshTokenResponse | unknown` so the declared type is never a lie. |
| typescript-cop-r1-f3 | Medium | Open | PublicTypes | `index.d.ts:508` (`upload`) | `stream: any` is the parameter for the file upload stream. This is a public boundary method whose parameter accepts any value without type checking. A caller passing a `Buffer`, a string, or `null` compiles without error. | Narrow to `import('stream').Readable | Buffer | string` (Node built-in, no extra dep) or `NodeJS.ReadableStream` if the tsconfig includes `@types/node`. Either is more precise than `any` and catches common mis-uses at compile time. Apply in Phase 3 when the `.d.ts` is being edited anyway. |
| typescript-cop-r1-f4 | Medium | Open | PublicTypes | `index.d.ts:1165` (`createTaxService`) | `taxService: any` makes the parameter completely untyped at a create-entity boundary. Unlike the entity types that deliberately use `[key: string]: any` escape hatches for forward-compatibility, this parameter has no type at all — passing a number or a string compiles silently. | Define a `TaxService` interface (even a minimal one with the required fields Intuit documents for tax service creation) or at minimum use `Record<string, unknown>` to require an object shape. Apply in Phase 3 alongside the other `.d.ts` edits. |
