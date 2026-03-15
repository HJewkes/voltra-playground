/**
 * Coaching Store
 *
 * Manages AI coaching cue lifecycle during exercise sessions.
 * Handles cue queuing (during recording), display (during rest),
 * athlete reactions, and session coaching log.
 */

import { createStore, useStore, type StoreApi } from 'zustand';

// =============================================================================
// Types
// =============================================================================

export type CoachingCueType = 'informational' | 'load_adjustment' | 'encouragement';

export type AthleteReaction = 'thumbs_up' | 'thumbs_down' | null;

export interface CoachingCue {
  id: string;
  type: CoachingCueType;
  message: string;
  suggestedWeight?: number;
  setNumber: number;
  timestamp: number;
  reaction: AthleteReaction;
  dismissed: boolean;
}

export interface CoachingLogEntry {
  kind: 'cue' | 'set_marker';
  cue?: CoachingCue;
  setNumber?: number;
  timestamp: number;
}

export interface CoachingState {
  /** Whether AI coaching is enabled for this session */
  enabled: boolean;
  /** Cues queued during recording (shown when rest begins) */
  queuedCues: CoachingCue[];
  /** Currently displayed cue (shown on rest screen) */
  activeCue: CoachingCue | null;
  /** Full session coaching log */
  sessionLog: CoachingLogEntry[];
  /** Whether session log modal is visible */
  logVisible: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
  enqueueCue: (cue: Omit<CoachingCue, 'id' | 'reaction' | 'dismissed'>) => void;
  flushQueue: () => void;
  dismissActiveCue: () => void;
  reactToCue: (cueId: string, reaction: AthleteReaction) => void;
  addSetMarker: (setNumber: number) => void;
  toggleLog: () => void;
  getReactedCues: () => CoachingCue[];
  reset: () => void;
}

export type CoachingStoreApi = StoreApi<CoachingState>;

// =============================================================================
// Factory
// =============================================================================

let cueIdCounter = 0;

function generateCueId(): string {
  cueIdCounter += 1;
  return `cue_${Date.now()}_${cueIdCounter}`;
}

export function createCoachingStore(): CoachingStoreApi {
  return createStore<CoachingState>((set, get) => ({
    enabled: false,
    queuedCues: [],
    activeCue: null,
    sessionLog: [],
    logVisible: false,

    setEnabled: (enabled) => set({ enabled }),

    enqueueCue: (cue) => {
      if (!get().enabled) return;

      const fullCue: CoachingCue = {
        ...cue,
        id: generateCueId(),
        reaction: null,
        dismissed: false,
      };

      set((s) => ({ queuedCues: [...s.queuedCues, fullCue] }));
    },

    flushQueue: () => {
      const { queuedCues } = get();
      if (queuedCues.length === 0) return;

      const [next, ...remaining] = queuedCues;
      const logEntry: CoachingLogEntry = {
        kind: 'cue',
        cue: next,
        timestamp: next.timestamp,
      };

      set((s) => ({
        activeCue: next,
        queuedCues: remaining,
        sessionLog: [...s.sessionLog, logEntry],
      }));
    },

    dismissActiveCue: () => {
      const { activeCue, queuedCues } = get();
      if (!activeCue) return;

      const dismissed = { ...activeCue, dismissed: true };

      set((s) => ({
        activeCue: null,
        sessionLog: s.sessionLog.map((e) =>
          e.cue?.id === dismissed.id ? { ...e, cue: dismissed } : e,
        ),
      }));

      if (queuedCues.length > 0) {
        get().flushQueue();
      }
    },

    reactToCue: (cueId, reaction) => {
      set((s) => {
        const updatedLog = s.sessionLog.map((e) =>
          e.cue?.id === cueId ? { ...e, cue: { ...e.cue!, reaction } } : e,
        );
        const updatedActive =
          s.activeCue?.id === cueId ? { ...s.activeCue, reaction } : s.activeCue;

        return { sessionLog: updatedLog, activeCue: updatedActive };
      });
    },

    addSetMarker: (setNumber) => {
      set((s) => ({
        sessionLog: [
          ...s.sessionLog,
          { kind: 'set_marker' as const, setNumber, timestamp: Date.now() },
        ],
      }));
    },

    toggleLog: () => set((s) => ({ logVisible: !s.logVisible })),

    getReactedCues: () => {
      return get()
        .sessionLog.filter((e): e is CoachingLogEntry & { cue: CoachingCue } =>
          e.kind === 'cue' && e.cue != null && e.cue.reaction != null,
        )
        .map((e) => e.cue);
    },

    reset: () =>
      set({
        queuedCues: [],
        activeCue: null,
        sessionLog: [],
        logVisible: false,
      }),
  }));
}

// =============================================================================
// Singleton + Hook
// =============================================================================

export const coachingStore = createCoachingStore();

export function useCoachingStore<T>(selector: (s: CoachingState) => T): T {
  return useStore(coachingStore, selector);
}
