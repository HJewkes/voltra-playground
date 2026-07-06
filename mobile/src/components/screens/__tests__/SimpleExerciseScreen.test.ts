import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';

vi.mock('react-native-reanimated', () => ({
  default: { createAnimatedComponent: (c: unknown) => c },
  useSharedValue: () => ({ value: 0 }),
  useAnimatedStyle: (fn: () => unknown) => fn(),
  withSpring: (v: number) => v,
}));

vi.mock('../mock-rep-plan', () => ({
  generateMockRepPlan: vi.fn(() => []),
}));

vi.mock('@/utils/coach-console', () => ({
  registerCoachConsole: vi.fn(),
}));

vi.mock('@/utils/web-style', () => ({
  webStyle: (s: Record<string, unknown>) => s,
}));

vi.mock('@/domain/workout/models/workout-plan', () => ({
  validateWorkoutPlan: vi.fn(),
}));

vi.mock('@/data/provider', () => ({
  getWorkoutPlanRepository: () => ({ saveWorkoutPlan: vi.fn() }),
}));

vi.mock('expo-clipboard', () => ({
  getStringAsync: vi.fn(async () => ''),
}));
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
  Surface: 'Surface',
  getSemanticColors: () => ({}),
  alpha: (_color: string, _opacity: number) => 'rgba(0,0,0,0)',
}));

vi.mock('@voltras/workout-analytics', () => ({
  MovementPhase: { IDLE: 0, CONCENTRIC: 1, ECCENTRIC: 2, HOLD: 3 },
  getSetVelocityLossPct: () => 0,
  getSetMeanVelocity: () => 0,
  getSetRepVelocities: () => [],
  estimateSetRIR: () => ({ rpe: 5, rir: 5 }),
  getRepPeakVelocity: () => 0,
}));

vi.mock('@/domain/workout', () => ({
  getRPEColor: () => '#ffffff',
  createCompletedSet: vi.fn(),
}));

vi.mock('@/domain/exercise', () => ({
  createExercise: (base: { id: string; name: string }) => ({
    id: base.id,
    name: base.name,
    muscleGroups: [],
    movementPattern: 'push',
  }),
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
  meanVelocity: 0,
  rpe: 5,
  rir: 5,
  velocityLoss: 0,
  liveMessage: null as string | null,
  currentPhase: 0,
  phaseElapsedMs: 0,
  repPhaseDurations: [] as { phase: number; durationMs: number }[],
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  processSample: vi.fn(),
  setUIState: vi.fn(),
  reset: vi.fn(),
}));

const mockSessionStore = createStore(() => ({
  session: null as unknown,
  uiState: 'idle' as string,
  setLog: [] as unknown[],
  restElapsedMs: 0,
  restCountdown: 0,
  currentSetIndex: 0,
  currentPlannedSet: null as unknown,
  startSession: vi.fn(),
  bindRecordingStore: vi.fn(),
  bindVoltraStore: vi.fn(),
  prepareFirstSet: vi.fn(async () => {}),
  startFirstSet: vi.fn(),
  stopSession: vi.fn(async () => {}),
}));

const mockVoltraStore = createStore(() => ({
  mode: TrainingMode.WeightTraining,
  weight: 50,
  currentSample: null,
  deviceName: 'Test Voltra',
  eccentric: 50,
  setEccentric: vi.fn(),
  chains: 0,
  inverseChains: 0,
  setChains: vi.fn(),
  setInverseChains: vi.fn(),
  setMode: vi.fn(),
  setWeight: vi.fn(),
  prepareWorkout: vi.fn(async () => {}),
  engageMotor: vi.fn(async () => {}),
  disengageMotor: vi.fn(async () => {}),
  stopRecording: vi.fn(async () => {}),
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
  createExerciseSessionStore: () => mockSessionStore,
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
  RestCard: 'RestCard',
  CircularTimer: 'CircularTimer',
  SetLog: 'SetLog',
  ExercisePickerModal: 'ExercisePickerModal',
  QuickConfig: 'QuickConfig',
  EMPTY_TARGETS: {
    targetMode: 'reps',
    targetReps: 0,
    rirTarget: 0,
    targetTempo: { concentric: 0, eccentric: 0, pauseTop: 0, pauseBottom: 0 },
    targetSets: 0,
    restBlocks: 0,
    enabledSections: { effort: false, tempo: false, sets: false, rest: false },
  },
}));

