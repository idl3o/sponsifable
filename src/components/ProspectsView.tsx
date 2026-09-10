import { useMemo, useState } from 'react';
import { NICHE_LABEL } from '../domain/benchmarks';
import { nextAction } from '../domain/pitch';
import { buildRateCard } from '../domain/pricing';
import { rankProspects } from '../domain/scoring';
import type { FitScore, GeoSplit, Niche, PipelineStage, Prospect } from '../domain/types';
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

const TIERS: Array<keyof GeoSplit> = ['tier1', 'tier2', 'tier3'];

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

/** Editable detail for one prospect, hidden behind a disclosure. */
function ProspectDetail({ prospect }: { prospect: Prospect }) {
  const updateProspect = useStore((s) => s.updateProspect);
  const removeProspect = useStore((s) => s.removeProspect);

  const toggleTier = (tier: keyof GeoSplit) => {
    const next = prospect.sellsInto.includes(tier)
      ? prospect.sellsInto.filter((t) => t !== tier)
      : [...prospect.sellsInto, tier];
    updateProspect(prospect.id, { sellsInto: next });
  };

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
      <div className="grid cols-2">
        <div>
          <TextField
            label="Brand"
            value={prospect.brand}
            onChange={(brand) => updateProspect(prospect.id, { brand })}
          />
          <TextField
            label="Product being sold"
            value={prospect.product}
            placeholder="What they would want you to talk about"
            onChange={(product) => updateProspect(prospect.id, { product })}
          />
          <SelectField
            label="Their category"
            value={prospect.niche}
            options={NICHE_OPTIONS}
            onChange={(niche) => updateProspect(prospect.id, { niche })}
          />
          <SelectField
            label="Stage"
            value={prospect.stage}
            options={STAGES}
            onChange={(stage) => updateProspect(prospect.id, { stage })}
          />
        </div>

        <div>
          <TextField
            label="Contact name"
            value={prospect.contactName}
            placeholder="A person, not partnerships@"
            onChange={(contactName) => updateProspect(prospect.id, { contactName })}
          />
          <TextField
            label="Contact email"
            value={prospect.contactEmail}
            onChange={(contactEmail) => updateProspect(prospect.id, { contactEmail })}
          />
          <TextField
            label="Last contacted"
            value={prospect.lastContactedOn}
            placeholder="2026-09-01"
            onChange={(lastContactedOn) => updateProspect(prospect.id, { lastContactedOn })}
          />

          <div className="field">
            <span className="lbl">Budget band, GBP</span>
            <div className="row">
              <input
                type="number"
                value={prospect.budgetBand[0]}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    budgetBand: [Number(e.target.value), prospect.budgetBand[1]],
                  })
                }
                style={{ width: 110 }}
              />
              <span className="note">to</span>
              <input
                type="number"
                value={prospect.budgetBand[1]}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    budgetBand: [prospect.budgetBand[0], Number(e.target.value)],
                  })
                }
                style={{ width: 110 }}
              />
            </div>
            <span className="hint">
              Guess from what they have paid comparable creators. A wrong guess still beats none.
            </span>
          </div>

          <div className="field">
            <span className="lbl">Sells into</span>
            <div className="row">
              {TIERS.map((tier) => (
                <Button
                  key={tier}
                  onClick={() => toggleTier(tier)}
                  variant={prospect.sellsInto.includes(tier) ? 'primary' : 'default'}
                >
                  {tier === 'tier1' ? 'Tier 1' : tier === 'tier2' ? 'Tier 2' : 'Tier 3'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <label className="field">
        <span className="lbl">Evidence they sponsor creators</span>
        <textarea
          value={prospect.evidence}
          placeholder="Links to placements they have already paid for, or a note on where you saw one."
          onChange={(e) => updateProspect(prospect.id, { evidence: e.target.value })}
        />
        <span className="hint">
          A brand with no history of paying creators is the most expensive kind of prospect: they
          reply, they are enthusiastic, and there is no budget line.
        </span>
      </label>

      <label className="field">
        <span className="lbl">Notes</span>
        <textarea
          value={prospect.notes}
          onChange={(e) => updateProspect(prospect.id, { notes: e.target.value })}
        />
      </label>

      <Button variant="ghost" onClick={() => removeProspect(prospect.id)}>
        Delete prospect
      </Button>
    </div>
  );
}

/** One row in the ranked pipeline. */
function ProspectRow({
  prospect,
  fit,
  today,
}: {
  prospect: Prospect;
  fit: FitScore;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const openOutreach = useStore((s) => s.openOutreach);
  const action = nextAction(prospect, today);

  return (
    <div className="prospect">
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

      <div className="row" style={{ marginTop: 11 }}>
        <Button onClick={() => openOutreach(prospect.id)}>Write the pitch</Button>
        <button className="disclosure" onClick={() => setShowWhy(!showWhy)}>
          {showWhy ? 'Hide scoring' : 'Why this score'}
        </button>
        <button className="disclosure" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Edit details'}
        </button>
      </div>

      {showWhy && (
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
      )}

      {open && <ProspectDetail prospect={prospect} />}
    </div>
  );
}

export function ProspectsView({ today }: { today: string }) {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const prospects = useStore((s) => s.prospects);
  const addProspect = useStore((s) => s.addProspect);

  const bestLine = useMemo(() => {
    const lines = buildRateCard(profile, terms).filter((l) => l.target > 0);
    return lines.reduce<(typeof lines)[number] | undefined>(
      (acc, l) => (!acc || l.target > acc.target ? l : acc),
      undefined,
    );
  }, [profile, terms]);

  const ranked = useMemo(
    () => rankProspects(profile, prospects, bestLine),
    [profile, prospects, bestLine],
  );

  const live = ranked.filter(
    (r) => r.prospect.stage !== 'won' && r.prospect.stage !== 'lost',
  ).length;

  return (
    <>
      <div className="spread">
        <div>
          <h1>Prospects</h1>
          <p className="lede">
            Ranked by how likely they are to reply and pay, scored against{' '}
            {bestLine ? money(bestLine.target) : 'your rate card'}. Work down the list, not across
            it.
          </p>
        </div>
        <Button variant="primary" onClick={addProspect}>
          Add prospect
        </Button>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <Pill tone="accent">{live} live</Pill>
        <Pill tone="good">{prospects.filter((p) => p.stage === 'won').length} won</Pill>
        <Pill>{prospects.filter((p) => p.stage === 'lost').length} lost</Pill>
      </div>

      {ranked.length === 0 ? (
        <div className="empty">
          No prospects yet. Start with brands that have already sponsored someone in your category.
          They have a budget line, which is most of the battle.
        </div>
      ) : (
        ranked.map(({ prospect, fit }) => (
          <ProspectRow key={prospect.id} prospect={prospect} fit={fit} today={today} />
        ))
      )}

      <Card title="Where to find prospects" tight>
        <ul className="note" style={{ paddingLeft: 18, margin: '6px 0 0' }}>
          <li style={{ marginBottom: 5 }}>
            The sponsors of the three creators closest to you in size and subject. They have already
            decided this audience is worth paying for.
          </li>
          <li style={{ marginBottom: 5 }}>
            Companies that just raised money. New funding means new marketing budget and a mandate
            to spend it.
          </li>
          <li>
            Brands already advertising on podcasts in your category. Podcast buyers understand
            host-read placements and do not need educating.
          </li>
        </ul>
      </Card>
    </>
  );
}
