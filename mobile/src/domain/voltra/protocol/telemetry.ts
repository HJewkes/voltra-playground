/**
 * Telemetry Protocol - Re-exports
 * 
 * Re-exports types and decoder from the models and decoder modules.
 */

// Re-export types from models
export type {
  TelemetryFrame,
  WorkoutStats,
} from '@/domain/voltra/models/telemetry';

// Re-export computation functions
export { computeWorkoutStats } from '@/domain/voltra/models/telemetry';

// Re-export decoder and encoder
export { 
  decodeNotification, 
  decodeTelemetryFrame,
  encodeTelemetryFrame,
  identifyMessageType,
  type DecodeResult,
  type MessageType,
} from '@/domain/voltra/protocol/telemetry-decoder';
