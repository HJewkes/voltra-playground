/**
 * Recording Controller
 *
 * Handles recording lifecycle: start, stop, reset.
 *
 * A "recording" is a period when the Voltra device is actively streaming
 * telemetry data. This typically corresponds to a single set during a workout.
 */

import type { BLEAdapter } from '@/domain/bluetooth/adapters';
import { Workout } from '@/domain/voltra/protocol/constants';
import { delay } from '@/domain/shared';
import { type VoltraDevice, type VoltraRecordingState } from '@/domain/voltra/models/device';
import { type TelemetryController } from '@/domain/voltra/controllers/telemetry-controller';

/**
 * Recording event types.
 *
 * Note: WorkoutStats computation has moved to recording-store.
 * RecordingController now only reports duration on stop.
 */
export type RecordingEvent =
  | { type: 'stateChanged'; state: VoltraRecordingState }
  | { type: 'started' }
  | { type: 'stopped'; duration: number }
  | { type: 'error'; error: string };

/**
 * Recording event listener.
 */
export type RecordingEventListener = (event: RecordingEvent) => void;

/**
 * Delay after PREPARE command.
 */
const PREP_DELAY_MS = 200;

/**
 * Delay after SETUP command before GO.
 * Needs to be longer than init delay to allow device to prepare.
 */
const SETUP_DELAY_MS = 300;

/**
 * Controller for recording lifecycle.
 */
export class RecordingController {
  private _listeners: Set<RecordingEventListener> = new Set();

  constructor(
    private device: VoltraDevice,
    private adapter: BLEAdapter | null,
    private telemetryController: TelemetryController
  ) {}

  /**
   * Update the BLE adapter (used when connection changes).
   */
  setAdapter(adapter: BLEAdapter | null): void {
    this.adapter = adapter;
  }

  /**
   * Get current recording state.
   */
  get state(): VoltraRecordingState {
    return this.device.recordingState;
  }

  /**
   * Check if recording is active.
   */
  get isActive(): boolean {
    return this.device.isRecording;
  }

  /**
   * Subscribe to recording events.
   */
  subscribe(listener: RecordingEventListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private emit(event: RecordingEvent): void {
    this._listeners.forEach((listener) => listener(event));
  }

  private setState(state: VoltraRecordingState): void {
    this.device.setRecordingState(state);
    this.emit({ type: 'stateChanged', state });
  }

  /**
   * Prepare the device for workout mode.
   * Sends PREPARE + SETUP commands but does NOT engage the motor.
   * Call this when starting a session, before the countdown.
   */
  async prepare(): Promise<void> {
    if (!this.adapter) {
      this.device.setError('Not connected');
      this.emit({ type: 'error', error: 'Not connected' });
      return;
    }

    this.device.clearError();
    this.setState('preparing');

    try {
      // Reset telemetry state
      this.telemetryController.reset();
      this.telemetryController.setWeight(this.device.weight);

      // Send workout preparation commands (but NOT GO)
      console.log('[RecordingController] Sending PREPARE');
      await this.adapter.write(Workout.PREPARE);
      await delay(PREP_DELAY_MS);

      console.log('[RecordingController] Sending SETUP');
      await this.adapter.write(Workout.SETUP);
      await delay(SETUP_DELAY_MS);

      console.log('[RecordingController] Device ready (motor not engaged)');
      this.setState('ready');
    } catch (e: unknown) {
      this.setState('idle');
      const error = `Failed to prepare: ${e instanceof Error ? e.message : String(e)}`;
      this.device.setError(error);
      this.emit({ type: 'error', error });
    }
  }

  /**
   * Engage the motor to start recording.
   * Call this at the end of countdown to begin the set.
   * Device must be in 'ready' state (call prepare() first).
   */
  async engage(): Promise<void> {
    if (!this.adapter) {
      this.device.setError('Not connected');
      this.emit({ type: 'error', error: 'Not connected' });
      return;
    }

    // Can engage from 'ready' state or re-engage from 'idle' after a set
    const state = this.device.recordingState;
    if (state !== 'ready' && state !== 'idle') {
      console.warn(`[RecordingController] Cannot engage from state: ${state}`);
      return;
    }

    try {
      console.log('[RecordingController] Sending GO (engaging motor)');
      await this.adapter.write(Workout.GO);

      console.log('[RecordingController] Recording active');
      this.setState('active');
      this.emit({ type: 'started' });
    } catch (e: unknown) {
      const error = `Failed to engage: ${e instanceof Error ? e.message : String(e)}`;
      this.device.setError(error);
      this.emit({ type: 'error', error });
    }
  }

  /**
   * Disengage the motor at the end of a set.
   * Device stays in workout mode for the next set.
   */
  async disengage(): Promise<void> {
    if (!this.adapter) {
      this.device.setError('Not connected');
      return;
    }

    try {
      console.log('[RecordingController] Sending STOP (disengaging motor)');
      await this.adapter.write(Workout.STOP);

      // Stay in 'ready' state for next set (not 'idle')
      this.setState('ready');
    } catch (e: unknown) {
      console.warn('[RecordingController] Error disengaging:', e);
    }
  }

  /**
   * Start a recording (combines prepare + engage).
   * @deprecated Use prepare() then engage() for better UX control.
   */
  async start(): Promise<void> {
    await this.prepare();
    if (this.device.recordingState === 'ready') {
      await this.engage();
    }
  }

  /**
   * Stop the recording and end the workout session.
   * Use this when completely done with workout (exits workout mode).
   *
   * @returns Recording duration in seconds
   */
  async stop(): Promise<number> {
    const duration = this.telemetryController.endRecording();

    if (!this.adapter) {
      this.device.setError('Not connected');
      this.setState('idle');
      this.emit({ type: 'stopped', duration });
      return duration;
    }

    this.setState('stopping');

    try {
      console.log('[RecordingController] Sending STOP (ending workout)');
      await this.adapter.write(Workout.STOP);
    } catch (e) {
      console.warn('Error stopping recording:', e);
    }

    this.setState('idle');
    this.emit({ type: 'stopped', duration });

    return duration;
  }

  /**
   * End the current set (disengage motor) but stay in workout mode.
   * Use this between sets when there are more sets to do.
   *
   * @returns Recording duration in seconds
   */
  async endSet(): Promise<number> {
    const duration = this.telemetryController.endRecording();

    await this.disengage();
    this.emit({ type: 'stopped', duration });

    return duration;
  }

  /**
   * Reset recording state.
   */
  reset(): void {
    this.telemetryController.reset();
    this.setState('idle');
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    this._listeners.clear();
  }
}
