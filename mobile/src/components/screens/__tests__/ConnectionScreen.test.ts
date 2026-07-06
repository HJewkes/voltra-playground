import { describe, it, expect, vi } from 'vitest';

// Mock @/domain/device before anything imports it (prevents BLE resolution)
vi.mock('@/domain/device', () => ({
  VoltraManager: vi.fn(),
  detectBLEEnvironment: () => ({
    environment: 'node',
    bleSupported: true,
    warningMessage: null,
    isWeb: false,
    requiresUserGesture: false,
    forceMock: false,
  }),
}));

// Mock stores but import the real selectIsConnected via importActual
vi.mock('@/stores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores')>();
  return {
    ...actual,
    useConnectionStore: vi.fn((selector?: (s: unknown) => unknown) => {
      if (selector) return selector({ primaryDeviceId: null, devices: new Map() });
      return {};
    }),
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
  getSemanticColors: () => ({}),
}));

vi.mock('@/components/device', () => ({
  DeviceConnection: 'DeviceConnection',
}));

describe('ConnectionScreen', () => {
  it('exports ConnectionScreen as a function', async () => {
    const mod = await import('../ConnectionScreen');
    expect(mod.ConnectionScreen).toBeTypeOf('function');
  });

  it('barrel file declares ConnectionScreen export', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve(__dirname, '../index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('export { ConnectionScreen }');
  });

  it('selectIsConnected returns false when no device connected', async () => {
    const { selectIsConnected } = await import('@/stores');
    const state = { primaryDeviceId: null, devices: new Map() };
    expect(selectIsConnected(state as never)).toBe(false);
  });

  it('selectIsConnected returns true when primary device exists in map', async () => {
    const { selectIsConnected } = await import('@/stores');
    const devices = new Map([['device-1', {}]]);
    const state = { primaryDeviceId: 'device-1', devices };
    expect(selectIsConnected(state as never)).toBe(true);
  });

  it('selectIsConnected returns false when primary device id not in map', async () => {
    const { selectIsConnected } = await import('@/stores');
    const state = { primaryDeviceId: 'device-1', devices: new Map() };
    expect(selectIsConnected(state as never)).toBe(false);
  });
});
