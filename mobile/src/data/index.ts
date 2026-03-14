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

// Storage adapters
export * from './adapters';
