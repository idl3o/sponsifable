"""Render an archive paper from Markdown to a self-contained page.

    python scripts/archive/render.py docs/archive/2026-09-the-defensible-number.md

Writes `dist/archive/<name>.html`. The Markdown is the source of truth: edit
it and render again, never the page. Needs the `markdown` package, which the
`dev` extra installs.

A paper opens with three lines: `# Title`, an italic subtitle, and a byline.
It closes with a colophon after a final `---`. A paragraph holding only
`[[figure-name]]` is replaced by that figure from FIGURES below.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import markdown

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
EYEBROW = "Working paper · creator sponsorship · local-first"

SEAL = """<svg class="seal" viewBox="0 0 120 120" role="img" aria-label="Seal: H¹ = 0">
  <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" stroke-width="0.75" stroke-dasharray="2 3"/>
  <text x="60" y="68" text-anchor="middle" fill="currentColor" font-family="Cinzel, 'Times New Roman', serif" font-size="24">H¹ = 0</text>
</svg>"""

# Figure 1's plot box, shared with the page's hover script: width, height and margins.
W, H, L, R, T, B = 720, 360, 60, 28, 22, 46
PW, PH = W - L - R, H - T - B


def _x(views: float) -> float:
    return L + views / 30000 * PW


def _y(pounds: float) -> float:
    return T + (1 - pounds / 1200) * PH


def _axes() -> str:
    """Gridlines, ticks and labels for the floor figure."""
    ys = "".join(
        f'<line x1="{L}" y1="{_y(p):.1f}" x2="{L + PW}" y2="{_y(p):.1f}" class="grid"/>'
        f'<text x="{L - 10}" y="{_y(p) + 4:.1f}" class="axis-label" text-anchor="end">£{p:,}</text>'
        for p in range(0, 1201, 300)
    )
    xs = "".join(
        f'<line x1="{_x(v):.1f}" y1="{T + PH}" x2="{_x(v):.1f}" y2="{T + PH + 5}" class="tick"/>'
        f'<text x="{_x(v):.1f}" y="{T + PH + 20}" class="axis-label" text-anchor="middle">{v // 1000}k</text>'
        for v in range(0, 30001, 5000)
    )
    return (f'{ys}<line x1="{L}" y1="{T + PH}" x2="{L + PW}" y2="{T + PH}" class="axis"/>{xs}'
            f'<text x="{L + PW}" y="{H - 4}" class="axis-title" text-anchor="end">median views</text>')


def _floor_marks() -> str:
    """The floor, reach and price lines, with their markers and labels."""
    cross, floor = _x(11250), _y(450)
    return f"""
      <line x1="{L}" y1="{floor:.1f}" x2="{L + PW}" y2="{floor:.1f}" class="series-floor"/>
      <line x1="{_x(0):.1f}" y1="{_y(0):.1f}" x2="{_x(30000):.1f}" y2="{_y(1200):.1f}" class="series-reach"/>
      <polyline points="{_x(0):.1f},{floor:.1f} {cross:.1f},{floor:.1f} {_x(30000):.1f},{_y(1200):.1f}" class="series-price"/>
      <circle cx="{cross:.1f}" cy="{floor:.1f}" r="5" class="marker"/>
      <text x="{cross + 10:.1f}" y="{floor + 20:.1f}" class="annot">11,250 views: the audience takes over</text>
      <circle cx="{_x(900):.1f}" cy="{_y(36):.1f}" r="4.5" class="marker-reach"/>
      <text x="{_x(900) + 30:.1f}" y="{_y(0) - 6:.1f}" class="annot">900 views: £36 by reach alone</text>
      <text x="{L + PW}" y="{floor - 8:.1f}" class="direct" text-anchor="end">floor £450</text>
      <text x="{_x(26500):.1f}" y="{_y(1060) - 12:.1f}" class="direct" text-anchor="end">price follows reach</text>"""


def figure_floor() -> str:
    """Figure 1: price against median views, where the production floor gives way to reach."""
    return f"""
<figure class="chart" id="figure-floor">
  <div class="legend" aria-hidden="true">
    <span><i class="key key-price"></i>Price</span>
    <span><i class="key key-reach"></i>Reach alone</span>
    <span><i class="key key-floor"></i>Production floor</span>
  </div>
  <div class="chart-box">
    <svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="fig1-title" preserveAspectRatio="xMidYMid meet">
      <title id="fig1-title">Price against median views for a dedicated YouTube video: the production floor of £450 sets the price until about 11,250 views, after which reach alone does.</title>
      {_axes()}{_floor_marks()}
      <line id="hover-line" x1="0" y1="{T}" x2="0" y2="{T + PH}" class="hover-line" visibility="hidden"/>
      <rect id="hover-hit" x="{L}" y="{T}" width="{PW}" height="{PH}" fill="transparent"/>
    </svg>
    <div class="tip" id="tip" hidden></div>
  </div>
</figure>"""


FIGURES = {"figure-floor": figure_floor}


def body_html(body: str) -> tuple[str, str]:
    """The article body as HTML, and the contents list built from its numbered sections."""
    html = markdown.markdown(body, extensions=["tables", "toc"], extension_configs={"toc": {"permalink": False}})
    html = re.sub(r'<h2 id="([^"]+)">(\d+)\. (.+?)</h2>',
                  r'<h2 id="\1"><span class="num" aria-hidden="true">\2</span><span class="sr">\2. </span>\3</h2>', html)
    sections = re.findall(
        r'<h2 id="([^"]+)">(?:<span class="num" aria-hidden="true">(\d+)</span><span class="sr">\d+\. </span>)?(.+?)</h2>',
        html)
    toc = "\n".join(f'<li><a href="#{i}"><span class="toc-n">{n or "·"}</span>{t}</a></li>'
                    for i, n, t in sections if i != "abstract")
    html = html.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
    html = html.replace("<pre><code>", '<pre class="formula"><code>')
    for name, draw in FIGURES.items():
        html = html.replace(f"<p>[[{name}]]</p>", draw())
    return html, toc


def render(source: Path) -> str:
    """The finished page for one paper."""
    text = source.read_text(encoding="utf-8")
    head, body = text.split("## Abstract", 1)
    body, colophon = ("## Abstract" + body).rsplit("\n---\n", 1)
    title, subtitle, byline = [line.strip() for line in head.strip().splitlines() if line.strip()][:3]
    html, toc = body_html(body)
    fields = {
        "TITLE": title.lstrip("# ").strip(), "SUBTITLE": subtitle.strip("*"), "BYLINE": byline,
        "EYEBROW": EYEBROW, "TOC": toc, "BODY": html, "COLOPHON": markdown.markdown(colophon.strip()),
        "SEAL": SEAL, "PLOT": f"{L},{T},{PW},{PH},{W},{H}",
    }
    page = (HERE / "template.html").read_text(encoding="utf-8")
    for key, value in fields.items():
        page = page.replace("{{" + key + "}}", value)
    return page


def main(argv: list[str]) -> int:
    """Render each paper named on the command line into dist/archive/."""
    if not argv:
        print(__doc__, file=sys.stderr)
        return 1
    out_dir = ROOT / "dist" / "archive"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in argv:
        source = Path(name)
        out = out_dir / f"{source.stem}.html"
        out.write_text(render(source), encoding="utf-8")
        print(f"Rendered {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
