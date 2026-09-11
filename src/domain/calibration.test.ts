import { describe, expect, it } from 'vitest';
import { FORMAT_LABEL, PLATFORM_LABEL } from './benchmarks';
import { DEFAULT_TERMS, buildRateCard, effectiveCpm } from './pricing';
import type { CreatorProfile, Format, GeoSplit, Niche, Platform } from './types';

/**
 * Calibration sweep.
 *
 * Unit tests prove the engine is internally consistent. They cannot tell you
 * the answers are sensible. This file runs realistic creator archetypes end to
 * end and asserts the headline price lands somewhere a working creator would
 * recognise. When a band in benchmarks.ts is edited, this is what catches the
 * edit turning a £400 placement into a £40 one.
 *
 * Run `npx vitest run calibration --reporter=verbose` to see the table.
 */

interface Archetype {
  name: string;
  niche: Niche;
  platform: Platform;
  format: Format;
  followers: number;
  medianViews: number;
  engagementRate: number;
  geo: GeoSplit;
  /**
   * The range a working creator in this position would recognise, in GBP.
   * The lower bound is a walk-away price, not a target: for a small audience
   * the production floor binds, and the floor answers "below what is this not
   * worth making" rather than "what should I ask for".
   */
  expect: [number, number];
}

const ARCHETYPES: Archetype[] = [
  {
    name: 'Nano tech YouTuber',
    niche: 'technology',
    platform: 'youtube',
    format: 'dedicated',
    followers: 4_000,
    medianViews: 900,
    engagementRate: 0.06,
    geo: { tier1: 60, tier2: 25, tier3: 15 },
    expect: [150, 600],
  },
  {
    name: 'Micro tech YouTuber',
    niche: 'technology',
    platform: 'youtube',
    format: 'integration',
    followers: 25_000,
    medianViews: 8_000,
    engagementRate: 0.05,
    geo: { tier1: 65, tier2: 22, tier3: 13 },
    expect: [200, 900],
  },
  {
    name: 'Mid-size finance YouTuber',
    niche: 'finance',
    platform: 'youtube',
    format: 'dedicated',
    followers: 200_000,
    medianViews: 60_000,
    engagementRate: 0.045,
    geo: { tier1: 72, tier2: 18, tier3: 10 },
    expect: [1_800, 5_000],
  },
  {
    name: 'Large entertainment YouTuber',
    niche: 'entertainment',
    platform: 'youtube',
    format: 'integration',
    followers: 1_200_000,
    medianViews: 400_000,
    engagementRate: 0.04,
    geo: { tier1: 55, tier2: 20, tier3: 25 },
    expect: [3_000, 12_000],
  },
  {
    name: 'Micro beauty TikToker',
    niche: 'beauty',
    platform: 'tiktok',
    format: 'short',
    followers: 80_000,
    medianViews: 25_000,
    engagementRate: 0.07,
    geo: { tier1: 45, tier2: 20, tier3: 35 },
    expect: [150, 700],
  },
  {
    name: 'Small B2B newsletter',
    niche: 'b2b-software',
    platform: 'newsletter',
    format: 'primary-slot',
    followers: 5_000,
    medianViews: 2_000,
    engagementRate: 0.05,
    geo: { tier1: 70, tier2: 20, tier3: 10 },
    // Was 200–900, a guess. Paved's marketplace data puts a 5k-subscriber
    // primary slot at $125–250 (about £94–188) and finds no premium for
    // scarcity; B2B earns the top of that. See docs/research.
    expect: [90, 400],
  },
  {
    name: 'Established tech podcast',
    niche: 'technology',
    platform: 'podcast',
    format: 'episode-read',
    followers: 40_000,
    medianViews: 18_000,
    engagementRate: 0.012,
    geo: { tier1: 68, tier2: 20, tier3: 12 },
    expect: [300, 1_400],
  },
  {
    name: 'Gaming streamer',
    niche: 'gaming',
    platform: 'twitch',
    format: 'stream',
    followers: 60_000,
    medianViews: 3_500,
    engagementRate: 0.025,
    geo: { tier1: 50, tier2: 22, tier3: 28 },
    // A live read is genuinely cheap to produce, so the floor sits low.
    expect: [100, 700],
  },
  {
    name: 'Lifestyle Instagram creator',
    niche: 'lifestyle',
    platform: 'instagram',
    format: 'reel',
    followers: 120_000,
    medianViews: 30_000,
    engagementRate: 0.03,
    geo: { tier1: 58, tier2: 24, tier3: 18 },
    expect: [200, 900],
  },
];

