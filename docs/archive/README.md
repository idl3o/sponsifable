# Archive

Papers about this project's ideas, kept as dated records. Each is a Markdown file, and the file is the source of truth.

| Date | Paper | Status |
|---|---|---|
| September 2026 | [The Defensible Number](2026-09-the-defensible-number.md): pricing, proving and settling a creator sponsorship on one machine | Working draft |

## Conventions

- **One file per paper,** named `YYYY-MM-slug.md`. It opens with the title, an italic subtitle and a byline that states its status, and closes with a colophon after a final `---`.
- **A draft may change. A published paper does not.** Once a paper is marked published, later corrections go in a dated errata note at its end, and a changed argument becomes a new paper.
- **The register is the absent narrator.** Declaratives over rhetorical questions, British English, every figure cited and marked asking or paid where it is a price.
- **Every paper carries a "What Is Declined" section.**
- **No claim of novelty survives without a prior-art search,** and the related work says what was searched.
- **Titles name the idea, not the product.** The project's name is under review.

## Rendering a page

```bash
pip install -e ".[dev]"     # brings the markdown package
python scripts/archive/render.py docs/archive/2026-09-the-defensible-number.md
```

The page lands in `dist/archive/`, which is not committed. Edit the Markdown and render again. Never edit the page. A paragraph holding only `[[figure-name]]` is replaced by a figure that `scripts/archive/render.py` draws.
