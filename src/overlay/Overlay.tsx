import { useEffect, useState, type CSSProperties } from 'react';
import { overlayFor, overlayLine, type OverlayView } from '../domain/overlay';
import { fetchRemote, type Fetch } from '../store/workspaceClient';

/**
 * The sponsor overlay, as OBS shows it on stream.
 *
 * It reads the workspace file through the local server and draws the
 * disclosure for one won deal. It asks OBS for no permissions and times
 * nothing: an on-air log written by the thing being logged cannot tell "off
 * screen" from "not running", so the log belongs to the server.
 *
 * Whatever goes wrong, nothing goes wrong on stream. A failed read keeps the
 * last good frame, and an overlay that has never loaded draws nothing at all,
 * never an error message in front of viewers.
 */
export function Overlay({ dealId, fetcher, pollMs = 5000 }: { dealId: string; fetcher: Fetch; pollMs?: number }) {
  const [view, setView] = useState<OverlayView | null>(null);

  useEffect(() => {
    let etag: string | null = null;
    let cancelled = false;
    const read = async () => {
      const remote = await fetchRemote(fetcher, etag);
      if (cancelled || remote.kind !== 'ok') return;
      etag = remote.etag;
      setView(overlayFor(remote.workspace, dealId));
    };
    void read();
    const timer = setInterval(() => void read(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dealId, fetcher, pollMs]);

  if (!view) return null;
  return (
    <div className="ad-badge" style={{ '--accent': view.accent } as CSSProperties} role="note">
      <span className="ad-label">{view.disclosure}</span>
      <span className="ad-line">{overlayLine(view)}</span>
    </div>
  );
}
