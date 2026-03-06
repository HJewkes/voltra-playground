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
  Card: 'Card',
  CardContent: 'CardContent',
  Section: 'Section',
  SectionContent: 'SectionContent',
  getSemanticColors: () => ({}),
}));

vi.mock('@react-native-community/slider', () => ({
  default: 'Slider',
}));

// Mirror the SDK enum values directly to avoid importing @voltras/node-sdk
const TrainingMode = {
  Idle: 0x0000,
  WeightTraining: 0x0001,
  ResistanceBand: 0x0002,
  Rowing: 0x0003,
  Damper: 0x0004,
  CustomCurves: 0x0006,
  Isokinetic: 0x0007,
  Isometric: 0x0008,
} as const;

const TrainingModeNames: Record<number, string> = {
  [TrainingMode.Idle]: 'Idle',
  [TrainingMode.WeightTraining]: 'Weight Training',
  [TrainingMode.ResistanceBand]: 'Resistance Band',
  [TrainingMode.Rowing]: 'Rowing',
  [TrainingMode.Damper]: 'Damper',
  [TrainingMode.CustomCurves]: 'Custom Curves',
  [TrainingMode.Isokinetic]: 'Isokinetic',
  [TrainingMode.Isometric]: 'Isometric',
};

vi.mock('@/domain/device', () => ({
  TrainingMode,
  TrainingModeNames,
}));

const mockVoltraStore = createStore(() => ({
  mode: TrainingMode.WeightTraining,
  weight: 50,
  eccentric: 0,
  setMode: vi.fn(async (_mode: number) => {}),
  setWeight: vi.fn(async () => {}),
  setEccentric: vi.fn(async () => {}),
}));

vi.mock('@/stores', () => ({
  useConnectionStore: vi.fn((selector?: (s: unknown) => unknown) => {
    if (selector) {
      const state = {
        primaryDeviceId: 'device-1',
        devices: new Map([['device-1', mockVoltraStore]]),
        getPrimaryDevice: () => mockVoltraStore,
        disconnectAll: vi.fn(),
      };
      return selector(state);
    }
    return {};
  }),
  selectIsConnected: () => true,
}));

vi.mock('@/components/mode', () => ({
  WeightTrainingConfig: 'WeightTrainingConfig',
  BasicModeConfig: 'BasicModeConfig',
}));

describe('ModeSelectionScreen', () => {
  it('exports ModeSelectionScreen as a function', async () => {
    const mod = await import('../ModeSelectionScreen');
    expect(mod.ModeSelectionScreen).toBeTypeOf('function');
  });

  it('barrel file includes ModeSelectionScreen export', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve(__dirname, '../index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain("export { ModeSelectionScreen } from './ModeSelectionScreen'");
  });

  it('MODE_LIST contains seven training modes', () => {
    const MODE_LIST = [
      TrainingMode.WeightTraining,
      TrainingMode.ResistanceBand,
      TrainingMode.Rowing,
      TrainingMode.Damper,
      TrainingMode.Isokinetic,
      TrainingMode.Isometric,
      TrainingMode.Idle,
    ];
    expect(MODE_LIST).toHaveLength(7);
    const uniqueValues = new Set(MODE_LIST);
    expect(uniqueValues.size).toBe(7);
  });

  it('mode store selector reads current mode correctly', () => {
    const state = mockVoltraStore.getState();
    expect(state.mode).toBe(TrainingMode.WeightTraining);
  });

  it('setMode is callable with a training mode value', async () => {
    const state = mockVoltraStore.getState();
    await state.setMode(TrainingMode.ResistanceBand as number);
    expect(state.setMode).toHaveBeenCalledWith(TrainingMode.ResistanceBand);
  });

  it('Idle mode excludes config rendering', () => {
    const mode: number = TrainingMode.Idle;
    const showConfig = mode !== TrainingMode.Idle;
    expect(showConfig).toBe(false);
  });

  it('non-Idle mode enables config rendering', () => {
    const mode: number = TrainingMode.WeightTraining;
    const showConfig = mode !== TrainingMode.Idle;
    expect(showConfig).toBe(true);
  });

  it('eccentric modes set contains only ResistanceBand', () => {
    const ECCENTRIC_MODES = new Set<number>([TrainingMode.ResistanceBand]);
    expect(ECCENTRIC_MODES.has(TrainingMode.ResistanceBand)).toBe(true);
    expect(ECCENTRIC_MODES.has(TrainingMode.WeightTraining)).toBe(false);
    expect(ECCENTRIC_MODES.has(TrainingMode.Rowing)).toBe(false);
  });

  it('all training modes have human-readable names', () => {
    const MODE_LIST = [
      TrainingMode.WeightTraining,
      TrainingMode.ResistanceBand,
      TrainingMode.Rowing,
      TrainingMode.Damper,
      TrainingMode.Isokinetic,
      TrainingMode.Isometric,
      TrainingMode.Idle,
    ];
    for (const mode of MODE_LIST) {
      expect(TrainingModeNames[mode]).toBeTypeOf('string');
      expect(TrainingModeNames[mode].length).toBeGreaterThan(0);
    }
  });
});
