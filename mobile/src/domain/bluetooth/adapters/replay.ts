/**
 * ReplayBLEAdapter
 *
 * A BLE adapter implementation that plays back recorded WorkoutSamples,
 * enabling replay-based development and testing without a physical device.
 *
 * Converts WorkoutSamples back to TelemetryFrames and sends them through
 * the standard notification callback at appropriate timing intervals.
 */

import { BaseBLEAdapter } from './base';
import type { Device, ConnectOptions } from './types';
import type { SampleRecording } from '@/data/recordings';
import type { WorkoutSample } from '@/domain/workout';
import type { TelemetryFrame } from '@/domain/voltra/models/telemetry';
import { encodeTelemetryFrame } from '@/domain/voltra/protocol/telemetry-decoder';

/** Voltra position range for denormalization */
const VOLTRA_MAX_POSITION = 600;

/**
 * Reconstruct a TelemetryFrame from a WorkoutSample.
 * Reverses the transformation in sample-adapter.ts.
 */
function toTelemetryFrame(sample: WorkoutSample): TelemetryFrame {
  return {
    sequence: sample.sequence,
    phase: sample.phase, // MovementPhase values are aligned
    position: Math.round(sample.position * VOLTRA_MAX_POSITION),
    force: sample.force, // WorkoutSample stores absolute force
    velocity: sample.velocity,
    timestamp: sample.timestamp,
  };
}

/**
 * ReplayBLEAdapter - plays back recorded samples as if from a real device.
 */
export class ReplayBLEAdapter extends BaseBLEAdapter {
  private recording: SampleRecording;

  // Playback state
  private isPlaying = false;
  private playbackSpeed = 1.0;
  private currentIndex = 0;
  private playbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(recording: SampleRecording) {
    super();
    this.recording = recording;
  }

  /**
   * Scan returns a fake device representing the recording.
   */
  async scan(_timeout: number): Promise<Device[]> {
    return [
      {
        id: `replay-${this.recording.id}`,
        name: `Replay: ${this.recording.exerciseName}`,
        rssi: -50,
      },
    ];
  }

  /**
   * Connect sets state to connected.
   */
  async connect(_deviceId: string, _options?: ConnectOptions): Promise<void> {
    this.setConnectionState('connecting');
    // Simulate brief connection delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.setConnectionState('connected');
  }

  /**
   * Disconnect stops playback and sets state.
   */
  async disconnect(): Promise<void> {
    this.stop();
    this.setConnectionState('disconnecting');
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.setConnectionState('disconnected');
  }

  /**
   * Write is a no-op for replay (commands ignored).
   */
  async write(_data: Uint8Array): Promise<void> {
    // Commands are ignored during replay
  }

  // ==========================================================================
  // Replay-specific methods
  // ==========================================================================

  /**
   * Start playback from current position.
   * @param speed Playback speed multiplier (1.0 = realtime, 2.0 = 2x speed)
   */
  play(speed = 1.0): void {
    if (this.isPlaying) return;
    if (this.currentIndex >= this.recording.samples.length) {
      this.currentIndex = 0; // Loop back to start
    }

    this.isPlaying = true;
    this.playbackSpeed = speed;
    this.scheduleNextSample();
  }

  /**
   * Pause playback.
   */
  pause(): void {
    this.isPlaying = false;
    if (this.playbackTimeoutId) {
      clearTimeout(this.playbackTimeoutId);
      this.playbackTimeoutId = null;
    }
  }

  /**
   * Stop playback and reset to beginning.
   */
  stop(): void {
    this.pause();
    this.currentIndex = 0;
  }

  /**
   * Seek to a specific sample index.
   */
  seek(sampleIndex: number): void {
    this.currentIndex = Math.max(0, Math.min(sampleIndex, this.recording.samples.length - 1));
  }

  /**
   * Get current playback progress.
   */
  getProgress(): { current: number; total: number; percent: number } {
    const total = this.recording.samples.length;
    return {
      current: this.currentIndex,
      total,
      percent: total > 0 ? (this.currentIndex / total) * 100 : 0,
    };
  }

  /**
   * Check if currently playing.
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the recording being played.
   */
  getRecording(): SampleRecording {
    return this.recording;
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private scheduleNextSample(): void {
    if (!this.isPlaying) return;
    if (this.currentIndex >= this.recording.samples.length) {
      // Playback complete
      this.isPlaying = false;
      return;
    }

    const sample = this.recording.samples[this.currentIndex];
    this.emitSample(sample);
    this.currentIndex++;

    // Calculate delay to next sample
    if (this.currentIndex < this.recording.samples.length) {
      const nextSample = this.recording.samples[this.currentIndex];
      const deltaMs = nextSample.timestamp - sample.timestamp;
      const adjustedDelay = Math.max(1, deltaMs / this.playbackSpeed);

      this.playbackTimeoutId = setTimeout(() => {
        this.scheduleNextSample();
      }, adjustedDelay);
    } else {
      this.isPlaying = false;
    }
  }

  private emitSample(sample: WorkoutSample): void {
    // Reconstruct TelemetryFrame and encode as BLE notification
    const frame = toTelemetryFrame(sample);
    const encoded = encodeTelemetryFrame(frame);
    this.emitNotification(encoded);
  }
}
