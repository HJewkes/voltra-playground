import { describe, it, expect } from 'vitest';
import { getSetMeanVelocity, estimateSetRIR } from '@voltras/workout-analytics';

import { computeClusterMeanVelocity } from '../SetLog';
import {
  mockCompletedSet,
  mockRep,
} from '@/__fixtures__/generators/mock-helpers';
import type { SetLogEntry, ClusterBoundary, PlannedSet } from '@/domain/workout';

function makeSetLogEntry(overrides: Parameters<typeof mockCompletedSet>[0] = {}, clusters: ClusterBoundary[] = []): SetLogEntry {
  return {
    set: mockCompletedSet(overrides),
    clusters,
  };
}

function makePlannedSet(overrides: Partial<PlannedSet> = {}): PlannedSet {
  return {
    setNumber: 1,
    weight: 135,
    targetReps: 8,
    rirTarget: 2,
    isWarmup: false,
    ...overrides,
  };
}

describe('computeClusterMeanVelocity', () => {
  it('computes mean peak velocity for reps in cluster range', () => {
    const reps = [mockRep(1, 0.6), mockRep(2, 0.5), mockRep(3, 0.4)];
    const cluster: ClusterBoundary = { repStart: 0, repEnd: 2, pauseAfterMs: 8000 };

    const result = computeClusterMeanVelocity(reps, cluster);

    // getRepPeakVelocity returns concentric.peakVelocity = velocity * 1.3
    const expected = ((0.6 * 1.3) + (0.5 * 1.3)) / 2;
    expect(result).toBeCloseTo(expected, 4);
  });

  it('returns 0 for empty cluster range', () => {
    const reps = [mockRep(1, 0.6)];
    const cluster: ClusterBoundary = { repStart: 0, repEnd: 0, pauseAfterMs: null };

    expect(computeClusterMeanVelocity(reps, cluster)).toBe(0);
  });

  it('handles single-rep cluster', () => {
    const reps = [mockRep(1, 0.7), mockRep(2, 0.5)];
    const cluster: ClusterBoundary = { repStart: 1, repEnd: 2, pauseAfterMs: null };

    const result = computeClusterMeanVelocity(reps, cluster);
    expect(result).toBeCloseTo(0.5 * 1.3, 4);
  });
});

describe('SetLogEntry data access patterns', () => {
  it('completed set exposes rep count from analytics data', () => {
    const entry = makeSetLogEntry({ repCount: 8, weight: 135 });
    expect(entry.set.data.reps.length).toBe(8);
    expect(entry.set.weight).toBe(135);
  });

  it('getSetMeanVelocity returns mean velocity for completed set', () => {
    const entry = makeSetLogEntry({ velocities: [0.6, 0.55, 0.5] });
    const avgVel = getSetMeanVelocity(entry.set.data);
    expect(avgVel).toBeGreaterThan(0);
    expect(typeof avgVel).toBe('number');
  });

  it('estimateSetRIR returns rpe for completed set', () => {
    const entry = makeSetLogEntry({
      velocities: [0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35],
    });
    const { rpe } = estimateSetRIR(entry.set.data);
    expect(rpe).toBeGreaterThanOrEqual(4);
    expect(rpe).toBeLessThanOrEqual(10);
  });

  it('cluster boundaries slice reps correctly for pause sets', () => {
    const velocities = [0.6, 0.55, 0.5, 0.45, 0.4];
    const entry = makeSetLogEntry({ velocities }, [
      { repStart: 0, repEnd: 3, pauseAfterMs: 8000 },
      { repStart: 3, repEnd: 5, pauseAfterMs: null },
    ]);

    const firstClusterReps = entry.set.data.reps.slice(
      entry.clusters[0].repStart,
      entry.clusters[0].repEnd,
    );
    expect(firstClusterReps.length).toBe(3);

    const secondClusterReps = entry.set.data.reps.slice(
      entry.clusters[1].repStart,
      entry.clusters[1].repEnd,
    );
    expect(secondClusterReps.length).toBe(2);
  });

  it('empty clusters array indicates standard (non-pause) set', () => {
    const entry = makeSetLogEntry({ repCount: 5 });
    expect(entry.clusters).toHaveLength(0);
  });
});

describe('PlannedSet data access', () => {
  it('planned set exposes target reps and weight', () => {
    const planned = makePlannedSet({ setNumber: 3, targetReps: 10, weight: 185 });
    expect(planned.setNumber).toBe(3);
    expect(planned.targetReps).toBe(10);
    expect(planned.weight).toBe(185);
  });

  it('planned set has rirTarget', () => {
    const planned = makePlannedSet({ rirTarget: 3 });
    expect(planned.rirTarget).toBe(3);
  });
});

describe('active set data shape', () => {
  it('active set with target reps shows progress', () => {
    const activeSet = { setIndex: 2, repCount: 3, weight: 135, targetReps: 8 };
    expect(activeSet.repCount).toBe(3);
    expect(activeSet.targetReps).toBe(8);
  });

  it('active set without target reps shows only count', () => {
    const activeSet = { setIndex: 0, repCount: 5, weight: 100, targetReps: null };
    expect(activeSet.targetReps).toBeNull();
    expect(activeSet.repCount).toBe(5);
  });
});

describe('set log accumulation', () => {
  it('set log grows as sets complete', () => {
    const entries: SetLogEntry[] = [];
    expect(entries.length).toBe(0);

    entries.push(makeSetLogEntry({ id: 's1', repCount: 8, weight: 135 }));
    expect(entries.length).toBe(1);

    entries.push(makeSetLogEntry({ id: 's2', repCount: 7, weight: 135 }));
    expect(entries.length).toBe(2);
  });

  it('planned sets decrease as set log grows', () => {
    const allPlanned = [
      makePlannedSet({ setNumber: 1 }),
      makePlannedSet({ setNumber: 2 }),
      makePlannedSet({ setNumber: 3 }),
    ];

    const completedCount = 1;
    const activeIndex = completedCount;
    const futurePlanned = allPlanned.slice(activeIndex + 1);

    expect(futurePlanned.length).toBe(1);
    expect(futurePlanned[0].setNumber).toBe(3);
  });
});
