import {
  EXCLUSIVITY_UPLIFT,
  GEO_WEIGHT,
  MEDIAN_ENGAGEMENT,
  NICHE_MULTIPLIER,
  USAGE_UPLIFT,
  baseCpm,
} from './benchmarks';
import type {
  Adjustment,
  Channel,
  CreatorProfile,
  DealTerms,
  Format,
  GeoSplit,
  RateLine,
} from './types';

/** Terms that assume nothing: one asset, creator's channel only, no exclusivity. */
export const DEFAULT_TERMS: DealTerms = {
  exclusivityDays: 0,
  usageRights: 'organic-only',
  revisions: 1,
  rush: false,
  bundleSize: 1,
};

/** Constrain a value to a range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalise a geography split to shares summing to 1.
 * An all-zero split falls back to an all-tier-1 assumption, which is the
 * optimistic reading. The media kit flags it rather than hiding it.
 */
export function normaliseGeo(geo: GeoSplit): GeoSplit {
  const total = geo.tier1 + geo.tier2 + geo.tier3;
  if (total <= 0) return { tier1: 1, tier2: 0, tier3: 0 };
  return {
    tier1: geo.tier1 / total,
    tier2: geo.tier2 / total,
    tier3: geo.tier3 / total,
  };
}

/**
 * Blended value of the audience relative to an all-tier-1 audience.
 * @returns a factor in roughly 0.28..1.0.
 */
export function geoFactor(geo: GeoSplit): number {
  const g = normaliseGeo(geo);
  return g.tier1 * GEO_WEIGHT.tier1 + g.tier2 * GEO_WEIGHT.tier2 + g.tier3 * GEO_WEIGHT.tier3;
}

/**
 * Reward an audience that engages harder than the platform norm, and discount
 * one that does not. The square root damps the effect: being twice as engaged
 * is worth about 40% more, not 100% more, because engagement and purchase
 * intent are correlated but not equal.
 */
export function engagementFactor(channel: Channel): number {
  const median = MEDIAN_ENGAGEMENT[channel.platform];
  if (median <= 0 || channel.engagementRate <= 0) return 1;
  return clamp(Math.sqrt(channel.engagementRate / median), 0.8, 1.5);
}

/** Volume discount for buying several assets at once. */
export function bundleFactor(bundleSize: number): number {
  const n = Math.max(1, Math.floor(bundleSize));
  if (n === 1) return 1;
  if (n === 2) return 0.95;
  if (n === 3) return 0.92;
  if (n === 4) return 0.9;
  return 0.88;
}

/**
 * Round to an increment a human would actually say in a negotiation.
 * Nobody quotes 1,847 pounds.
 */
export function roundToNegotiable(amount: number): number {
  if (amount < 250) return Math.round(amount / 10) * 10;
  if (amount < 1_000) return Math.round(amount / 25) * 25;
  if (amount < 5_000) return Math.round(amount / 50) * 50;
  return Math.round(amount / 100) * 100;
}

/** Describe what the category multiplier means, in one speakable sentence. */
function nicheRationale(factor: number): string {
  if (factor >= 1.2) {
    return 'Advertisers in this category pay above-average rates because a converted viewer is worth more to them.';
  }
  if (factor >= 0.95) return 'Category demand sits close to the market average.';
  return 'Category demand runs below average, so the price leans on reach rather than intent.';
}

/** Describe the engagement multiplier, in one speakable sentence. */
function engagementRationale(factor: number): string {
  if (factor > 1.02) {
    const pct = Math.round((factor - 1) * 100);
    return `This audience engages ${pct}% harder than the platform median, so the same impression carries more attention.`;
  }
  if (factor < 0.98) {
    return 'Engagement sits below the platform median, which the price reflects honestly.';
  }
  return 'Engagement tracks the platform median.';
}

