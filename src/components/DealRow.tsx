import { useState } from 'react';
import { FORMAT_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { priceOverrun, rateSubmissionUrl } from '../domain/deals';
import type { Deal, Sighting } from '../domain/types';
import { useStore } from '../store/useStore';
import { Button, Pill, TextField, money } from './ui/Primitives';

const LOST_LABEL: Record<NonNullable<Deal['lostReason']>, string> = {
  budget: 'budget',
  timing: 'timing',
  'no-reply': 'no reply',
  'poor-fit': 'poor fit',
  'i-declined': 'I declined',
  other: 'other',
};

/** Copy text to the clipboard, ignoring a denied permission. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** One sighting of the asset running as a paid ad, with the overrun it implies. */
function SightingLine({ deal, sighting }: { deal: Deal; sighting: Sighting }) {
  const removeSighting = useStore((s) => s.removeSighting);
  const [copied, setCopied] = useState(false);
  const overrun = priceOverrun(deal, sighting);

  return (
    <div className="adj">
      <div>
        {sighting.startedOn} to {sighting.seenOn}
        <div className="note">{sighting.source || 'No source recorded'}</div>
      </div>
      <div className="f">{overrun.owed > 0 ? money(overrun.owed) : 'in terms'}</div>
      <div className="why">
        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
          {sighting.verified ? (
            <Pill tone="good">verified by sponsorable verify</Pill>
          ) : (
            <Pill tone="warn">not verified</Pill>
          )}
          <Pill>
            {overrun.daysRun} days run, {Number.isFinite(overrun.permitted) ? overrun.permitted : 'unlimited'}{' '}
            permitted
          </Pill>
        </div>
        {!sighting.verified && (
          <p style={{ margin: '0 0 6px' }}>
            The contract still supports this claim. Without a decoded watermark the sponsor can
            dispute that the footage is yours, and a watermark that failed to decode proves nothing
            either way.
          </p>
        )}
        {overrun.sentence && <p style={{ margin: '0 0 6px' }}>{overrun.sentence}</p>}
        <div className="row" style={{ gap: 6 }}>
          {overrun.sentence && (
            <Button onClick={() => void copy(overrun.sentence).then(setCopied)}>
              {copied ? 'Copied' : 'Copy paragraph'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => removeSighting(deal.id, sighting.id)}>
            Delete sighting
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Record a paid ad found running the asset. */
function SightingForm({ deal, today }: { deal: Deal; today: string }) {
  const addSighting = useStore((s) => s.addSighting);
  const [source, setSource] = useState('');
  const [startedOn, setStartedOn] = useState('');
  const [seenOn, setSeenOn] = useState(today);

  return (
    <div className="grid cols-3" style={{ alignItems: 'end' }}>
      <TextField label="Where you saw it" value={source} placeholder="Ad library link" onChange={setSource} />
      <TextField label="Started running" value={startedOn} placeholder="2026-10-01" onChange={setStartedOn} />
      <TextField label="Last seen running" value={seenOn} onChange={setSeenOn} />
      <Button
        onClick={() => {
          if (!startedOn || !seenOn) return;
          addSighting(deal.id, { source, startedOn, seenOn, verified: false });
          setSource('');
          setStartedOn('');
        }}
      >
        Record sighting
      </Button>
    </div>
  );
}

/** Rights, delivery and sightings for a won deal. */
function WonDetail({ deal, today }: { deal: Deal; today: string }) {
  const updateDeal = useStore((s) => s.updateDeal);
  const submitUrl = rateSubmissionUrl(deal);

  return (
    <>
      <div className="grid cols-2">
        <TextField
          label="Delivered on"
          value={deal.deliveredOn}
          placeholder="YYYY-MM-DD"
          onChange={(deliveredOn) => updateDeal(deal.id, { deliveredOn })}
          hint={deal.seal ? '' : 'Once this is set the deal can no longer be sealed.'}
        />
        <TextField
          label="Invoice paid on"
          value={deal.paidOn}
          placeholder="YYYY-MM-DD"
          onChange={(paidOn) => updateDeal(deal.id, { paidOn })}
        />
      </div>

      <h3>Rights</h3>
      {deal.seal ? (
        <p className="note">
          <Pill tone="good">sealed</Pill> Serial {deal.seal.serial}, timestamped{' '}
          {deal.seal.timestampedAt}. Deliver the sealed file, not the original.
        </p>
      ) : deal.deliveredOn ? (
        <p className="note">
          Not sealed, and delivered, so it can no longer be. The contract is the evidence for
          this deal.
        </p>
      ) : (
        <p className="note">
          Not sealed. To establish rights, run <code>sponsorable seal {deal.id} your-file.png</code>{' '}
          before delivering. Sealing is optional and cannot be done after delivery.
        </p>
      )}

      <h3>Sightings</h3>
      {deal.sightings.map((sighting) => (
        <SightingLine key={sighting.id} deal={deal} sighting={sighting} />
      ))}
      <SightingForm deal={deal} today={today} />

      {submitUrl && (
        <>
          <h3>Help the benchmarks</h3>
          <p className="note">
            Opens the rate-data form on GitHub, filled in with rounded figures: no brand, no handle,
            no exact numbers or dates. The figures travel to GitHub in the page address as soon as
            it opens. Nothing is posted until you press submit there.
          </p>
          <a className="btn" href={submitUrl} target="_blank" rel="noopener noreferrer">
            Submit this rate anonymously
          </a>
        </>
      )}
    </>
  );
}

/** One closed deal, expandable into delivery, rights and sightings. */
export function DealRow({ deal, today }: { deal: Deal; today: string }) {
  const [open, setOpen] = useState(false);
  const removeDeal = useStore((s) => s.removeDeal);
  const updateDeal = useStore((s) => s.updateDeal);
  const won = deal.outcome === 'won';
  const ratio = won && deal.quoted > 0 ? Math.round((deal.agreed / deal.quoted) * 100) : null;

  return (
    <div className="prospect">
      <div className="spread">
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <strong>{deal.brand || 'Unnamed brand'}</strong>
            <Pill tone={won ? 'good' : 'plain'}>
              {won ? 'won' : `lost: ${LOST_LABEL[deal.lostReason ?? 'other']}`}
            </Pill>
            {deal.seal && <Pill tone="accent">sealed</Pill>}
            {deal.sightings.length > 0 && <Pill tone="warn">{deal.sightings.length} sighted</Pill>}
          </div>
          <div className="note" style={{ marginTop: 3 }}>
            {FORMAT_LABEL[deal.format]} on {PLATFORM_LABEL[deal.platform]} · closed {deal.closedOn}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 96 }}>
          <div className="price">{won ? money(deal.agreed) : '—'}</div>
          <div className="band">
            quoted {money(deal.quoted)}
            {ratio !== null ? ` · ${ratio}%` : ''}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 11 }}>
        <button className="disclosure" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Close' : won ? 'Delivery, rights and sightings' : 'Details'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
          {won && <WonDetail deal={deal} today={today} />}
          <label className="field">
            <span className="lbl">Notes</span>
            <textarea value={deal.notes} onChange={(e) => updateDeal(deal.id, { notes: e.target.value })} />
          </label>
          <Button variant="ghost" onClick={() => removeDeal(deal.id)}>
            Delete deal record
          </Button>
        </div>
      )}
    </div>
  );
}
