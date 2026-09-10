import { describe, expect, it } from 'vitest';
import { SAMPLE_PROFILE, SAMPLE_PROSPECTS } from '../store/sample';
import { DEFAULT_TERMS } from './pricing';
import { WORKSPACE_VERSION, parseWorkspace } from './workspace';

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

  it('rejects an exclusivity window the pricing tables do not know', () => {
    const parsed = parseWorkspace({ ...V1_FILE, terms: { ...DEFAULT_TERMS, exclusivityDays: 45 } });
    expect(parsed.ok).toBe(false);
  });
});
