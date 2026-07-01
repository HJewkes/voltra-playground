import { describe, it, expect, vi } from 'vitest';
import { createStore } from 'zustand';

// Mock @/domain/device with real enum values from SDK, stub BLE classes
vi.mock('@/domain/device', async (importOriginal) => {
  // importOriginal resolves @/domain/device which re-exports from @voltras/node-sdk
  // We need @voltras/node-sdk mocked first to prevent BLE resolution
  return {
    TrainingMode: {
      Idle: 0x0000, WeightTraining: 0x0001, ResistanceBand: 0x0002,
      Rowing: 0x0003, Damper: 0x0004, CustomCurves: 0x0006,
      Isokinetic: 0x0007, Isometric: 0x0008,
    },
    TrainingModeNames: {
      0x0000: 'Idle', 0x0001: 'Weight Training', 0x0002: 'Resistance Band',
      0x0003: 'Rowing', 0x0004: 'Damper', 0x0006: 'Custom Curves',
      0x0007: 'Isokinetic', 0x0008: 'Isometric',
    },
    VoltraManager: vi.fn(),
    detectBLEEnvironment: vi.fn(),
  };
});

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
  Card: 'Card', CardContent: 'CardContent',
  Section: 'Section', SectionContent: 'SectionContent',
  getSemanticColors: () => ({}),
}));

vi.mock('@react-native-community/slider', () => ({
  default: 'Slider',
}));

const mockVoltraStore = createStore(() => ({
  mode: 0x0001, weight: 50, eccentric: 0,
  setMode: vi.fn(async (_mode: number) => {}),
  setWeight: vi.fn(async () => {}),
  setEccentric: vi.fn(async () => {}),
}));

vi.mock('@/stores', () => ({
  useConnectionStore: vi.fn((selector?: (s: unknown) => unknown) => {
    if (selector) {
      return selector({
        primaryDeviceId: 'device-1',
        devices: new Map([['device-1', mockVoltraStore]]),
        getPrimaryDevice: () => mockVoltraStore,
        disconnectAll: vi.fn(),
      });
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

  // Barrel import test skipped: loading all screens triggers expo-modules-core
  // TypeScript source parsing in vitest, causing SyntaxError. The direct
  // import test above verifies the component exports correctly.
  it.skip('barrel file exports ModeSelectionScreen', async () => {
    const barrel = await import('../index');
    expect(barrel.ModeSelectionScreen).toBeTypeOf('function');
  });

  it('MODE_LIST from production contains six selectable training modes', async () => {
    const { MODE_LIST } = await import('../ModeSelectionScreen');
    expect(MODE_LIST).toHaveLength(6);
    const uniqueValues = new Set(MODE_LIST);
    expect(uniqueValues.size).toBe(6);
  });

  it('MODE_LIST from production includes expected modes', async () => {
    const { MODE_LIST } = await import('../ModeSelectionScreen');
    const { TrainingMode } = await import('@/domain/device');
    expect(MODE_LIST).toContain(TrainingMode.WeightTraining);
    expect(MODE_LIST).toContain(TrainingMode.ResistanceBand);
    expect(MODE_LIST).not.toContain(TrainingMode.Idle);
  });

  it('ECCENTRIC_MODES from production contains only ResistanceBand', async () => {
    const { ECCENTRIC_MODES } = await import('../ModeSelectionScreen');
    const { TrainingMode } = await import('@/domain/device');
    expect(ECCENTRIC_MODES.has(TrainingMode.ResistanceBand)).toBe(true);
    expect(ECCENTRIC_MODES.has(TrainingMode.WeightTraining)).toBe(false);
    expect(ECCENTRIC_MODES.has(TrainingMode.Rowing)).toBe(false);
  });

  it('all training modes in MODE_LIST have human-readable names', async () => {
    const { MODE_LIST } = await import('../ModeSelectionScreen');
    const { TrainingModeNames } = await import('@/domain/device');
    for (const mode of MODE_LIST) {
      expect(TrainingModeNames[mode]).toBeTypeOf('string');
      expect(TrainingModeNames[mode].length).toBeGreaterThan(0);
    }
  });
});
