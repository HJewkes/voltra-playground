/**
 * Coaching Store
 *
 * Manages coaching cues and athlete reactions during a workout session.
 * Provides getReactedCues() for the feedback loop into the next Claude call.
 */

import { createStore, useStore, type StoreApi } from 'zustand';
import type { CoachingCue, CueReaction, ReactedCue } from './types';

// =============================================================================
// Types
// =============================================================================

export interface CoachingState {
  /** All coaching cues generated this session */
  cues: ReactedCue[];

  /** Whether a coaching cue request is in flight */
  isLoading: boolean;

  /** Most recent error (non-blocking) */
  error: string | null;

  /** Whether coaching is enabled for this session */
  isEnabled: boolean;

  // Actions
  enqueueCue: (cue: CoachingCue) => void;
  reactToCue: (cueId: string, reaction: CueReaction) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  reset: () => void;

  // Selectors
  getReactedCues: () => ReactedCue[];
  getLatestCue: () => ReactedCue | null;
  getCueForSet: (afterSetIndex: number) => ReactedCue | null;
}

// =============================================================================
// Factory
// =============================================================================

const INITIAL_STATE = {
  cues: [] as ReactedCue[],
  isLoading: false,
  error: null as string | null,
  isEnabled: true,
};

export function createCoachingStore(): CoachingStoreApi {
  return createStore<CoachingState>()((set, get) => ({
    ...INITIAL_STATE,

    enqueueCue: (cue: CoachingCue) => {
      const reactedCue: ReactedCue = {
        ...cue,
        reaction: null,
        reactedAt: null,
      };

      set((state) => ({
        cues: [...state.cues, reactedCue],
        isLoading: false,
        error: null,
      }));
    },

    reactToCue: (cueId: string, reaction: CueReaction) => {
      set((state) => ({
        cues: state.cues.map((c) =>
          c.id === cueId ? { ...c, reaction, reactedAt: Date.now() } : c
        ),
      }));
    },

    setLoading: (loading: boolean) => set({ isLoading: loading }),

    setError: (error: string | null) => set({ error, isLoading: false }),

    setEnabled: (enabled: boolean) => set({ isEnabled: enabled }),

    reset: () => set(INITIAL_STATE),

    getReactedCues: () => get().cues.filter((c) => c.reaction !== null),

    getLatestCue: () => {
      const { cues } = get();
      return cues.length > 0 ? cues[cues.length - 1] : null;
    },

    getCueForSet: (afterSetIndex: number) =>
      get().cues.find((c) => c.afterSetIndex === afterSetIndex) ?? null,
  }));
}

// =============================================================================
// Singleton & Hook
// =============================================================================

export const coachingStore: CoachingStoreApi = createCoachingStore();

export function useCoachingStore<T>(selector: (state: CoachingState) => T): T {
  return useStore(coachingStore, selector);
}

export type CoachingStoreApi = StoreApi<CoachingState>;
