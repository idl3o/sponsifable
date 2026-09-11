import { useMemo, useState } from 'react';
import { FORMAT_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { calibrate, closeDeal } from '../domain/deals';
import { buildRateCard } from '../domain/pricing';
import { scoreProspect } from '../domain/scoring';
import type { DealOutcome, LostReason, Prospect, RateLine, Verdict } from '../domain/types';
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

/** The outcome half of the record form: how it ended, and when. */
function useOutcomeForm(today: string) {
  const [outcome, setOutcome] = useState<DealOutcome>('won');
  const [agreed, setAgreed] = useState(0);
  const [lostReason, setLostReason] = useState<LostReason>('no-reply');
  const [closedOn, setClosedOn] = useState(today);
  return { outcome, setOutcome, agreed, setAgreed, lostReason, setLostReason, closedOn, setClosedOn };
}

type OutcomeForm = ReturnType<typeof useOutcomeForm>;

/** Won or lost, what was agreed or why it was lost, and the date it closed. */
function OutcomeFields({ form }: { form: OutcomeForm }) {
  return (
    <>
      <SelectField
        label="Outcome"
        value={form.outcome}
        options={[
          { value: 'won', label: 'Won' },
          { value: 'lost', label: 'Lost' },
        ]}
        onChange={form.setOutcome}
      />
      {form.outcome === 'won' ? (
        <NumberField
          label="Agreed, GBP"
          value={form.agreed}
          onChange={form.setAgreed}
          step={10}
          hint="What was actually agreed, not what you asked for."
        />
      ) : (
        <SelectField label="Why it was lost" value={form.lostReason} options={LOST_REASONS} onChange={form.setLostReason} />
      )}
      <TextField label="Closed on" value={form.closedOn} onChange={form.setClosedOn} />
    </>
  );
}

/** A priced line's key in the placement list. */
function lineKey(line: RateLine): string {
  return `${line.channelId}-${line.format}`;
}

/** Which prospect and which priced placement the outcome belongs to. */
function DealTargetFields(props: {
  prospects: Prospect[];
  prospect: Prospect;
  onProspect: (id: string) => void;
  lines: RateLine[];
  line: RateLine;
  onLine: (key: string) => void;
}) {
  return (
    <>
      <SelectField
        label="Prospect"
        value={props.prospect.id}
        options={props.prospects.map((p) => ({ value: p.id, label: p.brand || 'Unnamed prospect' }))}
        onChange={props.onProspect}
      />
      <SelectField
        label="Placement"
        value={lineKey(props.line)}
        options={props.lines.map((l) => ({
          value: lineKey(l),
          label: `${FORMAT_LABEL[l.format]} on ${PLATFORM_LABEL[l.platform]}, quoted £${l.target.toLocaleString('en-GB')}`,
        }))}
        onChange={props.onLine}
      />
    </>
  );
}

/** File the outcome of a conversation against the price the tool quoted. */
function RecordCard({ today }: { today: string }) {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const prospects = useStore((s) => s.prospects);
  const recordDeal = useStore((s) => s.recordDeal);
  const lines = useMemo(() => buildRateCard(profile, terms).filter((l) => l.target > 0), [profile, terms]);
  const [prospectId, setProspectId] = useState('');
  const [chosenLine, setChosenLine] = useState('');
  const form = useOutcomeForm(today);

  const open = prospects.filter((p) => p.stage !== 'won' && p.stage !== 'lost');
  const prospect = prospects.find((p) => p.id === prospectId) ?? open[0] ?? prospects[0];
  const line = lines.find((l) => lineKey(l) === chosenLine) ?? lines[0];
  if (!prospect || !line) {
    return (
      <Card title="Record an outcome" tight>
        <p className="note">Add a prospect and a priced channel first.</p>
      </Card>
    );
  }

  const submit = () => {
    const fitAtClose = scoreProspect(profile, prospect, line).total;
    const { outcome, agreed, lostReason, closedOn } = form;
    recordDeal((id) => closeDeal(profile, prospect, line, terms, { id, outcome, agreed, lostReason, closedOn, fitAtClose }));
    form.setAgreed(0);
  };

  return (
    <Card
      title="Record an outcome"
      subtitle="Won or lost, against the price the card quoted. The deal is frozen as it stands today, so later edits to your profile do not rewrite it."
      tight
    >
      <DealTargetFields prospects={prospects} prospect={prospect} onProspect={setProspectId} lines={lines} line={line} onLine={setChosenLine} />
      <OutcomeFields form={form} />
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

/** The deal log: recorded outcomes, the form that records them, and what they say. */
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
