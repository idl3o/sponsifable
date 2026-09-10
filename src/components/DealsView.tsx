import { useMemo, useState } from 'react';
import { FORMAT_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { calibrate, closeDeal } from '../domain/deals';
import { buildRateCard } from '../domain/pricing';
import { scoreProspect } from '../domain/scoring';
import type { DealOutcome, LostReason, Verdict } from '../domain/types';
import { useStore } from '../store/useStore';
import { DealRow } from './DealRow';
import { Button, Card, NumberField, SelectField, Stat, TextField } from './ui/Primitives';

const LOST_REASONS: Array<{ value: LostReason; label: string }> = [
  { value: 'no-reply', label: 'Never replied' },
  { value: 'budget', label: 'Budget' },
  { value: 'timing', label: 'Timing' },
  { value: 'poor-fit', label: 'Poor fit' },
  { value: 'i-declined', label: 'I declined' },
  { value: 'other', label: 'Other' },
];

const VERDICT_LABEL: Record<Verdict, string> = {
  strong: 'Strong fit',
  'worth-a-shot': 'Worth a shot',
  weak: 'Weak fit',
};

/** File the outcome of a conversation against the price the tool quoted. */
function RecordCard({ today }: { today: string }) {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const prospects = useStore((s) => s.prospects);
  const recordDeal = useStore((s) => s.recordDeal);

  const lines = useMemo(
    () => buildRateCard(profile, terms).filter((l) => l.target > 0),
    [profile, terms],
  );
  const [prospectId, setProspectId] = useState('');
  const [lineKey, setLineKey] = useState('');
  const [outcome, setOutcome] = useState<DealOutcome>('won');
  const [agreed, setAgreed] = useState(0);
  const [lostReason, setLostReason] = useState<LostReason>('no-reply');
  const [closedOn, setClosedOn] = useState(today);

  const open = prospects.filter((p) => p.stage !== 'won' && p.stage !== 'lost');
  const prospect = prospects.find((p) => p.id === prospectId) ?? open[0] ?? prospects[0];
  const line = lines.find((l) => `${l.channelId}-${l.format}` === lineKey) ?? lines[0];

  if (!prospect || !line) {
    return (
      <Card title="Record an outcome" tight>
        <p className="note">Add a prospect and a priced channel first.</p>
      </Card>
    );
  }

  const submit = () => {
    const fitAtClose = scoreProspect(profile, prospect, line).total;
    recordDeal((id) =>
      closeDeal(profile, prospect, line, terms, { id, outcome, agreed, lostReason, closedOn, fitAtClose }),
    );
    setAgreed(0);
  };

  return (
    <Card
      title="Record an outcome"
      subtitle="Won or lost, against the price the card quoted. The deal is frozen as it stands today, so later edits to your profile do not rewrite it."
      tight
    >
      <SelectField
        label="Prospect"
        value={prospect.id}
        options={prospects.map((p) => ({ value: p.id, label: p.brand || 'Unnamed prospect' }))}
        onChange={setProspectId}
      />
      <SelectField
        label="Placement"
        value={`${line.channelId}-${line.format}`}
        options={lines.map((l) => ({
          value: `${l.channelId}-${l.format}`,
          label: `${FORMAT_LABEL[l.format]} on ${PLATFORM_LABEL[l.platform]}, quoted £${l.target.toLocaleString('en-GB')}`,
        }))}
        onChange={setLineKey}
      />
      <SelectField
        label="Outcome"
        value={outcome}
        options={[
          { value: 'won', label: 'Won' },
          { value: 'lost', label: 'Lost' },
        ]}
        onChange={setOutcome}
      />
      {outcome === 'won' ? (
        <NumberField
          label="Agreed, GBP"
          value={agreed}
          onChange={setAgreed}
          step={10}
          hint="What was actually agreed, not what you asked for."
        />
      ) : (
        <SelectField label="Why it was lost" value={lostReason} options={LOST_REASONS} onChange={setLostReason} />
      )}
      <TextField label="Closed on" value={closedOn} onChange={setClosedOn} />
      <Button variant="primary" onClick={submit}>
        Record
      </Button>
    </Card>
  );
}

/** What the log says about this creator's pricing so far. */
function CalibrationCard() {
  const deals = useStore((s) => s.deals);
  const c = useMemo(() => calibrate(deals), [deals]);

  return (
    <Card title="Your calibration" subtitle={c.sentence} tight>
      <div className="grid cols-2" style={{ marginBottom: 12 }}>
        <Stat
          k="Close ratio"
          v={c.closeRatio === null ? '—' : `${Math.round(c.closeRatio * 100)}%`}
          sub={c.readable ? 'median agreed ÷ quoted' : 'needs three won deals'}
        />
        <Stat k="Won / lost" v={`${c.won} / ${c.lost}`} sub="recorded outcomes" />
      </div>
      {(Object.keys(VERDICT_LABEL) as Verdict[]).map((verdict) => {
        const { won, total } = c.byVerdict[verdict];
        return (
          <div className="adj" key={verdict}>
            <div>{VERDICT_LABEL[verdict]}</div>
            <div className="f">{total === 0 ? '—' : `${won}/${total}`}</div>
            <div className="why">
              Won out of recorded, by fit score when recorded. This is how you find out whether the
              score predicts anything for you.
            </div>
          </div>
        );
      })}
    </Card>
  );
}

export function DealsView({ today }: { today: string }) {
  const deals = useStore((s) => s.deals);

  return (
    <>
      <h1>Deals</h1>
      <p className="lede">
        What actually happened, set against what the card said. This is the only ground truth the
        tool has: it tells you whether you are being negotiated down, whether the fit score means
        anything, and, if you choose to share it, what the benchmarks should say.
      </p>

      <div className="split">
        <div>
          {deals.length === 0 ? (
            <div className="empty">
              No outcomes recorded yet. Lost deals count too: they are the half of the market no rate
              survey ever sees.
            </div>
          ) : (
            deals.map((deal) => <DealRow key={deal.id} deal={deal} today={today} />)
          )}
        </div>
        <div className="stack">
          <RecordCard today={today} />
          <CalibrationCard />
        </div>
      </div>
    </>
  );
}
