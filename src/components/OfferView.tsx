import { useMemo, useState } from 'react';
import { FORMAT_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { assessOffer, offerHeadline, offerReply, type OfferAssessment, type OfferVerdict } from '../domain/offer';
import { DEFAULT_TERMS } from '../domain/pricing';
import type { DealTerms, Format } from '../domain/types';
import { useStore } from '../store/useStore';
import { IntroductoryField, ScheduleFields, UsageFields } from './TermsFields';
import { Button, Card, NumberField, Pill, SelectField, Stat, TextField, copyText, money } from './ui/Primitives';

/**
 * Judging an offer that has already arrived.
 *
 * The terms here are the sponsor's, not the creator's, so they are kept in
 * this view rather than in the workspace: an offer under consideration is a
 * calculation, and what survives it is the deal record.
 */

const TONE: Record<OfferVerdict, 'good' | 'warn' | 'bad' | 'accent'> = {
  strong: 'good',
  fair: 'good',
  under: 'warn',
  'below-floor': 'bad',
};

const VERDICT_LABEL: Record<OfferVerdict, string> = {
  strong: 'above your ask',
  fair: 'about right',
  under: 'under the card',
  'below-floor': 'below your walk-away',
};

/** What the sponsor's own terms add to the price, each with the sentence that says why. */
function TermCosts({ assessment }: { assessment: OfferAssessment }) {
  if (assessment.termCosts.length === 0) {
    return (
      <p className="note">
        They have asked for the placement and nothing else. Anything further — paid usage, exclusivity, a
        deadline — is a separate thing they would be buying.
      </p>
    );
  }
  return (
    <>
      {assessment.termCosts.map((cost) => (
        <div className="adj" key={cost.label}>
          <div>{cost.label}</div>
          <div className="f">{cost.amount > 0 ? `+${money(cost.amount)}` : `−${money(Math.abs(cost.amount))}`}</div>
          <div className="why">{cost.rationale}</div>
        </div>
      ))}
    </>
  );
}

/** What to take back when the fee will not move. */
function Concessions({ assessment }: { assessment: OfferAssessment }) {
  if (assessment.concessions.length === 0) return null;
  return (
    <Card
      title="If the fee cannot move"
      subtitle="Scope, not rate. Each of these is something they asked for, given back, with what the placement is worth once it is."
      tight
    >
      {assessment.concessions.map((give) => (
        <div className="adj" key={give.label}>
          <div>
            {give.label}
            {give.closes && (
              <>
                {' '}
                <Pill tone="good">meets their offer</Pill>
              </>
            )}
          </div>
          <div className="f">{money(give.price)}</div>
          <div className="why">{give.sentence}</div>
        </div>
      ))}
    </Card>
  );
}

/** The headline numbers: what they offered, what it sells for, and the difference. */
function Verdict({ assessment }: { assessment: OfferAssessment }) {
  const { line, fee, verdict, gap, offeredCpm } = assessment;
  return (
    <Card title="The answer" tight>
      <div className="row" style={{ marginBottom: 12 }}>
        <Pill tone={TONE[verdict]}>{VERDICT_LABEL[verdict]}</Pill>
        {line.flooredByProduction && <Pill tone="warn">priced on your time</Pill>}
        {line.introductory && <Pill tone="accent">introductory rate</Pill>}
      </div>
      <p style={{ marginTop: 0 }}>{offerHeadline(assessment)}</p>
      <div className="grid cols-3">
        <Stat k="They offered" v={money(fee)} {...(offeredCpm ? { sub: `${money(offeredCpm)} per thousand` } : {})} />
        <Stat k="It sells for" v={money(line.target)} sub={`walk away below ${money(line.floor)}`} />
        <Stat k="Gap" v={gap > 0 ? money(gap) : '—'} {...(gap > 0 ? { sub: `they are at ${Math.round(assessment.ratio * 100)}% of the ask` } : {})} />
      </div>
      {line.market && <p className="note" style={{ marginTop: 10 }}>{line.market.sentence}</p>}
    </Card>
  );
}

/** The reply, ready to send. */
function Reply({ assessment, brand }: { assessment: OfferAssessment; brand: string }) {
  const [copied, setCopied] = useState(false);
  const text = offerReply(assessment, brand);
  return (
    <Card title="What to say" tight>
      <p className="email" style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
      <Button onClick={() => void copyText(text).then(setCopied)}>{copied ? 'Copied' : 'Copy reply'}</Button>
    </Card>
  );
}

/** Which placement the offer is for, and what they have put on the table. */
function OfferFields({
  channelId,
  format,
  fee,
  brand,
  set,
}: {
  channelId: string;
  format: Format;
  fee: number;
  brand: string;
  set: (patch: { channelId?: string; format?: Format; fee?: number; brand?: string }) => void;
}) {
  const channels = useStore((s) => s.profile.channels);
  const channel = channels.find((c) => c.id === channelId);
  return (
    <>
      <TextField label="Who is asking" value={brand} placeholder="Brand" onChange={(value) => set({ brand: value })} />
      <SelectField
        label="Channel"
        value={channelId}
        options={channels.map((c) => ({ value: c.id, label: `${PLATFORM_LABEL[c.platform]} · ${c.handle || 'unnamed'}` }))}
        onChange={(value) => {
          const next = channels.find((c) => c.id === value);
          set({ channelId: value, ...(next?.formats[0] ? { format: next.formats[0] } : {}) });
        }}
      />
      <SelectField
        label="Placement"
        value={format}
        options={(channel?.formats ?? []).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
        onChange={(value) => set({ format: value })}
      />
      <NumberField
        label="What they have offered, GBP"
        value={fee}
        onChange={(value) => set({ fee: Math.max(0, value) })}
        step={50}
        hint="The number in their email, before you have said anything."
      />
    </>
  );
}

/** Everything the creator types in: the placement, the money, and their terms. */
function OfferPanels({
  offer,
  set,
  setTerms,
}: {
  offer: { channelId: string; format: Format; fee: number; brand: string; terms: DealTerms };
  set: (patch: { channelId?: string; format?: Format; fee?: number; brand?: string }) => void;
  setTerms: (patch: Partial<DealTerms>) => void;
}) {
  return (
    <div className="stack">
      <Card title="Their offer" subtitle="What they have asked for, in their words, priced in yours." tight>
        <OfferFields channelId={offer.channelId} format={offer.format} fee={offer.fee} brand={offer.brand} set={set} />
      </Card>
      <Card title="What they want for it" subtitle="Every one of these is a separate thing they are buying." tight>
        <UsageFields terms={offer.terms} setTerms={setTerms} />
        <IntroductoryField terms={offer.terms} setTerms={setTerms} />
        <ScheduleFields terms={offer.terms} setTerms={setTerms} />
      </Card>
    </div>
  );
}

/** The answer, what their terms cost, the reply, and what to give back. */
function Answer({ assessment, brand }: { assessment: OfferAssessment | null; brand: string }) {
  if (!assessment) {
    return (
      <Card title="Not a placement you sell" tight>
        <p className="note" style={{ margin: 0 }}>
          This channel does not list that format. Add it on the profile tab if you would sell it, or price
          something you do.
        </p>
      </Card>
    );
  }
  return (
    <div className="stack">
      <Verdict assessment={assessment} />
      <Card
        title="What their terms cost"
        subtitle="Each of these is priced against the same placement with nothing attached, so you can say where the number comes from."
        tight
      >
        <TermCosts assessment={assessment} />
      </Card>
      <Reply assessment={assessment} brand={brand} />
      <Concessions assessment={assessment} />
    </div>
  );
}

export function OfferView() {
  const profile = useStore((s) => s.profile);
  const first = profile.channels[0];
  const [brand, setBrand] = useState('');
  const [channelId, setChannelId] = useState(first?.id ?? '');
  const [format, setFormat] = useState<Format>(first?.formats[0] ?? 'dedicated');
  const [fee, setFee] = useState(0);
  const [terms, setTerms] = useState<DealTerms>({ ...DEFAULT_TERMS });

  const assessment = useMemo(
    () => assessOffer(profile, { channelId, format, fee, terms }),
    [profile, channelId, format, fee, terms],
  );

  const set = (patch: { channelId?: string; format?: Format; fee?: number; brand?: string }) => {
    if (patch.channelId !== undefined) setChannelId(patch.channelId);
    if (patch.format !== undefined) setFormat(patch.format);
    if (patch.fee !== undefined) setFee(patch.fee);
    if (patch.brand !== undefined) setBrand(patch.brand);
  };

  return (
    <>
      <h1>An offer</h1>
      <p className="lede">
        A sponsor has named a number. This prices the same placement on the terms they asked for, says what each
        of those terms is worth, and gives you the reply. It is the rate card read backwards, so the two can
        never disagree.
      </p>
      {profile.channels.length === 0 ? (
        <Card title="Nothing to price yet" tight>
          <p className="note" style={{ margin: 0 }}>
            Add a channel on the profile tab, and this can judge what you are offered for it.
          </p>
        </Card>
      ) : (
        <div className="split">
          <OfferPanels
            offer={{ channelId, format, fee, brand, terms }}
            set={set}
            setTerms={(patch) => setTerms({ ...terms, ...patch })}
          />
          <Answer assessment={assessment} brand={brand} />
        </div>
      )}
    </>
  );
}
