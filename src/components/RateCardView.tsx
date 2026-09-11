import { useMemo, useState } from 'react';
import { FORMAT_LABEL, INTRODUCTORY_RATE, PLATFORM_LABEL } from '../domain/benchmarks';
import { buildRateCard, effectiveCpm, hasResults, rateCardTotal } from '../domain/pricing';
import type { DealTerms, RateLine, UsageRights } from '../domain/types';
import { useStore } from '../store/useStore';
import { Button, Card, NumberField, Pill, SelectField, Stat, count, money } from './ui/Primitives';

const USAGE_OPTIONS: Array<{ value: UsageRights; label: string }> = [
  { value: 'organic-only', label: 'Organic only, my channel' },
  { value: 'whitelisting-30', label: 'Paid whitelisting, 30 days' },
  { value: 'whitelisting-90', label: 'Paid whitelisting, 90 days' },
  { value: 'full-buyout', label: 'Full buyout, anywhere, forever' },
];

const EXCLUSIVITY_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
];

/** The deal terms and the store action that changes them, which every terms field needs. */
interface TermsProps {
  terms: DealTerms;
  setTerms: (patch: Partial<DealTerms>) => void;
}

/** Usage rights, and the sponsor's declared paid spend when there is paid usage. */
function UsageFields({ terms, setTerms }: TermsProps) {
  return (
    <>
      <SelectField
        label="Usage rights"
        value={terms.usageRights}
        options={USAGE_OPTIONS}
        onChange={(usageRights) => setTerms({ usageRights })}
        hint="If the sponsor can run paid spend behind your face, they are buying media, not a post. Paid usage is priced per 30 days, with a minimum however small your audience."
      />
      {terms.usageRights !== 'organic-only' && (
        <NumberField
          label="Sponsor's declared paid spend, GBP"
          value={terms.declaredSpend}
          onChange={(declaredSpend) => setTerms({ declaredSpend: Math.max(0, declaredSpend) })}
          step={500}
          hint="Ask what they plan to spend behind the asset. If they say, the fee scales with it; if not, leave it at nought."
        />
      )}
    </>
  );
}

/** The introductory rate, offered once and withdrawn by the first result on record. */
function IntroductoryField({ terms, setTerms }: TermsProps) {
  const proven = useStore((s) => hasResults(s.profile));
  return (
    <SelectField
      label="Introductory rate"
      value={terms.introductory && !proven ? 'on' : 'off'}
      options={[
        { value: 'off', label: 'Standard rates' },
        { value: 'on', label: 'Introductory, until my first result' },
      ]}
      onChange={(value) => setTerms({ introductory: value === 'on' })}
      hint={
        proven
          ? 'You have a result on record, so the introductory rate no longer applies.'
          : `Once, knowingly: ${Math.round((1 - INTRODUCTORY_RATE.factor) * 100)}% off in exchange for permission to publish the results. Your first result is worth more than the fee.`
      }
    />
  );
}

