import { normaliseGeo } from './pricing';
import type { CreatorProfile, FitScore, GeoSplit, Niche, Prospect, RateLine } from './types';

/**
 * Prospect fit scoring.
 *
 * The purpose is triage, not truth. A creator with two hours of outreach time
 * should spend it on the five brands most likely to reply, and the score exists
 * to rank a list rather than to predict an outcome. Every component reports its
 * own reasoning so a low score can be argued with.
 */

/** Categories whose audiences overlap enough for a sponsor to cross over. */
const ADJACENCY: Record<Niche, Niche[]> = {
  finance: ['b2b-software', 'technology', 'education'],
  'b2b-software': ['technology', 'finance', 'education'],
  technology: ['b2b-software', 'gaming', 'finance', 'education'],
  'health-fitness': ['food-drink', 'lifestyle', 'beauty'],
  education: ['technology', 'finance', 'b2b-software'],
  beauty: ['lifestyle', 'health-fitness'],
  'food-drink': ['health-fitness', 'lifestyle', 'travel'],
  travel: ['lifestyle', 'food-drink'],
  gaming: ['technology', 'entertainment'],
  entertainment: ['gaming', 'lifestyle'],
  lifestyle: ['beauty', 'travel', 'food-drink', 'entertainment'],
};

const MAX_CATEGORY = 30;
const MAX_GEOGRAPHY = 25;
const MAX_BUDGET = 25;
const MAX_EVIDENCE = 20;

/** Score how closely the sponsor's category matches the creator's audience. */
function scoreCategory(creator: Niche, prospect: Niche): { score: number; note: string } {
  if (creator === prospect) {
    return { score: MAX_CATEGORY, note: 'Same category, so the audience is already qualified.' };
  }
  if ((ADJACENCY[creator] ?? []).includes(prospect)) {
    return { score: 20, note: 'Adjacent category. The overlap is real but needs arguing in the pitch.' };
  }
  return { score: 7, note: 'Unrelated category. Only worth pitching with a specific angle.' };
}

/** Share of the audience living where the sponsor can actually sell. */
function audienceInMarkets(geo: GeoSplit, sellsInto: Array<keyof GeoSplit>): number {
  const g = normaliseGeo(geo);
  return sellsInto.reduce((sum, tier) => sum + g[tier], 0);
}

/** Score geographic overlap between audience and sponsor's markets. */
function scoreGeography(profile: CreatorProfile, prospect: Prospect): { score: number; note: string } {
  if (prospect.sellsInto.length === 0) {
    return { score: 12, note: 'Sponsor markets unknown, so this is scored neutrally.' };
  }
  const overlap = audienceInMarkets(profile.geo, prospect.sellsInto);
  const pct = Math.round(overlap * 100);
  return {
    score: Math.round(overlap * MAX_GEOGRAPHY),
    note: `${pct}% of the audience lives somewhere this sponsor sells.`,
  };
}

/**
 * Score whether the sponsor's budget can meet the asking price.
 * A sponsor whose ceiling sits under the walk-away price is not a prospect,
 * however good the audience fit.
 */
function scoreBudget(prospect: Prospect, ask: RateLine | undefined): { score: number; note: string } {
  if (!ask) return { score: 10, note: 'No rate card line to compare against yet.' };

  const [low, high] = prospect.budgetBand;
  if (high <= 0) return { score: 10, note: 'Sponsor budget unknown, so this is scored neutrally.' };

  if (high < ask.floor) {
    return {
      score: 0,
      note: `Their ceiling of £${high.toLocaleString('en-GB')} sits below the £${ask.floor.toLocaleString('en-GB')} walk-away price.`,
    };
  }
  if (low >= ask.stretch) {
    return { score: MAX_BUDGET, note: 'Their floor clears the opening ask, so lead with the stretch price.' };
  }
  if (high >= ask.target) {
    return { score: 21, note: 'Their budget covers the target price comfortably.' };
  }
  return { score: 12, note: 'Their budget lands between the walk-away and target price. Expect a negotiation.' };
}

/** Score recorded evidence that this brand already pays creators. */
function scoreEvidence(prospect: Prospect): { score: number; note: string } {
  const length = prospect.evidence.trim().length;
  if (length === 0) {
    return {
      score: 0,
      note: 'No evidence recorded that this brand sponsors creators at all. Check before spending a pitch on them.',
    };
  }
  if (length < 40) {
    return { score: 10, note: 'Some evidence recorded, though thin. Self-reported, not verified.' };
  }
  return { score: MAX_EVIDENCE, note: 'Documented history of sponsoring creators. Self-reported, not verified.' };
}

/**
 * Rank a prospect against a creator profile and a chosen rate card line.
 * @param ask the line the creator intends to pitch, used for budget alignment.
 * @returns a 0..100 score with per-component reasoning.
 */
export function scoreProspect(
  profile: CreatorProfile,
  prospect: Prospect,
  ask?: RateLine,
): FitScore {
  const category = scoreCategory(profile.niche, prospect.niche);
  const geography = scoreGeography(profile, prospect);
  const budget = scoreBudget(prospect, ask);
  const evidence = scoreEvidence(prospect);

  const components = [
    { label: 'Category fit', ...category, max: MAX_CATEGORY },
    { label: 'Market overlap', ...geography, max: MAX_GEOGRAPHY },
    { label: 'Budget alignment', ...budget, max: MAX_BUDGET },
    { label: 'Sponsors creators', ...evidence, max: MAX_EVIDENCE },
  ];

  const total = components.reduce((sum, c) => sum + c.score, 0);
  return {
    total,
    components,
    verdict: total >= 70 ? 'strong' : total >= 45 ? 'worth-a-shot' : 'weak',
  };
}

/** Order prospects by fit, strongest first. Stable for equal scores. */
export function rankProspects(
  profile: CreatorProfile,
  prospects: Prospect[],
  ask?: RateLine,
): Array<{ prospect: Prospect; fit: FitScore }> {
  return prospects
    .map((prospect) => ({ prospect, fit: scoreProspect(profile, prospect, ask) }))
    .sort((a, b) => b.fit.total - a.fit.total);
}
