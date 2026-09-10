import { FORMATS_BY_PLATFORM, NICHE_LABEL } from './benchmarks';
import { paidDaysFor } from './deals';
import { DEFAULT_TERMS } from './pricing';
import type {
  Channel,
  CreatorProfile,
  Deal,
  DealTerms,
  Format,
  GeoSplit,
  Niche,
  Platform,
  Prospect,
  ProofPoint,
  SealSummary,
  Sighting,
  UsageRights,
} from './types';

/**
 * The whole workspace as one versioned document: what is exported, what is
 * imported, and what the browser persists.
 *
 * Anything read from outside the running app is untrusted, including this
 * app's own older saves. `parseWorkspace` checks every field and fills the ones
 * a previous version did not have, so a file from any version either loads
 * whole or is refused with a reason. It never loads half.
 */

/** Bump when the shape changes, and teach `parseWorkspace` the old shape. */
export const WORKSPACE_VERSION = 2;

export interface Workspace {
  version: number;
  profile: CreatorProfile;
  terms: DealTerms;
  prospects: Prospect[];
  deals: Deal[];
}

export type ParseResult = { ok: true; workspace: Workspace } | { ok: false; error: string };

/** Thrown inside the parser and caught at its edge, carrying a readable path. */
class Invalid extends Error {}

type Obj = Record<string, unknown>;

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Invalid(`${path} should be an object`);
  }
  return value as Obj;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Invalid(`${path} should be a list`);
  return value;
}

function str(value: unknown, path: string, fallback?: string): string {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string') throw new Invalid(`${path} should be text`);
  return value;
}

function num(value: unknown, path: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Invalid(`${path} should be a number`);
  }
  return value;
}

function bool(value: unknown, path: string, fallback?: boolean): boolean {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'boolean') throw new Invalid(`${path} should be true or false`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new Invalid(`${path} should be one of ${allowed.join(', ')}`);
}

const PLATFORMS = Object.keys(FORMATS_BY_PLATFORM) as Platform[];
const FORMATS = [...new Set(Object.values(FORMATS_BY_PLATFORM).flat())] as Format[];
const NICHES = Object.keys(NICHE_LABEL) as Niche[];
const USAGE: readonly UsageRights[] = [
  'organic-only',
  'whitelisting-30',
  'whitelisting-90',
  'full-buyout',
];
const EXCLUSIVITY = [0, 30, 60, 90, 180] as const;
const TIERS = ['tier1', 'tier2', 'tier3'] as const;
const STAGES = ['researching', 'contacted', 'replied', 'negotiating', 'won', 'lost'] as const;
const LOST_REASONS = ['budget', 'timing', 'no-reply', 'poor-fit', 'i-declined', 'other'] as const;

function parseGeo(value: unknown, path: string): GeoSplit {
  const o = obj(value, path);
  return {
    tier1: num(o.tier1, `${path}.tier1`),
    tier2: num(o.tier2, `${path}.tier2`),
    tier3: num(o.tier3, `${path}.tier3`),
  };
}

function parseChannel(value: unknown, path: string): Channel {
  const o = obj(value, path);
  return {
    id: str(o.id, `${path}.id`),
    platform: oneOf(o.platform, PLATFORMS, `${path}.platform`),
    handle: str(o.handle, `${path}.handle`, ''),
    followers: num(o.followers, `${path}.followers`, 0),
    medianViews: num(o.medianViews, `${path}.medianViews`, 0),
    engagementRate: num(o.engagementRate, `${path}.engagementRate`, 0),
    formats: arr(o.formats, `${path}.formats`).map((f, i) =>
      oneOf(f, FORMATS, `${path}.formats[${i}]`),
    ),
  };
}

function parseProof(value: unknown, path: string): ProofPoint {
  const o = obj(value, path);
  return {
    id: str(o.id, `${path}.id`),
    label: str(o.label, `${path}.label`, ''),
    result: str(o.result, `${path}.result`, ''),
  };
}

function parseProfile(value: unknown): CreatorProfile {
  const o = obj(value, 'profile');
  return {
    name: str(o.name, 'profile.name', ''),
    tagline: str(o.tagline, 'profile.tagline', ''),
    niche: oneOf(o.niche, NICHES, 'profile.niche'),
    geo: parseGeo(o.geo, 'profile.geo'),
    channels: arr(o.channels, 'profile.channels').map((c, i) =>
      parseChannel(c, `profile.channels[${i}]`),
    ),
    proofPoints: arr(o.proofPoints ?? [], 'profile.proofPoints').map((p, i) =>
      parseProof(p, `profile.proofPoints[${i}]`),
    ),
    contactEmail: str(o.contactEmail, 'profile.contactEmail', ''),
  };
}

/** Terms are optional in a file: the first release could export without them. */
function parseTerms(value: unknown, path: string): DealTerms {
  if (value === undefined) return { ...DEFAULT_TERMS };
  const o = obj(value, path);
  const days = num(o.exclusivityDays, `${path}.exclusivityDays`, 0);
  const exclusivityDays = EXCLUSIVITY.find((d) => d === days);
  if (exclusivityDays === undefined) {
    throw new Invalid(`${path}.exclusivityDays should be one of ${EXCLUSIVITY.join(', ')}`);
  }
  return {
    exclusivityDays,
    usageRights: oneOf(o.usageRights ?? 'organic-only', USAGE, `${path}.usageRights`),
    revisions: num(o.revisions, `${path}.revisions`, 1),
    rush: bool(o.rush, `${path}.rush`, false),
    bundleSize: num(o.bundleSize, `${path}.bundleSize`, 1),
  };
}

