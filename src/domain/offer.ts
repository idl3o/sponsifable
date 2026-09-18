import { FORMAT_LABEL, PAID_USAGE_DAYS } from './benchmarks';
import { gbp } from './pitch';
import { DEFAULT_TERMS, priceLine, roundToNegotiable } from './pricing';
import type { Channel, CreatorProfile, DealTerms, Format, RateLine } from './types';

/**
 * Judging an offer a sponsor has already made.
 *
 * The rate card answers "what should I ask?". This answers the question that
 * actually arrives in the inbox: "they have offered this much, for these
 * terms — is it good, and what do I say?" It is the same engine read
 * backwards, so the two can never disagree.
 *
 * Nothing here is a negotiating tactic. Every number is the price of
 * something the sponsor asked for, with the sentence that says why, because
 * the creator has to defend it out loud.
 */

/** What a sponsor has put on the table. */
export interface Offer {
  channelId: string;
  format: Format;
  /** What they have offered, GBP. */
  fee: number;
  /** What they want for it. */
  terms: DealTerms;
}

/**
 * Where the offer sits against the card.
 *
 * `below-floor` is the only one that is not a negotiation: under the walk-away
 * price the honest answer is no, or a smaller job.
 */
export type OfferVerdict = 'below-floor' | 'under' | 'fair' | 'strong';

/** What one thing the sponsor asked for adds to the price. */
export interface TermCost {
  label: string;
  /** GBP this term adds over the same placement without it. */
  amount: number;
  rationale: string;
}

/** Something the creator can take back to make the sponsor's number work. */
export interface Concession {
  label: string;
  /** The terms after giving it back. */
  terms: DealTerms;
  /** What the placement is worth once it is given back. */
  price: number;
  /** GBP this takes off the price. */
  saves: number;
  /** True when the sponsor's fee covers the price after this concession. */
  closes: boolean;
  sentence: string;
}

export interface OfferAssessment {
  /** The placement priced under the sponsor's own terms. */
  line: RateLine;
  fee: number;
  verdict: OfferVerdict;
  /** Target minus fee, never below zero. */
  gap: number;
  /** Fee over target. Zero when there is no price to compare against. */
  ratio: number;
  /**
   * What the sponsor is paying per thousand impressions. Null when the price
   * is set by the cost of the work: dividing labour by a small audience yields
   * a CPM that ends the conversation.
   */
  offeredCpm: number | null;
  /** What the sponsor's terms add over a plain placement on the creator's own channel. */
  termCosts: TermCost[];
  /** What to take back if the fee cannot move, cheapest give first. */
  concessions: Concession[];
}

/** A placement the creator actually sells, or null. */
function placement(profile: CreatorProfile, offer: Offer): Channel | null {
  return profile.channels.find((c) => c.id === offer.channelId) ?? null;
}

function verdictFor(fee: number, line: RateLine): OfferVerdict {
  if (fee >= line.stretch) return 'strong';
  // Within a rounding step of the ask is the ask. Haggling over £20 on £450
  // loses deals that were already fair.
  if (fee >= line.target * 0.97) return 'fair';
  return fee >= line.floor ? 'under' : 'below-floor';
}

/** The same placement, priced as if the sponsor had asked for nothing beyond the post. */
function bare(profile: CreatorProfile, channel: Channel, offer: Offer): RateLine {
  return priceLine(profile, channel, offer.format, { ...DEFAULT_TERMS, introductory: offer.terms.introductory });
}

/** Each term the sponsor asked for, priced on its own against the bare placement. */
function termCosts(profile: CreatorProfile, channel: Channel, offer: Offer, baseline: number): TermCost[] {
  const only = (patch: Partial<DealTerms>): number =>
    priceLine(profile, channel, offer.format, { ...DEFAULT_TERMS, introductory: offer.terms.introductory, ...patch }).target;
  const wants: Array<{ when: boolean; label: string; price: () => number; rationale: string }> = [
    {
      when: offer.terms.usageRights !== 'organic-only',
      label: `Usage rights: ${offer.terms.usageRights.replace(/-/g, ' ')}`,
      price: () => only({ usageRights: offer.terms.usageRights, declaredSpend: offer.terms.declaredSpend }),
      rationale: usageRationale(offer.terms),
    },
    {
      when: offer.terms.exclusivityDays > 0,
      label: `Category exclusivity: ${offer.terms.exclusivityDays} days`,
      price: () => only({ exclusivityDays: offer.terms.exclusivityDays }),
      rationale: `For ${offer.terms.exclusivityDays} days you cannot take a competitor's money in this category. That is the price of the days, not of the post.`,
    },
    {
      when: offer.terms.rush,
      label: 'Rush delivery',
      price: () => only({ rush: true }),
      rationale: 'Inside two weeks means moving other work, which costs more than it looks like it should.',
    },
    {
      when: offer.terms.revisions > DEFAULT_TERMS.revisions,
      label: `Revisions: ${offer.terms.revisions}`,
      price: () => only({ revisions: offer.terms.revisions }),
      rationale: 'Each round after the first is another edit, another approval, another week.',
    },
    {
      when: offer.terms.bundleSize > 1,
      label: `Volume: ${offer.terms.bundleSize} assets`,
      price: () => only({ bundleSize: offer.terms.bundleSize }),
      rationale: 'Buying several at once earns a discount, which is worth more offered than conceded.',
    },
  ];
  return wants
    .filter((w) => w.when)
    .map((w) => ({ label: w.label, amount: roundToNegotiable(w.price() - baseline), rationale: w.rationale }))
    .filter((cost) => cost.amount !== 0);
}

