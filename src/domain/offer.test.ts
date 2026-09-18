import { describe, expect, it } from 'vitest';
import { SAMPLE_PROFILE } from '../store/sample';
import { assessOffer, offerHeadline, offerReply, type Offer } from './offer';
import { DEFAULT_TERMS, priceLine } from './pricing';
import type { CreatorProfile, DealTerms } from './types';

/**
 * The evaluator is the rate card read backwards, so these tests mostly check
 * that it agrees with the engine, and that the advice it gives is the advice a
 * creator could act on without being talked out of it.
 */

const CHANNEL = SAMPLE_PROFILE.channels[0]!;

const nano: CreatorProfile = {
  ...SAMPLE_PROFILE,
  proofPoints: [],
  channels: [{ ...CHANNEL, followers: 4000, medianViews: 900 }],
};

const offerOf = (fee: number, terms: Partial<DealTerms> = {}): Offer => ({
  channelId: CHANNEL.id,
  format: CHANNEL.formats[0]!,
  fee,
  terms: { ...DEFAULT_TERMS, ...terms },
});

const priceOf = (profile: CreatorProfile, terms: Partial<DealTerms> = {}) =>
  priceLine(profile, profile.channels[0]!, profile.channels[0]!.formats[0]!, { ...DEFAULT_TERMS, ...terms });

describe('assessOffer', () => {
  it('agrees with the rate card about what the placement is worth', () => {
    const terms = { usageRights: 'whitelisting-90' as const, exclusivityDays: 90 as const };
    const assessment = assessOffer(SAMPLE_PROFILE, offerOf(1000, terms));
    expect(assessment?.line.target).toBe(priceOf(SAMPLE_PROFILE, terms).target);
  });

  it('refuses a placement the creator does not sell', () => {
    expect(assessOffer(SAMPLE_PROFILE, { ...offerOf(500), channelId: 'ch-nope' })).toBeNull();
    expect(assessOffer(SAMPLE_PROFILE, { ...offerOf(500), format: 'classified' })).toBeNull();
  });

  it('calls an offer over the stretch price strong, and one at the ask fair', () => {
    const line = priceOf(SAMPLE_PROFILE);
    expect(assessOffer(SAMPLE_PROFILE, offerOf(line.stretch))?.verdict).toBe('strong');
    expect(assessOffer(SAMPLE_PROFILE, offerOf(line.target))?.verdict).toBe('fair');
  });

  it('does not haggle over a rounding step', () => {
    const line = priceOf(SAMPLE_PROFILE);
    expect(assessOffer(SAMPLE_PROFILE, offerOf(Math.round(line.target * 0.98)))?.verdict).toBe('fair');
  });

  it('separates an offer worth countering from one below the walk-away price', () => {
    const line = priceOf(SAMPLE_PROFILE);
    expect(assessOffer(SAMPLE_PROFILE, offerOf(line.floor))?.verdict).toBe('under');
    expect(assessOffer(SAMPLE_PROFILE, offerOf(Math.round(line.floor * 0.5)))?.verdict).toBe('below-floor');
  });

  it('reports the gap to the ask, and never a negative one', () => {
    const line = priceOf(SAMPLE_PROFILE);
    expect(assessOffer(SAMPLE_PROFILE, offerOf(line.target - 400))?.gap).toBeGreaterThan(0);
    expect(assessOffer(SAMPLE_PROFILE, offerOf(line.stretch * 2))?.gap).toBe(0);
  });
});

describe('what the sponsor is asking for', () => {
  it('prices each term the sponsor wants, with a sentence for each', () => {
    const assessment = assessOffer(
      SAMPLE_PROFILE,
      offerOf(500, { usageRights: 'full-buyout', exclusivityDays: 90, rush: true }),
    );
    const labels = assessment?.termCosts.map((c) => c.label) ?? [];
    expect(labels.some((l) => /Usage rights/.test(l))).toBe(true);
    expect(labels.some((l) => /exclusivity/i.test(l))).toBe(true);
    expect(labels.some((l) => /Rush/.test(l))).toBe(true);
    for (const cost of assessment?.termCosts ?? []) {
      expect(cost.amount).toBeGreaterThan(0);
      expect(cost.rationale.length).toBeGreaterThan(30);
    }
  });

  it('says nothing about terms a plain placement already includes', () => {
    expect(assessOffer(SAMPLE_PROFILE, offerOf(500))?.termCosts).toEqual([]);
  });

  it('prices a volume discount as the discount it is', () => {
    const assessment = assessOffer(SAMPLE_PROFILE, offerOf(500, { bundleSize: 4 }));
    const volume = assessment?.termCosts.find((c) => /Volume/.test(c.label));
    expect(volume?.amount).toBeLessThan(0);
  });
});