/** Audience-quality and category adjustments that apply to every deal. */
function audienceAdjustments(profile: CreatorProfile, channel: Channel): Adjustment[] {
  const niche = NICHE_MULTIPLIER[profile.niche];
  const geo = geoFactor(profile.geo);
  const engagement = engagementFactor(channel);
  const tier1Pct = Math.round(normaliseGeo(profile.geo).tier1 * 100);

  return [
    { label: 'Category demand', factor: niche, rationale: nicheRationale(niche) },
    {
      label: 'Audience geography',
      factor: geo,
      rationale: `${tier1Pct}% of the audience sits in markets where this sponsor can actually sell.`,
    },
    {
      label: 'Engagement vs platform norm',
      factor: engagement,
      rationale: engagementRationale(engagement),
    },
  ];
}

/** Adjustments that come from the commercial terms rather than the audience. */
function termsAdjustments(terms: DealTerms): Adjustment[] {
  const out: Adjustment[] = [];

  if (terms.exclusivityDays > 0) {
    out.push({
      label: `Category exclusivity, ${terms.exclusivityDays} days`,
      factor: EXCLUSIVITY_UPLIFT[terms.exclusivityDays] ?? 1,
      rationale: `Turning away every competitor for ${terms.exclusivityDays} days has a real cost, and this covers it.`,
    });
  }

  if (terms.usageRights !== 'organic-only') {
    out.push({
      label: `Usage rights: ${terms.usageRights.replace(/-/g, ' ')}`,
      factor: USAGE_UPLIFT[terms.usageRights],
      rationale:
        terms.usageRights === 'full-buyout'
          ? 'A buyout lets the sponsor run this asset anywhere, forever. That is a media licence, not a post.'
          : 'Paid spend behind the creator handle reaches far beyond the organic audience being priced here.',
    });
  }

  if (terms.revisions > 1) {
    out.push({
      label: `${terms.revisions} revisions`,
      factor: 1 + 0.05 * (terms.revisions - 1),
      rationale:
        'Each additional revision round is production time that is not spent making the next piece.',
    });
  }

  if (terms.rush) {
    out.push({
      label: 'Rush delivery',
      factor: 1.2,
      rationale: 'Delivery inside two weeks displaces already-scheduled work.',
    });
  }

  const bundle = bundleFactor(terms.bundleSize);
  if (bundle < 1) {
    out.push({
      label: `Bundle of ${terms.bundleSize}`,
      factor: bundle,
      rationale: 'Committing to several assets up front lowers the per-asset price.',
    });
  }

  return out;
}

/**
 * Price a single placement.
 *
 * Pure: same inputs, same output, no clock and no randomness. Every factor
 * applied is returned alongside the price, because a number the creator cannot
 * explain is a number they will be talked out of.
 */
export function priceLine(
  profile: CreatorProfile,
  channel: Channel,
  format: Format,
  terms: DealTerms = DEFAULT_TERMS,
): RateLine {
  const cpm = baseCpm(channel.platform, format);
  const impressions = Math.max(0, Math.round(channel.medianViews));
  const adjustments = [...audienceAdjustments(profile, channel), ...termsAdjustments(terms)];
  const compounded = adjustments.reduce((acc, a) => acc * a.factor, 1);
  const raw = (impressions / 1000) * cpm * compounded;

  return {
    channelId: channel.id,
    platform: channel.platform,
    format,
    effectiveImpressions: impressions,
    baseCpm: cpm,
    adjustments,
    target: roundToNegotiable(raw),
    floor: roundToNegotiable(raw * 0.78),
    stretch: roundToNegotiable(raw * 1.35),
  };
}

/**
 * Price every format that every channel sells.
 * @returns rate lines grouped by channel, highest-value format first.
 */
export function buildRateCard(
  profile: CreatorProfile,
  terms: DealTerms = DEFAULT_TERMS,
): RateLine[] {
  return profile.channels.flatMap((channel) =>
    channel.formats
      .map((format) => priceLine(profile, channel, format, terms))
      .sort((a, b) => b.target - a.target),
  );
}

/**
 * The effective cost per thousand a sponsor is asked to pay on a line, after
 * every adjustment. Sponsors think in CPM, so this is the number they check.
 */
export function effectiveCpm(line: RateLine): number {
  if (line.effectiveImpressions <= 0) return 0;
  return (line.target / line.effectiveImpressions) * 1000;
}

/** Total asking price if a sponsor bought one of everything. */
export function rateCardTotal(lines: RateLine[]): number {
  return lines.reduce((sum, line) => sum + line.target, 0);
}
