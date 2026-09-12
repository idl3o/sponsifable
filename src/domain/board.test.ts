import { describe, expect, it } from 'vitest';
import { SAMPLE_PROFILE } from '../store/sample';
import { DEFAULT_BOARD, VERTICAL_UI_ZONES, boardText, layoutBoard, linkFor, qrMatrix, referenceScale, type Aspect, type BoardLayout } from './board';
import { checkBoard, contrastRatio } from './boardChecks';
import type { BoardSpec } from './types';

/** Every character is 0.6 of the font size wide. Deterministic, like a monospace face. */
const measure = (text: string, font: string) => text.length * Number(/ ([\d.]+)px/.exec(font)?.[1] ?? 10) * 0.6;

const SPEC: BoardSpec = { ...DEFAULT_BOARD, handle: '@kernowbuilds', linkBase: 'kernow.build/m/' };
const PUBLIC = { kind: 'public' } as const;

function layouts(spec: BoardSpec, audience: Parameters<typeof boardText>[2] = PUBLIC): Record<Aspect, BoardLayout> {
  const text = boardText(spec, SAMPLE_PROFILE, audience, '1432');
  return { landscape: layoutBoard(spec, text, 'landscape', measure), vertical: layoutBoard(spec, text, 'vertical', measure) };
}

function checks(spec: BoardSpec) {
  const text = boardText(spec, SAMPLE_PROFILE, PUBLIC, '1432');
  const modules = text.link && spec.showQr ? qrMatrix(text.link).length : null;
  return checkBoard(spec, text, layouts(spec), modules);
}

const tone = (spec: BoardSpec, id: string) => checks(spec).find((c) => c.id === id)?.tone;

describe('boardText', () => {
  it('fills a blank handle and monogram from the profile', () => {
    const text = boardText(DEFAULT_BOARD, SAMPLE_PROFILE, PUBLIC, '1');
    expect(text.handle).toBe(SAMPLE_PROFILE.channels[0]?.handle);
    expect(text.monogram.length).toBeGreaterThan(0);
    expect(text.label).toBe('PREVIEW');
  });

  it('gives a sponsor-only preview no public link, and names the sponsor', () => {
    const text = boardText(SPEC, SAMPLE_PROFILE, { kind: 'sponsor', sponsor: 'Hetzner' }, '1432');
    expect(text.link).toBeNull();
    expect(text.label).toBe('PREVIEW FOR HETZNER');
    expect(text.pattern).toBe('PREVIEW · FOR HETZNER');
    expect(text.note).toMatch(/delivery report/);
  });

  it('builds the link without a scheme, whatever the creator typed', () => {
    expect(linkFor({ ...SPEC, linkBase: 'https://kernow.build/m/' }, '1432')).toBe('kernow.build/m/1432');
    expect(linkFor({ ...SPEC, linkBase: '' }, '1432')).toBeNull();
  });
});

describe('layoutBoard', () => {
  it('scales the design canvas to 1280 × 720, keeping its margin', () => {
    const { landscape } = layouts(SPEC);
    const margin = 26 * (1280 / 960);
    expect(landscape.board.x).toBeCloseTo(margin);
    expect(landscape.board.y + landscape.board.h).toBeCloseTo(720 - margin);
  });

  it('moves the board with its position', () => {
    const upper = layouts({ ...SPEC, landscape: 'upper-left' }).landscape;
    const right = layouts({ ...SPEC, landscape: 'lower-right' }).landscape;
    expect(upper.board.y).toBeCloseTo(26 * (1280 / 960));
    expect(right.board.x + right.board.w).toBeCloseTo(1280 - 26 * (1280 / 960));
  });

  it('draws a QR code only on a public preview with a link', () => {
    expect(layouts(SPEC).landscape.qr).not.toBeNull();
    expect(layouts({ ...SPEC, showQr: false }).landscape.qr).toBeNull();
    expect(layouts({ ...SPEC, linkBase: '' }).landscape.qr).toBeNull();
    expect(layouts(SPEC, { kind: 'sponsor', sponsor: 'Hetzner' }).landscape.qr).toBeNull();
  });

  it('always carries the PREVIEW label, in every mode', () => {
    for (const mark of ['monogram', 'logo', 'board-image'] as const) {
      const { landscape, vertical } = layouts({ ...SPEC, mark });
      expect(landscape.runs.some((r) => r.text === 'PREVIEW')).toBe(true);
      expect(vertical.runs.some((r) => r.text === 'PREVIEW')).toBe(true);
    }
  });

  it('keeps the link in the band under a whole-board image', () => {
    const { landscape } = layouts({ ...SPEC, mark: 'board-image', image: 'data:image/png;base64,AA', imageAspect: 4 });
    expect(landscape.whole).toBe(true);
    expect(landscape.mark?.w).toBeCloseTo(landscape.board.w);
    expect(landscape.runs.some((r) => r.text === 'kernow.build/m/1432')).toBe(true);
  });

  it('is deterministic', () => {
    expect(layouts(SPEC)).toEqual(layouts(SPEC));
  });
});

