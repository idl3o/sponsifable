# Sponsorable

Price it, prove it, pitch it. A local-first tool for creators who want sponsorship money and have no idea what to charge.

It is not a marketplace. Nobody is on the other side of it. It is the thing a creator uses alone, before and during a negotiation, to stop leaving money on the table.

## What it does

**Derives a defensible price.** A rate card built from median views, engagement against the platform norm, audience geography, category demand, and the commercial terms actually on offer. Every price expands into the full derivation, with a sentence attached to each factor that the creator can say out loud when a sponsor asks why. A number you cannot explain is a number you will be talked out of.

**Prices the terms, not just the placement.** Most creators quote one figure for a video and hand over usage rights and category exclusivity for nothing. Those are separate things a sponsor is buying. A full buyout is priced at nearly twice organic-only, because it is a media licence rather than a post.

**Builds a media kit that survives scrutiny.** Leading with impressions per placement rather than summed follower counts, because summing followers across five platforms counts the same person five times and every experienced sponsor knows it. The kit also lists the problems a sponsor will spot, so the creator names them first.

**Ranks prospects.** A 0 to 100 fit score over category adjacency, market overlap, budget alignment against the walk-away price, and whether the brand has ever paid a creator at all. Each component reports its reasoning so a low score can be argued with. The point is triage, not prophecy.

**Writes the pitch and the follow-ups.** Deterministic composition from the creator's own numbers: name the product, show delivered attention, state a price, ask one question, under 150 words. A follow-up cadence at days 4, 11 and 25, with a next-action flag per prospect.

## Local-first

Nothing leaves the browser. No account, no server, no analytics. A creator's unreleased rates and prospect list are commercially sensitive, and the simplest way to keep them private is never to transmit them. Export and import are a JSON file.

If Ollama is running on the machine, the outreach tab offers to tighten the draft's wording with a local model, instructed to preserve every number and invent nothing. The deterministic draft is complete without it.

## Running it

```
npm install
npm run dev        # http://localhost:5180
npm test           # 53 tests
npm run typecheck
npm run build
```

## Where the numbers come from

`src/domain/benchmarks.ts` holds every market assumption in one file: CPM bands per platform and format, category multipliers, geography weights, platform-median engagement rates, and the uplifts for exclusivity and usage rights. They are seeded from publicly circulated creator rates for 2025 and 2026, in GBP.

They are not audited market data, and the app never pretends otherwise. The value is that the derivation is explicit rather than a guess dressed as a quote: change a band in that file and every price downstream moves for a stated reason. When a sponsor says the number is wrong, ask what they paid last time and edit the band, rather than discounting the whole card.

## The honest limitation

Pricing, media kit and pitch composition all work from data the creator already has. Prospect discovery does not. The app will rank a list of brands well and will not find them for you, because doing that properly needs a maintained database of who sponsors whom, which is the expensive part of this problem and cannot be shipped as a static page. Until that exists, the prospects tab is a well-organised manual research habit with a scoring function attached.

## Shape

```
src/domain/      pure functions, no clock, no randomness, no I/O
  types.ts       the vocabulary
  benchmarks.ts  every market assumption, in one editable place
  pricing.ts     rate derivation with per-factor rationale
  mediakit.ts    derived audience facts and credibility warnings
  scoring.ts     prospect fit
  pitch.ts       email composition and follow-up cadence
  localModel.ts  optional Ollama sharpening, fails quietly
src/store/       zustand and immer, persisted to localStorage
src/components/  one view per tab
```

The domain layer is deterministic by construction: same profile in, same rate card out, every time. That is a testable property and the tests assert it.
