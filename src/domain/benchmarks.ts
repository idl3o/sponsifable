import type { Format, Niche, Platform, UsageRights } from './types';

/**
 * Seeded market assumptions.
 *
 * These are starting points drawn from publicly circulated creator rate-card
 * norms for 2025-26, expressed in GBP. They are NOT audited market data, and
 * the app treats every one of them as an editable assumption rather than a
 * fact. The value of the engine is that the derivation is explicit: change a
 * band here and every price downstream moves for a stated reason.
 *
 * Evidence for the September 2026 revisions, with every figure marked asking
 * or paid, is in docs/research/new-creator-economics-2026-09.md ("research"
 * below). The social CPMs could not be validated against any primary data.
 */

/** Base cost per thousand impressions, GBP, assuming a tier-1 audience. */
const CPM_BANDS: Record<Platform, Partial<Record<Format, number>>> = {
  youtube: { dedicated: 32, integration: 20, mention: 11 },
  'youtube-shorts': { short: 5 },
  tiktok: { short: 7, mention: 4 },
  instagram: { reel: 11, post: 9, story: 6 },
  twitch: { stream: 12, mention: 6 },
  x: { post: 5, mention: 3 },
  // £55 per thousand opens is about £25 per thousand subscribers at a 45%
  // open rate, inside Paved's marketplace range of $25–50 (research).
  newsletter: { 'primary-slot': 55, classified: 18, mention: 12 },
  // Was 26. AdvertiseCast's 2024 sales average for a 60s host read is
  // £16–17 (paid, high reliability); 19 leaves room for a niche premium.
  podcast: { 'episode-read': 19, mention: 14 },
};

/** Formats each platform can legitimately sell. */
export const FORMATS_BY_PLATFORM: Record<Platform, Format[]> = {
  youtube: ['dedicated', 'integration', 'mention'],
  'youtube-shorts': ['short'],
  tiktok: ['short', 'mention'],
  instagram: ['reel', 'post', 'story'],
  twitch: ['stream', 'mention'],
  x: ['post', 'mention'],
  newsletter: ['primary-slot', 'classified', 'mention'],
  podcast: ['episode-read', 'mention'],
};

/**
 * Advertiser willingness to pay per impression, by content category.
 * A finance audience converts into higher-value customers than an
 * entertainment audience, and sponsors price accordingly.
 */
export const NICHE_MULTIPLIER: Record<Niche, number> = {
  finance: 1.6,
  'b2b-software': 1.55,
  technology: 1.25,
  'health-fitness': 1.1,
  education: 1.05,
  travel: 0.95,
  lifestyle: 0.92,
  beauty: 1.0,
  'food-drink': 0.9,
  gaming: 0.8,
  entertainment: 0.75,
};

/** Relative advertiser spend per head of audience, by geography tier. */
export const GEO_WEIGHT = { tier1: 1.0, tier2: 0.62, tier3: 0.28 } as const;

/**
 * Typical engagement rate as a fraction of impressions, per platform.
 * Used as the denominator when judging whether an audience is unusually
 * responsive. Beating the median is worth money; missing it costs money.
 */
export const MEDIAN_ENGAGEMENT: Record<Platform, number> = {
  youtube: 0.045,
  'youtube-shorts': 0.035,
  tiktok: 0.06,
  instagram: 0.035,
  twitch: 0.02,
  x: 0.015,
  newsletter: 0.04,
  podcast: 0.01,
};

/**
 * The least an asset can sell for and still be worth making, in GBP, before
 * any commercial terms are added.
 *
 * Cost-per-impression pricing has a failure mode that hurts exactly the people
 * this tool exists for: it tells a creator with a small audience to charge
 * thirty pounds for a video that takes a day to make. Reach scales with
 * audience size. The labour does not. These floors are derived from the hours
 * each format actually costs — concepting, scripting, shooting, editing, plus
 * the contract, the disclosure compliance and the invoice — at a rate a
 * skilled freelancer would charge for creative work.
 *
 * A creator whose media value sits below the floor is not being told their
 * audience is worth more than it is. They are being told that below this
 * number, the correct answer is no.
 */
export const PRODUCTION_FLOOR: Record<Format, number> = {
  // A full video is a day and a half of work whoever is making it. This sits
  // at the top of SevenSix's UK asking band for 1–5k subscribers and 2.3x
  // Collabstr's paid YouTube average (research). That is deliberate: it is a
  // walk-away number for a day and a half of labour, not a market price.
  dedicated: 450,
  // Script, shoot, edit and brief compliance on a 60-90 second segment.
  integration: 200,
  // Short-form still takes half a day once concepting is counted.
  short: 150,
  reel: 150,
  // A static post is a couple of hours plus the commercial admin.
  post: 90,
  // A story frame is quick, but never free.
  story: 45,
  // A brief in-video mention, plus the admin every paid deal carries.
  mention: 60,
  // A live read needs prep, and commits the stream to a sponsor.
  stream: 120,
  // Was 200. Writing a sponsored section is a few hours. Paved prices a
  // 3k-subscriber slot at $75–150 and found no premium for scarcity (research).
  'primary-slot': 100,
  // Secondary slots sell at 50–65% of the primary (Paved).
  classified: 60,
  // Was 150, which needed about 5,800 downloads to clear at the old CPM.
  // Prep, read and admin on a host-read spot is under two hours.
  'episode-read': 60,
};