describe('what to give back instead of the price', () => {
  it('offers the smallest give first, and says which ones close the deal', () => {
    const assessment = assessOffer(
      SAMPLE_PROFILE,
      offerOf(800, { usageRights: 'full-buyout', exclusivityDays: 90, rush: true }),
    );
    const saves = assessment?.concessions.map((c) => c.saves) ?? [];
    expect(saves.length).toBeGreaterThan(1);
    expect([...saves].sort((a, b) => a - b)).toEqual(saves);
    for (const give of assessment?.concessions ?? []) {
      expect(give.closes).toBe(assessment!.fee >= give.price);
      expect(give.price).toBeLessThan(assessment!.line.target);
    }
  });

  it('has nothing to give back when the sponsor asked for nothing extra', () => {
    expect(assessOffer(SAMPLE_PROFILE, offerOf(100))?.concessions).toEqual([]);
  });
});

describe('the CPM the sponsor is paying', () => {
  it('is reported when the price comes from the audience', () => {
    const assessment = assessOffer(SAMPLE_PROFILE, offerOf(2000));
    expect(assessment?.line.flooredByProduction).toBe(false);
    expect(assessment?.offeredCpm).toBeGreaterThan(0);
  });

  it('is never reported when the price is the cost of the work', () => {
    const assessment = assessOffer(nano, { ...offerOf(300), channelId: nano.channels[0]!.id });
    expect(assessment?.line.flooredByProduction).toBe(true);
    expect(assessment?.offeredCpm).toBeNull();
  });
});

describe('the reply', () => {
  it('accepts a fair offer without arguing', () => {
    const line = priceOf(SAMPLE_PROFILE);
    const assessment = assessOffer(SAMPLE_PROFILE, offerOf(line.target))!;
    const reply = offerReply(assessment, 'Hetzner');
    expect(reply).toContain('Hetzner');
    expect(reply).toMatch(/that works/i);
  });

  it('counters a low offer by naming what the terms cost, not by pleading', () => {
    const assessment = assessOffer(SAMPLE_PROFILE, offerOf(400, { usageRights: 'full-buyout', exclusivityDays: 90 }))!;
    const reply = offerReply(assessment, 'Linear');
    expect(reply).toContain('£400');
    expect(reply).toMatch(/usage rights|exclusivity/i);
    expect(reply).not.toMatch(/sorry|afford|please|hope/i);
  });

  it('offers a smaller job when the fee can be reached by giving something back', () => {
    const line = priceOf(SAMPLE_PROFILE, { usageRights: 'full-buyout', rush: true });
    const assessment = assessOffer(SAMPLE_PROFILE, offerOf(Math.round(line.target * 0.9), { usageRights: 'full-buyout', rush: true }))!;
    const closes = assessment.concessions.find((c) => c.closes)!;
    const reply = offerReply(assessment, '');
    expect(reply).toMatch(/scope rather than rate/);
    // The sentence is quoted as written, not mangled into the middle of another.
    expect(reply).toContain(closes.sentence);
  });

  it('says so when nothing it can give back reaches the offer', () => {
    const assessment = assessOffer(SAMPLE_PROFILE, offerOf(200, { usageRights: 'full-buyout', exclusivityDays: 90 }))!;
    expect(assessment.concessions.every((c) => !c.closes)).toBe(true);
    const reply = offerReply(assessment, 'Linear');
    const most = assessment.concessions[assessment.concessions.length - 1]!;
    expect(reply).not.toMatch(/the way to get there/);
    expect(reply).toContain(most.sentence);
    expect(reply).toMatch(/not the right one for us/);
  });

  it('never invents a number that is not in the assessment', () => {
    const assessment = assessOffer(SAMPLE_PROFILE, offerOf(400, { exclusivityDays: 30 }))!;
    const known = new Set(
      [assessment.fee, assessment.line.target, ...assessment.termCosts.map((c) => c.amount), ...assessment.concessions.map((c) => c.price)]
        .map((n) => Math.round(n).toLocaleString('en-GB')),
    );
    for (const found of offerReply(assessment, 'Linear').match(/£[\d,]+/g) ?? []) {
      expect(known).toContain(found.slice(1));
    }
  });

  it('has a headline for every verdict', () => {
    for (const fee of [50, 400, 1200, 100000]) {
      const assessment = assessOffer(SAMPLE_PROFILE, offerOf(fee))!;
      expect(offerHeadline(assessment).length).toBeGreaterThan(20);
    }
  });
});
