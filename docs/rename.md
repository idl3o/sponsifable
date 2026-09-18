# The name

The project was renamed from **Sponsorable** to **Sponsifable** on 18 September 2026, identifiers included. This note records what moved, what deliberately did not, and what earlier candidates were rejected for, so the next naming attempt starts from the prior-art check rather than repeating it.

## Why it was done all at once

Every migration below was a no-op on the day. Nothing had been published to PyPI, no receipt had been signed under the SSHSIG namespace, no C2PA manifest had been embedded outside tests, and no `~/.sponsorable` directory existed on the author's machine. A rename later would have cost a compatibility path for each identifier; a rename then cost a search and replace. That window is now closed: from the first release, each line below becomes a migration with users on the other side of it.

## What moved

**Prose** goes through one constant on each side, so the next rename touches one line:

- `src/brand.ts`: `PRODUCT`, `TAGLINE`.
- `python/sponsifable/brand.py`: `PRODUCT`.

**Identifiers**, all changed together:

| Identifier | Was | Now | Where |
|---|---|---|---|
| PyPI distribution and the command | `sponsorable` | `sponsifable` | `pyproject.toml` |
| Python package directory | `python/sponsorable/` | `python/sponsifable/` | the whole tree |
| SSHSIG namespace | `sponsorable-receipt` | `sponsifable-receipt` | `sshsig.py` |
| C2PA assertion label | `org.sponsorable.licence` | `org.sponsifable.licence` | `manifest.py` |
| C2PA claim generator | `sponsorable` | `sponsifable` | `manifest.py` |
| Home directory and its override | `~/.sponsorable`, `SPONSORABLE_HOME` | `~/.sponsifable`, `SPONSIFABLE_HOME` | `ledger.py` |
| Browser save key | `sponsorable-v1` | `sponsifable-v1` | `useStore.ts` |
| Sync revision key | `sponsorable-sync-revision` | `sponsifable-sync-revision` | `sync.ts` |
| Export file name | `sponsorable.json` | `sponsifable.json` | `App.tsx` |
| npm package name | `sponsorable` | `sponsifable` | `package.json` |

## What deliberately did not move

- **The GitHub repository** is still `idl3o/sponsorable`, and every URL in the docs still points there. Renaming it is the author's to do; GitHub redirects both ways afterwards, so the links keep working either way. Update them when the repository moves, not before.
- **`docs/archive/2026-09-the-defensible-number.md`.** A published paper takes errata, not edits. Its only mention of the old name is the repository URL in its colophon, which is accurate as written.
- **The timestamp fixture's digest.** `python/tests/test_timestamp.py` hashes the literal bytes `sponsorable api probe`, because those are the bytes DigiCert signed in September 2026. A rename cannot change what a timestamp covers, and a test that pretended otherwise would be testing nothing.
- **A save written under the old browser key.** `adoptRenamedSave()` in `useStore.ts` copies a `sponsorable-v1` save to the new key once, and leaves the original where it is. A creator who had only ever run `npm run dev` kept their work in the browser and nowhere else; renaming the key without this would have stranded it. Remove it once no such browser can plausibly remain.

## Still to do

- **Rename the repository** on GitHub, then update the URLs in the docs and `package.json`.
- **Reserve `sponsifable`** on PyPI and TestPyPI before the first release, and set up trusted publishing for it (see `docs/RELEASING.md`).
- **Search the UK trademark register.** This has not been done for any candidate, and it is the check that matters legally.

## Names checked and rejected

**Sponsify**, checked 18 September 2026. Rejected: comprehensively taken in this exact market.

- An npm package exists under the name, and the GitHub account `sponsify` is taken.
- At least six live businesses trade as Sponsify in sponsorship or creator marketing: sponsify.io (sponsorship ROI), sponsify.ge (creator collaboration), sponsify.co (YouTube native advertising), sponsifyagency.com, sponsifyapp.com, and SponsifyMe, with LinkedIn and Crunchbase entries besides.

**Sponsoar**, checked 12 September 2026. Rejected: an active UK company in sponsorship services.

- [SPONSOAR LTD](https://find-and-update.company-information.service.gov.uk/company/14908657), Companies House 14908657, incorporated 1 June 2023, registered in Bristol, trading at sponsoar.co.uk as a sports sponsorship marketplace. An active UK trader under the same name in the same services is a passing-off exposure whether or not the mark is registered.
- A second sponsorship-management platform traded at sponsoar.app; the domain no longer resolves.
- Princeton's DataSpace holds a thesis titled *SponSoar: The Data-Driven Influencer Marketing Tool*.
- The GitHub organisation `Sponsoar` has existed since 2022.
- The name was free on PyPI, TestPyPI and npm, which was not enough.

## What Sponsifable was checked against

On 18 September 2026: free on PyPI, TestPyPI and npm; the GitHub account was free; Companies House returned no results; a web search found no company, product or trademark, only the archaic dictionary word *sponsible*; and sponsifable.com, .io, .co.uk and .app did not resolve.

**The known risk.** [Sponsara.ai](https://sponsara.ai/) sells "AI sponsorship intelligence" for YouTube influencers — the same services class, one letter and a stress pattern away. An examiner or an opponent would look at that pair. A professional search is worth commissioning before any application.

## How to check the next one

Companies House, the UK IPO register, PyPI, TestPyPI, npm, GitHub accounts and organisations, the obvious domains, and a plain web search for the same market. Record the result here whether it passes or fails.
