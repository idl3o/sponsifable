# Sponsorable — working notes

## Decisions, not accidents — do not undo

- **Not a marketplace.** Single-player tool. No brand-side account, no two-sided liquidity problem. If a future session proposes "let brands sign up", that is a different product.
- **Domain layer is pure.** No `Date.now()`, no `Math.random()`, no I/O in `src/domain/*` (except `localModel.ts`, which is explicitly the I/O edge). Today's date is read once in `App.tsx` and passed down as a prop. Ids come from a monotonic `seq` counter in the store.
- **Every price carries its rationale.** `Adjustment.rationale` is a sentence the creator says out loud in a negotiation. Adding a factor without one defeats the point of the tool.
- **Benchmarks live in one file.** `src/domain/benchmarks.ts`. Never inline a CPM or multiplier at a call site.
- **Local-first, no telemetry.** Nothing is transmitted. Rates and prospect lists are commercially sensitive.

## Gotchas already resolved — do not regress

- `tsconfig` runs `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Optional props are spread conditionally (`{...(hint ? { hint } : {})}`) rather than passed as `undefined`. Array indexing needs a guard.
- Heredocs in this repo choke on the pricing/component files. Use the Write tool for anything with template literals and nested quotes.
- Vitest runs `.test.ts` in node and `.test.tsx` in jsdom via `environmentMatchGlobs`. Component tests must stub `fetch` (the Ollama probe) and `window.print`.
- `updateChannel` resets `formats` when the platform changes. That is deliberate: a YouTube format list on a TikTok channel prices nonsense.

## Known gap

Prospect *discovery* is not solved and is not pretended to be. Scoring ranks a list the creator assembles by hand. A real sponsor database is the expensive part and would need a backend, which would break the local-first promise. Decide that trade deliberately before building it.
