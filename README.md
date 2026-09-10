# Sponsorable

**Work out what to charge a sponsor, prove the audience, send the pitch, track the pipeline. Entirely on your own machine.**

Most creators price sponsorship by guessing, or by repeating a number someone said on a podcast. Then a brand asks why, and the number falls apart. Sponsorable derives a price you can defend line by line, and hands you the sentence to say when you are asked to justify it.

MIT licensed. No account, no server, no telemetry. Built for a creator who runs their own tools on a small budget: one install, and everything stays on your machine.

---

## What it does

**Derives a defensible price.** A rate card built from median views, engagement measured against the platform norm, audience geography, category demand, and the commercial terms actually on the table. Open any line and the full derivation expands, each factor carrying a sentence you can say out loud. A number you cannot explain is a number you will be talked out of.

**Refuses to price your labour like an impression.** A dedicated video takes a day and a half whoever makes it. Cost-per-impression pricing alone tells a creator with a small audience to do that for thirty pounds. Every format carries a production floor derived from the hours it costs, and the price is the greater of the two. When the floor binds, the interface says so and shows both numbers.

**Prices the terms, not just the placement.** Most creators quote one figure for a video and hand over usage rights and category exclusivity for nothing. Those are separate things a sponsor is buying. A full buyout costs nearly twice organic-only here, because it is a media licence rather than a post.

**Builds a media kit that survives scrutiny.** It leads with impressions per placement rather than summed follower counts, because summing followers across five platforms counts the same person five times and every experienced sponsor knows it. It also lists the problems a sponsor will notice, so you name them first.

**Ranks prospects.** A 0 to 100 fit score over category adjacency, market overlap, budget against your walk-away price, and whether the brand has ever paid a creator at all. Every component reports its reasoning, so a low score can be argued with. Triage, not prophecy.

**Writes the pitch and the follow-ups.** Composed from your own numbers: name the product, show delivered attention, state a price, ask one question, under 150 words. Follow-ups at days 4, 11 and 25, with a next-action flag on every prospect.

**Keeps a deal log.** Every outcome, won or lost, is recorded against the price the card quoted, with the audience and terms frozen as they stood. It tells you whether you are being negotiated down, and whether the fit score predicts anything for you. If you choose to, one button opens the project's rate-data form with the deal filled in, rounded so it cannot identify you. Lost deals count too: they are the half of the market no rate survey ever sees.

**Seals what you deliver, if you ask it to.** A sponsor who keeps your whitelisted ad running on day 90 has bought the ninety-day licence at the thirty-day price. `sponsorable seal` watermarks the file before delivery, signs a licence receipt, and has it timestamped. If the ad later turns up in a public ad library, `sponsorable verify` checks it, and the app prices the overrun as the tier the sponsor actually used. It is opt-in per deal, and it cannot be applied after delivery: the evidence, not the app, enforces that. [docs/provenance.md](docs/provenance.md) explains how, and what it cannot do.

---

## The interesting problem is not the code

The application is a few thousand lines of TypeScript. Anyone could write it.

The hard part sits in one file: [`src/domain/benchmarks.ts`](src/domain/benchmarks.ts). It holds every market assumption the tool makes — cost-per-thousand bands for each platform and format, category multipliers, geography weights, platform-median engagement rates, production floors, and the uplifts for exclusivity and usage rights.

Those numbers are seeded from publicly circulated creator rates for 2025 and 2026. They are not audited market data, and the app says so on the rate card rather than presenting a guess as a quote.

**This is where contributions matter most.** If you have been paid for a placement, you know something the table does not. A single real data point — platform, format, audience size, category, what you were actually paid, and what rights the sponsor got — is worth more to this project than a refactor. Rates also drift, so a table that is right today is wrong in eighteen months without people correcting it.

The guard against bad edits is [`src/domain/calibration.test.ts`](src/domain/calibration.test.ts), which runs nine realistic creator archetypes end to end and asserts each headline price lands somewhere a working creator would recognise. Change a band, run the sweep, and see what moved:

