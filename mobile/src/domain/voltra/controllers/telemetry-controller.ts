/**
 * Telemetry Controller
 *
 * Manages telemetry processing during recordings:
 * - Decodes BLE notifications using protocol decoder
 * - Emits raw frame events for consumers
 * - Handles recording lifecycle (start/stop)
 *
 * Note: Rep detection and analytics computation have been moved to
 * the recording-store, which uses workout domain's RepDetector and aggregators.
 */

import { decodeNotification, type DecodeResult } from '@/domain/voltra/protocol/telemetry-decoder';
import {
  type TelemetryFrame,
  type TelemetryState,
  createTelemetryState,
  RECENT_FRAMES_WINDOW,
} from '@/domain/voltra/models/telemetry';

// =============================================================================
// Event Types
// =============================================================================

/**
 * Telemetry event types.
 *
 * Simplified to only emit raw device data - consumers handle analytics.
 */
export type TelemetryEvent =
  | { type: 'frame'; frame: TelemetryFrame }
  | { type: 'recordingStarted' }
  | { type: 'recordingEnded'; duration: number };

/**
 * Telemetry event listener.
 */
export type TelemetryEventListener = (event: TelemetryEvent) => void;

// =============================================================================
// Controller
// =============================================================================

/**
 * Controller for telemetry processing during recordings.
 *
 * Responsibilities:
 * - Decode BLE notifications to TelemetryFrames
 * - Track current frame and recent frames for UI
 * - Emit raw frame events
 * - Handle recording lifecycle
 *
 * NOT responsible for (moved to recording-store):
 * - Rep detection
 * - Phase/rep/set aggregation
 * - Analytics computation
 */
export class TelemetryController {
  // State
  private _state: TelemetryState;

  // Recording tracking
  private _startTime: number | null = null;
  private _weightLbs: number | null = null;
  private _isRecording = false;

  // Event listeners
  private _listeners: Set<TelemetryEventListener> = new Set();

  constructor() {
    this._state = createTelemetryState();
  }

  // ===========================================================================
  // Public Getters
  // ===========================================================================

  /**
   * Get current telemetry state (for UI).
   */
  get state(): TelemetryState {
    return { ...this._state };
  }

  /**
   * Get current frame.
   */
  get currentFrame(): TelemetryFrame | null {
    return this._state.currentFrame;
  }

  /**
   * Get recent frames for charts.
   */
  get recentFrames(): TelemetryFrame[] {
    return [...this._state.recentFrames];
  }

  /**
   * Check if currently recording.
   */
  get isRecording(): boolean {
    return this._isRecording;
  }

  /**
   * Get recording start time.
   */
  get startTime(): number | null {
    return this._startTime;
  }

  /**
   * Get configured weight.
   */
  get weightLbs(): number | null {
    return this._weightLbs;
  }

  // ===========================================================================
  // Event Subscription
  // ===========================================================================

  /**
   * Subscribe to telemetry events.
   */
  subscribe(listener: TelemetryEventListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private emit(event: TelemetryEvent): void {
    this._listeners.forEach((listener) => listener(event));
  }

  // ===========================================================================
  // Recording Lifecycle
  // ===========================================================================

  /**
   * Set weight for the recording.
   */
  setWeight(lbs: number): void {
    this._weightLbs = lbs;
  }

  /**
   * Start a new recording session.
   */
  startRecording(): void {
    this.reset();
    this._startTime = Date.now();
    this._isRecording = true;
    this.emit({ type: 'recordingStarted' });
  }

  /**
   * End the current recording session.
   *
   * @returns Recording duration in seconds
   */
  endRecording(): number {
    const endTime = Date.now();
    const duration = this._startTime ? (endTime - this._startTime) / 1000 : 0;

    this._isRecording = false;
    this.emit({ type: 'recordingEnded', duration });

    return duration;
  }

  // ===========================================================================
  // Notification Processing
  // ===========================================================================

  /**
   * Process a BLE notification.
   *
   * This is the main entry point for telemetry data.
   * Decodes the notification and emits frame events.
   */
  processNotification(data: Uint8Array): DecodeResult {
    const result = decodeNotification(data);
    if (!result) return null;

    // Track start time on first frame
    if (this._startTime === null && result.type === 'frame') {
      this._startTime = Date.now();
    }

    switch (result.type) {
      case 'frame':
        this.handleFrame(result.frame);
        break;

      case 'rep_boundary':
        // Device-level signal - consumers can listen for this
        // Rep detection is now handled by recording-store
        break;

      case 'set_boundary':
        // Device-level signal for set completion
        break;
    }

    return result;
  }

  // ===========================================================================
  // Frame Handling
  // ===========================================================================

  private handleFrame(frame: TelemetryFrame): void {
    // Update state with new frame
    const recentFrames = [...this._state.recentFrames, frame].slice(-RECENT_FRAMES_WINDOW);

    this._state = {
      ...this._state,
      currentFrame: frame,
      recentFrames,
    };

    // Emit frame event - consumers handle rep detection and analytics
    this.emit({ type: 'frame', frame });
  }

  // ===========================================================================
  // Reset
  // ===========================================================================

  /**
   * Reset telemetry state.
   */
  reset(): void {
    this._state = createTelemetryState();
    this._startTime = null;
    this._isRecording = false;
    // Keep weight setting across resets
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    this._listeners.clear();
    this.reset();
  }
}
