import { useMemo } from 'react';
import { FORMAT_LABEL, NICHE_LABEL, PLATFORM_LABEL } from '../domain/benchmarks';
import { summarise } from '../domain/mediakit';
import { buildRateCard } from '../domain/pricing';
import { normaliseGeo } from '../domain/pricing';
import { useStore } from '../store/useStore';
import { Button, Card, Pill, Stat, count, money } from './ui/Primitives';

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
  const lines = useMemo(
    () => buildRateCard(profile, terms).filter((l) => l.target > 0),
    [profile, terms],
  );
  const geo = normaliseGeo(profile.geo);

  return (
    <>
      <div className="spread no-print">
        <div>
          <h1>Media kit</h1>
          <p className="lede">
            What a sponsor sees after they reply. Print to PDF to send it, or keep it open on a
            call.
          </p>
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

      <div className="grid cols-3" style={{ margin: '14px 0' }}>
        <Stat
          k="Impressions per campaign round"
          v={count(summary.impressionsPerRound)}
          sub="median, across all channels"
        />
        <Stat
          k="Engagement rate"
          v={`${(summary.blendedEngagement * 100).toFixed(1)}%`}
          sub="weighted by impressions"
        />
        <Stat
          k="Audience in top-spend markets"
          v={`${Math.round(summary.tier1Share * 100)}%`}
          sub="US, UK, CA, AU, DE and similar"
        />
      </div>

      <div className="split">
        <div className="stack">
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
                {profile.channels.map((channel) => (
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

          {profile.proofPoints.length > 0 && (
            <Card title="What previous sponsors got">
              {profile.proofPoints.map((proof) => (
                <div key={proof.id} style={{ marginBottom: 11 }}>
                  <div style={{ fontWeight: 560, fontSize: 13.5 }}>{proof.label}</div>
                  <div className="note">{proof.result}</div>
                </div>
              ))}
            </Card>
          )}

          <Card title="Audience">
            <table>
              <tbody>
                <tr>
                  <td>Tier 1 — US, UK, CA, AU, DE, CH, SG</td>
                  <td className="num">{Math.round(geo.tier1 * 100)}%</td>
                </tr>
                <tr>
                  <td>Tier 2 — rest of Western Europe, JP, KR, NZ</td>
                  <td className="num">{Math.round(geo.tier2 * 100)}%</td>
                </tr>
                <tr>
                  <td>Tier 3 — everywhere else</td>
                  <td className="num">{Math.round(geo.tier3 * 100)}%</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>

        <div className="stack">
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

          <Card title="Contact">
            <div className="note">{profile.contactEmail}</div>
          </Card>

          {summary.warnings.length > 0 && (
            <Card
              title="Before you send this"
              subtitle="Problems a sponsor will notice. Better that you name them first."
            >
              <ul className="warn-list">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
