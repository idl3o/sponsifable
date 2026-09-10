import { describe, expect, it } from 'vitest';
import { BUYOUT, INTRODUCTORY_RATE, PAID_USAGE } from './benchmarks';
import { composePitch } from './pitch';
import { DEFAULT_TERMS, priceLine, usageFee } from './pricing';
import type { Channel, CreatorProfile, DealTerms, Prospect } from './types';

/**
 * The September 2026 terms: paid usage by the period, the sponsor's declared
 * spend, the introductory rate, and the paid-market reference.
 */

const reels: Channel = {
  id: 'ig',
  platform: 'instagram',
  handle: '@example',
  followers: 80_000,
  medianViews: 20_000,
  engagementRate: 0.035,
  formats: ['reel', 'story'],
};

const profile: CreatorProfile = {
  name: 'Test Creator',
  tagline: '',
  niche: 'lifestyle',
  geo: { tier1: 60, tier2: 25, tier3: 15 },
  channels: [reels],
  proofPoints: [],
  contactEmail: 'test@example.com',
};

const withTerms = (patch: Partial<DealTerms>) => ({ ...DEFAULT_TERMS, ...patch });
const organic = priceLine(profile, reels, 'reel');

describe('paid usage, priced by the period', () => {
  it('charges each thirty days, so ninety costs more than thirty by about the extra periods', () => {
    const thirty = priceLine(profile, reels, 'reel', withTerms({ usageRights: 'whitelisting-30' }));
    const ninety = priceLine(profile, reels, 'reel', withTerms({ usageRights: 'whitelisting-90' }));
    const perPeriod = thirty.target - organic.target;
    expect(ninety.target - organic.target).toBeGreaterThanOrEqual(perPeriod * 3 - 30);
  });

  it('never charges less than the minimum per period, however small the audience', () => {
    expect(usageFee(withTerms({ usageRights: 'whitelisting-30' }), 40).fee).toBe(PAID_USAGE.minimumPerPeriod);
    expect(usageFee(withTerms({ usageRights: 'whitelisting-90' }), 40).fee).toBe(PAID_USAGE.minimumPerPeriod * 3);
  });

  it("follows the sponsor's declared spend when that is worth more", () => {
    const quiet = usageFee(withTerms({ usageRights: 'whitelisting-30' }), 500);
    const loud = usageFee(withTerms({ usageRights: 'whitelisting-30', declaredSpend: 50_000 }), 500);
    expect(loud.fee).toBe(PAID_USAGE.shareOfDeclaredSpend * 50_000);
    expect(loud.fee).toBeGreaterThan(quiet.fee);
    expect(loud.rationale).toContain('declared £50,000 paid spend');
  });

  it('prices a buyout as the placement again, and never below six months of usage', () => {
    expect(usageFee(withTerms({ usageRights: 'full-buyout' }), 2_000).fee).toBe(2_000 * BUYOUT.shareOfOrganic);
    expect(usageFee(withTerms({ usageRights: 'full-buyout' }), 50).fee).toBe(
      BUYOUT.minimumPeriods * PAID_USAGE.minimumPerPeriod,
    );
  });

  it('charges nothing for organic use, and nothing on a placement that cannot be sold', () => {
    expect(usageFee(DEFAULT_TERMS, 1_000).fee).toBe(0);
    expect(usageFee(withTerms({ usageRights: 'whitelisting-30' }), 0).fee).toBe(0);
  });

  it('explains itself like every other factor', () => {
    const line = priceLine(profile, reels, 'reel', withTerms({ usageRights: 'whitelisting-90' }));
    const usage = line.adjustments.find((a) => a.label.startsWith('Usage rights'));
    expect(usage?.rationale).toContain('3 × 30 days');
  });
});

describe('the introductory rate', () => {
  const intro = withTerms({ introductory: true });

  it('applies, named, while the creator has no results on record', () => {
    const line = priceLine(profile, reels, 'reel', intro);
    expect(line.introductory).toBe(true);
    expect(line.target).toBeLessThan(organic.target);
    expect(line.adjustments.find((a) => a.label === 'Introductory rate')?.factor).toBe(INTRODUCTORY_RATE.factor);
  });

  it('lapses with the first result, whatever the terms say', () => {
    const proven = { ...profile, proofPoints: [{ id: 'p', label: 'First deal', result: '1,200 clicks' }] };
    const line = priceLine(proven, reels, 'reel', intro);
    expect(line.introductory).toBe(false);
    expect(line.target).toBe(priceLine(proven, reels, 'reel').target);
  });

  it('is the one case that goes below the cost of the work, and says so in the pitch', () => {
    const nano: Channel = { ...reels, followers: 3_000, medianViews: 900 };
    const small = { ...profile, channels: [nano] };
    const line = priceLine(small, nano, 'reel', intro);
    expect(line.flooredByProduction).toBe(true);
    expect(line.target).toBeLessThan(priceLine(small, nano, 'reel').productionFloor);

    const prospect: Prospect = {
      id: 'p', brand: 'Acme', product: 'Acme', niche: 'lifestyle', contactName: '', contactEmail: '',
      budgetBand: [0, 0], sellsInto: ['tier1'], evidence: '', stage: 'researching', lastContactedOn: '', notes: '',
    };
    expect(composePitch(small, prospect, line).body).toContain('introductory rate');
  });
});

describe('the paid-market reference', () => {
  it('shows what creators this size are paid, with its source', () => {
    expect(organic.market?.typical).toBeGreaterThan(0);
    expect(organic.market?.sentence).toContain('Smith 2026');
  });

  it('says so when the market pays more than the views-based price', () => {
    expect(organic.market?.position).toBe('below');
    expect(organic.market?.sentence).toContain('asking for the market rate is defensible');
  });

  it('is a reference, never an input: more followers move it, not the price', () => {
    const bigger = { ...reels, followers: 400_000 };
    const line = priceLine({ ...profile, channels: [bigger] }, bigger, 'reel');
    expect(line.target).toBe(organic.target);
    expect(line.market?.typical).toBeGreaterThan(organic.market?.typical ?? 0);
  });

  it('is offered only where the evidence reaches', () => {
    expect(priceLine(profile, reels, 'story').market).toBeNull();
    const yt: Channel = { ...reels, platform: 'youtube', formats: ['integration'] };
    expect(priceLine({ ...profile, channels: [yt] }, yt, 'integration').market).toBeNull();
  });
});
