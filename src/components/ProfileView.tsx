import { NICHE_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { normaliseGeo } from '../domain/pricing';
import type { Channel, Niche, Platform } from '../domain/types';
import { useStore } from '../store/useStore';
import { Button, Card, NumberField, SelectField, TextField } from './ui/Primitives';

const NICHE_OPTIONS = (Object.keys(NICHE_LABEL) as Niche[]).map((value) => ({
  value,
  label: NICHE_LABEL[value],
}));

const PLATFORM_OPTIONS = (Object.keys(PLATFORM_LABEL) as Platform[]).map((value) => ({
  value,
  label: PLATFORM_LABEL[value],
}));

/** One editable channel. */
function ChannelCard({ channel }: { channel: Channel }) {
  const updateChannel = useStore((s) => s.updateChannel);
  const removeChannel = useStore((s) => s.removeChannel);

  return (
    <Card>
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2>{PLATFORM_LABEL[channel.platform]}</h2>
        <Button variant="ghost" onClick={() => removeChannel(channel.id)}>
          Remove
        </Button>
      </div>

      <SelectField
        label="Platform"
        value={channel.platform}
        options={PLATFORM_OPTIONS}
        onChange={(platform) => updateChannel(channel.id, { platform })}
        hint="Changing this resets the formats on offer."
      />

      <TextField
        label="Handle"
        value={channel.handle}
        placeholder="@yourhandle"
        onChange={(handle) => updateChannel(channel.id, { handle })}
      />

      <NumberField
        label="Followers or subscribers"
        value={channel.followers}
        onChange={(followers) => updateChannel(channel.id, { followers })}
        hint="Used only as a credibility check. It does not set the price."
      />

      <NumberField
        label="Median views per post"
        value={channel.medianViews}
        onChange={(medianViews) => updateChannel(channel.id, { medianViews })}
        hint="Median, not average. One viral video should not price the next deal."
      />

      <NumberField
        label="Engagement rate, %"
        value={Number((channel.engagementRate * 100).toFixed(2))}
        step={0.1}
        onChange={(pct) => updateChannel(channel.id, { engagementRate: pct / 100 })}
        hint="Likes, comments and shares as a share of views."
      />
    </Card>
  );
}

/** Audience geography, entered as raw shares and normalised on read. */
function GeographyCard() {
  const geo = useStore((s) => s.profile.geo);
  const updateGeo = useStore((s) => s.updateGeo);
  const normalised = normaliseGeo(geo);

  const tiers = [
    { key: 'tier1' as const, label: 'Tier 1', note: 'US, UK, CA, AU, DE, CH, SG' },
    { key: 'tier2' as const, label: 'Tier 2', note: 'Rest of Western Europe, JP, KR, NZ' },
    { key: 'tier3' as const, label: 'Tier 3', note: 'Everywhere else' },
  ];

  return (
    <Card
      title="Audience geography"
      subtitle="Enter percentages from your platform analytics. Advertiser spend per head varies by an order of magnitude across these tiers, so this moves the price more than most creators expect."
    >
      {tiers.map((tier) => (
        <NumberField
          key={tier.key}
          label={`${tier.label} — ${tier.note}`}
          value={geo[tier.key]}
          onChange={(value) => updateGeo(tier.key, value)}
          hint={`Currently ${Math.round(normalised[tier.key] * 100)}% of the audience once normalised.`}
        />
      ))}
    </Card>
  );
}

/** Past sponsor results, the highest-leverage thing on the page. */
function ProofCard() {
  const proofPoints = useStore((s) => s.profile.proofPoints);
  const addProofPoint = useStore((s) => s.addProofPoint);
  const updateProofPoint = useStore((s) => s.updateProofPoint);
  const removeProofPoint = useStore((s) => s.removeProofPoint);

  return (
    <Card
      title="Past results"
      subtitle="One concrete outcome from a previous sponsor moves reply rates more than any amount of audience data. Clicks, signups and cost per acquisition beat impressions."
    >
      {proofPoints.length === 0 && (
        <div className="empty">
          Nothing recorded. If you have never been sponsored, use an organic result instead: a link
          you shared and the clicks it earned.
        </div>
      )}

      {proofPoints.map((proof) => (
        <div key={proof.id} style={{ marginBottom: 14 }}>
          <TextField
            label="Campaign"
            value={proof.label}
            placeholder="Brand, month, format"
            onChange={(label) => updateProofPoint(proof.id, { label })}
          />
          <TextField
            label="Result"
            value={proof.result}
            placeholder="4,100 clicks, 380 signups, £2.10 per signup"
            onChange={(result) => updateProofPoint(proof.id, { result })}
          />
          <Button variant="ghost" onClick={() => removeProofPoint(proof.id)}>
            Remove
          </Button>
        </div>
      ))}

      <Button onClick={addProofPoint}>Add a result</Button>
    </Card>
  );
}

export function ProfileView() {
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);
  const addChannel = useStore((s) => s.addChannel);

  return (
    <>
      <h1>Your profile</h1>
      <p className="lede">
        Everything downstream is derived from this page. Nothing here leaves your browser.
      </p>

      <div className="split">
        <div className="stack">
          <Card title="Identity">
            <TextField
              label="Name"
              value={profile.name}
              onChange={(name) => updateProfile({ name })}
            />
            <TextField
              label="Tagline"
              value={profile.tagline}
              placeholder="What you make, in six words"
              onChange={(tagline) => updateProfile({ tagline })}
            />
            <TextField
              label="Contact email"
              value={profile.contactEmail}
              onChange={(contactEmail) => updateProfile({ contactEmail })}
            />
            <SelectField
              label="Category"
              value={profile.niche}
              options={NICHE_OPTIONS}
              onChange={(niche) => updateProfile({ niche })}
              hint="Sets how much advertisers in your space pay per impression."
            />
          </Card>

          <GeographyCard />
          <ProofCard />
        </div>

        <div className="stack">
          {profile.channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}

          <Card title="Add a channel">
            <div className="row">
              {PLATFORM_OPTIONS.map((option) => (
                <Button key={option.value} onClick={() => addChannel(option.value)}>
                  {option.label}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
