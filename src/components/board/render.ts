import { OUTPUT_SIZE, fontFor, layoutBoard, qrMatrix, type Aspect, type BoardLayout, type BoardText, type Box, type Measure, type RunColour } from '../../domain/board';
import type { BoardSpec } from '../../domain/types';

/**
 * Draws the shop board onto a canvas. The only renderer: the editor's live
 * preview and the exported overlay are the same drawing, so what the creator
 * sees is what ships. Colours come from the app's tokens and the design canvas.
 */

const INK = '#e7eaf0';
const MUTED = '#8e99ab';
const LINK = '#c9d0db';
const BACKING = 'rgba(9, 11, 15, 0.88)';
const BAND = 'rgba(9, 11, 15, 0.94)';
const EDGE = 'rgba(255, 255, 255, 0.10)';
const ON_ACCENT = '#191305';

/** Images the board may draw: the creator's upload, and an optional frame to preview on. */
export interface BoardImages {
  mark: HTMLImageElement | null;
  frame: HTMLImageElement | null;
}

type Ctx = CanvasRenderingContext2D;

/** Measure text with a canvas where there is one, and by a fair estimate where there is not. */
export function makeMeasure(): Measure {
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!ctx) return (text, font) => text.length * Number(/ ([\d.]+)px/.exec(font)?.[1] ?? 12) * 0.56;
  return (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}

function colourOf(colour: RunColour, spec: BoardSpec): string {
  return { accent: spec.accent, ink: INK, muted: MUTED, link: LINK }[colour];
}

function rounded(ctx: Ctx, box: Box, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, radius);
}

function setTracking(ctx: Ctx, px: number): void {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** The tiled, rotated PREVIEW pattern across the whole frame. */
function drawPattern(ctx: Ctx, layout: BoardLayout, text: string, strength: number): void {
  const s = layout.width / (layout.aspect === 'landscape' ? 960 : 405);
  const tileW = 300 * s;
  const tileH = 130 * s;
  const reach = Math.hypot(layout.width, layout.height);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = '#ffffff';
  ctx.font = fontFor(16 * s, 400, true);
  setTracking(ctx, 3 * s);
  ctx.translate(layout.width / 2, layout.height / 2);
  ctx.rotate((-22 * Math.PI) / 180);
  for (let y = -reach; y < reach; y += tileH) {
    for (let x = -reach; x < reach; x += tileW) {
      ctx.fillText(text, x, y);
      ctx.fillText(text, x + tileW / 2, y + tileH / 2);
    }
  }
  ctx.restore();
}

/** A QR code with its four-module quiet zone, snapped to whole pixels. */
function drawQr(ctx: Ctx, box: Box, matrix: boolean[][]): void {
  const n = matrix.length;
  const mod = box.w / (n + 8);
  ctx.fillStyle = '#ffffff';
  rounded(ctx, box, mod);
  ctx.fill();
  ctx.fillStyle = '#0d0f13';
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (!dark) return;
      const x = Math.round(box.x + (c + 4) * mod);
      const y = Math.round(box.y + (r + 4) * mod);
      ctx.fillRect(x, y, Math.round(box.x + (c + 5) * mod) - x, Math.round(box.y + (r + 5) * mod) - y);
    }),
  );
}

/** A dashed slot saying where the creator's image goes, until they upload one. */
function drawImageSlot(ctx: Ctx, box: Box, scale: number): void {
  ctx.save();
  ctx.strokeStyle = '#616c7d';
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([5 * scale, 4 * scale]);
  rounded(ctx, box, 7 * scale);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = fontFor(11 * scale, 500);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Your image', box.x + box.w / 2, box.y + box.h / 2);
  ctx.restore();
}

