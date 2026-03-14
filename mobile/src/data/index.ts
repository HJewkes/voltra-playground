/**
 * Data Layer
 *
 * Entity-based storage modules for data persistence.
 */

// Centralized data provider (singleton access)
export * from './provider';

// Exercise session data (unified storage for all sessions)
export * from './exercise-session';

// Preferences data (device and connection settings)
export * from './preferences';

// Velocity profile data (load-velocity profiles per exercise)
export * from './velocity-profile';

// Manual log data (free weight set logging)
export * from './manual-log';

// Workout plan data (coach-programmed plans)
export * from './workout-plan';

// Storage adapters
export * from './adapters';
