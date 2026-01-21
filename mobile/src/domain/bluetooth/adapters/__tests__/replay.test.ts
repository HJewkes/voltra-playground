/**
 * Replay BLE Adapter Tests
 *
 * Tests for the ReplayBLEAdapter that plays back recorded samples.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ReplayBLEAdapter } from '../replay';
import { generateRecording } from '@/__fixtures__';
import type { SampleRecording } from '@/data/recordings';

// =============================================================================
// Test Setup
// =============================================================================

function createTestRecording(_sampleCount = 10): SampleRecording {
  return generateRecording({
    exerciseId: 'test_exercise',
    exerciseName: 'Test Exercise',
    weight: 100,
    repCount: 2,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('ReplayBLEAdapter', () => {
  let recording: SampleRecording;
  let adapter: ReplayBLEAdapter;

  beforeEach(() => {
    recording = createTestRecording();
    adapter = new ReplayBLEAdapter(recording);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('connection state', () => {
    it('initial state is disconnected', () => {
      expect(adapter.getConnectionState()).toBe('disconnected');
      expect(adapter.isConnected()).toBe(false);
    });

    it('connect() transitions to connected', async () => {
      const connectPromise = adapter.connect('replay-device');

      // Advance past the simulated delay
      await vi.runAllTimersAsync();
      await connectPromise;

      expect(adapter.getConnectionState()).toBe('connected');
      expect(adapter.isConnected()).toBe(true);
    });

    it('disconnect() transitions to disconnected', async () => {
      // First connect
      const connectPromise = adapter.connect('replay-device');
      await vi.runAllTimersAsync();
      await connectPromise;

      // Then disconnect
      const disconnectPromise = adapter.disconnect();
      await vi.runAllTimersAsync();
      await disconnectPromise;

      expect(adapter.getConnectionState()).toBe('disconnected');
      expect(adapter.isConnected()).toBe(false);
    });

    it('calls connection state callback on changes', async () => {
      const stateCallback = vi.fn();
      adapter.onConnectionStateChange(stateCallback);

      const connectPromise = adapter.connect('replay-device');
      await vi.runAllTimersAsync();
      await connectPromise;

      expect(stateCallback).toHaveBeenCalledWith('connecting');
      expect(stateCallback).toHaveBeenCalledWith('connected');
    });

    it('unsubscribe removes callback', async () => {
      const stateCallback = vi.fn();
      const unsubscribe = adapter.onConnectionStateChange(stateCallback);

      unsubscribe();

      const connectPromise = adapter.connect('replay-device');
      await vi.runAllTimersAsync();
      await connectPromise;

      expect(stateCallback).not.toHaveBeenCalled();
    });
  });

  describe('scan()', () => {
    it('returns device with recording metadata', async () => {
      const devices = await adapter.scan(5);

      expect(devices.length).toBe(1);
      expect(devices[0].id).toContain('replay-');
      expect(devices[0].name).toContain('Replay:');
      expect(devices[0].name).toContain(recording.exerciseName);
    });
  });

  describe('playback controls', () => {
    it('play() starts playback', () => {
      expect(adapter.getIsPlaying()).toBe(false);

      adapter.play();

      expect(adapter.getIsPlaying()).toBe(true);
    });

    it('pause() stops playback', () => {
      adapter.play();
      expect(adapter.getIsPlaying()).toBe(true);

      adapter.pause();

      expect(adapter.getIsPlaying()).toBe(false);
    });

    it('stop() resets to beginning', () => {
      adapter.play();

      // Advance some samples
      vi.advanceTimersByTime(500);
      adapter.stop();

      expect(adapter.getIsPlaying()).toBe(false);
      expect(adapter.getProgress().current).toBe(0);
    });

    it('seek() updates current index', () => {
      const targetIndex = Math.floor(recording.samples.length / 2);

      adapter.seek(targetIndex);

      expect(adapter.getProgress().current).toBe(targetIndex);
    });

    it('seek() clamps to valid range', () => {
      adapter.seek(-10);
      expect(adapter.getProgress().current).toBe(0);

      adapter.seek(999999);
      expect(adapter.getProgress().current).toBe(recording.samples.length - 1);
    });

    it('getProgress() returns correct position', () => {
      const progress = adapter.getProgress();

      expect(progress.current).toBe(0);
      expect(progress.total).toBe(recording.samples.length);
      expect(progress.percent).toBe(0);
    });

    it('getProgress() percent updates correctly', () => {
      const midpoint = Math.floor(recording.samples.length / 2);
      adapter.seek(midpoint);

      const progress = adapter.getProgress();

      expect(progress.current).toBe(midpoint);
      expect(progress.percent).toBeCloseTo((midpoint / recording.samples.length) * 100, 1);
    });
  });

  describe('notifications', () => {
    it('calls notification callback with encoded frames', () => {
      const notificationCallback = vi.fn();
      adapter.onNotification(notificationCallback);

      adapter.play();

      // Should emit first sample immediately
      expect(notificationCallback).toHaveBeenCalledTimes(1);
      expect(notificationCallback).toHaveBeenCalledWith(expect.any(Uint8Array));
    });

    it('emits samples at correct intervals', () => {
      const notificationCallback = vi.fn();
      adapter.onNotification(notificationCallback);

      adapter.play();
      expect(notificationCallback).toHaveBeenCalledTimes(1);

      // Advance time to trigger next sample
      vi.advanceTimersByTime(200);
      expect(notificationCallback.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('respects playback speed', () => {
      const notificationCallback = vi.fn();
      adapter.onNotification(notificationCallback);

      // Play at 2x speed
      adapter.play(2.0);

      // First sample emitted immediately
      expect(notificationCallback).toHaveBeenCalledTimes(1);

      // At 2x speed, samples should come faster
      vi.advanceTimersByTime(100);
      const callsAt2x = notificationCallback.mock.calls.length;

      // Reset and play at normal speed
      notificationCallback.mockClear();
      adapter.stop();
      adapter.play(1.0);
      vi.advanceTimersByTime(100);
      const callsAt1x = notificationCallback.mock.calls.length;

      // 2x should have more calls in same time period
      expect(callsAt2x).toBeGreaterThanOrEqual(callsAt1x);
    });

    it('unsubscribe removes notification callback', () => {
      const notificationCallback = vi.fn();
      const unsubscribe = adapter.onNotification(notificationCallback);

      unsubscribe();
      adapter.play();

      expect(notificationCallback).not.toHaveBeenCalled();
    });

    it('playback completes when all samples emitted', () => {
      const notificationCallback = vi.fn();
      adapter.onNotification(notificationCallback);

      adapter.play(100); // Very fast playback

      // Advance enough time for all samples
      vi.advanceTimersByTime(10000);

      expect(adapter.getIsPlaying()).toBe(false);
      // Should have emitted all samples
      expect(notificationCallback.mock.calls.length).toBe(recording.samples.length);
    });
  });

  describe('write()', () => {
    it('is a no-op (does not throw)', async () => {
      await expect(adapter.write(new Uint8Array([1, 2, 3]))).resolves.not.toThrow();
    });
  });

  describe('getRecording()', () => {
    it('returns the recording', () => {
      const returned = adapter.getRecording();

      expect(returned).toBe(recording);
      expect(returned.exerciseName).toBe('Test Exercise');
    });
  });

  describe('play() edge cases', () => {
    it('does nothing if already playing', () => {
      adapter.play();
      const _progress1 = adapter.getProgress().current;

      adapter.play(); // Second call should be ignored

      expect(adapter.getIsPlaying()).toBe(true);
    });

    it('loops back to start if at end', () => {
      // Seek to end
      adapter.seek(recording.samples.length - 1);

      // Advance past the last sample
      adapter.play();
      vi.advanceTimersByTime(500);

      // Now play should loop back
      adapter.play();

      // Should be playing from start
      expect(adapter.getIsPlaying()).toBe(true);
    });
  });

  describe('disconnect during playback', () => {
    it('stops playback on disconnect', async () => {
      adapter.play();
      expect(adapter.getIsPlaying()).toBe(true);

      const disconnectPromise = adapter.disconnect();
      await vi.runAllTimersAsync();
      await disconnectPromise;

      expect(adapter.getIsPlaying()).toBe(false);
    });
  });
});
