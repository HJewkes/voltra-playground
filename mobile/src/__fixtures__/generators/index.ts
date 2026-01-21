/**
 * Fixture Generators
 *
 * Export all generators for testing and development.
 */

// Sample generators
export {
  generateWorkoutSample,
  generateSampleStream,
  resetSequence,
  type GenerateSampleOptions,
  type GenerateStreamOptions,
} from './sample-generator';

// Session generators
export {
  generateStoredSession,
  generateStoredSet,
  type GenerateSessionOptions,
  type GenerateSetOptions,
} from './session-generator';

// Recording generators
export {
  generateRecording,
  type GenerateRecordingOptions,
} from './recording-generator';