/** Uplift for granting a sponsor category exclusivity for a window. */
export const EXCLUSIVITY_UPLIFT: Record<number, number> = {
  0: 1.0,
  30: 1.08,
  60: 1.15,
  90: 1.22,
  180: 1.4,
};

/**
 * Paid usage, priced per 30-day period rather than as a one-off uplift.
 *
 * Whitelisting and usage are conventionally charged as a share of the base
 * fee for each 30 days (20–30% in the guides; asking figures only, low
 * reliability). A share alone underprices small creators, because the value
 * of paid usage comes from the sponsor's spend, which does not shrink with
 * the creator's audience. Hence the minimum per period. The only structures
 * found that scale usage with the buyer's reach are Equity's UseFee and
 * SevenSix's formula (research).
 */
export const PAID_USAGE = {
  /** Share of the organic price charged for each period of paid usage. */
  sharePerPeriod: 0.25,
  /** The least one period of paid usage costs, whatever the audience, GBP. */
  minimumPerPeriod: 75,
  /** Days in a period. */
  periodDays: 30,
  /**
   * Share of the sponsor's declared paid spend behind the asset. The one
   * example found is 4% (Lumanu/Collectively survey): a parameter, not a
   * benchmark. Applied only when the sponsor has declared a budget.
   */
  shareOfDeclaredSpend: 0.04,
} as const;

/**
 * A full buyout: the placement priced again as a media licence, and never
 * below this many periods of paid usage at the minimum. Influencer guides
 * ask 3–4x; UGC marketplaces bundle rights at close to 1x (research).
 */
export const BUYOUT = { shareOfOrganic: 1.0, minimumPeriods: 6 } as const;

/**
 * What creators are actually paid per deliverable, by follower count.
 *
 * Smith (2026), Influencer Dynamics: log pay on log followers across 15,047
 * verified, accepted deals reported on FYPM, coefficient 0.489 (s.e. 0.006),
 * R² 0.33; $145 per deliverable at 10,000 followers. Paid prices, high
 * reliability, checked against the paper. Mostly Instagram and TikTok, so it
 * is offered only for those platforms' main formats.
 *
 * It is a reference beside the price, never an input to it. The card prices
 * on views; the market pays on followers. Showing both lets a creator whose
 * followers outrun their views ask for what the market actually pays.
 */
export const MARKET_PAY = {
  usdAt10kFollowers: 145,
  elasticity: 0.489,
  usdPerGbp: 1.33,
  deals: 15_047,
  citation: 'Smith 2026, 15,047 paid deals',
  /** Within this share either side, a price is described as in line with the market. */
  inLineTolerance: 0.15,
  platforms: ['instagram', 'tiktok'] as readonly Platform[],
  formats: ['reel', 'post', 'short'] as readonly Format[],
} as const;

/**
 * The introductory rate: a named, capped concession for a creator with no
 * results on record. New creators rationally accept deals below the cost of
 * the work, because a first proof point is worth more than the fee. This
 * makes that trade explicit, once, in exchange for permission to publish the
 * campaign's results, rather than letting it happen as a quiet discount.
 */
export const INTRODUCTORY_RATE = { factor: 0.7 } as const;

/**
 * Days of paid running each usage tier permits, counted from the first paid
 * run. Organic-only permits none; a buyout permits any. Used to price an
 * overrun as the tier the sponsor actually consumed.
 */
export const PAID_USAGE_DAYS: Record<UsageRights, number> = {
  'organic-only': 0,
  'whitelisting-30': 30,
  'whitelisting-90': 90,
  'full-buyout': Number.POSITIVE_INFINITY,
};

/**
 * Median views as a share of followers, below which an audience looks
 * inattentive or inflated. Used as a media-kit warning, never as a price cut —
 * a low ratio is a conversation to have, not a number to quietly apply.
 */
export const REACH_RATIO_FLOOR: Record<Platform, number> = {
  youtube: 0.06,
  'youtube-shorts': 0.05,
  tiktok: 0.08,
  instagram: 0.08,
  twitch: 0.02,
  x: 0.04,
  newsletter: 0.25,
  podcast: 0.2,
};

/**
 * Look up the base CPM for a platform and format.
 * @returns the CPM in GBP, or 0 if that platform does not sell that format.
 */
export function baseCpm(platform: Platform, format: Format): number {
  return CPM_BANDS[platform][format] ?? 0;
}

/** Each platform's name as a creator would write it. */
export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: 'YouTube',
  'youtube-shorts': 'YouTube Shorts',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitch: 'Twitch',
  x: 'X',
  newsletter: 'Newsletter',
  podcast: 'Podcast',
};

/** Each format's name as it appears on a rate card. */
export const FORMAT_LABEL: Record<Format, string> = {
  dedicated: 'Dedicated video',
  integration: '60–90s integration',
  mention: 'Brief mention',
  short: 'Short-form video',
  reel: 'Reel',
  story: 'Story frame',
  post: 'Feed post',
  stream: 'Stream segment',
  'primary-slot': 'Primary slot',
  classified: 'Classified',
  'episode-read': 'Host-read spot',
};

/** Each content category's name as it appears to a creator. */
export const NICHE_LABEL: Record<Niche, string> = {
  finance: 'Finance & investing',
  'b2b-software': 'B2B software',
  technology: 'Technology',
  'health-fitness': 'Health & fitness',
  education: 'Education',
  beauty: 'Beauty',
  'food-drink': 'Food & drink',
  travel: 'Travel',
  gaming: 'Gaming',
  entertainment: 'Entertainment',
  lifestyle: 'Lifestyle',
};
