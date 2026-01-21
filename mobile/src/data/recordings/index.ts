/**
 * Recordings Data Module
 *
 * Storage and management of sample recordings for replay.
 */

// Schema
export type { SampleRecording, RecordingMetadata } from './recording-schema';

// Repository
export type { RecordingRepository } from './recording-repository';
export { RecordingRepositoryImpl, createRecordingRepository } from './recording-repository';
