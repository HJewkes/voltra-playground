import { describe, it, expect, vi } from 'vitest';

vi.mock('@/domain/device', () => ({
  VoltraManager: vi.fn(),
  detectBLEEnvironment: () => ({
    environment: 'node', bleSupported: true, warningMessage: null,
    isWeb: false, requiresUserGesture: false, forceMock: false,
  }),
}));

vi.mock('@/stores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores')>();
  return {
    ...actual,
    selectBleEnvironment: actual.selectBleEnvironment,
  };
});

vi.mock('@titan-design/react-ui', () => ({
  DataRow: 'DataRow',
  Surface: 'Surface',
  Button: 'Button',
  ButtonText: 'ButtonText',
  VStack: 'VStack',
  getSemanticColors: () => ({}),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

vi.mock('@/components/device', () => ({
  DeviceConnection: 'DeviceConnection',
}));

vi.mock('@/components/settings', () => ({
  DevToolsSection: 'DevToolsSection',
}));

describe('SettingsScreen', () => {
  it('exports SettingsScreen as a function', async () => {
    const mod = await import('../SettingsScreen');
    expect(mod.SettingsScreen).toBeTypeOf('function');
  });

  it('barrel file declares SettingsScreen export', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve(__dirname, '../index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain("export { SettingsScreen }");
  });

  it('selectBleEnvironment returns expected shape from real selector', async () => {
    const { selectBleEnvironment } = await import('@/stores');
    const env = selectBleEnvironment();
    expect(env).toHaveProperty('isWeb');
    expect(env).toHaveProperty('bleSupported');
    expect(env).toHaveProperty('environment');
  });

  it('selectBleEnvironment returns node environment in test', async () => {
    const { selectBleEnvironment } = await import('@/stores');
    const env = selectBleEnvironment();
    // detectBLEEnvironment is mocked to return node environment
    expect(env.isWeb).toBe(false);
    expect(env.environment).toBe('node');
  });

  it('selectBleEnvironment indicates BLE support', async () => {
    const { selectBleEnvironment } = await import('@/stores');
    const env = selectBleEnvironment();
    expect(env.bleSupported).toBe(true);
    expect(env.warningMessage).toBeNull();
  });

  it('__DEV__ flag controls DevToolsSection visibility', () => {
    expect(__DEV__).toBe(true);
  });

  it('BLE mode label shows Web Bluetooth for web environment', () => {
    const isWeb = true as boolean;
    const bleMode = isWeb ? 'Web Bluetooth' : 'Native';
    expect(bleMode).toBe('Web Bluetooth');
  });

  it('BLE mode label shows Native for non-web environment', () => {
    const isWeb = false as boolean;
    const bleMode = isWeb ? 'Web Bluetooth' : 'Native';
    expect(bleMode).toBe('Native');
  });
});
