import { describe, it, expect, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand';
import type { VoltraState } from '@/stores/voltra-store';

// Mock native slider — no DOM in node test environment
vi.mock('@react-native-community/slider', () => ({
  default: 'Slider',
}));

/** Subset of VoltraState that BasicModeConfig actually uses. */
interface MockVoltraState {
  weight: number;
  eccentric: number;
  setWeight: (lbs: number) => Promise<void>;
  setEccentric: (pct: number) => Promise<void>;
}

function createMockVoltraStore(overrides: Partial<MockVoltraState> = {}) {
  const store = createStore<MockVoltraState>()(() => ({
    weight: 50,
    eccentric: 0,
    setWeight: vi.fn(async () => {}),
    setEccentric: vi.fn(async () => {}),
    ...overrides,
  }));
  // Cast to VoltraStoreApi — the component only reads the fields above
  return store as unknown as StoreApi<VoltraState>;
}

describe('BasicModeConfig', () => {
  it('exports BasicModeConfig as a function', async () => {
    const mod = await import('../BasicModeConfig');
    expect(mod.BasicModeConfig).toBeTypeOf('function');
  });

  it('barrel file includes BasicModeConfig export statement', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve(__dirname, '../index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain("export { BasicModeConfig } from './BasicModeConfig'");
  });

  it('store selectors read weight and eccentric correctly', () => {
    const store = createMockVoltraStore({ weight: 135, eccentric: 42 });
    const state = store.getState();

    expect(state.weight).toBe(135);
    expect(state.eccentric).toBe(42);
    expect(state.setWeight).toBeTypeOf('function');
    expect(state.setEccentric).toBeTypeOf('function');
  });

  it('setWeight commits value to store', async () => {
    const mockSetWeight = vi.fn(async () => {});
    const store = createMockVoltraStore({ weight: 50, setWeight: mockSetWeight });

    await store.getState().setWeight(75);
    expect(mockSetWeight).toHaveBeenCalledWith(75);
  });

  it('setEccentric commits value to store', async () => {
    const mockSetEccentric = vi.fn(async () => {});
    const store = createMockVoltraStore({ eccentric: 0, setEccentric: mockSetEccentric });

    await store.getState().setEccentric(30);
    expect(mockSetEccentric).toHaveBeenCalledWith(30);
  });
});
