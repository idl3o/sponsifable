import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';
import { FORMATS_BY_PLATFORM } from '../domain/benchmarks';
import { DEFAULT_TERMS } from '../domain/pricing';
import type {
  Channel,
  CreatorProfile,
  DealTerms,
  Platform,
  Prospect,
  ProofPoint,
} from '../domain/types';
import { SAMPLE_PROFILE, SAMPLE_PROSPECTS } from './sample';

export type Tab = 'profile' | 'rate-card' | 'media-kit' | 'prospects' | 'outreach';

interface State {
  profile: CreatorProfile;
  terms: DealTerms;
  prospects: Prospect[];
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
  /** Replace all stored data, e.g. from an imported file. */
  importAll: (data: Pick<State, 'profile' | 'terms' | 'prospects'>) => void;
  resetToSample: () => void;
}

const initialState: State = {
  profile: SAMPLE_PROFILE,
  terms: DEFAULT_TERMS,
  prospects: SAMPLE_PROSPECTS,
  tab: 'rate-card',
  activeProspectId: null,
  seq: 100,
};

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

      importAll: (data) =>
        set({ profile: data.profile, terms: data.terms, prospects: data.prospects }),

      resetToSample: () =>
        set({
          profile: SAMPLE_PROFILE,
          terms: DEFAULT_TERMS,
          prospects: SAMPLE_PROSPECTS,
          activeProspectId: null,
        }),
    }),
    {
      name: 'sponsorable-v1',
      partialize: (s) => ({
        profile: s.profile,
        terms: s.terms,
        prospects: s.prospects,
        seq: s.seq,
      }),
    },
  ),
);