/** Build a single-channel profile for an archetype. */
function profileFor(a: Archetype): CreatorProfile {
  return {
    name: a.name,
    tagline: '',
    niche: a.niche,
    geo: a.geo,
    contactEmail: 'test@example.com',
    proofPoints: [],
    channels: [
      {
        id: 'ch-1',
        platform: a.platform,
        handle: '@test',
        followers: a.followers,
        medianViews: a.medianViews,
        engagementRate: a.engagementRate,
        formats: [a.format],
      },
    ],
  };
}

describe('calibration sweep', () => {
  it('prices every archetype somewhere a working creator would recognise', () => {
    const rows: string[] = [];
    const failures: string[] = [];

    for (const archetype of ARCHETYPES) {
      const [line] = buildRateCard(profileFor(archetype), DEFAULT_TERMS);
      if (!line) throw new Error(`no rate line for ${archetype.name}`);

      const [low, high] = archetype.expect;
      const inRange = line.target >= low && line.target <= high;

      const market = line.market ? `paid ~£${line.market.typical} (${(line.target / line.market.typical).toFixed(1)}x)` : '';
      rows.push(
        [
          archetype.name.padEnd(30),
          `${PLATFORM_LABEL[archetype.platform]} ${FORMAT_LABEL[archetype.format]}`.padEnd(34),
          `${archetype.medianViews.toLocaleString('en-GB')} views`.padStart(15),
          `£${line.target.toLocaleString('en-GB')}`.padStart(9),
          (line.flooredByProduction ? 'on time' : `£${effectiveCpm(line).toFixed(2)} CPM`).padStart(
            13,
          ),
          (inRange ? 'ok' : `OUT (expected £${low}–£${high})`).padEnd(4),
          market,
        ].join('  '),
      );

      if (!inRange) {
        failures.push(
          `${archetype.name}: £${line.target}, expected £${low}–£${high}`,
        );
      }
    }

    console.log(`\n${rows.join('\n')}\n`);

    expect(failures).toEqual([]);
  });

  /**
   * The ranges above were written by the same hand as the benchmarks, which is
   * circular. This is the outside anchor: Smith's curve over 15,047 paid deals.
   * SevenSix's UK asking prices sit about 3x above it, so a card more than 3x
   * off in either direction has left the market, not merely negotiated it.
   */
  it('stays within 3x of what the paid market pays, where the evidence covers it', () => {
    const outliers: string[] = [];
    for (const archetype of ARCHETYPES) {
      const [line] = buildRateCard(profileFor(archetype), DEFAULT_TERMS);
      if (!line?.market) continue;
      const ratio = line.target / line.market.typical;
      if (ratio > 3 || ratio < 1 / 3) outliers.push(`${archetype.name}: ${ratio.toFixed(2)}x`);
    }
    expect(outliers).toEqual([]);
  });

  it('never prices a placement below the cost of making it', () => {
    for (const archetype of ARCHETYPES) {
      const [line] = buildRateCard(profileFor(archetype), DEFAULT_TERMS);
      if (!line) continue;
      // A dedicated video is a day of work whoever makes it.
      expect(line.target).toBeGreaterThan(50);
    }
  });

  it('keeps price monotonic in audience size, all else equal', () => {
    const base = ARCHETYPES[2];
    if (!base) throw new Error('missing archetype');

    const sizes = [5_000, 20_000, 60_000, 200_000];
    const prices = sizes.map((medianViews) => {
      const [line] = buildRateCard(profileFor({ ...base, medianViews }), DEFAULT_TERMS);
      return line?.target ?? 0;
    });

    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i] ?? 0).toBeGreaterThan(prices[i - 1] ?? 0);
    }
  });
});
