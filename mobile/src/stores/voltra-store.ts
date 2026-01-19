/**
 * Voltra Store
 * 
 * Factory function that creates a complete Zustand store for one Voltra device.
 * Includes integrated telemetry parsing and live analytics.
 * 
 * Usage:
 *   const voltra = createVoltraStore(adapter, deviceId, deviceName);
 *   const weight = useStore(voltra, s => s.weight);
 */

import { createStore, StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  TelemetryParser, 
  TelemetryFrame, 
  RepData, 
  WorkoutStats,
  ParseResult,
} from '@/protocol/telemetry';
import { Workout, WeightCommands, Timing } from '@/protocol';
import { DualCommand, ChainsCommands, EccentricCommands } from '@/protocol/commands';
import { 
  computeVelocityLoss, 
  estimateRIR, 
  estimateRPE,
  WorkoutAnalyzer,
} from '@/analytics';
import type { BLEAdapter } from '@/ble/types';

// =============================================================================
// Types
// =============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';
export type WorkoutState = 'idle' | 'preparing' | 'ready' | 'active' | 'stopping';

export interface VoltraState {
  // Identity
  deviceId: string;
  deviceName: string | null;
  
  // Connection
  connectionState: ConnectionState;
  isReconnecting: boolean;
  error: string | null;
  
  // Device Settings (single source of truth)
  weight: number;
  chains: number;
  eccentric: number;
  
  // Workout State
  workoutState: WorkoutState;
  workoutStartTime: number | null;
  
  // Telemetry (integrated - replaces useTelemetry hook)
  repCount: number;
  reps: RepData[];
  lastRep: RepData | null;
  currentFrame: TelemetryFrame | null;
  currentRepFrames: TelemetryFrame[];  // Frames for rep in progress
  recentFrames: TelemetryFrame[];      // Rolling window for charts
  
  // Live Analytics (computed from telemetry)
  liveVelocityLoss: number;
  liveRPE: number;
  liveRIR: number;
  
  // Actions - Device Control
  setWeight: (lbs: number) => Promise<void>;
  setChains: (lbs: number) => Promise<void>;
  setEccentric: (pct: number) => Promise<void>;
  
  // Actions - Workout Control
  startWorkout: () => Promise<void>;
  stopWorkout: () => Promise<WorkoutStats>;
  resetWorkout: () => void;
  
  // Getters
  getWorkoutStats: () => WorkoutStats;
  
  // Connection management (for SessionStore to use)
  setConnectionState: (state: ConnectionState) => void;
  setError: (error: string | null) => void;
  setReconnecting: (value: boolean) => void;
  
  // Internal
  _adapter: BLEAdapter | null;
  _parser: TelemetryParser;
  _analyzer: WorkoutAnalyzer;
  _processNotification: (data: Uint8Array) => void;
  _updateLiveAnalytics: () => void;
}

// =============================================================================
// Store Factory
// =============================================================================

/**
 * Create a Voltra store for a single device.
 * Each device gets its own store instance with isolated state.
 */
