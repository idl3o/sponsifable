# Sponsorable — working notes

## Decisions, not accidents — do not undo

- **Not a marketplace.** Single-player tool. No brand-side account, no two-sided liquidity problem. If a future session proposes "let brands sign up", that is a different product.
- **Domain layer is pure.** No `Date.now()`, no `Math.random()`, no I/O in `src/domain/*` (except `localModel.ts`, which is explicitly the I/O edge). Today's date is read once in `App.tsx` and passed down as a prop. Ids come from a monotonic `seq` counter in the store.
- **Every price carries its rationale.** `Adjustment.rationale` is a sentence the creator says out loud in a negotiation. Adding a factor without one defeats the point of the tool.
- **Benchmarks live in one file.** `src/domain/benchmarks.ts`. Never inline a CPM or multiplier at a call site.
- **Local-first, no telemetry.** Nothing is transmitted. Rates and prospect lists are commercially sensitive.
- **Production floor beats reach for small creators.** `PRODUCTION_FLOOR` in `benchmarks.ts` sets the least each format can sell for. Pure cost-per-impression pricing told a 900-view creator to charge £30 for a day of work, which is the worst thing this tool could do to the people who most need it. `priceLine` takes `max(mediaValue, productionFloor × termsFactor)` and reports both numbers. Do not remove the floor to "simplify" the engine.
- **Never show a CPM derived from a floored price.** Dividing a labour cost by a small audience yields £500 CPM, which ends a negotiation. The rate card hides it, the blended-CPM stat excludes floored lines, and `priceSentence` in `pitch.ts` writes a different sentence. Tests lock all three.

- **The first audience is the low-budget, self-hosting, technical creator.** Tech, B2B and developer-tools creators, newsletter writers, maintainers with an audience. Distribution is one `pipx install` that serves the app on localhost and carries the `seal` CLI. Do not claim to serve UGC creators generally until the tool reaches people who will not open a terminal.

### Provenance (see `docs/provenance.md`)

- **Sealing is opt-in.** Only an explicit `sponsorable seal`, with a confirmation, watermarks anything. The web app never seals.
- **Sealing cannot be retroactive, and the evidence enforces it, not the app.** A claim needs the watermark in the ad itself, a timestamp earlier than the ad's start date, and a receipt the sponsor has held since delivery. The CLI's refusal to seal lost, delivered or already-sealed deals only catches mistakes. Never add a path that seals an existing file or backdates a record.
- **The watermark carries a serial, never the terms.** A payload under 100 bits allows a birthday search for alternative terms. The terms live in the signed receipt.
- **Sealing is the only network call that carries anything derived from the creator's data.** One salted SHA-256 digest goes to an RFC 3161 timestamp authority, opt-in per deal, and the confirmation says so first. The only other access is TrustMark's one-off model download (`sponsorable setup`), which sends nothing about the creator.
- **Seal each aspect ratio delivered.** The survival proxy shows model Q / BCH_SUPER survives compression, downscaling, crops, banners, grading and H.264, and fails on reframing a landscape to 4:5 or 9:16. Do not switch model or schema without rerunning `scripts/survival.py`.
- **The licence window is frozen on the deal** (`Deal.paidUsageDays`, null for unlimited). Python reads it from the deal; never copy `PAID_USAGE_DAYS` into Python.
- **`--source` is required on `seal`.** The tool cannot know how an asset was made, and C2PA's claim of creation states it. No default.
- **Disclosed, not covert.** The receipt tells the sponsor the file is marked.
- **A missing watermark proves nothing.** TrustMark ships a removal model. No copy may treat absence as evidence.
- **The CLI does not price.** `verify` reports facts. The overrun invoice is composed in TypeScript from `benchmarks.ts`, so market assumptions stay in one file.

## Gotchas already resolved — do not regress

- `tsconfig` runs `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Optional props are spread conditionally (`{...(hint ? { hint } : {})}`) rather than passed as `undefined`. Array indexing needs a guard.
- Heredocs in this repo choke on the pricing/component files. Use the Write tool for anything with template literals and nested quotes.
- Vitest runs `.test.ts` in node and `.test.tsx` in jsdom via `environmentMatchGlobs`. Component tests must stub `fetch` (the Ollama probe) and `window.print`.
- `updateChannel` resets `formats` when the platform changes. That is deliberate: a YouTube format list on a TikTok channel prices nonsense.
- The play test (`node scripts/playtest.mjs`) drives the installed Chrome via `channel: 'chrome'`, because the bundled Playwright build does not match the browsers on this machine. Do not swap it back to `chromium.launch()` without running `npx playwright install`.
- Channel cards and proof points both render a button labelled "Remove". Any selector for one must exclude the other.
- **Workspace format changes go through `src/domain/workspace.ts`.** Bump `WORKSPACE_VERSION`, teach `parseWorkspace` the old shape, and bump `SUPPORTED_VERSION` in `python/sponsorable/workspace.py`. The localStorage key stays `sponsorable-v1` on purpose; `persist.version` tracks the format. An unreadable save is copied to `sponsorable-unreadable-v<n>`, never dropped.
- **TrustMark decoding must stay strict** (`schema == BCH_SUPER and len == 40`). Its decoder auto-detects the schema, and 8 of 400 clean images passed as a weaker one.
- **TrustMark will not decode a pure-noise image.** Test covers must be structured; the survival script uses real frames or drawn shapes.
- **C2PA signs with ES256.** An Ed25519 chain signed but failed claim-signature validation. The C2PA leaf needs Subject and Authority Key Identifiers, and the first action must be `c2pa.created` with a `digitalSourceType`.
- **`pip install` needs `PYTHONUTF8=1` on this machine.** One dependency's `setup.py` reads a file as cp1252 and dies otherwise.
- **`npm run bundle` before building the wheel.** The web app is gitignored inside the package and is included only via hatch `artifacts`. A git install without it serves an error telling you so.
- `python -m pytest` needs the repo venv (`.venv`, created with `--system-site-packages` to reuse the installed torch). Tests fake the watermark and the timestamp authority; `python/tests/fixtures/digicert-probe.tsr` is a real token over SHA-256("sponsorable api probe") for offline token tests.

## Calibration

`src/domain/calibration.test.ts` runs nine realistic creator archetypes end to end and asserts each headline price lands in a range a working creator would recognise. It is the guard against a benchmark edit quietly turning a £400 placement into a £40 one. Run `npx vitest run calibration --reporter=verbose` to read the table. The lower bound of each range is a walk-away number, not a target.

## Known gap

Prospect *discovery* is not solved and is not pretended to be. Scoring ranks a list the creator assembles by hand. A real sponsor database is the expensive part and would need a backend, which would break the local-first promise. Decide that trade deliberately before building it.
