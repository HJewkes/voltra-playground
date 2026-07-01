/**
 * SQLite schema for exercise session storage.
 *
 * Three tables mirror the stored session structure:
 * - exercise_sessions: session metadata (indexed on exercise_id, start_time, status)
 * - session_sets:      per-set summary metrics
 * - telemetry_samples: raw ~11Hz workout samples (partial reads / crash recovery)
 *
 * A key/value meta table tracks the current in-progress session and the
 * one-time AsyncStorage migration flag.
 */

export const SESSION_DB_NAME = 'voltra-sessions.sqlite';

/** Meta key for the current in-progress session id. */
export const META_CURRENT_SESSION = 'current_session_id';

/** Meta key marking the AsyncStorage->SQLite migration as complete. */
export const META_ASYNC_MIGRATION_DONE = 'async_storage_migrated';

/** Phase discriminator used in telemetry_samples. */
export const RAW_REP_NUMBER = -1;
export const PHASE_RAW = 'raw';
export const PHASE_CONCENTRIC = 'concentric';
export const PHASE_ECCENTRIC = 'eccentric';

/** DDL statements, executed individually and idempotently on init. */
export const SESSION_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS exercise_sessions (
    id TEXT PRIMARY KEY,
    exercise_id TEXT NOT NULL,
    exercise_name TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    status TEXT NOT NULL,
    generated_by TEXT NOT NULL,
    termination_reason TEXT,
    schema_version INTEGER,
    notes TEXT,
    plan_json TEXT NOT NULL,
    created_order INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_exercise ON exercise_sessions(exercise_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON exercise_sessions(start_time)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_status ON exercise_sessions(status)`,
  `CREATE TABLE IF NOT EXISTS session_sets (
    session_id TEXT NOT NULL,
    set_index INTEGER NOT NULL,
    weight REAL NOT NULL,
    chains REAL,
    eccentric REAL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    mean_velocity REAL NOT NULL,
    estimated_rpe REAL NOT NULL,
    estimated_rir REAL NOT NULL,
    velocity_loss_percent REAL NOT NULL,
    rep_numbers TEXT NOT NULL,
    PRIMARY KEY (session_id, set_index)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sets_session ON session_sets(session_id)`,
  `CREATE TABLE IF NOT EXISTS telemetry_samples (
    session_id TEXT NOT NULL,
    set_index INTEGER NOT NULL,
    rep_number INTEGER NOT NULL,
    phase TEXT NOT NULL,
    sample_index INTEGER NOT NULL,
    sample_json TEXT NOT NULL,
    PRIMARY KEY (session_id, set_index, rep_number, phase, sample_index)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_set ON telemetry_samples(session_id, set_index)`,
  `CREATE TABLE IF NOT EXISTS session_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
];
