import { useEffect, useMemo, useState } from 'react';
import { FORMAT_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { probeLocalModels, sharpenDraft } from '../domain/localModel';
import { composeFollowUp, composePitch, nextAction } from '../domain/pitch';
import { buildRateCard } from '../domain/pricing';
import { scoreProspect } from '../domain/scoring';
import type { Prospect, RateLine } from '../domain/types';
import { useStore, type Tab } from '../store/useStore';
import { Button, Card, Pill, SelectField, Stat, copyText, money } from './ui/Primitives';

const TOUCHES = [
  { value: '0', label: 'Opening pitch' },
  { value: '1', label: 'Follow-up 1, day 4' },
  { value: '2', label: 'Follow-up 2, day 11' },
  { value: '3', label: 'Follow-up 3, day 25' },
];

/** The models Ollama reports on this machine, probed once. Empty when it is not running. */
function useLocalModels() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  useEffect(() => {
    let cancelled = false;
    void probeLocalModels().then((status) => {
      if (cancelled) return;
      setModels(status.models);
      setModel(status.models[0] ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { models, model, setModel };
}

/** Local model controls, shown only when Ollama is actually running. */
function LocalModelPanel({ body, onSharpened }: { body: string; onSharpened: (text: string) => void }) {
  const { models, model, setModel } = useLocalModels();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (models.length === 0) {
    return (
      <Card title="Sharpen locally" tight>
        <p className="note" style={{ margin: 0 }}>
          No local model found. Start Ollama and reload to have a model on this machine tighten the
          wording. The draft above is complete without it, and nothing is ever sent to a remote
          service either way.
        </p>
      </Card>
    );
  }
  const sharpen = () => {
    setBusy(true);
    setFailed(false);
    void sharpenDraft(model, body).then((text) => {
      setBusy(false);
      if (text) onSharpened(text);
      else setFailed(true);
    });
  };
  return (
    <Card title="Sharpen locally" tight>
      <SelectField label="Model" value={model} options={models.map((m) => ({ value: m, label: m }))} onChange={setModel} />
      <div className="row">
        <Button onClick={sharpen}>{busy ? 'Working…' : 'Tighten the wording'}</Button>
        {failed && <Pill tone="bad">Model did not respond</Pill>}
      </div>
      <p className="note" style={{ marginTop: 9, marginBottom: 0 }}>
        The model is told to preserve every number and invent nothing. Read what comes back before
        sending it, because that instruction is a request rather than a guarantee.
      </p>
    </Card>
  );
}

/** The outreach page with nothing to draft yet, and where to go to fix that. */
function EmptyOutreach({ message, go, label }: { message: string; go: Tab; label: string }) {
  const setTab = useStore((s) => s.setTab);
  return (
    <>
      <h1>Outreach</h1>
      <div className="empty">
        {message} <Button onClick={() => setTab(go)}>{label}</Button>
      </div>
    </>
  );
}

/** The draft email, with copy, send and mark-as-sent controls. */
function DraftCard(props: { subject: string; body: string; prospect: Prospect; today: string; edited: boolean }) {
  const { subject, body, prospect, today } = props;
  const updateProspect = useStore((s) => s.updateProspect);
  const [copied, setCopied] = useState(false);
  const words = body.split(/\s+/).filter(Boolean).length;
  const mailto = `mailto:${prospect.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <Card tight>
      <div className="subject">Subject: {subject}</div>
      <div className="email">{body}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <Button variant="primary" onClick={() => void copyText(`Subject: ${subject}\n\n${body}`).then(setCopied)}>
          {copied ? 'Copied' : 'Copy email'}
        </Button>
        <Button onClick={() => (window.location.href = mailto)}>Open in email client</Button>
        <Button onClick={() => updateProspect(prospect.id, { lastContactedOn: today, stage: 'contacted' })}>
          Mark sent today
        </Button>
        {props.edited && <Pill tone="warn">Edited by a local model</Pill>}
        <Pill tone={words > 160 ? 'warn' : 'good'}>{words} words</Pill>
      </div>
    </Card>
  );
}

/** Which prospect, which placement, and which message in the sequence. */
function WhoAndWhatCard(props: {
  prospect: Prospect;
  line: RateLine;
  lines: RateLine[];
  onLine: (key: string) => void;
  touch: string;
  onTouch: (touch: string) => void;
}) {
  const prospects = useStore((s) => s.prospects);
  const openOutreach = useStore((s) => s.openOutreach);
  const key = (l: RateLine) => `${l.channelId}-${l.format}`;
  return (
    <Card title="Who and what" tight>
      <SelectField
        label="Prospect"
        value={props.prospect.id}
        options={prospects.map((p) => ({ value: p.id, label: p.brand || 'Unnamed prospect' }))}
        onChange={openOutreach}
      />
      <SelectField
        label="Placement being offered"
        value={key(props.line)}
        options={props.lines.map((l) => ({
          value: key(l),
          label: `${FORMAT_LABEL[l.format]} on ${PLATFORM_LABEL[l.platform]} — ${money(l.target)}`,
        }))}
        onChange={props.onLine}
      />
      <SelectField label="Which message" value={props.touch} options={TOUCHES} onChange={props.onTouch} />
    </Card>
  );
}

/** When the next follow-up is due, and the checks worth making before any send. */
function SendingCards({ prospect, today }: { prospect: Prospect; today: string }) {
  const action = nextAction(prospect, today);
  return (
    <>
      <Card title="Next action" tight>
        <Pill tone={action.urgency === 'overdue' ? 'bad' : 'warn'}>{action.label}</Pill>
        {prospect.lastContactedOn && (
          <p className="note" style={{ marginTop: 8, marginBottom: 0 }}>
            Last contacted {prospect.lastContactedOn}.
          </p>
        )}
      </Card>
      <Card title="Before you send" tight>
        <ul className="note" style={{ paddingLeft: 18, margin: '4px 0 0' }}>
          <li style={{ marginBottom: 5 }}>Find a named person. A pitch to a shared inbox is a pitch to nobody.</li>
          <li style={{ marginBottom: 5 }}>No attachment on the first email. Send the media kit when they reply.</li>
          <li style={{ marginBottom: 5 }}>
            Say the price. Creators who withhold it to open a conversation mostly open nothing.
          </li>
          <li>
            Read it once more for anything that is not true. The whole approach depends on every
            number in there being defensible.
          </li>
        </ul>
      </Card>
    </>
  );
}

/**
 * The draft for a prospect and placement: the composed pitch or follow-up, or
 * a local model's edit of it. A different prospect, placement or touch starts
 * a fresh draft.
 */
function useDraft(prospect: Prospect | undefined, line: RateLine | undefined, touch: string) {
  const profile = useStore((s) => s.profile);
  const [edited, setEdited] = useState<string | null>(null);
  const pitch = useMemo(() => {
    if (!prospect || !line) return null;
    const n = Number(touch);
    return n === 0 ? composePitch(profile, prospect, line) : composeFollowUp(profile, prospect, line, n);
  }, [profile, prospect, line, touch]);
  useEffect(() => setEdited(null), [prospect?.id, line?.channelId, line?.format, touch]);
  return { pitch, edited, setEdited };
}

/** Compose the pitch and follow-ups for one prospect, from the creator's own numbers. */
export function OutreachView({ today }: { today: string }) {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const prospects = useStore((s) => s.prospects);
  const activeProspectId = useStore((s) => s.activeProspectId);
  const lines = useMemo(() => buildRateCard(profile, terms).filter((l) => l.target > 0), [profile, terms]);
  const [lineKey, setLineKey] = useState('');
  const [touch, setTouch] = useState('0');
  const prospect = prospects.find((p) => p.id === activeProspectId) ?? prospects[0];
  const line = lines.find((l) => `${l.channelId}-${l.format}` === lineKey) ?? lines[0];
  const { pitch, edited, setEdited } = useDraft(prospect, line, touch);

  if (!prospect) return <EmptyOutreach message="No prospects yet. Add one first." go="prospects" label="Go to prospects" />;
  if (!line) {
    return <EmptyOutreach message="Nothing priced to offer. Add a channel with median views first." go="profile" label="Go to profile" />;
  }
  const fit = scoreProspect(profile, prospect, line);
  return (
    <>
      <h1>Outreach</h1>
      <p className="lede">
        A draft built from your numbers. Specific beats polished: the brand name, a real median view
        count and a price will out-perform anything more elegant.
      </p>
      <div className="split">
        <div className="stack">
          <DraftCard key={`${prospect.id}-${line.channelId}-${line.format}-${touch}`} subject={pitch?.subject ?? ''} body={edited ?? pitch?.body ?? ''} prospect={prospect} today={today} edited={edited !== null} />
          <LocalModelPanel body={pitch?.body ?? ''} onSharpened={setEdited} />
        </div>
        <div className="stack">
          <WhoAndWhatCard prospect={prospect} line={line} lines={lines} onLine={setLineKey} touch={touch} onTouch={setTouch} />
          <div className="grid cols-2">
            <Stat k="Fit score" v={String(fit.total)} sub={fit.verdict.replace(/-/g, ' ')} />
            <Stat k="Asking" v={money(line.target)} sub={`walk away at ${money(line.floor)}`} />
          </div>
          <SendingCards prospect={prospect} today={today} />
        </div>
      </div>
    </>
  );
}
