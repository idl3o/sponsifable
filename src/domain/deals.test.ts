import { describe, expect, it } from 'vitest';
import {
  calibrate,
  closeDeal,
  priceOverrun,
  quarterOf,
  rateSubmissionUrl,
  roundHard,
  tierCovering,
} from './deals';
import { DEFAULT_TERMS, priceLine } from './pricing';
import type { Channel, CreatorProfile, Deal, Prospect } from './types';

const channel: Channel = {
  id: 'yt',
  platform: 'youtube',
  handle: '@kernow',
  followers: 100_000,
  medianViews: 40_000,
  engagementRate: 0.05,
  formats: ['integration'],
};

const profile: CreatorProfile = {
  name: 'Ada Trelawny',
  tagline: '',
  niche: 'technology',
  geo: { tier1: 70, tier2: 20, tier3: 10 },
  channels: [channel],
  proofPoints: [],
  contactEmail: 'ada@example.com',
};

const prospect: Prospect = {
  id: 'p1',
  brand: 'Linear',
  product: 'Linear',
  niche: 'b2b-software',
  contactName: 'Jo',
  contactEmail: 'jo@example.com',
  budgetBand: [2_000, 8_000],
  sellsInto: ['tier1'],
  evidence: '',
  stage: 'negotiating',
  lastContactedOn: '2026-09-01',
  notes: '',
};

const whitelisted = { ...DEFAULT_TERMS, usageRights: 'whitelisting-30' as const };
const line = priceLine(profile, channel, 'integration', whitelisted);

function won(agreed: number, overrides: Partial<Deal> = {}): Deal {
  const deal = closeDeal(profile, prospect, line, whitelisted, {
    id: 'dl-1',
    outcome: 'won',
    agreed,
    lostReason: 'other',
    closedOn: '2026-09-10',
    fitAtClose: 75,
  });
  if (!deal) throw new Error('channel missing');
  return { ...deal, ...overrides };
}

describe('closeDeal', () => {
  it('freezes the audience and the quote as they stood at close', () => {
    const deal = won(1_000);
    expect(deal.medianViews).toBe(40_000);
    expect(deal.quoted).toBe(line.target);
    expect(deal.terms.usageRights).toBe('whitelisting-30');
    expect(deal.lostReason).toBeNull();
  });

  it('records nothing agreed on a lost deal', () => {
    const lost = closeDeal(profile, prospect, line, whitelisted, {
      id: 'dl-2',
      outcome: 'lost',
      agreed: 900,
      lostReason: 'budget',
      closedOn: '2026-09-10',
      fitAtClose: 40,
    });
    expect(lost?.agreed).toBe(0);
    expect(lost?.lostReason).toBe('budget');
  });

  it('refuses a line whose channel has since been removed', () => {
    expect(
      closeDeal({ ...profile, channels: [] }, prospect, line, whitelisted, {
        id: 'x',
        outcome: 'won',
        agreed: 1,
        lostReason: 'other',
        closedOn: '2026-09-10',
        fitAtClose: 0,
      }),
    ).toBeNull();
  });
});

describe('calibrate', () => {
  it('reports the median close against the quote', () => {
    const q = line.target;
    const c = calibrate([won(q * 0.8), won(q * 0.85), won(q * 0.9, { id: 'b' })]);
    expect(c.closeRatio).toBeCloseTo(0.85, 5);
    expect(c.readable).toBe(true);
    expect(c.sentence).toContain('negotiated down');
  });

  it('declines to read a pattern into fewer than three deals', () => {
    const c = calibrate([won(line.target * 0.5)]);
    expect(c.readable).toBe(false);
    expect(c.sentence).toContain('Too few');
  });

  it('counts wins against the fit verdict they were recorded with', () => {
    const lost: Deal = { ...won(0), outcome: 'lost', lostReason: 'no-reply', fitAtClose: 30 };
    const c = calibrate([won(line.target), lost]);
    expect(c.byVerdict.strong).toEqual({ won: 1, total: 1 });
    expect(c.byVerdict.weak).toEqual({ won: 0, total: 1 });
    expect(c.lostReasons).toEqual({ 'no-reply': 1 });
  });
});

