import {
  BUYOUT,
  EXCLUSIVITY_UPLIFT,
  GEO_WEIGHT,
  INTRODUCTORY_RATE,
  MARKET_PAY,
  MEDIAN_ENGAGEMENT,
  NICHE_MULTIPLIER,
  PAID_USAGE,
  PAID_USAGE_DAYS,
  PRODUCTION_FLOOR,
  baseCpm,
} from './benchmarks';
import type {
  Adjustment,
  Channel,
  CreatorProfile,
  DealTerms,
  Format,
  GeoSplit,
  MarketReference,
  RateLine,
} from './types';

/** Terms that assume nothing: one asset, creator's channel only, no exclusivity. */
export const DEFAULT_TERMS: DealTerms = {
  exclusivityDays: 0,
  usageRights: 'organic-only',
  revisions: 1,
  rush: false,
  bundleSize: 1,
  declaredSpend: 0,
  introductory: false,
};

/** Constrain a value to a range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when the creator has recorded any audience geography at all. */
export function hasGeo(geo: GeoSplit): boolean {
  return geo.tier1 + geo.tier2 + geo.tier3 > 0;
}

/** True once the creator has a single result on record. It ends the introductory rate. */
export function hasResults(profile: CreatorProfile): boolean {
  return profile.proofPoints.some((p) => p.result.trim().length > 0);
}

/**
 * Normalise a geography split to shares summing to 1.
 * An all-zero split falls back to an all-tier-1 assumption, which is the
 * optimistic reading. It is a pricing placeholder, never a claim: the media kit
 * flags it, and nothing addressed to a sponsor may state it as a fact.
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

/** Round to two significant figures: "about 80,000", and too coarse to fingerprint anyone. */
export function roundHard(n: number): number {
  if (n <= 0) return 0;
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / magnitude) * magnitude;
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

/** Describe the geography multiplier, without inventing a split nobody recorded. */
function geoRationale(geo: GeoSplit): string {
  if (!hasGeo(geo)) {
    return 'No audience geography recorded, so this assumes a top-spend audience. Fill in the split before quoting this line.';
  }
  const tier1Pct = Math.round(normaliseGeo(geo).tier1 * 100);
  return `${tier1Pct}% of the audience sits in the highest-spending advertising markets.`;
}

/** Audience-quality and category adjustments that apply to every deal. */
function audienceAdjustments(profile: CreatorProfile, channel: Channel): Adjustment[] {
  const niche = NICHE_MULTIPLIER[profile.niche];
  const geo = geoFactor(profile.geo);
  const engagement = engagementFactor(channel);

  return [
    { label: 'Category demand', factor: niche, rationale: nicheRationale(niche) },
    { label: 'Audience geography', factor: geo, rationale: geoRationale(profile.geo) },
    {
      label: 'Engagement vs platform norm',
      factor: engagement,
      rationale: engagementRationale(engagement),
    },
  ];
}

