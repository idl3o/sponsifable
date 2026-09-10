import { useMemo, useState } from 'react';
import { FORMAT_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { buildRateCard, effectiveCpm, rateCardTotal } from '../domain/pricing';
import type { RateLine, UsageRights } from '../domain/types';
import { useStore } from '../store/useStore';
import { Button, Card, Pill, SelectField, Stat, count, money } from './ui/Primitives';

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

/** The commercial terms that reshape every price on the card. */
function TermsPanel() {
  const terms = useStore((s) => s.terms);
  const setTerms = useStore((s) => s.setTerms);

  return (
    <Card
      title="Deal terms"
      subtitle="Most creators quote one price for a placement and give away the rest. Exclusivity and usage rights are separate things a sponsor is buying, and they are where the money is."
    >
      <SelectField
        label="Usage rights"
        value={terms.usageRights}
        options={USAGE_OPTIONS}
        onChange={(usageRights) => setTerms({ usageRights })}
        hint="If the sponsor can run paid spend behind your face, they are buying media, not a post."
      />

      <SelectField
        label="Category exclusivity"
        value={String(terms.exclusivityDays)}
        options={EXCLUSIVITY_OPTIONS}
        onChange={(value) =>
          setTerms({ exclusivityDays: Number(value) as 0 | 30 | 60 | 90 | 180 })
        }
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
    </Card>
  );
}

/** One priced line, expandable into its full derivation. */
function RateRow({ line }: { line: RateLine }) {
  const [open, setOpen] = useState(false);
  const handle = useStore((s) => s.profile.channels.find((c) => c.id === line.channelId)?.handle);

  if (line.target === 0) return null;

  return (
    <div className="rate">
      <button className="rate-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div>
          <div className="row" style={{ gap: 7 }}>
            <span style={{ fontWeight: 560 }}>{FORMAT_LABEL[line.format]}</span>
            {line.flooredByProduction && <Pill tone="warn">priced on your time</Pill>}
          </div>
          <div className="note">
            {PLATFORM_LABEL[line.platform]} {handle ? `· ${handle}` : ''} ·{' '}
            {count(line.effectiveImpressions)} median views
            {line.flooredByProduction ? '' : ` · ${money(effectiveCpm(line))} CPM`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="price">{money(line.target)}</div>
          <div className="band">
            walk away {money(line.floor)} · open at {money(line.stretch)}
          </div>
        </div>
      </button>

      {open && (
        <div className="rate-body">
          <h3>How this number was reached</h3>
          <div className="adj">
            <div>
              Base rate, {PLATFORM_LABEL[line.platform]} {FORMAT_LABEL[line.format].toLowerCase()}
            </div>
            <div className="f">{money(line.baseCpm)} CPM</div>
            <div className="why">
              The market rate per thousand impressions before anything specific to you.
            </div>
          </div>

          {line.adjustments.map((adjustment) => (
            <div className="adj" key={adjustment.label}>
              <div>{adjustment.label}</div>
              <div className="f">×{adjustment.factor.toFixed(2)}</div>
              <div className="why">{adjustment.rationale}</div>
            </div>
          ))}

          <div className="adj">
            <div>Audience value</div>
            <div className="f">{money(line.mediaValue)}</div>
            <div className="why">
              What the reach alone is worth once every factor above is applied.
            </div>
          </div>

          <div className="adj">
            <div>Cost of making it</div>
            <div className="f">{money(line.productionFloor)}</div>
            <div className="why">
              {line.flooredByProduction
                ? 'This is what sets your price. The work takes the same hours whoever is watching, so reach-based pricing would have you make this for less than it costs you. Below this number the correct answer to a sponsor is no.'
                : 'The least this could sell for and still be worth making. Your audience clears it comfortably.'}
            </div>
          </div>

          <div className="adj">
            <div style={{ fontWeight: 560 }}>Asking price</div>
            <div className="f" style={{ color: 'var(--accent)' }}>
              {money(line.target)}
            </div>
            <div className="why">
              {line.flooredByProduction
                ? 'Rounded to a number you can say out loud. There is no room beneath it, because the floor is the cost of the work rather than a negotiating position.'
                : 'Rounded to a number you can say out loud. The walk-away sits 22% below and the opening ask 35% above, which is the room a normal negotiation needs.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RateCardView() {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const setTab = useStore((s) => s.setTab);

  const lines = useMemo(() => buildRateCard(profile, terms), [profile, terms]);
  const priced = lines.filter((l) => l.target > 0);
  // Lines where the audience, not the labour, sets the price. Only these carry
  // a cost per thousand that would survive a sponsor reading it.
  const reachPriced = priced.filter((l) => !l.flooredByProduction);
  const total = rateCardTotal(priced);
  const best = priced.reduce<RateLine | undefined>(
    (acc, l) => (!acc || l.target > acc.target ? l : acc),
    undefined,
  );

  return (
    <>
      <h1>Rate card</h1>
      <p className="lede">
        Prices derived from your audience and the terms on offer, with the full working shown.
        Open any line to see the sentence you would say if a sponsor asked why.
      </p>

      {priced.length === 0 ? (
        <div className="empty">
          No priced placements yet. Add a channel with median views on the profile page.{' '}
          <Button onClick={() => setTab('profile')}>Go to profile</Button>
        </div>
      ) : (
        <div className="split">
          <div>
            <div className="grid cols-3" style={{ marginBottom: 16 }}>
              <Stat
                k="Top placement"
                v={best ? money(best.target) : '—'}
                sub={best ? FORMAT_LABEL[best.format] : ''}
              />
              <Stat k="Everything at once" v={money(total)} sub={`${priced.length} placements`} />
              {reachPriced.length > 0 ? (
                <Stat
                  k="Blended CPM"
                  v={money(
                    reachPriced.reduce((s, l) => s + effectiveCpm(l) * l.effectiveImpressions, 0) /
                      Math.max(1, reachPriced.reduce((s, l) => s + l.effectiveImpressions, 0)),
                  )}
                  sub="what a sponsor pays per thousand"
                />
              ) : (
                <Stat
                  k="Priced on"
                  v="Your time"
                  sub="audience too small for a cost per thousand to mean anything"
                />
              )}
            </div>

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
            <Card title="What to do with this">
              <ol style={{ paddingLeft: 18, margin: 0 }} className="note">
                <li style={{ marginBottom: 7 }}>
                  Quote the opening ask, not the target. The target is where you expect to land.
                </li>
                <li style={{ marginBottom: 7 }}>
                  Never quote a price without naming the usage rights it covers. That is the single
                  most common way creators give away four figures.
                </li>
                <li style={{ marginBottom: 7 }}>
                  If they push below the walk-away, offer a smaller format rather than a discount.
                  Cutting the price teaches them your card is fiction.
                </li>
                <li>
                  <Pill tone="accent">Free advice</Pill> Send the media kit only after they reply.
                  A cold email with an attachment gets less attention, not more.
                </li>
              </ol>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
