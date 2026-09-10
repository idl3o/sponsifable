import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';
import { FORMATS_BY_PLATFORM } from '../domain/benchmarks';
import { DEFAULT_TERMS } from '../domain/pricing';
import type {
  Channel,
  CreatorProfile,
  Deal,
  DealTerms,
  Platform,
  Prospect,
  ProofPoint,
  Sighting,
} from '../domain/types';
import { WORKSPACE_VERSION, parseWorkspace, type Workspace } from '../domain/workspace';
import { SAMPLE_PROFILE, SAMPLE_PROSPECTS } from './sample';

export type Tab = 'profile' | 'rate-card' | 'media-kit' | 'prospects' | 'outreach' | 'deals';

interface State {
  profile: CreatorProfile;
  terms: DealTerms;
  prospects: Prospect[];
  deals: Deal[];
  tab: Tab;
  /** Prospect currently open in the outreach composer. */
  activeProspectId: string | null;
  /** Monotonic counter behind every generated id, so ids stay deterministic. */
  seq: number;
}

interface Actions {
  setTab: (tab: Tab) => void;
  updateProfile: (patch: Partial<CreatorProfile>) => void;
  updateGeo: (tier: 'tier1' | 'tier2' | 'tier3', value: number) => void;
  addChannel: (platform: Platform) => void;
  updateChannel: (id: string, patch: Partial<Channel>) => void;
  removeChannel: (id: string) => void;
  addProofPoint: () => void;
  updateProofPoint: (id: string, patch: Partial<ProofPoint>) => void;
  removeProofPoint: (id: string) => void;
  setTerms: (patch: Partial<DealTerms>) => void;
  addProspect: () => void;
  updateProspect: (id: string, patch: Partial<Prospect>) => void;
  removeProspect: (id: string) => void;
  openOutreach: (id: string) => void;
  /**
   * File a closed deal and move its prospect to the matching stage.
   * @param build receives a fresh id and returns the record, or null to abort.
   */
  recordDeal: (build: (id: string) => Deal | null) => void;
  updateDeal: (id: string, patch: Partial<Omit<Deal, 'id'>>) => void;
  removeDeal: (id: string) => void;
  addSighting: (dealId: string, sighting: Omit<Sighting, 'id'>) => void;
  removeSighting: (dealId: string, sightingId: string) => void;
  /** Replace all stored data with a workspace that has already been validated. */
  importAll: (workspace: Workspace) => void;
  resetToSample: () => void;
}

const initialState: State = {
  profile: SAMPLE_PROFILE,
  terms: DEFAULT_TERMS,
  prospects: SAMPLE_PROSPECTS,
  deals: [],
  tab: 'rate-card',
  activeProspectId: null,
  seq: 100,
};

type Persisted = Pick<State, 'profile' | 'terms' | 'prospects' | 'deals' | 'seq'>;

/**
 * Upgrade a save written by an older version. A save that fails validation is
 * copied aside rather than discarded, so a bug here can never cost a creator
 * their prospect list, and the app starts from the sample.
 */
function migrate(persisted: unknown, version: number): Persisted {
  const parsed = parseWorkspace({ ...(persisted as object), version: Math.max(1, version) });
  const seq = (persisted as { seq?: unknown } | null)?.seq;
  if (parsed.ok) {
    const { profile, terms, prospects, deals } = parsed.workspace;
    return { profile, terms, prospects, deals, seq: typeof seq === 'number' ? seq : 100 };
  }
  try {
    localStorage.setItem(`sponsorable-unreadable-v${version}`, JSON.stringify(persisted));
  } catch {
    // Storage full or blocked. Nothing more can be done from here.
  }
  const { profile, terms, prospects, deals } = initialState;
  return { profile, terms, prospects, deals, seq: initialState.seq };
}

/**
 * Application state, persisted to this browser only.
 *
 * Nothing leaves the machine: no account, no server, no analytics. A creator's
 * unreleased rates and prospect list are commercially sensitive, and the
 * simplest way to keep them private is to never transmit them.
 */