/** The monogram, the logo, or the whole-board image. */
function drawMark(ctx: Ctx, layout: BoardLayout, spec: BoardSpec, image: HTMLImageElement | null): void {
  const box = layout.mark;
  if (!box) return;
  const scale = layout.board.h / 100;
  if (layout.monogram) {
    ctx.fillStyle = spec.accent;
    rounded(ctx, box, box.w * 0.17);
    ctx.fill();
    ctx.fillStyle = ON_ACCENT;
    ctx.font = layout.monogram.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(layout.monogram.text, box.x + box.w / 2, box.y + box.h / 2 + 1);
    ctx.textAlign = 'left';
    return;
  }
  if (!image) return drawImageSlot(ctx, box, Math.max(1, scale));
  const fit = layout.whole ? Math.max : Math.min;
  const s = fit(box.w / image.naturalWidth, box.h / image.naturalHeight);
  const w = image.naturalWidth * s;
  const h = image.naturalHeight * s;
  ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}

/** The board's backing: a rounded panel, or for a whole-board image, the band under it. */
function drawBacking(ctx: Ctx, layout: BoardLayout): void {
  const radius = layout.board.h * 0.1;
  ctx.save();
  rounded(ctx, layout.board, radius);
  ctx.clip();
  ctx.fillStyle = layout.whole ? BAND : BACKING;
  if (layout.whole && layout.mark) {
    const band = { ...layout.board, y: layout.mark.y + layout.mark.h, h: layout.board.h - layout.mark.h };
    ctx.fillRect(band.x, band.y, band.w, band.h);
  } else {
    ctx.fillRect(layout.board.x, layout.board.y, layout.board.w, layout.board.h);
  }
  ctx.restore();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = Math.max(1, layout.width / 960);
  rounded(ctx, layout.board, radius);
  ctx.stroke();
}

/** The board itself: backing, mark, text and QR code. */
function drawBoard(ctx: Ctx, layout: BoardLayout, spec: BoardSpec, text: BoardText, image: HTMLImageElement | null): void {
  drawBacking(ctx, layout);
  if (layout.whole && layout.mark) {
    ctx.save();
    rounded(ctx, layout.board, layout.board.h * 0.1);
    ctx.clip();
    drawMark(ctx, layout, spec, image);
    ctx.restore();
  } else {
    drawMark(ctx, layout, spec, image);
  }
  ctx.textBaseline = 'top';
  for (const run of layout.runs) {
    ctx.font = run.font;
    ctx.fillStyle = colourOf(run.colour, spec);
    setTracking(ctx, run.tracking);
    ctx.fillText(run.text, run.x, run.y);
  }
  setTracking(ctx, 0);
  if (layout.qr && text.link) drawQr(ctx, layout.qr, qrMatrix(text.link));
}

/** A plain scene to preview the board on when the creator has not supplied a frame. */
function drawScene(ctx: Ctx, width: number, height: number, frame: HTMLImageElement | null): void {
  if (frame) {
    const s = Math.max(width / frame.naturalWidth, height / frame.naturalHeight);
    const w = frame.naturalWidth * s;
    const h = frame.naturalHeight * s;
    ctx.drawImage(frame, (width - w) / 2, (height - h) / 2, w, h);
    return;
  }
  const sky = ctx.createRadialGradient(width * 0.28, height * 0.18, 0, width * 0.28, height * 0.18, width);
  sky.addColorStop(0, '#1f2d3f');
  sky.addColorStop(0.52, '#0f1620');
  sky.addColorStop(1, '#07090d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#0b1017';
  ctx.fillRect(0, height * 0.62, width, height * 0.38);
}

/**
 * Draw a preview or an overlay at the aspect's output size.
 * @param withScene false for the exported overlay, which is transparent everywhere but the pattern and the board.
 * @returns the layout drawn, or null when the canvas has no 2D context.
 */
export function renderBoard(
  canvas: HTMLCanvasElement,
  spec: BoardSpec,
  text: BoardText,
  aspect: Aspect,
  images: BoardImages,
  withScene: boolean,
): BoardLayout | null {
  canvas.width = OUTPUT_SIZE[aspect].w;
  canvas.height = OUTPUT_SIZE[aspect].h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const layout = layoutBoard(spec, text, aspect, makeMeasure());
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (withScene) drawScene(ctx, canvas.width, canvas.height, images.frame);
  drawPattern(ctx, layout, text.pattern, spec.pattern);
  drawBoard(ctx, layout, spec, text, images.mark);
  return layout;
}
