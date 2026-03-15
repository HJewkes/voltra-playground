/**
 * PR Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { setBuilder } from '@/__fixtures__/generators/set-builder';
import { buildPRSnapshot, detectPRs } from '../pr-detector';
import type { PRSnapshot } from '../pr-detector';

const emptySnapshot: PRSnapshot = { maxWeight: 0, maxReps: 0, maxVelocity: 0, maxVolume: 0 };

describe('buildPRSnapshot', () => {
  it('returns zeros for empty set list', () => {
    expect(buildPRSnapshot([])).toEqual({ maxWeight: 0, maxReps: 0, maxVelocity: 0, maxVolume: 0 });
  });

  it('extracts max weight from a single set', () => {
    const s = setBuilder().weight(150).repCount(5).build();
    expect(buildPRSnapshot([s]).maxWeight).toBe(150);
  });

  it('extracts the highest weight across multiple sets', () => {
    const s1 = setBuilder().weight(100).repCount(8).build();
    const s2 = setBuilder().weight(120).repCount(5).build();
    const s3 = setBuilder().weight(110).repCount(6).build();
    expect(buildPRSnapshot([s1, s2, s3]).maxWeight).toBe(120);
  });

  it('extracts max reps from the set with most reps', () => {
    const s1 = setBuilder().weight(100).repCount(5).build();
    const s2 = setBuilder().weight(80).repCount(12).build();
    expect(buildPRSnapshot([s1, s2]).maxReps).toBe(12);
  });

  it('records a positive maxVelocity from real rep data', () => {
    const s = setBuilder().weight(100).repCount(5).build();
    expect(buildPRSnapshot([s]).maxVelocity).toBeGreaterThan(0);
  });
});

describe('detectPRs with empty snapshot', () => {
  it('returns no badges when there is no prior history', () => {
    const s = setBuilder().weight(100).repCount(8).build();
    expect(detectPRs(s, emptySnapshot)).toHaveLength(0);
  });
});

describe('detectPRs weight PR', () => {
  it('detects a weight PR when set exceeds prior max weight', () => {
    const snapshot: PRSnapshot = { maxWeight: 100, maxReps: 8, maxVelocity: 0.8, maxVolume: 800 };
    const newSet = setBuilder().weight(110).repCount(5).build();
    const badges = detectPRs(newSet, snapshot);
    const weightBadge = badges.find((b) => b.type === 'max_weight');
    expect(weightBadge).toBeDefined();
    expect(weightBadge?.value).toBe(110);
  });

  it('does not report weight PR when weight equals prior max', () => {
    const snapshot: PRSnapshot = { maxWeight: 100, maxReps: 8, maxVelocity: 0.8, maxVolume: 800 };
    const newSet = setBuilder().weight(100).repCount(8).build();
    expect(detectPRs(newSet, snapshot).find((b) => b.type === 'max_weight')).toBeUndefined();
  });

  it('does not report weight PR when weight is below prior max', () => {
    const snapshot: PRSnapshot = { maxWeight: 150, maxReps: 8, maxVelocity: 0.8, maxVolume: 800 };
    const newSet = setBuilder().weight(100).repCount(8).build();
    expect(detectPRs(newSet, snapshot).find((b) => b.type === 'max_weight')).toBeUndefined();
  });
});

describe('detectPRs reps PR', () => {
  it('detects a reps PR when set has more reps than prior max', () => {
    const snapshot: PRSnapshot = { maxWeight: 100, maxReps: 8, maxVelocity: 0.8, maxVolume: 800 };
    const newSet = setBuilder().weight(80).repCount(12).build();
    const badges = detectPRs(newSet, snapshot);
    const repBadge = badges.find((b) => b.type === 'max_reps');
    expect(repBadge).toBeDefined();
    expect(repBadge?.value).toBe(newSet.data.reps.length);
  });

  it('does not report reps PR when rep count matches prior max', () => {
    const snapshot: PRSnapshot = { maxWeight: 100, maxReps: 8, maxVelocity: 0.8, maxVolume: 800 };
    const newSet = setBuilder().weight(100).repCount(8).build();
    expect(detectPRs(newSet, snapshot).find((b) => b.type === 'max_reps')).toBeUndefined();
  });
});

describe('detectPRs multiple PRs', () => {
  it('can return multiple badges when set breaks several records at once', () => {
    const snapshot: PRSnapshot = { maxWeight: 100, maxReps: 5, maxVelocity: 0.5, maxVolume: 500 };
    const newSet = setBuilder().weight(120).repCount(10).build();
    const types = detectPRs(newSet, snapshot).map((b) => b.type);
    expect(types).toContain('max_weight');
    expect(types).toContain('max_reps');
    expect(types).toContain('max_volume');
  });
});

describe('detectPRs badge labels', () => {
  it('includes human-readable label on each badge', () => {
    const snapshot: PRSnapshot = { maxWeight: 100, maxReps: 5, maxVelocity: 0.5, maxVolume: 500 };
    const newSet = setBuilder().weight(120).repCount(3).build();
    for (const badge of detectPRs(newSet, snapshot)) {
      expect(badge.label).toBeTruthy();
      expect(typeof badge.label).toBe('string');
    }
  });

  it('weight badge label contains weight value', () => {
    const snapshot: PRSnapshot = { maxWeight: 100, maxReps: 5, maxVelocity: 0.5, maxVolume: 500 };
    const newSet = setBuilder().weight(135).repCount(3).build();
    const weightBadge = detectPRs(newSet, snapshot).find((b) => b.type === 'max_weight');
    expect(weightBadge?.label).toContain('135');
  });
});

describe('detectPRs round-trip', () => {
  it('detects PR when new set beats snapshot built from real prior sets', () => {
    const priorSets = [
      setBuilder().weight(100).repCount(8).build(),
      setBuilder().weight(105).repCount(6).build(),
    ];
    const snapshot = buildPRSnapshot(priorSets);
    const newSet = setBuilder().weight(115).repCount(8).build();
    expect(detectPRs(newSet, snapshot).find((b) => b.type === 'max_weight')).toBeDefined();
  });

  it('returns no badges when new set does not beat any record', () => {
    const priorSets = [setBuilder().weight(150).repCount(10).build()];
    const snapshot = buildPRSnapshot(priorSets);
    const newSet = setBuilder().weight(100).repCount(5).build();
    expect(detectPRs(newSet, snapshot)).toHaveLength(0);
  });
});