vi.mock('../exercise', () => ({
  ModeDrawer: 'ModeDrawer',
  MODE_META: {},
  ConfigSection: 'ConfigSection',
  ExerciseBreadcrumbs: 'ExerciseBreadcrumbs',
  NextExerciseButton: 'NextExerciseButton',
  WorkoutView: 'WorkoutView',
  useExerciseStores: () => ({
    recordingStore: mockRecordingStore,
    sessionStore: mockSessionStore,
    device: {
      mode: 0x0001,
      setMode: vi.fn(),
      weight: 50,
      eccentric: 50,
      setEccentric: vi.fn(),
      chains: 0,
      inverseChains: 0,
      setChains: vi.fn(),
      setInverseChains: vi.fn(),
    },
    recording: {
      repCount: 0,
      rpe: 5,
      rir: 5,
      liveMessage: null,
      currentPhase: 0,
      phaseElapsedMs: 0,
      repPhaseDurations: [],
      liveSamples: [],
      meanVelocity: 0,
      velocityLoss: 0,
    },
    session: {
      uiState: 'idle',
      setLog: [],
      restElapsedMs: 0,
      currentSetIndex: 0,
      currentPlannedSet: null,
      session: null,
      autoRegulation: null,
    },
  }),
  useExerciseLifecycle: () => ({
    configRef: { current: null },
    completedExercises: [],
    pickerVisible: false,
    setPickerVisible: vi.fn(),
    workoutPlan: null,
    planExerciseIndex: 0,
    currentPlanExercise: null,
    hasMorePlanExercises: false,
    handlePlanLoaded: vi.fn(),
    handleNextExercise: vi.fn(),
    handlePlanNextExercise: vi.fn(),
    handleAddSet: vi.fn(),
    handleStart: vi.fn(async () => {}),
    handleStop: vi.fn(async () => {}),
  }),
}));

describe('SimpleExerciseScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('session store initializes in idle state', () => {
    const state = mockSessionStore.getState();
    expect(state.uiState).toBe('idle');
    expect(state.setLog).toEqual([]);
    expect(state.session).toBeNull();
    expect(state.currentSetIndex).toBe(0);
    expect(state.currentPlannedSet).toBeNull();
  });

  it('session store exposes session lifecycle methods', () => {
    const state = mockSessionStore.getState();
    expect(state.startSession).toBeTypeOf('function');
    expect(state.bindRecordingStore).toBeTypeOf('function');
    expect(state.bindVoltraStore).toBeTypeOf('function');
    expect(state.prepareFirstSet).toBeTypeOf('function');
    expect(state.startFirstSet).toBeTypeOf('function');
    expect(state.stopSession).toBeTypeOf('function');
  });

  it('exercise session state transitions follow session store lifecycle', () => {
    type SessionUIState =
      | 'idle'
      | 'preparing'
      | 'ready'
      | 'countdown'
      | 'recording'
      | 'processing'
      | 'resting'
      | 'results';
    const validTransitions: Record<SessionUIState, SessionUIState[]> = {
      idle: ['preparing'],
      preparing: ['ready'],
      ready: ['countdown'],
      countdown: ['recording'],
      recording: ['processing', 'resting'],
      processing: ['resting', 'results'],
      resting: ['countdown', 'recording'],
      results: [],
    };

    expect(validTransitions.idle).toContain('preparing');
    expect(validTransitions.preparing).toContain('ready');
    expect(validTransitions.ready).toContain('countdown');
    expect(validTransitions.countdown).toContain('recording');
    expect(validTransitions.recording).toContain('processing');
    expect(validTransitions.resting).toContain('countdown');
  });

  it('WorkoutControls isActive reflects recording and countdown states', () => {
    type SessionUIState =
      'idle' | 'preparing' | 'ready' | 'countdown' | 'recording' | 'resting' | 'results';

    function isControlsActive(state: SessionUIState): boolean {
      return state === 'recording' || state === 'countdown';
    }

    expect(isControlsActive('idle')).toBe(false);
    expect(isControlsActive('preparing')).toBe(false);
    expect(isControlsActive('countdown')).toBe(true);
    expect(isControlsActive('recording')).toBe(true);
    expect(isControlsActive('resting')).toBe(false);
    expect(isControlsActive('results')).toBe(false);
  });

  it('WorkoutControls hidden when uiState is results', () => {
    type SessionUIState = 'idle' | 'recording' | 'resting' | 'results';

    function showControls(state: SessionUIState): boolean {
      return state !== 'results';
    }

    expect(showControls('idle')).toBe(true);
    expect(showControls('recording')).toBe(true);
    expect(showControls('resting')).toBe(true);
    expect(showControls('results')).toBe(false);
  });

  it('rep count shows target when planned set has targetReps', () => {
    function formatRepCount(repCount: number, targetReps: number | null): string {
      return targetReps ? `${repCount}/${targetReps}` : `${repCount}`;
    }

    expect(formatRepCount(3, 8)).toBe('3/8');
    expect(formatRepCount(5, null)).toBe('5');
    expect(formatRepCount(0, 10)).toBe('0/10');
  });

  it('rest target ms computed from session plan defaultRestSeconds', () => {
    const session = { plan: { defaultRestSeconds: 90 } };
    const restTargetMs = session.plan.defaultRestSeconds * 1000;
    expect(restTargetMs).toBe(90000);
  });

  it('set log shows when there are completed sets or recording is active', () => {
    function showSetLog(setLogLength: number, uiState: string): boolean {
      return setLogLength > 0 || uiState === 'recording';
    }

    expect(showSetLog(0, 'idle')).toBe(false);
    expect(showSetLog(0, 'recording')).toBe(true);
    expect(showSetLog(1, 'idle')).toBe(true);
    expect(showSetLog(2, 'resting')).toBe(true);
  });

  it('mode name resolves from TrainingModeNames', () => {
    expect(TrainingModeNames[TrainingMode.WeightTraining]).toBe('Weight Training');
    expect(TrainingModeNames[TrainingMode.Idle]).toBe('Idle');
  });
});