/** Adjustments from the commercial terms, other than paid usage, which depends on the price. */
function termsAdjustments(profile: CreatorProfile, terms: DealTerms): Adjustment[] {
  const out: Adjustment[] = [];

  if (terms.introductory && !hasResults(profile)) {
    out.push({
      label: 'Introductory rate',
      factor: INTRODUCTORY_RATE.factor,
      rationale:
        "An introductory rate, offered until the first result is on record, in exchange for permission to publish this campaign's results as a case study.",
    });
  }

  if (terms.exclusivityDays > 0) {
    out.push({
      label: `Category exclusivity, ${terms.exclusivityDays} days`,
      factor: EXCLUSIVITY_UPLIFT[terms.exclusivityDays] ?? 1,
      rationale: `Turning away every competitor for ${terms.exclusivityDays} days has a real cost, and this covers it.`,
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

/** What one period of paid usage costs on a placement with this organic price. */
export function periodFee(organic: number): number {
  return Math.max(PAID_USAGE.sharePerPeriod * organic, PAID_USAGE.minimumPerPeriod);
}

/**
 * The fee for paid usage on top of an organic price, and the sentence that
 * justifies it. Zero for organic-only rights or an unsellable placement.
 */
export function usageFee(terms: DealTerms, organic: number): { fee: number; rationale: string } {
  if (terms.usageRights === 'organic-only' || organic <= 0) return { fee: 0, rationale: '' };
  const spendFee = PAID_USAGE.shareOfDeclaredSpend * Math.max(0, terms.declaredSpend);
  const spendPct = Math.round(PAID_USAGE.shareOfDeclaredSpend * 100);
  const spendSentence = `Priced at ${spendPct}% of the sponsor's declared £${terms.declaredSpend.toLocaleString('en-GB')} paid spend, so the fee scales with how widely your face is used.`;

  if (terms.usageRights === 'full-buyout') {
    const licence = Math.max(BUYOUT.shareOfOrganic * organic, BUYOUT.minimumPeriods * PAID_USAGE.minimumPerPeriod);
    if (spendFee > licence) return { fee: spendFee, rationale: spendSentence };
    return {
      fee: licence,
      rationale: `A buyout lets the sponsor run this asset anywhere, forever. That is a media licence, priced as the placement again and never below ${BUYOUT.minimumPeriods} months of paid usage.`,
    };
  }

  const periods = PAID_USAGE_DAYS[terms.usageRights] / PAID_USAGE.periodDays;
  const byPeriod = periods * periodFee(organic);
  if (spendFee > byPeriod) return { fee: spendFee, rationale: spendSentence };
  const pct = Math.round(PAID_USAGE.sharePerPeriod * 100);
  return {
    fee: byPeriod,
    rationale: `${periods} × ${PAID_USAGE.periodDays} days of paid usage, each priced at ${pct}% of the placement with a £${PAID_USAGE.minimumPerPeriod} minimum. The sponsor's paid reach does not shrink with your audience, so neither does the fee.`,
  };
}

/**
 * What the paid market pays a creator this size for this deliverable, where
 * the evidence covers it. A reference beside the price, never an input to it.
 */
export function marketReference(channel: Channel, format: Format, organic: number): MarketReference | null {
  if (!MARKET_PAY.platforms.includes(channel.platform) || !MARKET_PAY.formats.includes(format)) return null;
  if (channel.followers <= 0 || organic <= 0) return null;
  const usd = MARKET_PAY.usdAt10kFollowers * (channel.followers / 10_000) ** MARKET_PAY.elasticity;
  const typical = roundToNegotiable(usd / MARKET_PAY.usdPerGbp);
  const ratio = organic / typical;
  const position = ratio < 1 - MARKET_PAY.inLineTolerance ? 'below' : ratio > 1 + MARKET_PAY.inLineTolerance ? 'above' : 'in-line';
  const basis = `Creators with about ${roundHard(channel.followers).toLocaleString('en-GB')} followers are typically paid about £${typical.toLocaleString('en-GB')} per deliverable (${MARKET_PAY.citation}).`;
  const sentence = {
    below: `${basis} The market pays on followers and this card prices on views, so asking for the market rate is defensible.`,
    above: `${basis} This price sits above that, so expect to negotiate, and know which line of the derivation you will defend.`,
    'in-line': `${basis} This price is in line with it.`,
  }[position];
  return { typical, followers: channel.followers, position, sentence };
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
  const audience = audienceAdjustments(profile, channel);
  const commercial = termsAdjustments(profile, terms);
  const product = (list: Adjustment[]) => list.reduce((acc, a) => acc * a.factor, 1);

  // Terms scale the labour cost too: an exclusive, rushed piece is still more
  // work. Audience multipliers do not, since the floor is about the work.
  const termsFactor = product(commercial);
  const media = (impressions / 1000) * cpm * product(audience) * termsFactor;
  const sellable = cpm > 0 && impressions > 0;
  const production = sellable ? PRODUCTION_FLOOR[format] * termsFactor : 0;
  const organic = Math.max(media, production);

  // Paid usage is priced on the organic price, then applied to both numbers
  // alike so the derivation still reads as one list of factors.
  const usage = usageFee(terms, organic);
  const usageFactor = organic > 0 ? 1 + usage.fee / organic : 1;
  const adjustments = [...audience, ...commercial];
  if (usage.fee > 0) {
    adjustments.push({
      label: `Usage rights: ${terms.usageRights.replace(/-/g, ' ')}`,
      factor: usageFactor,
      rationale: usage.rationale,
    });
  }

  const mediaValue = media * usageFactor;
  const productionFloor = production * usageFactor;
  return {
    channelId: channel.id,
    platform: channel.platform,
    format,
    effectiveImpressions: impressions,
    baseCpm: cpm,
    adjustments,
    mediaValue: roundToNegotiable(mediaValue),
    productionFloor: roundToNegotiable(productionFloor),
    flooredByProduction: production > media,
    target: roundToNegotiable(organic * usageFactor),
    // Below the production floor the honest answer is no, so the walk-away
    // price never drops beneath it however small the audience.
    floor: roundToNegotiable(Math.max(mediaValue * 0.78, productionFloor)),
    stretch: roundToNegotiable(Math.max(mediaValue * 1.35, productionFloor * 1.25)),
    introductory: commercial.some((a) => a.label === 'Introductory rate'),
    market: marketReference(channel, format, organic),
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
