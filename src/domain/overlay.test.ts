import { describe, expect, it } from 'vitest';
import { SAMPLE_PROFILE, SAMPLE_PROSPECTS } from '../store/sample';
import { DEFAULT_BOARD } from './board';
import { DEFAULT_TERMS } from './pricing';
import type { Deal } from './types';
import { overlayFor, overlayLine, overlayUrl } from './overlay';
import { workspaceOf, type Workspace } from './workspace';

const DEAL: Deal = {
  id: 'dl-104',
  prospectId: 'pr-2',
  brand: 'Hetzner',
  outcome: 'won',
  lostReason: null,
  closedOn: '2026-09-10',
  platform: 'twitch',
  format: 'stream',
  niche: 'technology',
  geo: { tier1: 0.6, tier2: 0.3, tier3: 0.1 },
  followers: 4000,
  medianViews: 90,
  engagementRate: 0.05,
  terms: DEFAULT_TERMS,
  paidUsageDays: 0,
  quoted: 450,
  flooredByProduction: true,
  fitAtClose: 72,
  agreed: 400,
  deliveredOn: '',
  paidOn: '',
  seal: null,
  sightings: [],
  notes: 'Agreed £400 after a counter.',
};

const withDeals = (...deals: Deal[]): Workspace =>
  workspaceOf({ profile: SAMPLE_PROFILE, terms: DEFAULT_TERMS, prospects: SAMPLE_PROSPECTS, deals, board: DEFAULT_BOARD });

describe('overlayFor', () => {
  it('draws a won deal with its sponsor and the ad label', () => {
    const view = overlayFor(withDeals(DEAL), 'dl-104');
    expect(view).toEqual({ disclosure: 'Ad', brand: 'Hetzner', accent: DEFAULT_BOARD.accent });
    expect(view && overlayLine(view)).toBe('Sponsored by Hetzner');
  });

  it('carries nothing that could put a price on air', () => {
    const view = overlayFor(withDeals(DEAL), 'dl-104');
    expect(Object.keys(view ?? {}).sort()).toEqual(['accent', 'brand', 'disclosure']);
    expect(JSON.stringify(view)).not.toMatch(/400|450|£/);
  });

  it('draws nothing for a lost deal or an unknown id', () => {
    const lost: Deal = { ...DEAL, id: 'dl-105', outcome: 'lost', lostReason: 'budget' };
    expect(overlayFor(withDeals(DEAL, lost), 'dl-105')).toBeNull();
    expect(overlayFor(withDeals(DEAL), 'dl-999')).toBeNull();
  });

  it('keeps the label when the deal names no brand', () => {
    const view = overlayFor(withDeals({ ...DEAL, brand: '  ' }), 'dl-104');
    expect(view?.disclosure).toBe('Ad');
    expect(view && overlayLine(view)).toBe('Sponsored');
  });
});

describe('overlayUrl', () => {
  it('points OBS at the server that serves the app', () => {
    expect(overlayUrl('http://127.0.0.1:5180', 'dl-104')).toBe('http://127.0.0.1:5180/overlay.html?deal=dl-104');
  });
});