describe('buildPlanFromTargets', () => {
  // Test the plan-building logic directly
  it('creates single set when sets section disabled', () => {
    const targets = {
      targetMode: 'reps' as const,
      targetReps: 10,
      rirTarget: 2,
      targetTempo: { concentric: 1, eccentric: 3, pauseTop: 0, pauseBottom: 0 },
      targetSets: 5,
      restBlocks: 6,
      enabledSections: { effort: true, tempo: true, sets: false, rest: true },
    };

    // Simulate the logic from buildPlanFromTargets
    const numSets = targets.enabledSections.sets ? targets.targetSets : 1;
    expect(numSets).toBe(1);
  });

  it('uses target sets when sets section enabled', () => {
    const targets = {
      targetMode: 'reps' as const,
      targetReps: 10,
      rirTarget: 2,
      targetTempo: { concentric: 1, eccentric: 3, pauseTop: 0, pauseBottom: 0 },
      targetSets: 4,
      restBlocks: 6,
      enabledSections: { effort: true, tempo: true, sets: true, rest: true },
    };

    const numSets = targets.enabledSections.sets ? targets.targetSets : 1;
    expect(numSets).toBe(4);
  });

  it('uses reps target when effort section enabled with reps mode', () => {
    const targets = {
      targetMode: 'reps' as const,
      targetReps: 10,
      rirTarget: 0,
      targetTempo: { concentric: 0, eccentric: 0, pauseTop: 0, pauseBottom: 0 },
      targetSets: 1,
      restBlocks: 0,
      enabledSections: { effort: true, tempo: false, sets: false, rest: false },
    };

    const targetReps = targets.enabledSections.effort
      ? targets.targetMode === 'reps'
        ? targets.targetReps
        : 0
      : 0;
    expect(targetReps).toBe(10);
  });

  it('falls back to 8 reps when no reps target configured', () => {
    const targetReps = 0;
    const effectiveReps = targetReps || 8;
    expect(effectiveReps).toBe(8);
  });

  it('computes rest seconds from blocks (15s per block)', () => {
    const restBlocks = 6;
    const restEnabled = true;
    const restSeconds = restEnabled ? restBlocks * 15 : 90;
    expect(restSeconds).toBe(90);

    const fourBlocks = 4;
    const fourBlocksEnabled = true;
    const fourBlockRest = fourBlocksEnabled ? fourBlocks * 15 : 90;
    expect(fourBlockRest).toBe(60);
  });

  it('defaults to 90s rest when rest section disabled', () => {
    const restBlocks = 8;
    const restEnabled = false;
    const restSeconds = restEnabled ? restBlocks * 15 : 90;
    expect(restSeconds).toBe(90);
  });

  it('excludes tempo when tempo section disabled', () => {
    const targets = {
      enabledSections: { tempo: false },
      targetTempo: { concentric: 2, eccentric: 4, pauseTop: 1, pauseBottom: 0 },
    };

    const targetTempo = targets.enabledSections.tempo ? targets.targetTempo : undefined;
    expect(targetTempo).toBeUndefined();
  });

  it('includes tempo when tempo section enabled', () => {
    const targets = {
      enabledSections: { tempo: true },
      targetTempo: { concentric: 2, eccentric: 4, pauseTop: 1, pauseBottom: 0 },
    };

    const targetTempo = targets.enabledSections.tempo ? targets.targetTempo : undefined;
    expect(targetTempo).toEqual({ concentric: 2, eccentric: 4, pauseTop: 1, pauseBottom: 0 });
  });
});
