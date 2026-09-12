import { describe, expect, it } from 'vitest';
import { SAMPLE_PROFILE, SAMPLE_PROSPECTS } from '../store/sample';
import { DEFAULT_BOARD, MAX_IMAGE_CHARS } from './board';
import { DEFAULT_TERMS } from './pricing';
import type { Deal } from './types';
import { WORKSPACE_VERSION, parseWorkspace, seqFloor, workspaceOf } from './workspace';

/** A file exactly as the first release exported it: no version, no deals. */
const V1_FILE = { profile: SAMPLE_PROFILE, terms: DEFAULT_TERMS, prospects: SAMPLE_PROSPECTS };

describe('parseWorkspace', () => {
  it('upgrades a first-release export, adding an empty deal log', () => {
    const parsed = parseWorkspace(JSON.parse(JSON.stringify(V1_FILE)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.workspace.version).toBe(WORKSPACE_VERSION);
    expect(parsed.workspace.deals).toEqual([]);
    expect(parsed.workspace.profile).toEqual(SAMPLE_PROFILE);
  });

  it('fills default terms when a file omits them, rather than crashing the rate card', () => {
    const parsed = parseWorkspace({ profile: SAMPLE_PROFILE, prospects: SAMPLE_PROSPECTS });
    expect(parsed.ok && parsed.workspace.terms).toEqual(DEFAULT_TERMS);
  });

  it('round-trips its own output unchanged', () => {
    const first = parseWorkspace(V1_FILE);
    if (!first.ok) throw new Error(first.error);
    const second = parseWorkspace(JSON.parse(JSON.stringify(first.workspace)));
    expect(second).toEqual(first);
  });

  it('refuses a file from a newer version instead of guessing', () => {
    const parsed = parseWorkspace({ ...V1_FILE, version: WORKSPACE_VERSION + 1 });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('newer version');
  });

  it('names the field that is wrong', () => {
    const broken = JSON.parse(JSON.stringify(V1_FILE));
    broken.profile.channels[1].platform = 'myspace';
    const parsed = parseWorkspace(broken);
    expect(parsed).toEqual({
      ok: false,
      error: expect.stringContaining('profile.channels[1].platform'),
    });
  });

  it('refuses things that are not a workspace at all', () => {
    expect(parseWorkspace(null).ok).toBe(false);
    expect(parseWorkspace([]).ok).toBe(false);
    expect(parseWorkspace({ profile: SAMPLE_PROFILE }).ok).toBe(false);
  });

  it('gives a file saved before format 4 the default shop board', () => {
    const parsed = parseWorkspace({ ...V1_FILE, version: 3 });
    expect(parsed.ok && parsed.workspace.board).toEqual(DEFAULT_BOARD);
  });

  it('round-trips a board with an uploaded image', () => {
    const board = { ...DEFAULT_BOARD, mark: 'logo', image: 'data:image/png;base64,iVBORw0KGgo=', imageAspect: 2.5, linkBase: 'kernow.build/m/' };
    const parsed = parseWorkspace({ ...V1_FILE, version: 4, board });
    expect(parsed.ok && parsed.workspace.board).toEqual(board);
  });

  it('refuses a board image that is not a raster data URL, or is too large', () => {
    const svg = 'data:image/svg+xml;base64,PHN2Zz4=';
    const huge = `data:image/png;base64,${'A'.repeat(MAX_IMAGE_CHARS)}`;
    for (const image of [svg, huge, 'https://example.com/logo.png']) {
      const parsed = parseWorkspace({ ...V1_FILE, version: 4, board: { ...DEFAULT_BOARD, image } });
      expect(parsed).toEqual({ ok: false, error: expect.stringContaining('board.image') });
    }
  });

  it('refuses a bad accent and never lets the pattern reach zero', () => {
    expect(parseWorkspace({ ...V1_FILE, version: 4, board: { ...DEFAULT_BOARD, accent: 'gold' } }).ok).toBe(false);
    const parsed = parseWorkspace({ ...V1_FILE, version: 4, board: { ...DEFAULT_BOARD, pattern: 0 } });
    expect(parsed.ok && parsed.workspace.board.pattern).toBe(0.04);
  });

  it('rejects an exclusivity window the pricing tables do not know', () => {
    const parsed = parseWorkspace({ ...V1_FILE, terms: { ...DEFAULT_TERMS, exclusivityDays: 45 } });
    expect(parsed.ok).toBe(false);
  });
});

describe('seqFloor', () => {
  const slices = { profile: SAMPLE_PROFILE, terms: DEFAULT_TERMS, prospects: SAMPLE_PROSPECTS, deals: [], board: DEFAULT_BOARD };

  it('finds the highest generated id anywhere in the workspace', () => {
    const deal = { id: 'dl-212', sightings: [{ id: 'st-230' }, { id: 'st-verify-a1b2c3d4e5-1' }] };
    const floor = seqFloor({ ...slices, deals: [deal as unknown as Deal] });
    expect(floor).toBe(230);
  });

  it('ignores ids the CLI writes, which cannot collide with the counter', () => {
    const deal = { id: 'dl-3', sightings: [{ id: 'st-verify-9999999999-1' }] };
    expect(seqFloor({ ...slices, prospects: [], profile: { ...SAMPLE_PROFILE, channels: [], proofPoints: [] }, deals: [deal as unknown as Deal] })).toBe(3);
  });
});

describe('workspaceOf', () => {
  it('saves the current format and only the fields a file carries', () => {
    const state = { profile: SAMPLE_PROFILE, terms: DEFAULT_TERMS, prospects: [], deals: [], board: DEFAULT_BOARD, tab: 'deals', seq: 140 };
    expect(Object.keys(workspaceOf(state)).sort()).toEqual(['board', 'deals', 'profile', 'prospects', 'terms', 'version']);
    expect(workspaceOf(state).version).toBe(WORKSPACE_VERSION);
  });
});
