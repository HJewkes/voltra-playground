/**
 * SetBuilder composition-target tests (VLT-03.08 regression).
 *
 * Guards the fix for the latent fixture bug where `buildFromComposition` computed
 * a merged `repTargets` (base rep targets + velocity baseline) but never wired it
 * into `repBuilder`, so composition-generated reps silently ignored them and fell
 * back to the bare behavior preset. These tests assert the merged targets now
 * actually shape the generated reps.
 */

import { describe, it, expect } from 'vitest';
import {
  getSetFirstRepVelocity,
  getSetRepVelocities,
  getSetRepROMs,
} from '@voltras/workout-analytics';
import { setBuilder, RepBehavior } from '../generators/set-builder';

// Normal preset concentric mean velocity is 0.55 m/s; pick a baseline clearly
// above it but below the preset peak (0.7) so the physics stays consistent.
const RAISED_BASELINE = 0.68;

describe('SetBuilder composition rep targets (VLT-03.08)', () => {
  it('applies the velocity concentricBaseline to the first composition rep', () => {
    const withBaseline = setBuilder()
      .weight(100)
      .composition([RepBehavior.Normal, RepBehavior.Normal])
      .velocity({ concentricBaseline: RAISED_BASELINE })
      .build();

    const withoutBaseline = setBuilder()
      .weight(100)
      .composition([RepBehavior.Normal, RepBehavior.Normal])
      .build();

    // Before the fix these were identical (baseline dropped on the floor).
    expect(getSetFirstRepVelocity(withBaseline.data)).toBeGreaterThan(
      getSetFirstRepVelocity(withoutBaseline.data)
    );
  });

  it('applies the velocity baseline only to the first rep', () => {
    const set = setBuilder()
      .weight(100)
      .composition([RepBehavior.Normal, RepBehavior.Normal])
      .velocity({ concentricBaseline: RAISED_BASELINE })
      .build();

    const velocities = getSetRepVelocities(set.data);
    // Rep 0 lifted toward the baseline; rep 1 keeps the plain Normal profile.
    expect(velocities[0]).toBeGreaterThan(velocities[1]);
  });

  it('applies base rep targets (.rep) to every composition rep', () => {
    const withTarget = setBuilder()
      .weight(100)
      .repCount(3)
      .rep({ concentric: { meanVelocity: RAISED_BASELINE } })
      .build();

    const plain = setBuilder().weight(100).repCount(3).build();

    const withVelocities = getSetRepVelocities(withTarget.data);
    const plainVelocities = getSetRepVelocities(plain.data);

    // Base target applies to all reps, not just the first.
    withVelocities.forEach((v, i) => {
      expect(v).toBeGreaterThan(plainVelocities[i]);
    });
  });

  it('applies a base rangeOfMotion target to composition reps', () => {
    const set = setBuilder().weight(100).repCount(3).rep({ rangeOfMotion: 0.5 }).build();

    // Default ROM is 1.0; the base target must pull every rep well below it.
    getSetRepROMs(set.data).forEach((rom) => {
      expect(rom).toBeLessThan(0.9);
    });
  });
});
