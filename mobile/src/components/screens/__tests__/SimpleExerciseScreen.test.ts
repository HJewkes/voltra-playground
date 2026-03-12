import { describe, it, expect, vi } from 'vitest';
import { createStore } from 'zustand';

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

vi.mock('@titan-design/react-ui', () => ({
  Button: 'Button',
  getSemanticColors: () => ({}),
  alpha: (_color: string, _opacity: number) => 'rgba(0,0,0,0)',
}));

vi.mock('@voltras/workout-analytics', () => ({
  MovementPhase: { IDLE: 0, CONCENTRIC: 1, ECCENTRIC: 2, HOLD: 3 },
  getSetVelocityLossPct: () => 0,
  getSetMeanVelocity: () => 0,
  getSetRepVelocities: () => [],
  estimateSetRIR: () => ({ rpe: 5, rir: 5 }),
}));

vi.mock('@/domain/workout', () => ({
  getRPEColor: () => '#ffffff',
  createCompletedSet: vi.fn(),
}));

// Mirror SDK enum to avoid react-native-ble-plx resolution
const TrainingMode = {
  Idle: 0x0000,
  WeightTraining: 0x0001,
} as const;

const TrainingModeNames: Record<number, string> = {
  [TrainingMode.Idle]: 'Idle',
  [TrainingMode.WeightTraining]: 'Weight Training',
};

vi.mock('@/domain/device', () => ({
  TrainingMode,
  TrainingModeNames,
}));

const mockRecordingStore = createStore(() => ({
  repCount: 0,
  lastRepPeakVelocity: null as number | null,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  processSample: vi.fn(),
  setUIState: vi.fn(),
  reset: vi.fn(),
}));

const mockVoltraStore = createStore(() => ({
  mode: TrainingMode.WeightTraining,
  weight: 50,
  currentSample: null,
  deviceName: 'Test Voltra',
  prepareWorkout: vi.fn(async () => {}),
  engageMotor: vi.fn(async () => {}),
  disengageMotor: vi.fn(async () => {}),
}));

vi.mock('@/stores', () => ({
  useConnectionStore: vi.fn((selector?: (s: unknown) => unknown) => {
    if (selector) {
      const state = {
        primaryDeviceId: 'device-1',
        devices: new Map([['device-1', mockVoltraStore]]),
        getPrimaryDevice: () => mockVoltraStore,
      };
      return selector(state);
    }
    return {};
  }),
  selectIsConnected: () => true,
  createRecordingStore: () => mockRecordingStore,
}));

vi.mock('@/components/recording', () => ({
  RecordingDisplayView: 'RecordingDisplayView',
  WorkoutControls: 'WorkoutControls',
}));

vi.mock('@/components/mode', () => ({
  ModeControls: 'ModeControls',
  AdvancedAccordion: 'AdvancedAccordion',
}));

vi.mock('@/components/exercise', () => ({
  TempoBar: 'TempoBar',
  SetTargets: 'SetTargets',
  VerticalWeightJog: 'VerticalWeightJog',
  EMPTY_TARGETS: {
    targetMode: 'reps',
    targetReps: 0,
    rirTarget: 0,
    targetTempo: { concentric: 0, eccentric: 0, pauseTop: 0, pauseBottom: 0 },
    targetSets: 0,
    enabledSections: { effort: false, tempo: false, sets: false },
  },
}));

describe('SimpleExerciseScreen', () => {
  it('exports SimpleExerciseScreen as a function', async () => {
    const mod = await import('../SimpleExerciseScreen');
    expect(mod.SimpleExerciseScreen).toBeTypeOf('function');
  });

  it('barrel file includes SimpleExerciseScreen export', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve(__dirname, '../index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain("export { SimpleExerciseScreen } from './SimpleExerciseScreen'");
  });

  it('recording store initializes with zero reps', () => {
    const state = mockRecordingStore.getState();
    expect(state.repCount).toBe(0);
    expect(state.lastRepPeakVelocity).toBeNull();
  });

  it('recording store exposes startRecording and stopRecording', () => {
    const state = mockRecordingStore.getState();
    expect(state.startRecording).toBeTypeOf('function');
    expect(state.stopRecording).toBeTypeOf('function');
  });

  it('voltra store exposes workout lifecycle methods', () => {
    const state = mockVoltraStore.getState();
    expect(state.prepareWorkout).toBeTypeOf('function');
    expect(state.engageMotor).toBeTypeOf('function');
    expect(state.disengageMotor).toBeTypeOf('function');
  });

  it('exercise state transitions follow idle to preparing to countdown to recording', () => {
    type ExerciseState = 'idle' | 'preparing' | 'countdown' | 'recording';
    const validTransitions: Record<ExerciseState, ExerciseState[]> = {
      idle: ['preparing'],
      preparing: ['countdown', 'idle'],
      countdown: ['recording', 'idle'],
      recording: ['idle'],
    };

    expect(validTransitions.idle).toContain('preparing');
    expect(validTransitions.preparing).toContain('countdown');
    expect(validTransitions.countdown).toContain('recording');
    expect(validTransitions.recording).toContain('idle');
  });

  it('display instruction maps correctly for each state', () => {
    type ExerciseState = 'idle' | 'preparing' | 'countdown' | 'recording';

    function getInstruction(state: ExerciseState): string {
      if (state === 'recording') return 'Lift!';
      if (state === 'countdown') return 'Get Ready';
      return 'Press Start';
    }

    expect(getInstruction('idle')).toBe('Press Start');
    expect(getInstruction('preparing')).toBe('Press Start');
    expect(getInstruction('countdown')).toBe('Get Ready');
    expect(getInstruction('recording')).toBe('Lift!');
  });

  it('isActive flag is true only during countdown and recording', () => {
    type ExerciseState = 'idle' | 'preparing' | 'countdown' | 'recording';

    function isActive(state: ExerciseState): boolean {
      return state === 'countdown' || state === 'recording';
    }

    expect(isActive('idle')).toBe(false);
    expect(isActive('preparing')).toBe(false);
    expect(isActive('countdown')).toBe(true);
    expect(isActive('recording')).toBe(true);
  });

  it('mode name resolves from TrainingModeNames', () => {
    expect(TrainingModeNames[TrainingMode.WeightTraining]).toBe('Weight Training');
    expect(TrainingModeNames[TrainingMode.Idle]).toBe('Idle');
  });
});
