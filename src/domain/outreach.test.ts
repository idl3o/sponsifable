import { describe, expect, it } from 'vitest';
import { composeFollowUp, composePitch, daysBetween, nextAction } from './pitch';
import { priceLine } from './pricing';
import { rankProspects, scoreProspect } from './scoring';
import type { Channel, CreatorProfile, Prospect } from './types';

const channel: Channel = {
  id: 'yt',
  platform: 'youtube',
  handle: '@kernow',
  followers: 100_000,
  medianViews: 40_000,
  engagementRate: 0.05,
  formats: ['dedicated', 'integration', 'mention'],
};

const profile: CreatorProfile = {
  name: 'Ada Trelawny',
  tagline: 'Systems, slowly',
  niche: 'technology',
  geo: { tier1: 70, tier2: 20, tier3: 10 },
  channels: [channel],
  proofPoints: [{ id: 'p1', label: 'Notion, Mar 2026', result: '4,100 clicks and 380 signups' }],
  contactEmail: 'ada@example.com',
};

const ask = priceLine(profile, channel, 'integration');

const prospect: Prospect = {
  id: 'p1',
  brand: 'Linear',
  product: 'Linear',
  niche: 'b2b-software',
  contactName: 'Jo',
  contactEmail: 'jo@example.com',
  budgetBand: [2_000, 8_000],
  sellsInto: ['tier1', 'tier2'],
  evidence: 'Sponsored four developer channels through 2025, listed on their marketing page.',
  stage: 'contacted',
  lastContactedOn: '2026-09-01',
  notes: '',
};

describe('scoreProspect', () => {
  it('rewards an exact category match over an unrelated one', () => {
    const adjacent = scoreProspect(profile, prospect, ask);
    const unrelated = scoreProspect(profile, { ...prospect, niche: 'beauty' }, ask);
    expect(adjacent.total).toBeGreaterThan(unrelated.total);
  });

  it('zeroes budget alignment when the sponsor cannot reach the walk-away price', () => {
    const broke = scoreProspect(profile, { ...prospect, budgetBand: [50, 100] }, ask);
    const budget = broke.components.find((c) => c.label === 'Budget alignment');
    expect(budget?.score).toBe(0);
  });

  it('penalises a brand with no record of sponsoring anyone', () => {
    const unproven = scoreProspect(profile, { ...prospect, evidence: '' }, ask);
    const proven = scoreProspect(profile, prospect, ask);
    expect(unproven.total).toBeLessThan(proven.total);
  });

  it('keeps the total inside nought to one hundred', () => {
    const best = scoreProspect(
      profile,
      { ...prospect, niche: 'technology', budgetBand: [20_000, 40_000] },
      ask,
    );
    expect(best.total).toBeLessThanOrEqual(100);
    expect(best.total).toBeGreaterThanOrEqual(0);
    expect(best.verdict).toBe('strong');
  });

  it('explains every component it scores', () => {
    const fit = scoreProspect(profile, prospect, ask);
    expect(fit.components).toHaveLength(4);
    for (const component of fit.components) {
      expect(component.note.length).toBeGreaterThan(10);
      expect(component.score).toBeLessThanOrEqual(component.max);
    }
  });
});

describe('rankProspects', () => {
  it('puts the best fit first', () => {
    const ranked = rankProspects(
      profile,
      [
        { ...prospect, id: 'weak', niche: 'beauty', evidence: '', budgetBand: [0, 0] },
        { ...prospect, id: 'strong', niche: 'technology', budgetBand: [20_000, 40_000] },
      ],
      ask,
    );
    expect(ranked[0]?.prospect.id).toBe('strong');
  });
});

