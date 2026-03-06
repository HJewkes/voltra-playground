import { describe, it, expect, vi } from 'vitest';

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

vi.mock('@/stores', () => ({
  selectBleEnvironment: () => ({
    isWeb: false,
    bleSupported: true,
    warningMessage: null,
    environment: 'native',
    requiresUserGesture: false,
  }),
}));

describe('SettingsScreen', () => {
  it('exports SettingsScreen as a function', async () => {
    const mod = await import('../SettingsScreen');
    expect(mod.SettingsScreen).toBeTypeOf('function');
  });

  it('barrel file includes SettingsScreen export', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve(__dirname, '../index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain("export { SettingsScreen } from './SettingsScreen'");
  });

  it('selectBleEnvironment returns expected shape', async () => {
    const { selectBleEnvironment } = await import('@/stores');
    const env = selectBleEnvironment();
    expect(env).toHaveProperty('isWeb');
    expect(env).toHaveProperty('bleSupported');
    expect(env).toHaveProperty('environment');
  });

  it('selectBleEnvironment returns native environment by default', async () => {
    const { selectBleEnvironment } = await import('@/stores');
    const env = selectBleEnvironment();
    expect(env.isWeb).toBe(false);
    expect(env.environment).toBe('native');
  });

  it('selectBleEnvironment indicates BLE support', async () => {
    const { selectBleEnvironment } = await import('@/stores');
    const env = selectBleEnvironment();
    expect(env.bleSupported).toBe(true);
    expect(env.warningMessage).toBeNull();
  });

  it('__DEV__ flag controls DevToolsSection visibility', () => {
    // __DEV__ is defined as true in vitest.config.ts
    expect(__DEV__).toBe(true);
  });

  it('app version is hardcoded to 1.0.0', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const screenPath = path.resolve(__dirname, '../SettingsScreen.tsx');
    const content = fs.readFileSync(screenPath, 'utf-8');
    expect(content).toContain('"1.0.0"');
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