export function createVoltraStore(
  adapter: BLEAdapter | null,
  deviceId: string,
  deviceName?: string | null
): VoltraStoreApi {
  // Each device gets its own parser and analyzer
  const parser = new TelemetryParser(true);
  const analyzer = new WorkoutAnalyzer();
  
  return createStore<VoltraState>()(
    devtools(
      (set, get) => ({
        // Identity
        deviceId,
        deviceName: deviceName ?? null,
        
        // Connection
        connectionState: adapter ? 'connected' : 'disconnected',
        isReconnecting: false,
        error: null,
        
        // Settings
        weight: 0,
        chains: 0,
        eccentric: 0,
        
        // Workout
        workoutState: 'idle',
        workoutStartTime: null,
        
        // Telemetry
        repCount: 0,
        reps: [],
        lastRep: null,
        currentFrame: null,
        currentRepFrames: [],
        recentFrames: [],
        
        // Live analytics
        liveVelocityLoss: 0,
        liveRPE: 5,
        liveRIR: 6,
        
        // Internal
        _adapter: adapter,
        _parser: parser,
        _analyzer: analyzer,
        
        // Connection management
        setConnectionState: (state) => set({ connectionState: state }),
        setError: (error) => set({ error }),
        setReconnecting: (value) => set({ isReconnecting: value }),
        
        // Device control
        setWeight: async (lbs) => {
          const { _adapter } = get();
          if (!_adapter) {
            set({ error: 'Not connected' });
            return;
          }
          
          const cmd = WeightCommands.get(lbs);
          if (!cmd) {
            set({ error: `Invalid weight: ${lbs}` });
            return;
          }
          
          try {
            await _adapter.write(cmd);
            parser.setWeight(lbs);
            set({ weight: lbs, error: null });
          } catch (e) {
            set({ error: `Failed to set weight: ${e}` });
          }
        },
        
        setChains: async (lbs) => {
          const { _adapter } = get();
          if (!_adapter) {
            set({ error: 'Not connected' });
            return;
          }
          
          const cmds = ChainsCommands.get(lbs);
          if (!cmds) {
            set({ error: `Invalid chains value: ${lbs}` });
            return;
          }
          
          try {
            await _adapter.write(cmds.step1);
            await delay(Timing.DUAL_COMMAND_DELAY_MS);
            await _adapter.write(cmds.step2);
            set({ chains: lbs, error: null });
          } catch (e) {
            set({ error: `Failed to set chains: ${e}` });
          }
        },
        
        setEccentric: async (pct) => {
          const { _adapter } = get();
          if (!_adapter) {
            set({ error: 'Not connected' });
            return;
          }
          
          const cmds = EccentricCommands.get(pct);
          if (!cmds) {
            set({ error: `Invalid eccentric value: ${pct}` });
            return;
          }
          
          try {
            await _adapter.write(cmds.step1);
            await delay(Timing.DUAL_COMMAND_DELAY_MS);
            await _adapter.write(cmds.step2);
            set({ eccentric: pct, error: null });
          } catch (e) {
            set({ error: `Failed to set eccentric: ${e}` });
          }
        },
        
        // Workout control
        startWorkout: async () => {
          const { _adapter, weight } = get();
          if (!_adapter) {
            set({ error: 'Not connected' });
            return;
          }
          
          set({ workoutState: 'preparing', error: null });
          
          try {
            // Reset telemetry state
            parser.reset();
            parser.setWeight(weight);
            
            // Send workout commands
            await _adapter.write(Workout.PREPARE);
            await delay(200); // PREP_DELAY_MS
            await _adapter.write(Workout.SETUP);
            await delay(Timing.INIT_COMMAND_DELAY_MS);
            await _adapter.write(Workout.GO);
            
            set({
              workoutState: 'active',
              workoutStartTime: Date.now(),
              repCount: 0,
              reps: [],
              lastRep: null,
              currentRepFrames: [],
              recentFrames: [],
              liveVelocityLoss: 0,
              liveRPE: 5,
              liveRIR: 6,
            });
          } catch (e) {
            set({ workoutState: 'idle', error: `Failed to start workout: ${e}` });
          }
        },
        
        stopWorkout: async () => {
          const { _adapter } = get();
          if (!_adapter) {
            set({ error: 'Not connected' });
            return parser.getWorkoutStats();
          }
          
          set({ workoutState: 'stopping' });
          
          try {
            await _adapter.write(Workout.STOP);
          } catch (e) {
            console.warn('Error stopping workout:', e);
          }
          
          const stats = parser.getWorkoutStats();
          set({ workoutState: 'idle', workoutStartTime: null });
          
          return stats;
        },
        
        resetWorkout: () => {
          parser.reset();
          set({
            workoutState: 'idle',
            workoutStartTime: null,
            repCount: 0,
            reps: [],
            lastRep: null,
            currentFrame: null,
            currentRepFrames: [],
            recentFrames: [],
            liveVelocityLoss: 0,
            liveRPE: 5,
            liveRIR: 6,
          });
        },
        
        getWorkoutStats: () => parser.getWorkoutStats(),
        
        // Telemetry processing
        _processNotification: (data: Uint8Array) => {
          const result = parser.parse(data);
          if (!result) return;
          
          if (result.type === 'frame') {
            const frame = result.frame;
            const recentFrames = [...get().recentFrames, frame].slice(-100);
            const currentRepFrames = [...get().currentRepFrames, frame];
            
            set({
              currentFrame: frame,
              recentFrames,
              currentRepFrames,
            });
          } else if (result.type === 'rep') {
            const { repData } = result;
            const reps = [...get().reps, repData];
            
            set({
              repCount: repData.repNumber,
              reps,
              lastRep: repData,
              currentRepFrames: [], // Reset for next rep
            });
            
            // Update live analytics after each rep
            get()._updateLiveAnalytics();
          }
        },
        
        _updateLiveAnalytics: () => {
          const { reps } = get();
          if (reps.length < 2) return;
          
          const velocities = reps.map(r => r.maxVelocity);
          const velocityLoss = computeVelocityLoss(reps);
          const rpe = estimateRPE(velocityLoss);
          const rir = estimateRIR(velocityLoss);
          
          set({ liveVelocityLoss: velocityLoss, liveRPE: rpe, liveRIR: rir });
        },
      }),
      { name: `voltra-${deviceId}` }
    )
  );
}

// =============================================================================
// Helpers
// =============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Types
// =============================================================================

export type VoltraStoreApi = StoreApi<VoltraState>;