describe('composePitch', () => {
  it('names the product, the price and the impressions', () => {
    const pitch = composePitch(profile, prospect, ask);
    expect(pitch.body).toContain('Linear');
    expect(pitch.body).toContain('£');
    expect(pitch.body).toContain('40,000');
    expect(pitch.subject).toContain('Linear');
  });

  it('stays short enough to be read', () => {
    const pitch = composePitch(profile, prospect, ask);
    expect(pitch.words).toBeLessThan(180);
  });

  it('is deterministic', () => {
    expect(composePitch(profile, prospect, ask)).toEqual(composePitch(profile, prospect, ask));
  });

  it('uses a bare greeting when no contact is named', () => {
    const pitch = composePitch(profile, { ...prospect, contactName: '' }, ask);
    expect(pitch.body.startsWith('Hi,')).toBe(true);
  });

  it('includes a past result when one is recorded', () => {
    expect(composePitch(profile, prospect, ask).body).toContain('380 signups');
  });
});

describe('composeFollowUp', () => {
  it('writes a distinct message for each touch', () => {
    const first = composeFollowUp(profile, prospect, ask, 1).body;
    const second = composeFollowUp(profile, prospect, ask, 2).body;
    const third = composeFollowUp(profile, prospect, ask, 3).body;
    expect(new Set([first, second, third]).size).toBe(3);
  });

  it('says it is the last message on the final touch', () => {
    expect(composeFollowUp(profile, prospect, ask, 3).body).toContain('stop emailing');
  });

  it('falls back to the closing message for an out-of-range touch', () => {
    expect(composeFollowUp(profile, prospect, ask, 9).body).toContain('stop emailing');
  });
});

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-09-01', '2026-09-11')).toBe(10);
  });

  it('returns nought for unparseable dates rather than throwing', () => {
    expect(daysBetween('', '2026-09-11')).toBe(0);
  });
});

describe('nextAction', () => {
  it('treats a reply as the most urgent thing on the board', () => {
    expect(nextAction({ ...prospect, stage: 'replied' }, '2026-09-10').urgency).toBe('overdue');
  });

  it('asks for a named contact while still researching', () => {
    const action = nextAction({ ...prospect, stage: 'researching' }, '2026-09-10');
    expect(action.label).toContain('named contact');
  });

  it('says nothing is needed on a closed deal', () => {
    expect(nextAction({ ...prospect, stage: 'won' }, '2026-09-10').urgency).toBe('none');
  });

  it('waits before the first follow-up is due', () => {
    expect(nextAction({ ...prospect, lastContactedOn: '2026-09-09' }, '2026-09-10').urgency).toBe(
      'waiting',
    );
  });

  it('flags a long-overdue follow-up', () => {
    expect(nextAction({ ...prospect, lastContactedOn: '2026-08-01' }, '2026-09-10').urgency).toBe(
      'none',
    );
    expect(nextAction({ ...prospect, lastContactedOn: '2026-08-25' }, '2026-09-10').urgency).toBe(
      'overdue',
    );
  });

  it('prompts an opening pitch when nothing has been sent', () => {
    const action = nextAction({ ...prospect, lastContactedOn: '' }, '2026-09-10');
    expect(action.label).toContain('opening pitch');
  });
});

describe('composePitch when the production floor binds', () => {
  const nano: Channel = { ...channel, followers: 4_000, medianViews: 900, engagementRate: 0.045 };
  const nanoProfile: CreatorProfile = { ...profile, channels: [nano] };
  const nanoAsk = priceLine(nanoProfile, nano, 'dedicated');

  it('never quotes a cost per thousand derived from a labour price', () => {
    expect(nanoAsk.flooredByProduction).toBe(true);
    const pitch = composePitch(nanoProfile, prospect, nanoAsk);
    expect(pitch.body).not.toContain('per thousand impressions');
  });

  it('states the basis for the price honestly instead', () => {
    const pitch = composePitch(nanoProfile, prospect, nanoAsk);
    expect(pitch.body).toContain('costs to make');
    expect(pitch.body).toContain('900');
  });

  it('still quotes a cost per thousand when reach sets the price', () => {
    expect(ask.flooredByProduction).toBe(false);
    expect(composePitch(profile, prospect, ask).body).toContain('per thousand impressions');
  });

  it('stays short even with the longer explanation', () => {
    expect(composePitch(nanoProfile, prospect, nanoAsk).words).toBeLessThan(190);
  });
});
