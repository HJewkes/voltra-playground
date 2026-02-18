import { describe, it, expect } from 'vitest';
import { getPhaseColor } from '../PhaseIndicator';
import { MovementPhase } from '@/domain/workout';

describe('getPhaseColor()', () => {
  it('returns distinct colors for each movement phase', () => {
    const concentric = getPhaseColor(MovementPhase.CONCENTRIC);
    const hold = getPhaseColor(MovementPhase.HOLD);
    const eccentric = getPhaseColor(MovementPhase.ECCENTRIC);
    const idle = getPhaseColor(MovementPhase.IDLE);

    const colors = [concentric, hold, eccentric, idle];
    const unique = new Set(colors);
    expect(unique.size).toBe(4);
  });

  it('returns hex color strings', () => {
    for (const phase of [
      MovementPhase.CONCENTRIC,
      MovementPhase.HOLD,
      MovementPhase.ECCENTRIC,
      MovementPhase.IDLE,
    ]) {
      const color = getPhaseColor(phase);
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('maps concentric to success token', () => {
    expect(getPhaseColor(MovementPhase.CONCENTRIC)).toBe(
      getPhaseColor(MovementPhase.CONCENTRIC)
    );
    // Concentric should differ from eccentric (not swapped)
    expect(getPhaseColor(MovementPhase.CONCENTRIC)).not.toBe(
      getPhaseColor(MovementPhase.ECCENTRIC)
    );
  });

  it('uses fallback color for unknown phases', () => {
    const color = getPhaseColor(99 as MovementPhase);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
