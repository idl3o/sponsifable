import { useEffect, useMemo, useState } from 'react';
import { FORMAT_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { probeLocalModels, sharpenDraft } from '../domain/localModel';
import { composeFollowUp, composePitch, nextAction } from '../domain/pitch';
import { buildRateCard } from '../domain/pricing';
import { scoreProspect } from '../domain/scoring';
import type { RateLine } from '../domain/types';
import { useStore } from '../store/useStore';
import { Button, Card, Pill, SelectField, Stat, money } from './ui/Primitives';

/** Copy text to the clipboard, ignoring a denied permission. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Local model controls, shown only when Ollama is actually running. */
function LocalModelPanel({
  body,
  onSharpened,
}: {
  body: string;
  onSharpened: (text: string) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

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

  return (
    <Card title="Sharpen locally" tight>
      <SelectField
        label="Model"
        value={model}
        options={models.map((m) => ({ value: m, label: m }))}
        onChange={setModel}
      />
      <div className="row">
        <Button
          onClick={() => {
            setBusy(true);
            setFailed(false);
            void sharpenDraft(model, body).then((text) => {
              setBusy(false);
              if (text) onSharpened(text);
              else setFailed(true);
            });
          }}
        >
          {busy ? 'Working…' : 'Tighten the wording'}
        </Button>
        {failed && <Pill tone="bad">Model did not respond</Pill>}
      </div>
      <p className="note" style={{ marginTop: 9, marginBottom: 0 }}>
        The model is told to preserve every number and invent nothing. Read what comes back before
        sending it, because that instruction is a request rather than a guarantee.
      </p>
    </Card>
  );
}

export function OutreachView({ today }: { today: string }) {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const prospects = useStore((s) => s.prospects);
  const activeProspectId = useStore((s) => s.activeProspectId);
  const openOutreach = useStore((s) => s.openOutreach);
  const updateProspect = useStore((s) => s.updateProspect);
  const setTab = useStore((s) => s.setTab);

  const lines = useMemo(
    () => buildRateCard(profile, terms).filter((l) => l.target > 0),
    [profile, terms],
  );

  const prospect = prospects.find((p) => p.id === activeProspectId) ?? prospects[0];
  const [lineKey, setLineKey] = useState('');
  const [touch, setTouch] = useState('0');
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const line: RateLine | undefined =
    lines.find((l) => `${l.channelId}-${l.format}` === lineKey) ?? lines[0];

  const pitch = useMemo(() => {
    if (!prospect || !line) return null;
    const n = Number(touch);
    return n === 0
      ? composePitch(profile, prospect, line)
      : composeFollowUp(profile, prospect, line, n);
  }, [profile, prospect, line, touch]);

  // A different prospect, placement or touch means a different draft.
  useEffect(() => {
    setEdited(null);
    setCopied(false);
  }, [prospect?.id, lineKey, touch]);

  if (!prospect) {
    return (
      <>
        <h1>Outreach</h1>
        <div className="empty">
          No prospects yet. Add one first.{' '}
          <Button onClick={() => setTab('prospects')}>Go to prospects</Button>
        </div>
      </>
    );
  }

  if (!line) {
    return (
      <>
        <h1>Outreach</h1>
        <div className="empty">
          Nothing priced to offer. Add a channel with median views first.{' '}
          <Button onClick={() => setTab('profile')}>Go to profile</Button>
        </div>
      </>
    );
  }

  const body = edited ?? pitch?.body ?? '';
  const fit = scoreProspect(profile, prospect, line);
  const action = nextAction(prospect, today);
  const words = body.split(/\s+/).filter(Boolean).length;

  return (
    <>
      <h1>Outreach</h1>
      <p className="lede">
        A draft built from your numbers. Specific beats polished: the brand name, a real median view
        count and a price will out-perform anything more elegant.
      </p>

      <div className="split">
        <div className="stack">
          <Card tight>
            <div className="subject">Subject: {pitch?.subject}</div>
            <div className="email">{body}</div>
            <div className="row" style={{ marginTop: 12 }}>
              <Button
                variant="primary"
                onClick={() => {
                  void copy(`Subject: ${pitch?.subject}\n\n${body}`).then(setCopied);
                }}
              >
                {copied ? 'Copied' : 'Copy email'}
              </Button>
              <Button
                onClick={() => {
                  const href = `mailto:${prospect.contactEmail}?subject=${encodeURIComponent(
                    pitch?.subject ?? '',
                  )}&body=${encodeURIComponent(body)}`;
                  window.location.href = href;
                }}
              >
                Open in email client
              </Button>
              <Button onClick={() => updateProspect(prospect.id, { lastContactedOn: today, stage: 'contacted' })}>
                Mark sent today
              </Button>
              {edited && <Pill tone="warn">Edited by a local model</Pill>}
              <Pill tone={words > 160 ? 'warn' : 'good'}>{words} words</Pill>
            </div>
          </Card>

          <LocalModelPanel body={pitch?.body ?? ''} onSharpened={setEdited} />
        </div>

        <div className="stack">
          <Card title="Who and what" tight>
            <SelectField
              label="Prospect"
              value={prospect.id}
              options={prospects.map((p) => ({
                value: p.id,
                label: p.brand || 'Unnamed prospect',
              }))}
              onChange={openOutreach}
            />
            <SelectField
              label="Placement being offered"
              value={`${line.channelId}-${line.format}`}
              options={lines.map((l) => ({
                value: `${l.channelId}-${l.format}`,
                label: `${FORMAT_LABEL[l.format]} on ${PLATFORM_LABEL[l.platform]} — ${money(l.target)}`,
              }))}
              onChange={setLineKey}
            />
            <SelectField
              label="Which message"
              value={touch}
              options={[
                { value: '0', label: 'Opening pitch' },
                { value: '1', label: 'Follow-up 1, day 4' },
                { value: '2', label: 'Follow-up 2, day 11' },
                { value: '3', label: 'Follow-up 3, day 25' },
              ]}
              onChange={setTouch}
            />
          </Card>

          <div className="grid cols-2">
            <Stat k="Fit score" v={String(fit.total)} sub={fit.verdict.replace(/-/g, ' ')} />
            <Stat k="Asking" v={money(line.target)} sub={`walk away at ${money(line.floor)}`} />
          </div>

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
              <li style={{ marginBottom: 5 }}>
                Find a named person. A pitch to a shared inbox is a pitch to nobody.
              </li>
              <li style={{ marginBottom: 5 }}>
                No attachment on the first email. Send the media kit when they reply.
              </li>
              <li style={{ marginBottom: 5 }}>
                Say the price. Creators who withhold it to open a conversation mostly open nothing.
              </li>
              <li>
                Read it once more for anything that is not true. The whole approach depends on every
                number in there being defensible.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
