import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TERMS,
  bundleFactor,
  buildRateCard,
  effectiveCpm,
  engagementFactor,
  geoFactor,
  normaliseGeo,
  priceLine,
  roundToNegotiable,
} from './pricing';
import type { Channel, CreatorProfile, DealTerms } from './types';

const channel: Channel = {
  id: 'yt',
  platform: 'youtube',
  handle: '@example',
  followers: 100_000,
  medianViews: 40_000,
  engagementRate: 0.045,
  formats: ['dedicated', 'integration', 'mention'],
};

const profile: CreatorProfile = {
  name: 'Test Creator',
  tagline: 'Testing things',
  niche: 'technology',
  geo: { tier1: 70, tier2: 20, tier3: 10 },
  channels: [channel],
  proofPoints: [],
  contactEmail: 'test@example.com',
};

describe('normaliseGeo', () => {
  it('turns raw counts into shares summing to one', () => {
    const g = normaliseGeo({ tier1: 70, tier2: 20, tier3: 10 });
    expect(g.tier1 + g.tier2 + g.tier3).toBeCloseTo(1, 10);
    expect(g.tier1).toBeCloseTo(0.7, 10);
  });

  it('falls back to all tier-1 when nothing is recorded', () => {
    expect(normaliseGeo({ tier1: 0, tier2: 0, tier3: 0 })).toEqual({
      tier1: 1,
      tier2: 0,
      tier3: 0,
    });
  });
});

describe('geoFactor', () => {
  it('scores an all tier-1 audience at parity', () => {
    expect(geoFactor({ tier1: 1, tier2: 0, tier3: 0 })).toBeCloseTo(1, 10);
  });

  it('discounts audiences in lower-spend markets', () => {
    const mixed = geoFactor({ tier1: 0, tier2: 0, tier3: 1 });
    expect(mixed).toBeLessThan(0.4);
    expect(mixed).toBeGreaterThan(0);
  });
});

describe('engagementFactor', () => {
  it('returns parity when engagement matches the platform median', () => {
    expect(engagementFactor(channel)).toBeCloseTo(1, 10);
  });

  it('damps the reward for outperforming, rather than scaling linearly', () => {
    const double = engagementFactor({ ...channel, engagementRate: 0.09 });
    expect(double).toBeGreaterThan(1.3);
    expect(double).toBeLessThan(1.45);
  });

  it('clamps extreme engagement so one metric cannot run the price', () => {
    expect(engagementFactor({ ...channel, engagementRate: 0.9 })).toBe(1.5);
    expect(engagementFactor({ ...channel, engagementRate: 0.0001 })).toBe(0.8);
  });

  it('treats a missing engagement rate as neutral rather than punitive', () => {
    expect(engagementFactor({ ...channel, engagementRate: 0 })).toBe(1);
  });
});

describe('roundToNegotiable', () => {
  it('rounds to increments a human would say out loud', () => {
    expect(roundToNegotiable(1_847)).toBe(1_850);
    expect(roundToNegotiable(612)).toBe(600);
    expect(roundToNegotiable(87)).toBe(90);
    expect(roundToNegotiable(12_340)).toBe(12_300);
  });
});

describe('bundleFactor', () => {
  it('gives no discount for a single asset', () => {
    expect(bundleFactor(1)).toBe(1);
  });

  it('discounts more for larger bundles, then flattens', () => {
    expect(bundleFactor(2)).toBeGreaterThan(bundleFactor(4));
    expect(bundleFactor(8)).toBe(bundleFactor(20));
  });
});

describe('priceLine', () => {
  it('is deterministic across repeated calls', () => {
    const a = priceLine(profile, channel, 'dedicated');
    const b = priceLine(profile, channel, 'dedicated');
    expect(a).toEqual(b);
  });

  it('orders floor below target below stretch', () => {
    const line = priceLine(profile, channel, 'dedicated');
    expect(line.floor).toBeLessThan(line.target);
    expect(line.target).toBeLessThan(line.stretch);
  });

  it('prices a dedicated video above a passing mention', () => {
    const dedicated = priceLine(profile, channel, 'dedicated');
    const mention = priceLine(profile, channel, 'mention');
    expect(dedicated.target).toBeGreaterThan(mention.target);
  });

  it('attaches a spoken rationale to every adjustment', () => {
    const line = priceLine(profile, channel, 'dedicated');
    expect(line.adjustments.length).toBeGreaterThan(0);
    for (const adjustment of line.adjustments) {
      expect(adjustment.rationale.length).toBeGreaterThan(10);
      expect(adjustment.factor).toBeGreaterThan(0);
    }
  });

  it('charges more for a buyout than for organic-only rights', () => {
    const organic = priceLine(profile, channel, 'dedicated', DEFAULT_TERMS);
    const buyout = priceLine(profile, channel, 'dedicated', {
      ...DEFAULT_TERMS,
      usageRights: 'full-buyout',
    });
    expect(buyout.target).toBeGreaterThan(organic.target * 1.5);
  });

  it('charges more for exclusivity, and more still for a longer window', () => {
    const none = priceLine(profile, channel, 'dedicated', DEFAULT_TERMS);
    const thirty = priceLine(profile, channel, 'dedicated', {
      ...DEFAULT_TERMS,
      exclusivityDays: 30,
    });
    const oneEighty = priceLine(profile, channel, 'dedicated', {
      ...DEFAULT_TERMS,
      exclusivityDays: 180,
    });
    expect(thirty.target).toBeGreaterThan(none.target);
    expect(oneEighty.target).toBeGreaterThan(thirty.target);
  });

  it('prices a format the platform does not sell at zero', () => {
    const line = priceLine(profile, channel, 'story');
    expect(line.baseCpm).toBe(0);
    expect(line.target).toBe(0);
  });

  it('survives a channel with no audience without producing nonsense', () => {
    const empty: Channel = { ...channel, followers: 0, medianViews: 0, engagementRate: 0 };
    const line = priceLine({ ...profile, channels: [empty] }, empty, 'dedicated');
    expect(line.target).toBe(0);
    expect(effectiveCpm(line)).toBe(0);
  });
});

describe('buildRateCard', () => {
  it('prices every format each channel sells', () => {
    const lines = buildRateCard(profile);
    expect(lines).toHaveLength(channel.formats.length);
  });

  it('lists the most valuable format first within a channel', () => {
    const lines = buildRateCard(profile);
    const targets = lines.map((l) => l.target);
    expect([...targets].sort((a, b) => b - a)).toEqual(targets);
  });

  it('moves every line when the terms change', () => {
    const rush: DealTerms = { ...DEFAULT_TERMS, rush: true };
    const base = buildRateCard(profile);
    const rushed = buildRateCard(profile, rush);
    for (let i = 0; i < base.length; i += 1) {
      const b = base[i];
      const r = rushed[i];
      if (!b || !r || b.target === 0) continue;
      expect(r.target).toBeGreaterThan(b.target);
    }
  });
});

describe('effectiveCpm', () => {
  it('reports the cost per thousand a sponsor is actually asked to pay', () => {
    const line = priceLine(profile, channel, 'dedicated');
    const cpm = effectiveCpm(line);
    expect(cpm).toBeCloseTo((line.target / line.effectiveImpressions) * 1000, 6);
    expect(cpm).toBeGreaterThan(line.baseCpm * 0.5);
  });
});