```
npx vitest run calibration --reporter=verbose

Nano tech YouTuber            YouTube Dedicated video      900 views     £450     on time  ok
Micro tech YouTuber           YouTube 60–90s integration 8,000 views     £200     on time  ok
Mid-size finance YouTuber     YouTube Dedicated video   60,000 views   £2,650  £44.17 CPM  ok
Large entertainment YouTuber  YouTube 60–90s integration  400,000 views £4,200  £10.50 CPM  ok
...
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to submit a rate, and what the project will and will not accept.

---

## Two design decisions worth arguing with

**It is not a marketplace.** There is nobody on the other side. Two-sided creator-and-brand marketplaces die on cold-start liquidity and need a sales team to survive, which makes them the wrong shape for software you can run locally. This is the tool you use alone, before and during a negotiation. If that is the wrong call, the argument is worth having in an issue.

**The domain layer is pure by construction.** No clock, no randomness, no I/O anywhere in `src/domain`. The same profile always produces the same rate card, which is a property the tests assert directly. This is not fastidiousness. A pricing tool that returns a different number on Tuesday is a pricing tool nobody can defend in a negotiation.

---

## What this project declines to do

**Scrape platform APIs for your stats.** You type in your median views. Automating it means OAuth, a backend, stored tokens and a privacy surface, in exchange for saving four numbers of typing.

**Find prospects for you.** The scoring ranks a list you assemble by hand and will not build that list. Doing it properly needs a maintained database of who sponsors whom, which is the genuinely expensive part of this problem and cannot live in a static page. Until that exists, the prospects tab is an organised research habit with a scoring function attached. This is the project's honest limitation, and it is written into the code comments as well as here.

**Send email on your behalf.** It composes the draft and copies it to your clipboard. Deliverability, warm-up and reputation are a business, not a feature.

**Call a paid language model.** The pitch composer is deterministic and complete without any model. If Ollama is running locally, the outreach tab offers to tighten the wording, with instructions to preserve every number and invent nothing. That is optional and stays on your machine.

**Track you.** No analytics, no error reporting, no account. Your unreleased rates and prospect list are commercially sensitive, and the simplest way to keep them private is never to transmit them. Export and import are a JSON file you control. The single exception is sealing, which you choose deal by deal: it sends one salted hash to a public timestamp authority, and tells you before it does.

**Treat a missing watermark as evidence.** Watermarks can be stripped, and the one Sponsorable uses ships with a removal model. A mark that decodes is evidence; a mark that does not proves nothing, and the tool never says otherwise.

---

## Running it

Sponsorable is not on PyPI yet. From a checkout, with Node 20+ and Python 3.10+:

```bash
npm install
npm run bundle                 # build the app into the Python package
pipx install .                 # the app and the CLI, without the watermark
pipx install --force ".[seal]" # or with it: adds PyTorch, several hundred MB

sponsorable                    # serves the app at http://127.0.0.1:5180
sponsorable key                # the fingerprint to write into your contracts
sponsorable setup              # fetch the watermark model once, ahead of time
sponsorable seal dl-104 reel.png --source capture --workspace sponsorable.json
sponsorable verify ad.jpg --started 2026-10-01 --workspace sponsorable.json
```

The server binds to 127.0.0.1 only. Serving from your own machine also means the optional Ollama integration talks to Ollama on the same machine, with no cross-origin configuration.

For development:

```bash
npm run dev        # http://localhost:5180
npm test           # 99 tests, including the calibration sweep
npm run typecheck
python -m pytest   # 32 tests: receipts, timestamps, seal and verify end to end

node scripts/playtest.mjs   # drives real Chrome, screenshots every tab,
                            # checks overflow, tap targets and broken numbers
python scripts/survival.py --corpus DIR   # how the watermark survives re-encoding
```

The play test uses the Chrome already installed on your machine rather than downloading a browser.

---

## Shape

```
src/domain/      pure functions: no clock, no randomness, no I/O
  types.ts         the vocabulary
  benchmarks.ts    every market assumption, in one editable place
  pricing.ts       rate derivation, with a rationale per factor
  mediakit.ts      derived audience facts and credibility warnings
  scoring.ts       prospect fit
  pitch.ts         email composition and follow-up cadence
  deals.ts         deal log, personal calibration, rate submission, overrun pricing
  workspace.ts     versioned file format; validates every import and old save
  localModel.ts    optional Ollama sharpening, fails quietly
  *.test.ts        property tests plus the calibration sweep
src/store/       zustand and immer, persisted to localStorage
src/components/  one view per tab
python/          the `sponsorable` CLI: serve, seal, verify
  receipt.py       pure: the receipt, its commitment, and the rules a claim must pass
docs/            provenance design
scripts/         browser play test, watermark survival test
```

React 18, TypeScript in strict mode, Vite, vitest, zustand. No CSS framework and no component library, so there is nothing to learn before changing something.

---

## Licence

MIT. See [LICENSE](LICENSE).

If this helps you land a sponsorship, the project would like to know what you were paid and what the table got wrong. That is the whole contribution loop.
