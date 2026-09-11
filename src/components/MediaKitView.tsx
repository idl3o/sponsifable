import { useMemo } from 'react';
import { FORMAT_LABEL, NICHE_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { summarise, type MediaKitSummary } from '../domain/mediakit';
import { buildRateCard, normaliseGeo } from '../domain/pricing';
import type { Channel, DealTerms, GeoSplit, ProofPoint, RateLine } from '../domain/types';
import { useStore } from '../store/useStore';
import { Button, Card, Pill, Stat, count, money } from './ui/Primitives';

/** The three numbers a sponsor reads first. */
function HeadlineStats({ summary }: { summary: MediaKitSummary }) {
  return (
    <div className="grid cols-3" style={{ margin: '14px 0' }}>
      <Stat k="Impressions per campaign round" v={count(summary.impressionsPerRound)} sub="median, across all channels" />
      <Stat k="Engagement rate" v={`${(summary.blendedEngagement * 100).toFixed(1)}%`} sub="weighted by impressions" />
      <Stat
        k="Audience in top-spend markets"
        v={`${Math.round(summary.tier1Share * 100)}%`}
        sub="US, UK, CA, AU, DE and similar"
      />
    </div>
  );
}

/** Each channel's audience, with followers shown for context only. */
function ChannelsCard({ channels }: { channels: Channel[] }) {
  return (
    <Card title="Channels">
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th className="num">Followers</th>
            <th className="num">Median views</th>
            <th className="num">Engagement</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => (
            <tr key={channel.id}>
              <td>
                {PLATFORM_LABEL[channel.platform]}
                <div className="note">{channel.handle}</div>
              </td>
              <td className="num">{count(channel.followers)}</td>
              <td className="num">{count(channel.medianViews)}</td>
              <td className="num">{(channel.engagementRate * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note" style={{ marginTop: 10 }}>
        Follower counts are shown for context. Price against median views, since that is the
        attention a sponsor actually receives.
      </p>
    </Card>
  );
}

/** Results from earlier campaigns, shown only when there are any. */
function ProofCard({ proofPoints }: { proofPoints: ProofPoint[] }) {
  if (proofPoints.length === 0) return null;
  return (
    <Card title="What previous sponsors got">
      {proofPoints.map((proof) => (
        <div key={proof.id} style={{ marginBottom: 11 }}>
          <div style={{ fontWeight: 560, fontSize: 13.5 }}>{proof.label}</div>
          <div className="note">{proof.result}</div>
        </div>
      ))}
    </Card>
  );
}

/** Where the audience sits, by advertiser spend tier. */
function AudienceCard({ geo }: { geo: GeoSplit }) {
  const tiers: Array<[string, number]> = [
    ['Tier 1 — US, UK, CA, AU, DE, CH, SG', geo.tier1],
    ['Tier 2 — rest of Western Europe, JP, KR, NZ', geo.tier2],
    ['Tier 3 — everywhere else', geo.tier3],
  ];
  return (
    <Card title="Audience">
      <table>
        <tbody>
          {tiers.map(([label, share]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num">{Math.round(share * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Every priced placement, and the terms the prices cover. */
function RatesCard({ lines, terms }: { lines: RateLine[]; terms: DealTerms }) {
  return (
    <Card title="Rates" subtitle="All prices in GBP, excluding VAT.">
      <table>
        <tbody>
          {lines.map((line) => (
            <tr key={`${line.channelId}-${line.format}`}>
              <td>
                {FORMAT_LABEL[line.format]}
                <div className="note">{PLATFORM_LABEL[line.platform]}</div>
              </td>
              <td className="num" style={{ fontWeight: 560 }}>
                {money(line.target)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note" style={{ marginTop: 10 }}>
        Rates cover {terms.usageRights.replace(/-/g, ' ')}
        {terms.exclusivityDays > 0
          ? ` with ${terms.exclusivityDays} days of category exclusivity`
          : ' with no category exclusivity'}
        . Anything beyond that is priced separately.
      </p>
    </Card>
  );
}

/** Problems a sponsor will notice, listed so the creator names them first. */
function WarningsCard({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <Card title="Before you send this" subtitle="Problems a sponsor will notice. Better that you name them first.">
      <ul className="warn-list">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The page a creator sends once a sponsor has replied.
 *
 * It leads with impressions rather than followers, because summing followers
 * across platforms counts the same person several times and every experienced
 * sponsor knows it. Printing to PDF is the export path.
 */
export function MediaKitView() {
  const profile = useStore((s) => s.profile);
  const terms = useStore((s) => s.terms);
  const summary = useMemo(() => summarise(profile), [profile]);
  const lines = useMemo(() => buildRateCard(profile, terms).filter((l) => l.target > 0), [profile, terms]);

  return (
    <>
      <div className="spread no-print">
        <div>
          <h1>Media kit</h1>
          <p className="lede">What a sponsor sees after they reply. Print to PDF to send it, or keep it open on a call.</p>
        </div>
        <Button variant="primary" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>
      <Card>
        <div className="spread" style={{ marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 19 }}>{profile.name}</h2>
            <div className="note">{profile.tagline}</div>
          </div>
          <Pill tone="accent">{NICHE_LABEL[profile.niche]}</Pill>
        </div>
      </Card>
      <HeadlineStats summary={summary} />
      <div className="split">
        <div className="stack">
          <ChannelsCard channels={profile.channels} />
          <ProofCard proofPoints={profile.proofPoints} />
          <AudienceCard geo={normaliseGeo(profile.geo)} />
        </div>
        <div className="stack">
          <RatesCard lines={lines} terms={terms} />
          <Card title="Contact">
            <div className="note">{profile.contactEmail}</div>
          </Card>
          <WarningsCard warnings={summary.warnings} />
        </div>
      </div>
    </>
  );
}
