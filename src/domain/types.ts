/**
 * Core domain vocabulary for Sponsorable.
 *
 * Everything here is plain data: no clock reads, no randomness, no I/O.
 * The pricing and scoring engines are pure functions over these shapes, so a
 * given profile always yields the same rate card — a creator can defend a
 * number in a negotiation because the derivation is reproducible.
 */

export type Platform =
  | 'youtube'
  | 'youtube-shorts'
  | 'tiktok'
  | 'instagram'
  | 'twitch'
  | 'x'
  | 'newsletter'
  | 'podcast';

export type Format =
  | 'dedicated'
  | 'integration'
  | 'mention'
  | 'short'
  | 'reel'
  | 'story'
  | 'post'
  | 'stream'
  | 'primary-slot'
  | 'classified'
  | 'episode-read';

/** Broad advertiser category. Drives willingness-to-pay per impression. */
export type Niche =
  | 'finance'
  | 'b2b-software'
  | 'technology'
  | 'health-fitness'
  | 'education'
  | 'beauty'
  | 'food-drink'
  | 'travel'
  | 'gaming'
  | 'entertainment'
  | 'lifestyle';

/** Audience geography tiers, by advertiser spend per head. */
export interface GeoSplit {
  /** US, UK, CA, AU, DE, NO, CH, SG — highest advertiser spend. */
  tier1: number;
  /** Western/Northern Europe, JP, KR, NZ, IE, NL and similar. */
  tier2: number;
  /** Everywhere else. */
  tier3: number;
}

/** One place a creator can sell an ad slot. */
export interface Channel {
  id: string;
  platform: Platform;
  /** Display handle, e.g. "@kernowbuilds". */
  handle: string;
  followers: number;
  /**
   * Median views (or opens, or concurrent viewers) on a recent representative
   * post. Median, not mean — one viral outlier should not price the next deal.
   */
  medianViews: number;
  /** Engagement actions (likes + comments + shares) as a fraction of views, 0..1. */
  engagementRate: number;
  /** Formats this channel actually sells. */
  formats: Format[];
}

export interface CreatorProfile {
  name: string;
  tagline: string;
  niche: Niche;
  /** Audience country mix; shares should sum to 1 but are normalised anyway. */
  geo: GeoSplit;
  channels: Channel[];
  /** Free-text proof: past sponsors, campaign results, testimonials. */
  proofPoints: ProofPoint[];
  contactEmail: string;
}

export interface ProofPoint {
  id: string;
  /** e.g. "Notion, Mar 2026 — 60s integration". */
  label: string;
  /** e.g. "4,100 clicks, 380 signups, £2.10 CAC". */
  result: string;
}

/** Commercial terms that move the price away from raw media value. */
export interface DealTerms {
  /** Days of category exclusivity granted to the sponsor. 0 = none. */
  exclusivityDays: 0 | 30 | 60 | 90 | 180;
  /** What the sponsor may do with the asset once it exists. */
  usageRights: UsageRights;
  /** Included revisions beyond the first cut. */
  revisions: number;
  /** True if the sponsor wants delivery inside two weeks. */
  rush: boolean;
  /** Number of assets bought together; volume earns a discount. */
  bundleSize: number;
}

export type UsageRights =
  /** Lives on the creator's channel only. */
  | 'organic-only'
  /** Sponsor may run paid spend behind the creator's handle. */
  | 'whitelisting-30'
  | 'whitelisting-90'
  /** Sponsor may re-cut and run the footage anywhere, in perpetuity. */
  | 'full-buyout';

/** One priced line on a rate card. */
export interface RateLine {
  channelId: string;
  platform: Platform;
  format: Format;
  /** Impressions the sponsor should expect to pay for. */
  effectiveImpressions: number;
  /** Base CPM before any adjustment, in GBP. */
  baseCpm: number;
  /** Ordered, named multipliers and uplifts applied to the base. */
  adjustments: Adjustment[];
  /** What the audience alone is worth, before any production floor applies. */
  mediaValue: number;
  /** The least this asset can sell for and still be worth making. */
  productionFloor: number;
  /**
   * True when the labour of making the asset, not the size of the audience,
   * is setting the price. Small creators are almost always in this case, and
   * the interface says so rather than quietly quoting a media number.
   */
  flooredByProduction: boolean;
  /** Recommended asking price, rounded to a negotiable increment. */
  target: number;
  /** Walk-away price. Below this, decline. */
  floor: number;
  /** Opening ask when the sponsor is large or the brief is demanding. */
  stretch: number;
}

export interface Adjustment {
  label: string;
  /** Multiplicative factor, e.g. 1.15 for a +15% uplift. */
  factor: number;
  /** One line the creator can say out loud to justify it. */
  rationale: string;
}

export type PipelineStage =
  | 'researching'
  | 'contacted'
  | 'replied'
  | 'negotiating'
  | 'won'
  | 'lost';

/** A brand worth pitching, plus everything known about the conversation. */
export interface Prospect {
  id: string;
  brand: string;
  product: string;
  niche: Niche;
  /** Named person, if known. Blank means "still researching". */
  contactName: string;
  contactEmail: string;
  /** What the sponsor is believed to pay per placement, in GBP. */
  budgetBand: [number, number];
  /** Countries the sponsor actually sells into. */
  sellsInto: Array<keyof GeoSplit>;
  /** Evidence they already sponsor creators: links, campaign notes. */
  evidence: string;
  stage: PipelineStage;
  /** ISO date (YYYY-MM-DD) of last outbound contact, or empty. */
  lastContactedOn: string;
  notes: string;
}

export type Verdict = 'strong' | 'worth-a-shot' | 'weak';

export interface FitScore {
  /** 0..100. */
  total: number;
  components: Array<{ label: string; score: number; max: number; note: string }>;
  verdict: Verdict;
}