describe('checkBoard', () => {
  it('passes the default vertical positions and flags the caption area', () => {
    expect(tone({ ...SPEC, vertical: 'middle-left' }, 'vertical')).toBe('good');
    expect(tone({ ...SPEC, vertical: 'upper-left' }, 'vertical')).toBe('good');
    expect(tone({ ...SPEC, vertical: 'bottom' }, 'vertical')).toBe('bad');
  });

  it('keeps every mark clear of the app UI at both safe positions, whatever its width', () => {
    for (const mark of ['monogram', 'logo', 'board-image'] as const) {
      for (const vertical of ['upper-left', 'middle-left'] as const) {
        expect(tone({ ...SPEC, mark, vertical, image: 'data:image/png;base64,AA', imageAspect: 3 }, 'vertical')).toBe('good');
      }
    }
  });

  it('sits the middle position just above the button column', () => {
    const { vertical } = layouts(SPEC);
    const s = referenceScale('vertical');
    expect((vertical.board.y + vertical.board.h) * s).toBeLessThanOrEqual(VERTICAL_UI_ZONES[1]?.y ?? 0);
  });

  it('refuses a price anywhere on the board', () => {
    expect(tone({ ...SPEC, handle: '@kb £40 a clip' }, 'price')).toBe('bad');
    expect(tone({ ...SPEC, handle: '@kb 2k' }, 'price')).toBe('bad');
    expect(tone(SPEC, 'price')).toBe('good');
  });

  it('wants the creator’s own domain', () => {
    expect(tone({ ...SPEC, linkBase: '' }, 'domain')).toBe('warn');
    expect(tone({ ...SPEC, linkBase: 'bit.ly/' }, 'domain')).toBe('bad');
    expect(tone({ ...SPEC, linkBase: 'my shop' }, 'domain')).toBe('bad');
    expect(tone(SPEC, 'domain')).toBe('good');
  });

  it('checks the QR code scans at the exported size, and warns when a link grows too long', () => {
    expect(tone(SPEC, 'qr')).toBe('good');
    expect(tone({ ...SPEC, linkBase: `kernow.build/${'licences/'.repeat(8)}` }, 'qr')).toBe('warn');
  });

  it('flags an accent too dark to read, and asks for an image by eye', () => {
    expect(tone({ ...SPEC, accent: '#333333' }, 'accent')).toBe('warn');
    expect(tone({ ...SPEC, mark: 'logo' }, 'image')).toBe('warn');
    expect(tone(SPEC, 'image')).toBeUndefined();
  });

  it('flags a board that runs off the frame', () => {
    expect(tone({ ...SPEC, landscape: 'lower-right', handle: `@${'k'.repeat(120)}` }, 'fit')).toBe('bad');
  });

  it('puts problems first', () => {
    const list = checks({ ...SPEC, vertical: 'bottom' });
    expect(list[0]?.tone).toBe('bad');
    expect(list.at(-1)?.id).toBe('label');
  });
});

describe('contrastRatio', () => {
  it('matches WCAG at the extremes', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1);
  });
});
