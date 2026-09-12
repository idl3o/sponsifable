import { VERTICAL_UI_ZONES, referenceScale, type Aspect, type BoardLayout, type BoardText, type Box } from './board';
import type { BoardSpec } from './types';

/**
 * What the board editor checks before a preview goes out. Pure.
 *
 * Each check is something the tool can actually measure. An uploaded image
 * is the exception, and the check says so rather than pretending to judge it.
 */

export interface BoardCheck {
  id: string;
  tone: 'good' | 'warn' | 'bad';
  label: string;
  note: string;
}

/** A currency sign, or a number with a currency or thousands unit after it. */
const PRICE = /[£$€¥]|\b\d+(?:[.,]\d+)?\s?(?:gbp|usd|eur|k|sats?)\b/i;

/** Link shorteners: their redirects can lapse, and they count the clicks. */
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'is.gd', 'shorturl.at', 'tiny.cc', 'rb.gy'];

/** The board's backing colour, near enough, for contrast checks. */
const BOARD_BACKING = '#0b0d11';

/** Below this many pixels per module, a QR code on a recompressed preview stops scanning reliably. */
const MIN_PX_PER_MODULE = 3;

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function inside(box: Box, width: number, height: number): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.w <= width && box.y + box.h <= height;
}

/** Relative luminance of a #rrggbb colour, per WCAG 2. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two #rrggbb colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function priceCheck(spec: BoardSpec, text: BoardText): BoardCheck {
  const priced = [text.handle, text.cta, text.monogram, spec.linkBase].some((t) => PRICE.test(t));
  return priced
    ? { id: 'price', tone: 'bad', label: 'A price in the pixels', note: "Take it out. Prices change and pixels don't; the link shows the current price." }
    : { id: 'price', tone: 'good', label: 'No price in the pixels', note: "Prices change and pixels don't. The link shows the current price." };
}

function verticalCheck(layout: BoardLayout): BoardCheck {
  const s = referenceScale('vertical');
  const board = { x: layout.board.x * s, y: layout.board.y * s, w: layout.board.w * s, h: layout.board.h * s };
  return VERTICAL_UI_ZONES.some((zone) => overlaps(board, zone))
    ? { id: 'vertical', tone: 'bad', label: "Under the app's UI in 9:16", note: 'TikTok, Reels and Shorts draw their own buttons and captions there. Move the board up.' }
    : { id: 'vertical', tone: 'good', label: 'Clear of vertical app UI', note: 'The 9:16 board sits outside the caption, button and top-bar areas.' };
}

function fitCheck(layouts: Record<Aspect, BoardLayout>): BoardCheck | null {
  const off = (Object.values(layouts) as BoardLayout[]).some((l) => !inside(l.board, l.width, l.height));
  return off ? { id: 'fit', tone: 'bad', label: 'Runs off the frame', note: 'Shorten the handle or the link, or choose another position.' } : null;
}

function domainCheck(spec: BoardSpec): BoardCheck {
  const base = spec.linkBase.trim().replace(/^https?:\/\//i, '');
  const host = base.split('/')[0]?.toLowerCase() ?? '';
  if (!base) return { id: 'domain', tone: 'warn', label: 'No link yet', note: 'Add the address your listings live at, on a domain you own.' };
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) {
    return { id: 'domain', tone: 'bad', label: 'Not an address', note: 'Write it as a domain and path, such as yoursite.com/m/.' };
  }
  if (SHORTENERS.includes(host)) {
    return { id: 'domain', tone: 'bad', label: 'A link shortener', note: "Use your own domain. A shortener's redirect can lapse, and it counts the clicks." };
  }
  return { id: 'domain', tone: 'good', label: 'Your own domain', note: 'Baked into the pixels, so keep it alive as long as the previews circulate.' };
}

function qrCheck(layouts: Record<Aspect, BoardLayout>, modules: number | null): BoardCheck | null {
  const sizes = (Object.values(layouts) as BoardLayout[]).flatMap((l) => (l.qr ? [l.qr.w] : []));
  if (modules === null || sizes.length === 0) return null;
  const perModule = Math.min(...sizes) / (modules + 8);
  return perModule >= MIN_PX_PER_MODULE
    ? { id: 'qr', tone: 'good', label: 'QR code scans', note: `${perModule.toFixed(1)} px a module on the exported previews, quiet zone included.` }
    : { id: 'qr', tone: 'warn', label: 'QR code too dense', note: `${perModule.toFixed(1)} px a module. Shorten the link, or turn the code off.` };
}

function accentCheck(spec: BoardSpec): BoardCheck | null {
  const ratio = contrastRatio(spec.accent, BOARD_BACKING);
  return ratio >= 4.5 ? null : { id: 'accent', tone: 'warn', label: 'Accent too dark', note: `The PREVIEW label reads at ${ratio.toFixed(1)}:1 on the board. Choose a lighter accent.` };
}

function imageCheck(spec: BoardSpec): BoardCheck | null {
  if (spec.mark === 'monogram') return null;
  return spec.image
    ? { id: 'image', tone: 'warn', label: 'Check your image by eye', note: 'The tool can measure its own text, not your picture. Look at it at the size shown.' }
    : { id: 'image', tone: 'warn', label: 'No image uploaded', note: 'Upload one, or switch back to the monogram.' };
}

/**
 * Every check for a board, most important first.
 * @param modules the QR code's width in modules, or null when there is no code.
 */
export function checkBoard(spec: BoardSpec, text: BoardText, layouts: Record<Aspect, BoardLayout>, modules: number | null): BoardCheck[] {
  const always: BoardCheck = { id: 'label', tone: 'good', label: 'Says Preview', note: 'Always, in every mode, whatever the design.' };
  const checks = [fitCheck(layouts), verticalCheck(layouts.vertical), priceCheck(spec, text), domainCheck(spec), qrCheck(layouts, modules), accentCheck(spec), imageCheck(spec), always];
  const order = { bad: 0, warn: 1, good: 2 };
  return checks.filter((c): c is BoardCheck => c !== null).sort((a, b) => order[a.tone] - order[b.tone]);
}
