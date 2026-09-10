import { PLATFORM_LABEL, REACH_RATIO_FLOOR } from './benchmarks';
import { hasGeo, normaliseGeo } from './pricing';
import type { Channel, CreatorProfile } from './types';

/**
 * Derived audience facts for the media kit.
 *
 * The honest framing matters here: a creator who sums followers across five
 * platforms and calls it "reach" is counting the same person five times, and
 * any experienced sponsor knows it. This module reports impressions per
 * placement instead, and says so.
 */

export interface ChannelSignal {
  channel: Channel;
  /** Median views as a share of followers. */
  reachRatio: number;
  /** True when reach falls below the platform's credibility floor. */
  underReaching: boolean;
  /** True when views far exceed the follower count, i.e. algorithmic reach. */
  algorithmDriven: boolean;
}

export interface MediaKitSummary {
  /** Sum of followers across channels. Overlapping, and labelled as such. */
  totalFollowers: number;
  /** Sum of median views per placement. The number a sponsor should price on. */
  impressionsPerRound: number;
  /** Audience-weighted engagement rate across channels. */
  blendedEngagement: number;
  tier1Share: number;
  signals: ChannelSignal[];
  /** Plain-language problems a sponsor will spot before the creator does. */
  warnings: string[];
}

/** Compute reach and credibility signals for one channel. */
function signalFor(channel: Channel): ChannelSignal {
  const reachRatio = channel.followers > 0 ? channel.medianViews / channel.followers : 0;
  return {
    channel,
    reachRatio,
    underReaching: channel.followers > 0 && reachRatio < REACH_RATIO_FLOOR[channel.platform],
    algorithmDriven: reachRatio > 3,
  };
}

/** Problems worth naming before a sponsor names them. */
function collectWarnings(profile: CreatorProfile, signals: ChannelSignal[]): string[] {
  const warnings: string[] = [];

  for (const s of signals) {
    if (s.underReaching) {
      warnings.push(
        `${PLATFORM_LABEL[s.channel.platform]} reaches ${Math.round(s.reachRatio * 100)}% of its followers per post, below what sponsors expect. Lead with impressions, not follower count.`,
      );
    }
    if (s.algorithmDriven) {
      warnings.push(
        `${PLATFORM_LABEL[s.channel.platform]} views run well ahead of the follower count, so reach depends on the algorithm rather than a returning audience. Expect sponsors to ask about consistency.`,
      );
    }
  }

  const geo = normaliseGeo(profile.geo);
  if (profile.geo.tier1 + profile.geo.tier2 + profile.geo.tier3 <= 0) {
    warnings.push(
      'No audience geography recorded, so pricing assumes an entirely tier-1 audience. That is the most optimistic reading and the first thing a sponsor will test.',
    );
  } else if (geo.tier1 < 0.35) {
    warnings.push(
      `Only ${Math.round(geo.tier1 * 100)}% of the audience sits in top-spend markets. Target sponsors who sell where the audience actually is, rather than the obvious brands.`,
    );
  }

  if (profile.proofPoints.length === 0) {
    warnings.push(
      'No past results recorded. A single concrete outcome from a previous sponsor moves reply rates more than any amount of audience data.',
    );
  }

  return warnings;
}

/**
 * Summarise a profile into the numbers and caveats a media kit should carry.
 * Pure function of the profile.
 */
export function summarise(profile: CreatorProfile): MediaKitSummary {
  const signals = profile.channels.map(signalFor);
  const totalFollowers = profile.channels.reduce((sum, c) => sum + c.followers, 0);
  const impressionsPerRound = profile.channels.reduce((sum, c) => sum + c.medianViews, 0);

  const weighted = profile.channels.reduce(
    (sum, c) => sum + c.engagementRate * c.medianViews,
    0,
  );

  return {
    totalFollowers,
    impressionsPerRound,
    blendedEngagement: impressionsPerRound > 0 ? weighted / impressionsPerRound : 0,
    tier1Share: normaliseGeo(profile.geo).tier1,
    signals,
    warnings: collectWarnings(profile, signals),
  };
}

/**
 * The three strongest facts about this creator, phrased for a cold email.
 * Ordered by how much a sponsor cares: delivered attention, then
 * responsiveness, then market fit.
 */
export function headlineEvidence(profile: CreatorProfile): string[] {
  const summary = summarise(profile);
  const best = [...profile.channels].sort((a, b) => b.medianViews - a.medianViews)[0];
  const facts: string[] = [];

  if (best) {
    facts.push(
      `${best.medianViews.toLocaleString('en-GB')} median views per ${PLATFORM_LABEL[best.platform]} post, not a one-off peak`,
    );
  }
  if (summary.blendedEngagement > 0) {
    facts.push(
      `${(summary.blendedEngagement * 100).toFixed(1)}% engagement rate across ${profile.channels.length} channel${profile.channels.length === 1 ? '' : 's'}`,
    );
  }
  // The all-tier-1 fallback prices an unrecorded split; it must never reach a
  // sponsor as a statement about the audience.
  if (hasGeo(profile.geo) && summary.tier1Share > 0) {
    facts.push(`${Math.round(summary.tier1Share * 100)}% of the audience in top-spend markets`);
  }

  return facts.slice(0, 3);
}
