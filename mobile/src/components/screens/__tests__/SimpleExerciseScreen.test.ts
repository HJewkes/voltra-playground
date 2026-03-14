import { describe, it, expect, vi } from 'vitest';
import { createStore } from 'zustand';

vi.mock('@/domain/device', () => ({
  TrainingMode: { Idle: 0x0000, WeightTraining: 0x0001 },
  TrainingModeNames: { 0x0000: 'Idle', 0x0001: 'Weight Training' },
  VoltraManager: vi.fn(),
  detectBLEEnvironment: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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
}));

const mockRecordingStore = createStore(() => ({
  repCount: 0, lastRepPeakVelocity: null as number | null,
  startRecording: vi.fn(), stopRecording: vi.fn(),
  processSample: vi.fn(), setUIState: vi.fn(), reset: vi.fn(),
}));

const mockVoltraStore = createStore(() => ({
  mode: 0x0001, weight: 50, currentSample: null, deviceName: 'Test Voltra',
  prepareWorkout: vi.fn(async () => {}),
  engageMotor: vi.fn(async () => {}),
  disengageMotor: vi.fn(async () => {}),
}));

vi.mock('@/stores', () => ({
  useConnectionStore: vi.fn((selector?: (s: unknown) => unknown) => {
    if (selector) {
      return selector({
        primaryDeviceId: 'device-1',
        devices: new Map([['device-1', mockVoltraStore]]),
        getPrimaryDevice: () => mockVoltraStore,
      });
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

describe('SimpleExerciseScreen', () => {
  it('exports SimpleExerciseScreen as a function', async () => {
    const mod = await import('../SimpleExerciseScreen');
    expect(mod.SimpleExerciseScreen).toBeTypeOf('function');
  });

  it('barrel file declares SimpleExerciseScreen export', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve(__dirname, '../index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain("export { SimpleExerciseScreen }");
  });

  it('exports getInstruction and isActiveState helpers', async () => {
    const mod = await import('../SimpleExerciseScreen');
    expect(mod.getInstruction).toBeTypeOf('function');
    expect(mod.isActiveState).toBeTypeOf('function');
  });

  it('getInstruction returns correct values using production function', async () => {
    const { getInstruction } = await import('../SimpleExerciseScreen');
    expect(getInstruction('idle')).toBe('Press Start');
    expect(getInstruction('preparing')).toBe('Press Start');
    expect(getInstruction('countdown')).toBe('Get Ready');
    expect(getInstruction('recording')).toBe('Lift!');
  });

  it('isActiveState returns correct values using production function', async () => {
    const { isActiveState } = await import('../SimpleExerciseScreen');
    expect(isActiveState('idle')).toBe(false);
    expect(isActiveState('preparing')).toBe(false);
    expect(isActiveState('countdown')).toBe(true);
    expect(isActiveState('recording')).toBe(true);
  });

  it('TrainingModeNames resolves from mock that mirrors SDK values', async () => {
    const { TrainingModeNames } = await import('@/domain/device');
    expect(TrainingModeNames[0x0001]).toBe('Weight Training');
    expect(TrainingModeNames[0x0000]).toBe('Idle');
  });
});
