# The name

The project is called Sponsorable while its name is under review. This note keeps what a rename has to touch, and what earlier attempts found, so the next attempt starts from the prior-art check rather than repeating it.

## Where the name lives

**Prose a person reads** goes through one constant on each side, and changes in one line:

- `src/brand.ts`: `PRODUCT` and `TAGLINE`, for the app's header, the deal-log notes and the refusal of a newer file.
- `python/sponsorable/brand.py`: `PRODUCT`, for the server's banner and the names on the local C2PA certificates.

**Also prose, but outside the constants:** `index.html`'s `<title>`, the README, the docs, the CLI's help text, and this repository's name on GitHub. GitHub redirects a renamed repository, but links in published papers should be updated anyway.

**Identifiers** keep their spelling until the rename is decided, because files and other people's tools already depend on them. Each needs its own migration:

| Identifier | Where | What changing it breaks |
|---|---|---|
| `sponsorable` on PyPI and as the command | `pyproject.toml` | Every install and every instruction that names the command. Publish the new name, and leave the old one as a stub that depends on it. |
| `sponsorable-receipt`, the SSHSIG namespace | `python/sponsorable/sshsig.py` | Verification of every receipt already issued: a sponsor's `ssh-keygen -Y verify -n` must name the namespace it was signed under. Verify under both. |
| `org.sponsorable.licence`, the C2PA assertion label | `python/sponsorable/manifest.py` | Reading the licence from manifests already embedded. Read both labels. |
| `sponsorable` as the C2PA claim generator | `python/sponsorable/manifest.py` | Nothing technical. It is what inspectors display. |
| `SPONSORABLE_HOME` and `~/.sponsorable` | `python/sponsorable/ledger.py` | The ledger, the keys and the workspace file. Read the old directory when the new one is absent. |
| `sponsorable-v1`, the localStorage key | `src/store/useStore.ts` | The browser cache. The workspace file is the source of truth, so a new key costs only the cache. |
| `sponsorable.json`, the export's file name | `src/App.tsx` | Nothing; the CLI takes any path. |

## Names already taken

**Sponsoar**, checked 2026-09-12:

- [SPONSOAR LTD](https://find-and-update.company-information.service.gov.uk/company/14908657), Companies House 14908657, is an active private company incorporated on 1 June 2023 and registered in Bristol. It trades at [sponsoar.co.uk](https://sponsoar.co.uk/) as a sports sponsorship platform that matches businesses with teams and athletes. An active UK trader in sponsorship services, under the same name, is a passing-off exposure whether or not the mark is registered.
- A sponsorship management platform traded as Sponsoar at sponsoar.app. The domain no longer resolves.
- Princeton University's DataSpace holds a thesis titled *SponSoar: The Data-Driven Influencer Marketing Tool*.
- The GitHub organisation `Sponsoar` exists, created in 2022, with no public repositories.
- The name was free on PyPI, TestPyPI and npm.

The UK trademark register was not searched. Any candidate should be checked there, at Companies House, on PyPI, npm and GitHub, and by a web search for the same market, before it is adopted.