function usageRationale(terms: DealTerms): string {
  if (terms.usageRights === 'full-buyout') {
    return 'A buyout is the placement again: they can re-cut and run it anywhere, for as long as they like.';
  }
  const days = PAID_USAGE_DAYS[terms.usageRights];
  const window = days === null ? 'unlimited' : `${days} days`;
  const spend = terms.declaredSpend > 0 ? `, against the ${gbp(terms.declaredSpend)} they said they would spend behind it` : '';
  return `Running paid spend behind my handle for ${window} is media buying${spend}. It is priced per 30-day period, and it is separate from the post.`;
}

/** What the creator can take back, cheapest give first. */
function concessions(profile: CreatorProfile, channel: Channel, offer: Offer, fee: number): Concession[] {
  const asked = priceLine(profile, channel, offer.format, offer.terms).target;
  const priced = (label: string, patch: Partial<DealTerms>, sentence: string): Concession | null => {
    const terms = { ...offer.terms, ...patch };
    const price = priceLine(profile, channel, offer.format, terms).target;
    const saves = roundToNegotiable(asked - price);
    if (saves <= 0) return null;
    return { label, terms, price, saves, closes: fee >= price, sentence };
  };
  const options = [
    offer.terms.rush
      ? priced('Drop the rush', { rush: false }, 'I can hold the price if the deadline moves out past two weeks.')
      : null,
    offer.terms.revisions > DEFAULT_TERMS.revisions
      ? priced(`Cut revisions to ${DEFAULT_TERMS.revisions}`, { revisions: DEFAULT_TERMS.revisions }, 'One round of changes included, further rounds billed. That holds the price down.')
      : null,
    offer.terms.exclusivityDays > 0
      ? priced('Drop the exclusivity', { exclusivityDays: 0 }, 'Without category exclusivity I am free to work either side of it, and the price comes down.')
      : null,
    offer.terms.usageRights === 'full-buyout'
      ? priced('Buyout down to 90-day whitelisting', { usageRights: 'whitelisting-90' }, 'Ninety days of paid running covers a campaign. A buyout is forever, and it is priced like it.')
      : null,
    offer.terms.usageRights !== 'organic-only'
      ? priced('Organic only, no paid usage', { usageRights: 'organic-only', declaredSpend: 0 }, 'If the budget is fixed, the post can stay on my channel and the paid usage comes later, priced on its own.')
      : null,
  ].filter((c): c is Concession => c !== null);
  // Smallest give first: the creator should hand back the least that closes it.
  return options.sort((a, b) => a.saves - b.saves);
}

/**
 * Judge an offer against the same engine that priced the card.
 * @returns null when the offer names a placement the creator does not sell.
 */
export function assessOffer(profile: CreatorProfile, offer: Offer): OfferAssessment | null {
  const channel = placement(profile, offer);
  if (!channel || !channel.formats.includes(offer.format)) return null;
  const line = priceLine(profile, channel, offer.format, offer.terms);
  const fee = Math.max(0, offer.fee);
  const baseline = bare(profile, channel, offer).target;
  return {
    line,
    fee,
    verdict: verdictFor(fee, line),
    gap: Math.max(0, roundToNegotiable(line.target - fee)),
    ratio: line.target > 0 ? fee / line.target : 0,
    offeredCpm: line.flooredByProduction || line.effectiveImpressions <= 0 ? null : (fee / line.effectiveImpressions) * 1000,
    termCosts: termCosts(profile, channel, offer, baseline),
    concessions: concessions(profile, channel, offer, fee),
  };
}

const HEADLINE: Record<OfferVerdict, string> = {
  strong: 'This is a good offer. Take it.',
  fair: 'This is about right. Take it, or ask once for the round number above it.',
  under: 'This is under the card, and worth a counter.',
  'below-floor': 'This is below your walk-away price. Counter, shrink the job, or decline.',
};

/**
 * The paragraph the creator can send back.
 *
 * It names the price, what the sponsor's own terms cost, and the one thing
 * that can move instead of the fee. It never pleads and never explains the
 * creator's circumstances: it prices what was asked for.
 */
export function offerReply(assessment: OfferAssessment, brand: string): string {
  const { line, fee, verdict, termCosts: costs } = assessment;
  const who = brand.trim() || 'there';
  const what = FORMAT_LABEL[line.format].toLowerCase();
  if (verdict === 'strong' || verdict === 'fair') {
    return `Hi ${who} — that works. ${gbp(fee)} for the ${what}, on the terms as described. I will send the invoice and the delivery date with the contract.`;
  }
  const breakdown = costs.length
    ? ` The ask is ${gbp(line.target)} because of what comes with it: ${costs.map((c) => `${c.label.toLowerCase()} (${gbp(c.amount)})`).join(', ')}.`
    : ` The ask for this placement is ${gbp(line.target)}.`;
  return `Hi ${who} — thank you for the offer. ${gbp(fee)} is under what this placement sells for.${breakdown}${tradeClause(assessment)}`;
}

/**
 * What can move instead of the fee.
 *
 * When no concession reaches the sponsor's number, it says so. Naming a
 * concession as "the way to get there" and then quoting a price still well
 * above the budget is how a creator ends up talked into the gap.
 */
function tradeClause({ fee, concessions: gives }: OfferAssessment): string {
  const closes = gives.find((c) => c.closes);
  if (closes) {
    return ` If ${gbp(fee)} is fixed, the way to get there is scope rather than rate. ${closes.sentence} That puts it at ${gbp(closes.price)}.`;
  }
  const most = gives[gives.length - 1];
  if (!most) return '';
  return ` The most I can take out is scope. ${most.sentence} That brings it to ${gbp(most.price)}. If the budget will not reach that, this is not the right one for us.`;
}

/** A one-line summary of where the offer sits, for the interface. */
export function offerHeadline(assessment: OfferAssessment): string {
  return HEADLINE[assessment.verdict];
}
