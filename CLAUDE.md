# Sponsorable — working notes

## Decisions, not accidents — do not undo

- **Not a marketplace.** Single-player tool. No brand-side account, no two-sided liquidity problem. If a future session proposes "let brands sign up", that is a different product.
- **Domain layer is pure.** No `Date.now()`, no `Math.random()`, no I/O in `src/domain/*` (except `localModel.ts`, which is explicitly the I/O edge). Today's date is read once in `App.tsx` and passed down as a prop. Ids come from a monotonic `seq` counter in the store.
- **Every price carries its rationale.** `Adjustment.rationale` is a sentence the creator says out loud in a negotiation. Adding a factor without one defeats the point of the tool.
- **Benchmarks live in one file.** `src/domain/benchmarks.ts`. Never inline a CPM or multiplier at a call site.
- **Local-first, no telemetry.** Nothing is transmitted. Rates and prospect lists are commercially sensitive.
- **Production floor beats reach for small creators.** `PRODUCTION_FLOOR` in `benchmarks.ts` sets the least each format can sell for. Pure cost-per-impression pricing told a 900-view creator to charge £30 for a day of work, which is the worst thing this tool could do to the people who most need it. `priceLine` takes `max(mediaValue, productionFloor × termsFactor)` and reports both numbers. Do not remove the floor to "simplify" the engine.
- **Never show a CPM derived from a floored price.** Dividing a labour cost by a small audience yields £500 CPM, which ends a negotiation. The rate card hides it, the blended-CPM stat excludes floored lines, and `priceSentence` in `pitch.ts` writes a different sentence. Tests lock all three.

## Gotchas already resolved — do not regress

- `tsconfig` runs `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Optional props are spread conditionally (`{...(hint ? { hint } : {})}`) rather than passed as `undefined`. Array indexing needs a guard.
- Heredocs in this repo choke on the pricing/component files. Use the Write tool for anything with template literals and nested quotes.
- Vitest runs `.test.ts` in node and `.test.tsx` in jsdom via `environmentMatchGlobs`. Component tests must stub `fetch` (the Ollama probe) and `window.print`.
- `updateChannel` resets `formats` when the platform changes. That is deliberate: a YouTube format list on a TikTok channel prices nonsense.
- The play test (`node scripts/playtest.mjs`) drives the installed Chrome via `channel: 'chrome'`, because the bundled Playwright build does not match the browsers on this machine. Do not swap it back to `chromium.launch()` without running `npx playwright install`.
- Channel cards and proof points both render a button labelled "Remove". Any selector for one must exclude the other.

## Calibration

`src/domain/calibration.test.ts` runs nine realistic creator archetypes end to end and asserts each headline price lands in a range a working creator would recognise. It is the guard against a benchmark edit quietly turning a £400 placement into a £40 one. Run `npx vitest run calibration --reporter=verbose` to read the table. The lower bound of each range is a walk-away number, not a target.

## Known gap

Prospect *discovery* is not solved and is not pretended to be. Scoring ranks a list the creator assembles by hand. A real sponsor database is the expensive part and would need a backend, which would break the local-first promise. Decide that trade deliberately before building it.