export const useStore = create<State & Actions>()(
  persist(
    (set) => ({
      ...initialState,

      setTab: (tab) => set({ tab }),

      updateProfile: (patch) =>
        set(produce<State>((s) => void Object.assign(s.profile, patch))),

      updateGeo: (tier, value) =>
        set(produce<State>((s) => void (s.profile.geo[tier] = Math.max(0, value)))),

      addChannel: (platform) =>
        set(
          produce<State>((s) => {
            s.seq += 1;
            s.profile.channels.push({
              id: `ch-${s.seq}`,
              platform,
              handle: '',
              followers: 0,
              medianViews: 0,
              engagementRate: 0,
              formats: [...(FORMATS_BY_PLATFORM[platform] ?? [])],
            });
          }),
        ),

      updateChannel: (id, patch) =>
        set(
          produce<State>((s) => {
            const channel = s.profile.channels.find((c) => c.id === id);
            if (!channel) return;
            Object.assign(channel, patch);
            // Switching platform invalidates the format list.
            if (patch.platform) channel.formats = [...(FORMATS_BY_PLATFORM[patch.platform] ?? [])];
          }),
        ),

      removeChannel: (id) =>
        set(
          produce<State>((s) => {
            s.profile.channels = s.profile.channels.filter((c) => c.id !== id);
          }),
        ),

      addProofPoint: () =>
        set(
          produce<State>((s) => {
            s.seq += 1;
            s.profile.proofPoints.push({ id: `pp-${s.seq}`, label: '', result: '' });
          }),
        ),

      updateProofPoint: (id, patch) =>
        set(
          produce<State>((s) => {
            const proof = s.profile.proofPoints.find((p) => p.id === id);
            if (proof) Object.assign(proof, patch);
          }),
        ),

      removeProofPoint: (id) =>
        set(
          produce<State>((s) => {
            s.profile.proofPoints = s.profile.proofPoints.filter((p) => p.id !== id);
          }),
        ),

      setTerms: (patch) => set(produce<State>((s) => void Object.assign(s.terms, patch))),

      addProspect: () =>
        set(
          produce<State>((s) => {
            s.seq += 1;
            const id = `pr-${s.seq}`;
            s.prospects.unshift({
              id,
              brand: '',
              product: '',
              niche: s.profile.niche,
              contactName: '',
              contactEmail: '',
              budgetBand: [0, 0],
              sellsInto: ['tier1'],
              evidence: '',
              stage: 'researching',
              lastContactedOn: '',
              notes: '',
            });
          }),
        ),

      updateProspect: (id, patch) =>
        set(
          produce<State>((s) => {
            const prospect = s.prospects.find((p) => p.id === id);
            if (prospect) Object.assign(prospect, patch);
          }),
        ),

      removeProspect: (id) =>
        set(
          produce<State>((s) => {
            s.prospects = s.prospects.filter((p) => p.id !== id);
            if (s.activeProspectId === id) s.activeProspectId = null;
          }),
        ),

      openOutreach: (id) => set({ activeProspectId: id, tab: 'outreach' }),

      recordDeal: (build) =>
        set(
          produce<State>((s) => {
            s.seq += 1;
            const deal = build(`dl-${s.seq}`);
            if (!deal) return;
            s.deals.unshift(deal);
            const prospect = s.prospects.find((p) => p.id === deal.prospectId);
            if (prospect) prospect.stage = deal.outcome;
          }),
        ),

      updateDeal: (id, patch) =>
        set(
          produce<State>((s) => {
            const deal = s.deals.find((d) => d.id === id);
            if (deal) Object.assign(deal, patch);
          }),
        ),

      removeDeal: (id) =>
        set(
          produce<State>((s) => {
            s.deals = s.deals.filter((d) => d.id !== id);
          }),
        ),

      addSighting: (dealId, sighting) =>
        set(
          produce<State>((s) => {
            const deal = s.deals.find((d) => d.id === dealId);
            if (!deal) return;
            s.seq += 1;
            deal.sightings.push({ ...sighting, id: `st-${s.seq}` });
          }),
        ),

      removeSighting: (dealId, sightingId) =>
        set(
          produce<State>((s) => {
            const deal = s.deals.find((d) => d.id === dealId);
            if (deal) deal.sightings = deal.sightings.filter((x) => x.id !== sightingId);
          }),
        ),

      importAll: (workspace) =>
        set({
          profile: workspace.profile,
          terms: workspace.terms,
          prospects: workspace.prospects,
          deals: workspace.deals,
          activeProspectId: null,
        }),

      resetToSample: () =>
        set({
          profile: SAMPLE_PROFILE,
          terms: DEFAULT_TERMS,
          prospects: SAMPLE_PROSPECTS,
          deals: [],
          activeProspectId: null,
        }),
    }),
    {
      // The key keeps its first name so existing saves are found; the format
      // is tracked by `version`, and `migrate` upgrades anything older.
      name: 'sponsorable-v1',
      version: WORKSPACE_VERSION,
      migrate: (persisted, version) => migrate(persisted, version) as State & Actions,
      partialize: (s): Persisted => ({
        profile: s.profile,
        terms: s.terms,
        prospects: s.prospects,
        deals: s.deals,
        seq: s.seq,
      }),
    },
  ),
);