function parseBudget(value: unknown, path: string): [number, number] {
  const [low, high] = arr(value, path);
  return [num(low, `${path}[0]`), num(high, `${path}[1]`)];
}

function parseProspect(value: unknown, path: string): Prospect {
  const o = obj(value, path);
  return {
    id: str(o.id, `${path}.id`),
    brand: str(o.brand, `${path}.brand`, ''),
    product: str(o.product, `${path}.product`, ''),
    niche: oneOf(o.niche, NICHES, `${path}.niche`),
    contactName: str(o.contactName, `${path}.contactName`, ''),
    contactEmail: str(o.contactEmail, `${path}.contactEmail`, ''),
    budgetBand: parseBudget(o.budgetBand ?? [0, 0], `${path}.budgetBand`),
    sellsInto: arr(o.sellsInto ?? [], `${path}.sellsInto`).map((t, i) =>
      oneOf(t, TIERS, `${path}.sellsInto[${i}]`),
    ),
    evidence: str(o.evidence, `${path}.evidence`, ''),
    stage: oneOf(o.stage ?? 'researching', STAGES, `${path}.stage`),
    lastContactedOn: str(o.lastContactedOn, `${path}.lastContactedOn`, ''),
    notes: str(o.notes, `${path}.notes`, ''),
  };
}

function parseSeal(value: unknown, path: string): SealSummary | null {
  if (value === null || value === undefined) return null;
  const o = obj(value, path);
  return {
    serial: str(o.serial, `${path}.serial`),
    commitment: str(o.commitment, `${path}.commitment`),
    sealedOn: str(o.sealedOn, `${path}.sealedOn`),
    timestampedAt: str(o.timestampedAt, `${path}.timestampedAt`),
  };
}

function parseSighting(value: unknown, path: string): Sighting {
  const o = obj(value, path);
  return {
    id: str(o.id, `${path}.id`),
    source: str(o.source, `${path}.source`, ''),
    startedOn: str(o.startedOn, `${path}.startedOn`),
    seenOn: str(o.seenOn, `${path}.seenOn`),
    verified: bool(o.verified, `${path}.verified`, false),
  };
}

/** A licence window: a whole number of days, or null for unlimited. */
function parsePaidDays(value: unknown, terms: DealTerms, path: string): number | null {
  if (value === undefined) return paidDaysFor(terms.usageRights);
  if (value === null) return null;
  const days = num(value, path);
  if (days < 0) throw new Invalid(`${path} should not be negative`);
  return days;
}

function parseDeal(value: unknown, path: string): Deal {
  const o = obj(value, path);
  const outcome = oneOf(o.outcome, ['won', 'lost'] as const, `${path}.outcome`);
  const terms = parseTerms(o.terms, `${path}.terms`);
  return {
    id: str(o.id, `${path}.id`),
    prospectId: str(o.prospectId, `${path}.prospectId`, ''),
    brand: str(o.brand, `${path}.brand`, ''),
    outcome,
    lostReason:
      outcome === 'lost' ? oneOf(o.lostReason ?? 'other', LOST_REASONS, `${path}.lostReason`) : null,
    closedOn: str(o.closedOn, `${path}.closedOn`),
    platform: oneOf(o.platform, PLATFORMS, `${path}.platform`),
    format: oneOf(o.format, FORMATS, `${path}.format`),
    niche: oneOf(o.niche, NICHES, `${path}.niche`),
    geo: parseGeo(o.geo, `${path}.geo`),
    followers: num(o.followers, `${path}.followers`, 0),
    medianViews: num(o.medianViews, `${path}.medianViews`),
    engagementRate: num(o.engagementRate, `${path}.engagementRate`, 0),
    terms,
    paidUsageDays: parsePaidDays(o.paidUsageDays, terms, `${path}.paidUsageDays`),
    quoted: num(o.quoted, `${path}.quoted`),
    flooredByProduction: bool(o.flooredByProduction, `${path}.flooredByProduction`, false),
    fitAtClose: num(o.fitAtClose, `${path}.fitAtClose`, 0),
    agreed: num(o.agreed, `${path}.agreed`, 0),
    deliveredOn: str(o.deliveredOn, `${path}.deliveredOn`, ''),
    paidOn: str(o.paidOn, `${path}.paidOn`, ''),
    seal: parseSeal(o.seal, `${path}.seal`),
    sightings: arr(o.sightings ?? [], `${path}.sightings`).map((s, i) =>
      parseSighting(s, `${path}.sightings[${i}]`),
    ),
    notes: str(o.notes, `${path}.notes`, ''),
  };
}

/**
 * Check and upgrade a workspace from any version.
 *
 * Version 1 had no `version` field and no deals, and its first exports could
 * omit `terms`. A file from a newer version than this one is refused rather
 * than guessed at, because a guess could silently drop fields it contains.
 */
export function parseWorkspace(input: unknown): ParseResult {
  try {
    const o = obj(input, 'file');
    const version = num(o.version, 'version', 1);
    if (version > WORKSPACE_VERSION) {
      throw new Invalid(
        `this file is from a newer version of Sponsorable (format ${version}); update before importing it`,
      );
    }
    return {
      ok: true,
      workspace: {
        version: WORKSPACE_VERSION,
        profile: parseProfile(o.profile),
        terms: parseTerms(o.terms, 'terms'),
        prospects: arr(o.prospects, 'prospects').map((p, i) => parseProspect(p, `prospects[${i}]`)),
        deals: arr(o.deals ?? [], 'deals').map((d, i) => parseDeal(d, `deals[${i}]`)),
      },
    };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}