/** Exclusivity, revisions, turnaround and volume. */
function ScheduleFields({ terms, setTerms }: TermsProps) {
  return (
    <>
      <SelectField
        label="Category exclusivity"
        value={String(terms.exclusivityDays)}
        options={EXCLUSIVITY_OPTIONS}
        onChange={(value) => setTerms({ exclusivityDays: Number(value) as DealTerms['exclusivityDays'] })}
        hint="Every day you cannot take a competitor's money has a price."
      />
      <SelectField
        label="Revisions included"
        value={String(terms.revisions)}
        options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}` }))}
        onChange={(value) => setTerms({ revisions: Number(value) })}
      />
      <SelectField
        label="Turnaround"
        value={terms.rush ? 'rush' : 'normal'}
        options={[
          { value: 'normal', label: 'Standard schedule' },
          { value: 'rush', label: 'Rush, inside two weeks' },
        ]}
        onChange={(value) => setTerms({ rush: value === 'rush' })}
      />
      <SelectField
        label="Assets bought together"
        value={String(terms.bundleSize)}
        options={[1, 2, 3, 4, 6].map((n) => ({ value: String(n), label: `${n}` }))}
        onChange={(value) => setTerms({ bundleSize: Number(value) })}
        hint="Volume earns a discount, and a discount you offer is worth more than one you concede."
      />
    </>
  );
}

/** The commercial terms that reshape every price on the card. */
function TermsPanel() {
  const terms = useStore((s) => s.terms);
  const setTerms = useStore((s) => s.setTerms);
  return (
    <Card
      title="Deal terms"
      subtitle="Most creators quote one price for a placement and give away the rest. Exclusivity and usage rights are separate things a sponsor is buying, and they are where the money is."
    >
      <UsageFields terms={terms} setTerms={setTerms} />
      <IntroductoryField terms={terms} setTerms={setTerms} />
      <ScheduleFields terms={terms} setTerms={setTerms} />
    </Card>
  );
}

/** What the cost of the work means for this line, in one speakable paragraph. */
function floorExplanation(line: RateLine): string {
  if (line.introductory) {
    return 'Deliberately below the cost of the work, once. You are buying your first published result with the difference, and the rate ends as soon as that result is on record.';
  }
  if (line.flooredByProduction) {
    return 'This is what sets your price. The work takes the same hours whoever is watching, so reach-based pricing would have you make this for less than it costs you. Below this number the correct answer to a sponsor is no.';
  }
  return 'The least this could sell for and still be worth making. Your audience clears it comfortably.';
}

/** A line's summary: format, badges, audience, and the three prices. A floored line shows no CPM. */
function RateHead({ line }: { line: RateLine }) {
  const handle = useStore((s) => s.profile.channels.find((c) => c.id === line.channelId)?.handle);
  return (
    <>
      <div>
        <div className="row" style={{ gap: 7 }}>
          <span style={{ fontWeight: 560 }}>{FORMAT_LABEL[line.format]}</span>
          {line.flooredByProduction && <Pill tone="warn">priced on your time</Pill>}
          {line.introductory && <Pill tone="accent">introductory</Pill>}
          {line.market?.position === 'below' && <Pill tone="good">market pays ~{money(line.market.typical)}</Pill>}
        </div>
        <div className="note">
          {PLATFORM_LABEL[line.platform]} {handle ? `· ${handle}` : ''} · {count(line.effectiveImpressions)} median views
          {line.flooredByProduction ? '' : ` · ${money(effectiveCpm(line))} CPM`}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="price">{money(line.target)}</div>
        <div className="band">
          walk away {money(line.floor)} · open at {money(line.stretch)}
        </div>
      </div>
    </>
  );
}

/** One step in a line's derivation: a label, a figure, and the reason for it. */
function Step({ label, figure, why, strong }: { label: string; figure: string; why: string; strong?: boolean }) {
  return (
    <div className="adj">
      <div style={strong ? { fontWeight: 560 } : undefined}>{label}</div>
      <div className="f" style={strong ? { color: 'var(--accent)' } : undefined}>
        {figure}
      </div>
      <div className="why">{why}</div>
    </div>
  );
}

/** The full working behind a line, every factor with the sentence that justifies it. */
function Derivation({ line }: { line: RateLine }) {
  const format = FORMAT_LABEL[line.format].toLowerCase();
  return (
    <div className="rate-body">
      <h3>How this number was reached</h3>
      <Step
        label={`Base rate, ${PLATFORM_LABEL[line.platform]} ${format}`}
        figure={`${money(line.baseCpm)} CPM`}
        why="The market rate per thousand impressions before anything specific to you."
      />
      {line.adjustments.map((a) => (
        <Step key={a.label} label={a.label} figure={`×${a.factor.toFixed(2)}`} why={a.rationale} />
      ))}
      <Step label="Audience value" figure={money(line.mediaValue)} why="What the reach alone is worth once every factor above is applied." />
      <Step label="Cost of making it" figure={money(line.productionFloor)} why={floorExplanation(line)} />
      <Step
        label="Asking price"
        figure={money(line.target)}
        strong
        why={
          line.flooredByProduction
            ? 'Rounded to a number you can say out loud. There is no room beneath it, because the floor is the cost of the work rather than a negotiating position.'
            : 'Rounded to a number you can say out loud. The walk-away sits 22% below and the opening ask 35% above, which is the room a normal negotiation needs.'
        }
      />
      {line.market && <Step label="What creators your size are paid" figure={`~${money(line.market.typical)}`} why={line.market.sentence} />}
    </div>
  );
}

/** One priced line, expandable into its full derivation. */
function RateRow({ line }: { line: RateLine }) {
  const [open, setOpen] = useState(false);
  if (line.target === 0) return null;
  return (
    <div className="rate">
      <button className="rate-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <RateHead line={line} />
      </button>
      {open && <Derivation line={line} />}
    </div>
  );
}

/**
 * The cost per thousand across lines, weighted by impressions. Pass only lines
 * the audience prices: a floored line's CPM divides a labour cost by a small
 * audience and must never be shown.
 */
function blendedCpm(reachPriced: RateLine[]): number {
  const impressions = reachPriced.reduce((s, l) => s + l.effectiveImpressions, 0);
  return reachPriced.reduce((s, l) => s + effectiveCpm(l) * l.effectiveImpressions, 0) / Math.max(1, impressions);
}

/** The card's headline numbers. A card priced entirely on time shows no CPM. */
function RateStats({ priced }: { priced: RateLine[] }) {
  // Lines where the audience, not the labour, sets the price. Only these carry
  // a cost per thousand that would survive a sponsor reading it.
  const reachPriced = priced.filter((l) => !l.flooredByProduction);
  const best = priced.reduce<RateLine | undefined>((acc, l) => (!acc || l.target > acc.target ? l : acc), undefined);
  return (
    <div className="grid cols-3" style={{ marginBottom: 16 }}>
      <Stat k="Top placement" v={best ? money(best.target) : '—'} sub={best ? FORMAT_LABEL[best.format] : ''} />
      <Stat k="Everything at once" v={money(rateCardTotal(priced))} sub={`${priced.length} placements`} />
      {reachPriced.length > 0 ? (
        <Stat k="Blended CPM" v={money(blendedCpm(reachPriced))} sub="what a sponsor pays per thousand" />
      ) : (
        <Stat k="Priced on" v="Your time" sub="audience too small for a cost per thousand to mean anything" />
      )}
    </div>
  );
}

/** How to use the card in a negotiation. */
function AdviceCard() {
  return (
    <Card title="What to do with this">
      <ol style={{ paddingLeft: 18, margin: 0 }} className="note">
        <li style={{ marginBottom: 7 }}>Quote the opening ask, not the target. The target is where you expect to land.</li>
        <li style={{ marginBottom: 7 }}>
          Never quote a price without naming the usage rights it covers. That is the single most
          common way creators give away four figures.
        </li>
        <li style={{ marginBottom: 7 }}>
          If they push below the walk-away, offer a smaller format rather than a discount. Cutting
          the price teaches them your card is fiction.
        </li>
        <li>
          <Pill tone="accent">Free advice</Pill> Send the media kit only after they reply. A cold
          email with an attachment gets less attention, not more.
        </li>
      </ol>
    </Card>
  );
}

/** Every placement priced with its derivation, beside the terms that shape it. */
export function RateCardView() {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const setTab = useStore((s) => s.setTab);
  const priced = useMemo(() => buildRateCard(profile, terms).filter((l) => l.target > 0), [profile, terms]);

  return (
    <>
      <h1>Rate card</h1>
      <p className="lede">
        Prices derived from your audience and the terms on offer, with the full working shown. Open
        any line to see the sentence you would say if a sponsor asked why.
      </p>
      {priced.length === 0 ? (
        <div className="empty">
          No priced placements yet. Add a channel with median views on the profile page.{' '}
          <Button onClick={() => setTab('profile')}>Go to profile</Button>
        </div>
      ) : (
        <div className="split">
          <div>
            <RateStats priced={priced} />
            {priced.map((line) => (
              <RateRow key={`${line.channelId}-${line.format}`} line={line} />
            ))}
            <p className="note" style={{ marginTop: 16 }}>
              These bands are seeded from publicly circulated creator rates for 2025 and 2026, not
              audited market data. They are a defensible starting position, not a guarantee. If a
              sponsor tells you the number is wrong, ask what they paid last time and adjust the
              base rate in the code rather than discounting the whole card.
            </p>
          </div>
          <div className="stack">
            <TermsPanel />
            <AdviceCard />
          </div>
        </div>
      )}
    </>
  );
}
