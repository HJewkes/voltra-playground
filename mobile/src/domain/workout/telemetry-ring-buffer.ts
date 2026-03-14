/**
 * TelemetryRingBuffer
 *
 * Fixed-capacity circular buffer for live telemetry samples.
 * Replaces array-spread accumulation (O(n) copy per sample) with O(1) push.
 *
 * Designed to be held as a module-level ref outside Zustand state
 * so that 11Hz sample writes don't trigger React re-renders.
 * Chart consumers poll via getAll() at a throttled 4Hz interval.
 */

import type { WorkoutSample } from '@voltras/workout-analytics';

const DEFAULT_CAPACITY = 500;

export class TelemetryRingBuffer {
  readonly capacity: number;
  private buffer: (WorkoutSample | undefined)[];
  private head = 0;
  private count = 0;
  private version = 0;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(sample: WorkoutSample): void {
    this.buffer[this.head] = sample;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
    this.version++;
  }

  getAll(): WorkoutSample[] {
    if (this.count === 0) return [];

    const result = new Array<WorkoutSample>(this.count);

    if (this.count < this.capacity) {
      for (let i = 0; i < this.count; i++) {
        result[i] = this.buffer[i] as WorkoutSample;
      }
    } else {
      for (let i = 0; i < this.capacity; i++) {
        result[i] = this.buffer[(this.head + i) % this.capacity] as WorkoutSample;
      }
    }

    return result;
  }

  getVersion(): number {
    return this.version;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
    this.version++;
  }

  get length(): number {
    return this.count;
  }
}
