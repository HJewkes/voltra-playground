/**
 * SQLite-backed ExerciseSessionRepository.
 *
 * Persists sessions across three tables (see sqlite-session-schema.ts) using
 * `@op-engineering/op-sqlite`. Provides indexed queries, partial reads (raw
 * telemetry lives in its own table) and crash recovery via durable writes.
 *
 * Contract-compatible with the AsyncStorage-backed repository; a one-time
 * idempotent migration copies existing sessions over on first run.
 */

import { open } from '@op-engineering/op-sqlite';
import type { ExerciseSessionRepository } from './exercise-session-repository';
import type { StoredExerciseSession, ExerciseSessionSummary } from './exercise-session-schema';
import { toExerciseSessionSummary } from './exercise-session-converters';
import {
  rowToSession,
  sessionInsertParams,
  setInsertParams,
  telemetrySampleParams,
  type Row,
  type Scalar,
} from './sqlite-session-mappers';
import {
  META_ASYNC_MIGRATION_DONE,
  META_CURRENT_SESSION,
  SESSION_DB_NAME,
  SESSION_SCHEMA_STATEMENTS,
} from './sqlite-session-schema';

type ExecuteResult = { rows: Row[]; rowsAffected: number; insertId?: number };

/** Narrow slice of the op-sqlite DB surface used by this repository. */
export interface SessionDatabase {
  execute(query: string, params?: Scalar[]): Promise<ExecuteResult>;
  transaction(
    fn: (tx: { execute(query: string, params?: Scalar[]): Promise<ExecuteResult> }) => Promise<void>
  ): Promise<void>;
  close(): void;
}

const INSERT_SESSION = `INSERT INTO exercise_sessions (id, exercise_id, exercise_name, start_time, end_time,
   status, generated_by, termination_reason, schema_version, notes, plan_json, created_order)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_SET = `INSERT INTO session_sets (session_id, set_index, weight, chains, eccentric, start_time,
   end_time, mean_velocity, estimated_rpe, estimated_rir, velocity_loss_percent, rep_numbers)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_TELEMETRY = `INSERT INTO telemetry_samples (session_id, set_index, rep_number, phase, sample_index, sample_json)
   VALUES (?, ?, ?, ?, ?, ?)`;

export class SQLiteExerciseSessionRepository implements ExerciseSessionRepository {
  private initPromise: Promise<void> | null = null;

  constructor(private db: SessionDatabase) {}

  async save(session: StoredExerciseSession): Promise<void> {
    await this.ensureInit();
    const createdOrder = await this.resolveCreatedOrder(session.id);
    await this.db.transaction(async (tx) => {
      await tx.execute('DELETE FROM telemetry_samples WHERE session_id = ?', [session.id]);
      await tx.execute('DELETE FROM session_sets WHERE session_id = ?', [session.id]);
      await tx.execute('DELETE FROM exercise_sessions WHERE id = ?', [session.id]);
      await tx.execute(INSERT_SESSION, sessionInsertParams(session, createdOrder));
      for (const set of session.completedSets) {
        await tx.execute(INSERT_SET, setInsertParams(session.id, set));
        for (const params of telemetrySampleParams(session.id, set)) {
          await tx.execute(INSERT_TELEMETRY, params);
        }
      }
    });
  }

  async getById(id: string): Promise<StoredExerciseSession | null> {
    await this.ensureInit();
    const { rows } = await this.db.execute('SELECT * FROM exercise_sessions WHERE id = ?', [id]);
    return rows.length > 0 ? this.hydrate(rows[0]) : null;
  }

  async getByExercise(exerciseId: string): Promise<StoredExerciseSession[]> {
    return this.querySessions(
      'SELECT * FROM exercise_sessions WHERE exercise_id = ? ORDER BY start_time DESC',
      [exerciseId]
    );
  }

  async getRecent(count: number): Promise<StoredExerciseSession[]> {
    return this.querySessions(
      'SELECT * FROM exercise_sessions ORDER BY created_order DESC LIMIT ?',
      [count]
    );
  }

  async getCurrent(): Promise<StoredExerciseSession | null> {
    const currentId = await this.getMeta(META_CURRENT_SESSION);
    return currentId ? this.getById(currentId) : null;
  }

  async setCurrent(sessionId: string | null): Promise<void> {
    await this.ensureInit();
    if (sessionId === null) {
      await this.db.execute('DELETE FROM session_meta WHERE key = ?', [META_CURRENT_SESSION]);
      return;
    }
    await this.setMeta(META_CURRENT_SESSION, sessionId);
  }

