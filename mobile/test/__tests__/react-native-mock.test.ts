import { describe, it, expect } from 'vitest';

describe('react-native mock', () => {
  it('resolves @titan-design/react-ui imports', async () => {
    const titan = await import('@titan-design/react-ui');
    expect(titan.getSemanticColors).toBeTypeOf('function');
    expect(titan.alpha).toBeTypeOf('function');
  });

  it('getSemanticColors returns hex color map', async () => {
    const { getSemanticColors } = await import('@titan-design/react-ui');
    const dark = getSemanticColors('dark');

    expect(dark['brand-primary']).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(dark['status-success']).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(dark['status-error']).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(dark['text-primary']).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('alpha utility produces rgba strings', async () => {
    const { alpha } = await import('@titan-design/react-ui');

    expect(alpha('#FF7900', 0.5)).toBe('rgba(255, 121, 0, 0.5)');
    expect(alpha('#14B8A6', 0.12)).toBe('rgba(20, 184, 166, 0.12)');
  });
});
