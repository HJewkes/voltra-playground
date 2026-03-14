/**
 * TelemetryRingBuffer unit tests.
 *
 * Covers: push, wrap-around, getAll ordering, clear, version tracking, capacity.
 */

import { describe, it, expect } from 'vitest';
import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';
import { TelemetryRingBuffer } from '../telemetry-ring-buffer';

function makeSample(seq: number): WorkoutSample {
  return {
    sequence: seq,
    timestamp: 1000 + seq * 50,
    phase: MovementPhase.CONCENTRIC,
    position: 0.5,
    velocity: 0.5,
    force: 100,
  };
}

describe('TelemetryRingBuffer', () => {
  it('starts empty', () => {
    const buf = new TelemetryRingBuffer(10);
    expect(buf.length).toBe(0);
    expect(buf.getAll()).toEqual([]);
    expect(buf.getVersion()).toBe(0);
  });

  it('stores samples up to capacity', () => {
    const buf = new TelemetryRingBuffer(5);
    for (let i = 0; i < 5; i++) {
      buf.push(makeSample(i));
    }
    expect(buf.length).toBe(5);
    expect(buf.getAll()).toHaveLength(5);
    expect(buf.getAll().map((s) => s.sequence)).toEqual([0, 1, 2, 3, 4]);
  });

  it('wraps around and overwrites oldest samples', () => {
    const buf = new TelemetryRingBuffer(3);
    for (let i = 0; i < 5; i++) {
      buf.push(makeSample(i));
    }
    expect(buf.length).toBe(3);
    expect(buf.getAll().map((s) => s.sequence)).toEqual([2, 3, 4]);
  });

  it('returns samples in insertion order after wrap-around', () => {
    const buf = new TelemetryRingBuffer(4);
    for (let i = 0; i < 7; i++) {
      buf.push(makeSample(i));
    }
    const sequences = buf.getAll().map((s) => s.sequence);
    expect(sequences).toEqual([3, 4, 5, 6]);
  });

  it('increments version on every push', () => {
    const buf = new TelemetryRingBuffer(10);
    expect(buf.getVersion()).toBe(0);

    buf.push(makeSample(0));
    expect(buf.getVersion()).toBe(1);

    buf.push(makeSample(1));
    expect(buf.getVersion()).toBe(2);
  });

  it('increments version on clear', () => {
    const buf = new TelemetryRingBuffer(10);
    buf.push(makeSample(0));
    const versionBeforeClear = buf.getVersion();

    buf.clear();
    expect(buf.getVersion()).toBe(versionBeforeClear + 1);
  });

  it('clears all data', () => {
    const buf = new TelemetryRingBuffer(5);
    for (let i = 0; i < 3; i++) {
      buf.push(makeSample(i));
    }

    buf.clear();
    expect(buf.length).toBe(0);
    expect(buf.getAll()).toEqual([]);
  });

  it('works correctly after clear and re-fill', () => {
    const buf = new TelemetryRingBuffer(3);
    for (let i = 0; i < 3; i++) {
      buf.push(makeSample(i));
    }

    buf.clear();

    for (let i = 10; i < 12; i++) {
      buf.push(makeSample(i));
    }

    expect(buf.length).toBe(2);
    expect(buf.getAll().map((s) => s.sequence)).toEqual([10, 11]);
  });

  it('uses default capacity of 500', () => {
    const buf = new TelemetryRingBuffer();
    expect(buf.capacity).toBe(500);
  });

  it('respects custom capacity', () => {
    const buf = new TelemetryRingBuffer(100);
    expect(buf.capacity).toBe(100);
  });

  it('handles single-element capacity', () => {
    const buf = new TelemetryRingBuffer(1);
    buf.push(makeSample(0));
    buf.push(makeSample(1));

    expect(buf.length).toBe(1);
    expect(buf.getAll().map((s) => s.sequence)).toEqual([1]);
  });

  it('getAll returns a new array each time', () => {
    const buf = new TelemetryRingBuffer(5);
    buf.push(makeSample(0));

    const a = buf.getAll();
    const b = buf.getAll();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