  async delete(id: string): Promise<void> {
    await this.ensureInit();
    await this.db.transaction(async (tx) => {
      await tx.execute('DELETE FROM telemetry_samples WHERE session_id = ?', [id]);
      await tx.execute('DELETE FROM session_sets WHERE session_id = ?', [id]);
      await tx.execute('DELETE FROM exercise_sessions WHERE id = ?', [id]);
    });
    if ((await this.getMeta(META_CURRENT_SESSION)) === id) {
      await this.setCurrent(null);
    }
  }

  async getAllSummaries(): Promise<ExerciseSessionSummary[]> {
    const all = await this.getAll();
    return all.map(toExerciseSessionSummary);
  }

  async getByDateRange(start: Date, end: Date): Promise<StoredExerciseSession[]> {
    return this.querySessions(
      'SELECT * FROM exercise_sessions WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC',
      [start.getTime(), end.getTime()]
    );
  }

  async getDiscoverySessions(exerciseId?: string): Promise<StoredExerciseSession[]> {
    if (exerciseId) {
      return this.querySessions(
        `SELECT * FROM exercise_sessions WHERE generated_by = 'discovery' AND exercise_id = ?
         ORDER BY start_time DESC`,
        [exerciseId]
      );
    }
    return this.querySessions(
      `SELECT * FROM exercise_sessions WHERE generated_by = 'discovery' ORDER BY start_time DESC`,
      []
    );
  }

  async getMostRecentForExercise(exerciseId: string): Promise<StoredExerciseSession | null> {
    const sessions = await this.getByExercise(exerciseId);
    return sessions[0] ?? null;
  }

  async getInProgress(): Promise<StoredExerciseSession | null> {
    const current = await this.getCurrent();
    return current && current.status === 'in_progress' ? current : null;
  }

  /**
   * One-time idempotent migration of sessions from another repository
   * (typically the AsyncStorage-backed one) into SQLite. Returns count copied.
   */
  async migrateFrom(source: ExerciseSessionRepository): Promise<number> {
    await this.ensureInit();
    if (await this.getMeta(META_ASYNC_MIGRATION_DONE)) return 0;

    let migrated = 0;
    for (const summary of await source.getAllSummaries()) {
      const full = await source.getById(summary.id);
      if (full) {
        await this.save(full);
        migrated++;
      }
    }
    const current = await source.getCurrent();
    if (current) await this.setCurrent(current.id);
    await this.setMeta(META_ASYNC_MIGRATION_DONE, '1');
    return migrated;
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private async getAll(): Promise<StoredExerciseSession[]> {
    return this.querySessions('SELECT * FROM exercise_sessions ORDER BY start_time DESC', []);
  }

  private async querySessions(sql: string, params: Scalar[]): Promise<StoredExerciseSession[]> {
    await this.ensureInit();
    const { rows } = await this.db.execute(sql, params);
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  private async hydrate(sessionRow: Row): Promise<StoredExerciseSession> {
    const id = String(sessionRow.id);
    const setRows = await this.db.execute(
      'SELECT * FROM session_sets WHERE session_id = ? ORDER BY set_index',
      [id]
    );
    const telemetryRows = await this.db.execute(
      'SELECT * FROM telemetry_samples WHERE session_id = ? ORDER BY set_index, rep_number, sample_index',
      [id]
    );
    return rowToSession(sessionRow, setRows.rows, telemetryRows.rows);
  }

  private async resolveCreatedOrder(id: string): Promise<number> {
    const existing = await this.db.execute(
      'SELECT created_order FROM exercise_sessions WHERE id = ?',
      [id]
    );
    if (existing.rows.length > 0) return Number(existing.rows[0].created_order);

    const max = await this.db.execute(
      'SELECT COALESCE(MAX(created_order), 0) AS max_order FROM exercise_sessions'
    );
    return Number(max.rows[0].max_order) + 1;
  }

  private async getMeta(key: string): Promise<string | null> {
    const { rows } = await this.db.execute('SELECT value FROM session_meta WHERE key = ?', [key]);
    return rows.length > 0 ? String(rows[0].value) : null;
  }

  private async setMeta(key: string, value: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO session_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }

  private ensureInit(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.createSchema();
    return this.initPromise;
  }

  private async createSchema(): Promise<void> {
    for (const statement of SESSION_SCHEMA_STATEMENTS) {
      await this.db.execute(statement);
    }
  }
}

/** Open the production session database via op-sqlite. */
export function openSessionDatabase(name = SESSION_DB_NAME): SessionDatabase {
  return open({ name }) as unknown as SessionDatabase;
}

/** Create a SQLite session repository bound to the given database. */
export function createSQLiteExerciseSessionRepository(
  db: SessionDatabase
): SQLiteExerciseSessionRepository {
  return new SQLiteExerciseSessionRepository(db);
}
