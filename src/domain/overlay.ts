import type { Workspace } from './workspace';

/**
 * What the OBS overlay draws for a won deal.
 *
 * The overlay is a browser source that viewers see, so the type carries only
 * what may be broadcast. There is no price in it, and no field the overlay
 * could use to find one.
 *
 * The disclosure is not optional. The UK's advertising code, the CMA and the
 * FTC all require a paid placement to be identified as an ad, up front, and a
 * creator who forgets the label is the one who answers for it. The overlay
 * always draws it, and nothing in the workspace can turn it off.
 */
export interface OverlayView {
  /** The label that identifies the placement as paid. */
  disclosure: 'Ad';
  /** Who paid, as the creator recorded it. Empty when the deal names no brand. */
  brand: string;
  /** The accent from the creator's shop board, so the overlay and the board match. */
  accent: string;
}

/** The overlay for a deal: only a won deal is on air. Null for a lost or unknown deal. */
export function overlayFor(workspace: Workspace, dealId: string): OverlayView | null {
  const deal = workspace.deals.find((d) => d.id === dealId);
  if (!deal || deal.outcome !== 'won') return null;
  return { disclosure: 'Ad', brand: deal.brand.trim(), accent: workspace.board.accent };
}

/** The sentence beside the label. */
export function overlayLine(view: OverlayView): string {
  return view.brand ? `Sponsored by ${view.brand}` : 'Sponsored';
}

/**
 * The address OBS loads for a deal's overlay, on the server that serves the
 * app. The file name, not the server's `/overlay` alias, so the same address
 * works under Vite in development.
 */
export function overlayUrl(origin: string, dealId: string): string {
  return `${origin}/overlay.html?deal=${encodeURIComponent(dealId)}`;
}
