import type { CreatorProfile, Prospect } from '../domain/types';

/**
 * A worked example, loaded on first run so the app opens with something to
 * argue with rather than an empty form. Every number here is invented.
 */
export const SAMPLE_PROFILE: CreatorProfile = {
  name: 'Ada Trelawny',
  tagline: 'Self-hosted tooling, explained slowly',
  niche: 'technology',
  geo: { tier1: 62, tier2: 24, tier3: 14 },
  contactEmail: 'ada@example.com',
  channels: [
    {
      id: 'ch-1',
      platform: 'youtube',
      handle: '@adabuilds',
      followers: 84_000,
      medianViews: 31_000,
      engagementRate: 0.052,
      formats: ['dedicated', 'integration', 'mention'],
    },
    {
      id: 'ch-2',
      platform: 'newsletter',
      handle: 'The Slow Build',
      followers: 9_400,
      medianViews: 4_100,
      engagementRate: 0.061,
      formats: ['primary-slot', 'classified'],
    },
  ],
  proofPoints: [
    {
      id: 'pp-1',
      label: 'Tailscale, February 2026, 90s integration',
      result: '3,880 link clicks and 410 trial starts at £2.40 per signup',
    },
    {
      id: 'pp-2',
      label: 'Hetzner, November 2025, newsletter primary slot',
      result: '11.2% click rate, best-performing placement of their quarter',
    },
  ],
};

/** Example prospects across the fit range, so the pipeline opens with something to rank. Invented. */
export const SAMPLE_PROSPECTS: Prospect[] = [
  {
    id: 'pr-1',
    brand: 'Linear',
    product: 'Linear, an issue tracker for software teams',
    niche: 'b2b-software',
    contactName: '',
    contactEmail: '',
    budgetBand: [3_000, 12_000],
    sellsInto: ['tier1', 'tier2'],
    evidence:
      'Sponsored several developer-tooling channels through 2025 and 2026, e.g. https://example.com/linear-integration',
    stage: 'researching',
    lastContactedOn: '',
    notes: 'Find the person who runs creator marketing before pitching.',
  },
  {
    id: 'pr-2',
    brand: 'Hetzner',
    product: 'Hetzner Cloud servers',
    niche: 'technology',
    contactName: 'Marek',
    contactEmail: 'partnerships@example.com',
    budgetBand: [2_000, 6_000],
    sellsInto: ['tier1', 'tier2', 'tier3'],
    evidence: 'Already sponsored the newsletter in November 2025 and asked about repeating.',
    stage: 'replied',
    lastContactedOn: '2026-09-02',
    notes: 'Warm. Lead with the 11.2% click rate from last time.',
  },
  {
    id: 'pr-3',
    brand: 'Glossier',
    product: 'Skincare range',
    niche: 'beauty',
    contactName: '',
    contactEmail: '',
    budgetBand: [500, 2_000],
    sellsInto: ['tier1'],
    evidence: '',
    stage: 'researching',
    lastContactedOn: '',
    notes: 'Kept as an example of a prospect the score should talk you out of.',
  },
];
