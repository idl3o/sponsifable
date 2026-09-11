import { useMemo, useState } from 'react';
import { NICHE_LABEL } from '../domain/benchmarks';
import { nextAction, type NextAction } from '../domain/pitch';
import { buildRateCard } from '../domain/pricing';
import { rankProspects } from '../domain/scoring';
import type { FitScore, GeoSplit, Niche, PipelineStage, Prospect, RateLine } from '../domain/types';
import { useStore } from '../store/useStore';
import { Button, Card, Pill, SelectField, TextField, money } from './ui/Primitives';

const STAGES: Array<{ value: PipelineStage; label: string }> = [
  { value: 'researching', label: 'Researching' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const NICHE_OPTIONS = (Object.keys(NICHE_LABEL) as Niche[]).map((value) => ({
  value,
  label: NICHE_LABEL[value],
}));

const TIERS: Array<{ tier: keyof GeoSplit; label: string }> = [
  { tier: 'tier1', label: 'Tier 1' },
  { tier: 'tier2', label: 'Tier 2' },
  { tier: 'tier3', label: 'Tier 3' },
];

const VERDICT_TONE = {
  strong: 'good',
  'worth-a-shot': 'warn',
  weak: 'bad',
} as const;

const URGENCY_TONE = {
  overdue: 'bad',
  'due-soon': 'warn',
  waiting: 'plain',
  none: 'plain',
} as const;

/** A prospect and the store action that edits it, which every detail field needs. */
interface FieldsProps {
  prospect: Prospect;
  update: (patch: Partial<Prospect>) => void;
}

/** Who the brand is, what it sells, and where the conversation stands. */
function BrandFields({ prospect, update }: FieldsProps) {
  return (
    <div>
      <TextField label="Brand" value={prospect.brand} onChange={(brand) => update({ brand })} />
      <TextField
        label="Product being sold"
        value={prospect.product}
        placeholder="What they would want you to talk about"
        onChange={(product) => update({ product })}
      />
      <SelectField label="Their category" value={prospect.niche} options={NICHE_OPTIONS} onChange={(niche) => update({ niche })} />
      <SelectField label="Stage" value={prospect.stage} options={STAGES} onChange={(stage) => update({ stage })} />
    </div>
  );
}

/** The low and high guess at what the brand pays per placement. */
function BudgetBandField({ prospect, update }: FieldsProps) {
  const [low, high] = prospect.budgetBand;
  return (
    <div className="field">
      <span className="lbl">Budget band, GBP</span>
      <div className="row">
        <input type="number" value={low} onChange={(e) => update({ budgetBand: [Number(e.target.value), high] })} style={{ width: 110 }} />
        <span className="note">to</span>
        <input type="number" value={high} onChange={(e) => update({ budgetBand: [low, Number(e.target.value)] })} style={{ width: 110 }} />
      </div>
      <span className="hint">Guess from what they have paid comparable creators. A wrong guess still beats none.</span>
    </div>
  );
}

/** The geography tiers the brand sells into, as toggles. */
function SellsIntoField({ prospect, update }: FieldsProps) {
  const toggle = (tier: keyof GeoSplit) =>
    update({
      sellsInto: prospect.sellsInto.includes(tier)
        ? prospect.sellsInto.filter((t) => t !== tier)
        : [...prospect.sellsInto, tier],
    });
  return (
    <div className="field">
      <span className="lbl">Sells into</span>
      <div className="row">
        {TIERS.map(({ tier, label }) => (
          <Button key={tier} onClick={() => toggle(tier)} variant={prospect.sellsInto.includes(tier) ? 'primary' : 'default'}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Who to write to, when they were last contacted, and what the brand can spend. */
function ContactFields({ prospect, update }: FieldsProps) {
  return (
    <div>
      <TextField
        label="Contact name"
        value={prospect.contactName}
        placeholder="A person, not partnerships@"
        onChange={(contactName) => update({ contactName })}
      />
      <TextField label="Contact email" value={prospect.contactEmail} onChange={(contactEmail) => update({ contactEmail })} />
      <TextField
        label="Last contacted"
        value={prospect.lastContactedOn}
        placeholder="2026-09-01"
        onChange={(lastContactedOn) => update({ lastContactedOn })}
      />
      <BudgetBandField prospect={prospect} update={update} />
      <SellsIntoField prospect={prospect} update={update} />
    </div>
  );
}

/** Evidence the brand pays creators, and free notes. */
function NotesFields({ prospect, update }: FieldsProps) {
  return (
    <>
      <label className="field">
        <span className="lbl">Evidence they sponsor creators</span>
        <textarea
          value={prospect.evidence}
          placeholder="Links to placements they have already paid for, or a note on where you saw one."
          onChange={(e) => update({ evidence: e.target.value })}
        />
        <span className="hint">
          A brand with no history of paying creators is the most expensive kind of prospect: they
          reply, they are enthusiastic, and there is no budget line.
        </span>
      </label>
      <label className="field">
        <span className="lbl">Notes</span>
        <textarea value={prospect.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>
    </>
  );
}

/** Editable detail for one prospect, hidden behind a disclosure. */
function ProspectDetail({ prospect }: { prospect: Prospect }) {
  const updateProspect = useStore((s) => s.updateProspect);
  const removeProspect = useStore((s) => s.removeProspect);
  const update = (patch: Partial<Prospect>) => updateProspect(prospect.id, patch);
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
      <div className="grid cols-2">
        <BrandFields prospect={prospect} update={update} />
        <ContactFields prospect={prospect} update={update} />
      </div>
      <NotesFields prospect={prospect} update={update} />
      <Button variant="ghost" onClick={() => removeProspect(prospect.id)}>
        Delete prospect
      </Button>
    </div>
  );
}

/** A prospect's name, verdict, stage and next action, beside its fit score. */
function ProspectHeadline({ prospect, fit, action }: { prospect: Prospect; fit: FitScore; action: NextAction }) {
  return (
    <div className="spread">
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <strong>{prospect.brand || 'Unnamed prospect'}</strong>
          <Pill tone={VERDICT_TONE[fit.verdict]}>{fit.verdict.replace(/-/g, ' ')}</Pill>
          <Pill>{STAGES.find((s) => s.value === prospect.stage)?.label}</Pill>
        </div>
        <div className="note" style={{ marginTop: 3 }}>
          {prospect.product || 'No product recorded'}
        </div>
        <div style={{ marginTop: 7 }}>
          <Pill tone={URGENCY_TONE[action.urgency]}>{action.label}</Pill>
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 96 }}>
        <div className="score">{fit.total}</div>
        <div className="note">fit score</div>
        <div className="meter">
          <i style={{ width: `${fit.total}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Each component of the fit score with the reasoning behind it. */
function FitBreakdown({ fit }: { fit: FitScore }) {
  return (
    <div style={{ marginTop: 11 }}>
      {fit.components.map((component) => (
        <div className="adj" key={component.label}>
          <div>{component.label}</div>
          <div className="f">
            {component.score}/{component.max}
          </div>
          <div className="why">{component.note}</div>
        </div>
      ))}
    </div>
  );
}

/** One row in the ranked pipeline. */
function ProspectRow({ prospect, fit, today }: { prospect: Prospect; fit: FitScore; today: string }) {
  const [open, setOpen] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const openOutreach = useStore((s) => s.openOutreach);
  return (
    <div className="prospect">
      <ProspectHeadline prospect={prospect} fit={fit} action={nextAction(prospect, today)} />
      <div className="row" style={{ marginTop: 11 }}>
        <Button onClick={() => openOutreach(prospect.id)}>Write the pitch</Button>
        <button className="disclosure" onClick={() => setShowWhy(!showWhy)}>
          {showWhy ? 'Hide scoring' : 'Why this score'}
        </button>
        <button className="disclosure" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Edit details'}
        </button>
      </div>
      {showWhy && <FitBreakdown fit={fit} />}
      {open && <ProspectDetail prospect={prospect} />}
    </div>
  );
}

/** Advice on where sponsors with a budget line are found. */
function WhereToFindCard() {
  return (
    <Card title="Where to find prospects" tight>
      <ul className="note" style={{ paddingLeft: 18, margin: '6px 0 0' }}>
        <li style={{ marginBottom: 5 }}>
          The sponsors of the three creators closest to you in size and subject. They have already
          decided this audience is worth paying for.
        </li>
        <li style={{ marginBottom: 5 }}>
          Companies that just raised money. New funding means new marketing budget and a mandate to
          spend it.
        </li>
        <li>
          Brands already advertising on podcasts in your category. Podcast buyers understand
          host-read placements and do not need educating.
        </li>
      </ul>
    </Card>
  );
}

/** The highest-priced line on the card, which prospects are scored against. */
function useBestLine(): RateLine | undefined {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  return useMemo(() => {
    const lines = buildRateCard(profile, terms).filter((l) => l.target > 0);
    return lines.reduce<RateLine | undefined>((acc, l) => (!acc || l.target > acc.target ? l : acc), undefined);
  }, [profile, terms]);
}

/** The pipeline, ranked by how likely each prospect is to reply and pay. */
export function ProspectsView({ today }: { today: string }) {
  const profile = useStore((s) => s.profile);
  const prospects = useStore((s) => s.prospects);
  const addProspect = useStore((s) => s.addProspect);
  const bestLine = useBestLine();
  const ranked = useMemo(() => rankProspects(profile, prospects, bestLine), [profile, prospects, bestLine]);
  const countAt = (stage: PipelineStage) => prospects.filter((p) => p.stage === stage).length;
  const live = ranked.filter((r) => r.prospect.stage !== 'won' && r.prospect.stage !== 'lost').length;

  return (
    <>
      <div className="spread">
        <div>
          <h1>Prospects</h1>
          <p className="lede">
            Ranked by how likely they are to reply and pay, scored against{' '}
            {bestLine ? money(bestLine.target) : 'your rate card'}. Work down the list, not across it.
          </p>
        </div>
        <Button variant="primary" onClick={addProspect}>
          Add prospect
        </Button>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <Pill tone="accent">{live} live</Pill>
        <Pill tone="good">{countAt('won')} won</Pill>
        <Pill>{countAt('lost')} lost</Pill>
      </div>
      {ranked.length === 0 ? (
        <div className="empty">
          No prospects yet. Start with brands that have already sponsored someone in your category.
          They have a budget line, which is most of the battle.
        </div>
      ) : (
        ranked.map(({ prospect, fit }) => <ProspectRow key={prospect.id} prospect={prospect} fit={fit} today={today} />)
      )}
      <WhereToFindCard />
    </>
  );
}