describe('rate submission', () => {
  it('rounds hard enough that a figure cannot fingerprint a channel', () => {
    expect(roundHard(41_372)).toBe(41_000);
    expect(roundHard(987)).toBe(990);
    expect(roundHard(0)).toBe(0);
    expect(quarterOf('2026-09-10')).toBe('Q3 2026');
  });

  it('carries no brand, handle or exact number', () => {
    const url = rateSubmissionUrl(won(1_234)) ?? '';
    const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
    expect(decoded).not.toContain('Linear');
    expect(decoded).not.toContain('@kernow');
    expect(decoded).not.toContain('1,234');
    expect(decoded).toContain('£1,200');
    expect(decoded).toContain('Q3 2026');
    expect(decoded).toContain('template=rate-data.yml');
  });

  it('says whether the money has actually arrived', () => {
    const unpaid = decodeURIComponent(rateSubmissionUrl(won(1_000)) ?? '');
    const paid = decodeURIComponent(rateSubmissionUrl(won(1_000, { paidOn: '2026-10-01' })) ?? '');
    expect(unpaid.replace(/\+/g, ' ')).toContain('agreed but not yet paid');
    expect(paid.replace(/\+/g, ' ')).toContain('money received');
  });

  it('offers nothing for a lost deal', () => {
    expect(rateSubmissionUrl({ ...won(0), outcome: 'lost' })).toBeNull();
  });
});

describe('priceOverrun', () => {
  const sighting = { id: 's', source: '', startedOn: '2026-10-01', seenOn: '2026-10-20', verified: true };

  it('owes nothing while the ad runs inside its window', () => {
    expect(priceOverrun(won(line.target), sighting).owed).toBe(0);
  });

  it('prices a run past thirty days as the ninety-day licence, less what was paid', () => {
    const late = { ...sighting, seenOn: '2026-12-15' };
    const overrun = priceOverrun(won(line.target), late);
    expect(overrun.daysRun).toBe(75);
    expect(overrun.consumed).toBe('whitelisting-90');
    expect(overrun.owed).toBeGreaterThan(0);
    expect(overrun.sentence).toContain('75 days');
    expect(overrun.sentence).toContain('90-day licence');
  });

  it('applies the discount the sponsor already negotiated', () => {
    const late = { ...sighting, seenOn: '2026-12-15' };
    const full = priceOverrun(won(line.target), late).owed;
    const discounted = priceOverrun(won(line.target * 0.5), late).owed;
    expect(discounted).toBeLessThan(full);
  });

  it('treats any paid running of an organic-only asset as an overrun', () => {
    const organic = won(line.target, { terms: DEFAULT_TERMS, paidUsageDays: 0 });
    const overrun = priceOverrun(organic, { ...sighting, seenOn: '2026-10-05' });
    expect(overrun.permitted).toBe(0);
    expect(overrun.owed).toBeGreaterThan(0);
    expect(overrun.sentence).toContain('no paid running');
  });

  it('never owes anything on a buyout', () => {
    const buyout = won(line.target, {
      terms: { ...DEFAULT_TERMS, usageRights: 'full-buyout' },
      paidUsageDays: null,
    });
    expect(priceOverrun(buyout, { ...sighting, seenOn: '2029-01-01' }).owed).toBe(0);
  });

  it('holds the sponsor to the window agreed, not the one the table defines today', () => {
    const generous = won(line.target, { paidUsageDays: 60 });
    expect(priceOverrun(generous, { ...sighting, seenOn: '2026-11-25' }).owed).toBe(0);
    expect(won(line.target).paidUsageDays).toBe(30);
  });

  it('picks the cheapest tier that covers the run', () => {
    expect(tierCovering(0)).toBe('organic-only');
    expect(tierCovering(30)).toBe('whitelisting-30');
    expect(tierCovering(31)).toBe('whitelisting-90');
    expect(tierCovering(400)).toBe('full-buyout');
  });
});
