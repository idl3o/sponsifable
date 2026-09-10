import { FORMAT_LABEL, NICHE_LABEL, PLATFORM_LABEL } from './benchmarks';
import { headlineEvidence } from './mediakit';
import type { CreatorProfile, PipelineStage, Prospect, RateLine } from './types';

/**
 * Deterministic pitch composition.
 *
 * No language model is required to write a good cold pitch, because the thing
 * that makes one work is structure and specificity rather than prose quality:
 * name the product, show delivered attention, state a price, ask one question.
 * A local model can sharpen the result afterwards, but the draft stands alone.
 */

export interface Pitch {
  subject: string;
  body: string;
  /** Word count, since a cold pitch over roughly 150 words stops being read. */
  words: number;
}

/** Format a GBP amount the way it should appear in an email. */
export function gbp(amount: number): string {
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

/** One sentence describing who this creator reaches. */
function audienceLine(profile: CreatorProfile): string {
  const primary = [...profile.channels].sort((a, b) => b.medianViews - a.medianViews)[0];
  if (!primary) return `a ${NICHE_LABEL[profile.niche].toLowerCase()} audience`;
  return `a ${NICHE_LABEL[profile.niche].toLowerCase()} audience on ${PLATFORM_LABEL[primary.platform]}`;
}

/** The strongest past result, if one has been recorded. */
function proofLine(profile: CreatorProfile): string {
  const proof = profile.proofPoints[0];
  if (!proof) return '';
  return `Last time I ran something similar — ${proof.label} — the result was ${proof.result}.`;
}

/**
 * The sentence that states the price.
 *
 * A cost-per-thousand figure is the number a sponsor checks first, so it is
 * quoted whenever the audience is what sets the price. When the production
 * floor is binding, that same arithmetic divides a labour cost by a small
 * audience and produces an absurd CPM. Quoting it would end the conversation,
 * so a smaller creator states the basis honestly instead.
 */
function priceSentence(ask: RateLine): string {
  const format = FORMAT_LABEL[ask.format].toLowerCase();
  const platform = PLATFORM_LABEL[ask.platform];
  const views = ask.effectiveImpressions.toLocaleString('en-GB');

  if (ask.flooredByProduction) {
    return `I have a ${format} on ${platform} available at ${gbp(ask.target)}, against ${views} median views. At this size the price reflects what the piece costs to make properly rather than a reach calculation, so it does not scale down further.`;
  }

  const cpm = (ask.target / Math.max(1, ask.effectiveImpressions)) * 1000;
  return `I have a ${format} on ${platform} available at ${gbp(ask.target)}. That prices the placement at roughly ${gbp(cpm)} per thousand impressions against ${views} median views.`;
}

const COUNT_WORD = ['', 'One thing', 'Two things', 'Three things'] as const;

/** The bulleted facts, headed by a count that matches what follows. */
function evidenceBlock(evidence: string[]): string[] {
  const heading = COUNT_WORD[evidence.length];
  if (!heading) return [];
  return ['', `${heading} worth knowing:`, ...evidence.map((line) => `- ${line}`)];
}

/**
 * Compose the opening pitch to a prospect.
 *
 * Pure: the same profile, prospect and rate line always produce the same email.
 * @param ask the placement being offered, priced.
 */
export function composePitch(profile: CreatorProfile, prospect: Prospect, ask: RateLine): Pitch {
  const greeting = prospect.contactName.trim() ? `Hi ${prospect.contactName.trim()},` : 'Hi,';
  const evidence = headlineEvidence(profile);
  const proof = proofLine(profile);

  const parts = [
    greeting,
    '',
    `I make ${NICHE_LABEL[profile.niche].toLowerCase()} content for ${audienceLine(profile)}, and ${prospect.product} is the kind of thing they ask me about directly.`,
    ...evidenceBlock(evidence),
    '',
    priceSentence(ask),
  ];

  if (proof) parts.push('', proof);

  parts.push(
    '',
    `Is ${prospect.brand} running creator placements this quarter? Happy to send the full media kit if it is useful.`,
    '',
    profile.name,
    profile.contactEmail,
  );

  const body = parts.join('\n');
  return {
    subject: `${prospect.brand} x ${profile.name} — ${FORMAT_LABEL[ask.format].toLowerCase()}`,
    body,
    words: body.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Compose a follow-up for a prospect who has not replied.
 * @param touch which follow-up this is, 1-indexed.
 */
export function composeFollowUp(
  profile: CreatorProfile,
  prospect: Prospect,
  ask: RateLine,
  touch: number,
): Pitch {
  const greeting = prospect.contactName.trim() ? `Hi ${prospect.contactName.trim()},` : 'Hi,';

  const bodies: Record<number, string[]> = {
    1: [
      greeting,
      '',
      `Following up on the ${FORMAT_LABEL[ask.format].toLowerCase()} for ${prospect.product}. The slot is still open at ${gbp(ask.target)}.`,
      '',
      'If the timing is wrong, tell me when to come back and I will.',
    ],
    2: [
      greeting,
      '',
      `One more from me on ${prospect.product}. Since I wrote, the channel has held at ${ask.effectiveImpressions.toLocaleString('en-GB')} median views per placement.`,
      '',
      `If budget is the blocker, the smallest useful version of this is a brief mention rather than a full placement. Say the word and I will price it.`,
    ],
    3: [
      greeting,
      '',
      `Closing the loop on ${prospect.brand}. I will stop emailing after this one.`,
      '',
      'If creator placements come back onto the plan later, I am easy to find.',
    ],
  };

  const parts = [...(bodies[touch] ?? bodies[3] ?? []), '', profile.name, profile.contactEmail];
  const body = parts.join('\n');

  return {
    subject: `Re: ${prospect.brand} x ${profile.name}`,
    body,
    words: body.split(/\s+/).filter(Boolean).length,
  };
}

/** Days after contact at which each follow-up is due. */
const FOLLOW_UP_DAYS = [4, 11, 25];

export interface NextAction {
  /** What to do now. */
  label: string;
  /** Days overdue. Negative means not yet due. */
  overdueBy: number;
  urgency: 'overdue' | 'due-soon' | 'waiting' | 'none';
}

/** Whole days between two ISO dates (YYYY-MM-DD). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Decide what a prospect needs next.
 * @param today ISO date supplied by the caller, so the function stays pure.
 */
export function nextAction(prospect: Prospect, today: string): NextAction {
  const stage: PipelineStage = prospect.stage;

  if (stage === 'won' || stage === 'lost') {
    return { label: 'Closed', overdueBy: 0, urgency: 'none' };
  }
  if (stage === 'researching') {
    return { label: 'Find a named contact, then pitch', overdueBy: 0, urgency: 'due-soon' };
  }
  if (stage === 'replied' || stage === 'negotiating') {
    return { label: 'They are waiting on you. Reply today.', overdueBy: 0, urgency: 'overdue' };
  }

  if (!prospect.lastContactedOn) {
    return { label: 'Send the opening pitch', overdueBy: 0, urgency: 'due-soon' };
  }

  const elapsed = daysBetween(prospect.lastContactedOn, today);
  const dueIndex = FOLLOW_UP_DAYS.findIndex((day) => elapsed < day);

  if (dueIndex === -1) {
    return { label: 'Sequence finished. Archive or re-research.', overdueBy: 0, urgency: 'none' };
  }

  const dueDay = FOLLOW_UP_DAYS[dueIndex] ?? 0;
  const previousDay = dueIndex === 0 ? 0 : (FOLLOW_UP_DAYS[dueIndex - 1] ?? 0);
  const overdueBy = elapsed - previousDay;
  const label = `Follow-up ${dueIndex + 1} of ${FOLLOW_UP_DAYS.length}, due day ${dueDay}`;

  if (dueIndex > 0 && overdueBy > 3) return { label, overdueBy, urgency: 'overdue' };
  if (dueDay - elapsed <= 1) return { label, overdueBy, urgency: 'due-soon' };
  return { label: `${label} (${dueDay - elapsed} days away)`, overdueBy: elapsed - dueDay, urgency: 'waiting' };
}
