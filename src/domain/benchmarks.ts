import type { Format, Niche, Platform, UsageRights } from './types';

/**
 * Seeded market assumptions.
 *
 * These are starting points drawn from publicly circulated creator rate-card
 * norms for 2025-26, expressed in GBP. They are NOT audited market data, and
 * the app treats every one of them as an editable assumption rather than a
 * fact. The value of the engine is that the derivation is explicit: change a
 * band here and every price downstream moves for a stated reason.
 */

/** Base cost per thousand impressions, GBP, assuming a tier-1 audience. */
const CPM_BANDS: Record<Platform, Partial<Record<Format, number>>> = {
  youtube: { dedicated: 32, integration: 20, mention: 11 },
  'youtube-shorts': { short: 5 },
  tiktok: { short: 7, mention: 4 },
  instagram: { reel: 11, post: 9, story: 6 },
  twitch: { stream: 12, mention: 6 },
  x: { post: 5, mention: 3 },
  newsletter: { 'primary-slot': 55, classified: 18, mention: 12 },
  podcast: { 'episode-read': 26, mention: 14 },
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

/** Uplift for granting a sponsor category exclusivity for a window. */
export const EXCLUSIVITY_UPLIFT: Record<number, number> = {
  0: 1.0,
  30: 1.08,
  60: 1.15,
  90: 1.22,
  180: 1.4,
};

/** Uplift for what the sponsor may do with the asset after delivery. */
export const USAGE_UPLIFT: Record<UsageRights, number> = {
  'organic-only': 1.0,
  'whitelisting-30': 1.25,
  'whitelisting-90': 1.45,
  'full-buyout': 1.9,
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
