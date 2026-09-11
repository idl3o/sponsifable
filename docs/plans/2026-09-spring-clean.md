# Spring clean, September 2026

The groundwork before the pivot to an OBS tool. The work here holds whatever shape that tool takes. Anything the pivot will reshape is listed at the end and left alone.

Branch: `chore/spring-clean`, cut from `main` at 050a7cb. Nothing is pushed until Sam says so.

## Starting state (2026-09-11)

- 114 TypeScript tests and 43 Python tests pass, and the typecheck is clean.
- Tests run only in the release workflow. Nothing checks a push.
- The production dependencies have no known vulnerabilities. The dev toolchain has five: Vite ≤ 6.4.2, esbuild ≤ 0.24.2 and Vitest ≤ 4.1.10, one of them critical. Two matter on this machine: a Vite path that can disclose Windows NTLM hashes, and a Vitest UI server that can read any file.
- 17 TypeScript functions exceed the house limit of 50 lines, mostly React views. No module exceeds 500 lines, and no Python function exceeds 50.
- 17 exported TypeScript symbols have no JSDoc, and several public Python helpers have no docstring.
- The Lightning sandbox and the whitepaper were uncommitted.

## Phases

Each phase is its own commit. The test suites and the typecheck pass after every one.

1. **Park the sandbox.** Commit the Lightning work on `sandbox/lightning` and remove its worktree folder. The branch keeps every file. *Done: 702b9a1.*
2. **Archive library.** Create `docs/archive/` with an index and its conventions. The whitepaper becomes its first entry. The script that renders a paper to a page moves into `scripts/`, so the page can be rebuilt from the Markdown.
3. **Toolchain security.** Move to Vite 7.3, Vitest 4.1.11 and plugin-react 5, the smallest upgrade that clears every advisory. Vitest 4 no longer has `environmentMatchGlobs`, so the node and jsdom split becomes two test projects. The audit must come back clean.
4. **CI on push.** Add a workflow that runs the typecheck, the vitest suite and pytest on every push and pull request. Pytest runs without the `seal` extra, so PyTorch is never installed in CI.
5. **House rules.** Split every function over 50 lines into named parts, without changing behaviour. The store's action object is split by concern. Add JSDoc to every exported symbol and docstrings to public Python functions.
6. **Lint.** Add an ESLint flat config, the house default, with the recommended typescript-eslint rules and the React hooks rules. Fix what it finds and run it in CI.
7. **Truth pass.** Bring the README, CONTRIBUTING, RELEASING and CLAUDE.md into line with the code: test counts, the Vitest gotcha, the archive. Record the OBS pivot in CLAUDE.md as a dated decision. The README says nothing about the OBS tool until something ships.
8. **Local tidy.** Delete ignored build output and caches: `dist/`, `python/dist/`, `__pycache__/` and `.pytest_cache/`. All of it regenerates. Keep `.venv` and `node_modules`.

## Deliberately out of scope

- **Framework majors.** React 19, zustand 5, immer 11 and TypeScript 7 would each change behaviour or tooling. None is a security fix. Take them with the restructure, when the UI is changing anyway.
- **The pivot's restructure.** The engine as a package, the workspace file as the source of truth, the OBS WebSocket log and the rename come next, on their own branch.
- **Unused-looking domain exports.** Types and functions exported from `src/domain` are the engine's public interface, so they stay exported even where only one file uses them today.

## Check before merging

```bash
npm run typecheck && npm run lint && npm test
python -m pytest
npm audit
node scripts/playtest.mjs   # against `npm run dev`
```
