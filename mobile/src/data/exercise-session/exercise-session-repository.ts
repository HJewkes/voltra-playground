/**
 * Exercise Session Repository
 *
 * Unified storage for all exercise sessions (discovery and standard).
 * Replaces both set-repository and discovery-storage.
 *
 * CRUD operations only - business logic belongs in domain services.
 */

import { StorageAdapter, STORAGE_KEYS } from '@/data/adapters';
import type { StoredExerciseSession, ExerciseSessionSummary } from './exercise-session-schema';
import { toExerciseSessionSummary } from './exercise-session-converters';

/**
 * Exercise session repository interface.
 */
export interface ExerciseSessionRepository {
  /** Save a session (create or update) */
  save(session: StoredExerciseSession): Promise<void>;

  /** Get session by ID */
  getById(id: string): Promise<StoredExerciseSession | null>;

  /** Get all sessions for an exercise */
  getByExercise(exerciseId: string): Promise<StoredExerciseSession[]>;

  /** Get recent sessions (most recent first) */
  getRecent(count: number): Promise<StoredExerciseSession[]>;

  /** Get current in-progress session (if any) */
  getCurrent(): Promise<StoredExerciseSession | null>;

  /** Set current in-progress session */
  setCurrent(sessionId: string | null): Promise<void>;

  /** Delete a session */
  delete(id: string): Promise<void>;

  /** Get all session summaries (lightweight) */
  getAllSummaries(): Promise<ExerciseSessionSummary[]>;

  /** Get sessions by date range */
  getByDateRange(start: Date, end: Date): Promise<StoredExerciseSession[]>;

  /** Get discovery sessions only */
  getDiscoverySessions(exerciseId?: string): Promise<StoredExerciseSession[]>;

  /** Get the most recent session for an exercise */
  getMostRecentForExercise(exerciseId: string): Promise<StoredExerciseSession | null>;

  /** Get in-progress session (convenience method) */
  getInProgress(): Promise<StoredExerciseSession | null>;
}

/**
 * Implementation of ExerciseSessionRepository using a StorageAdapter.
 */
export class ExerciseSessionRepositoryImpl implements ExerciseSessionRepository {
  constructor(private adapter: StorageAdapter) {}

  /**
   * Get the index of all session IDs.
   */
  private async getIndex(): Promise<string[]> {
    const index = await this.adapter.get<string[]>(STORAGE_KEYS.EXERCISE_SESSIONS_INDEX);
    return index ?? [];
  }

  /**
   * Save the index of session IDs.
   */
  private async saveIndex(ids: string[]): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.EXERCISE_SESSIONS_INDEX, ids);
  }

  /**
   * Get storage key for a session by ID.
   */
  private getKey(id: string): string {
    return `${STORAGE_KEYS.EXERCISE_SESSION_PREFIX}${id}`;
  }

  async save(session: StoredExerciseSession): Promise<void> {
    // Save the session
    await this.adapter.set(this.getKey(session.id), session);

    // Update index if needed
    const index = await this.getIndex();
    if (!index.includes(session.id)) {
      // Add to front (most recent)
      await this.saveIndex([session.id, ...index]);
    }
  }

  async getById(id: string): Promise<StoredExerciseSession | null> {
    return this.adapter.get<StoredExerciseSession>(this.getKey(id));
  }

  async getByExercise(exerciseId: string): Promise<StoredExerciseSession[]> {
    const all = await this.getAll();
    return all.filter(s => s.exerciseId === exerciseId);
  }

  async getRecent(count: number): Promise<StoredExerciseSession[]> {
    const index = await this.getIndex();
    const recentIds = index.slice(0, count);
    const keys = recentIds.map(id => this.getKey(id));
    const results = await this.adapter.getMultiple<StoredExerciseSession>(keys);

    const sessions: StoredExerciseSession[] = [];
    // Preserve order from index (most recent first)
    for (const id of recentIds) {
      const session = results.get(this.getKey(id));
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async getCurrent(): Promise<StoredExerciseSession | null> {
    const currentId = await this.adapter.get<string>(STORAGE_KEYS.EXERCISE_SESSION_CURRENT);
    if (!currentId) return null;
    return this.getById(currentId);
  }

  async setCurrent(sessionId: string | null): Promise<void> {
    if (sessionId) {
      await this.adapter.set(STORAGE_KEYS.EXERCISE_SESSION_CURRENT, sessionId);
    } else {
      await this.adapter.remove(STORAGE_KEYS.EXERCISE_SESSION_CURRENT);
    }
  }

  async delete(id: string): Promise<void> {
    // Remove from storage
    await this.adapter.remove(this.getKey(id));

    // Remove from index
    const index = await this.getIndex();
    const newIndex = index.filter(i => i !== id);
    await this.saveIndex(newIndex);

    // Clear current if this was the current session
    const currentId = await this.adapter.get<string>(STORAGE_KEYS.EXERCISE_SESSION_CURRENT);
    if (currentId === id) {
      await this.setCurrent(null);
    }
  }

  async getAllSummaries(): Promise<ExerciseSessionSummary[]> {
    const all = await this.getAll();
    return all.map(toExerciseSessionSummary);
  }

  async getByDateRange(start: Date, end: Date): Promise<StoredExerciseSession[]> {
    const all = await this.getAll();
    const startTs = start.getTime();
    const endTs = end.getTime();

    return all.filter(s => s.startTime >= startTs && s.startTime <= endTs);
  }

  async getDiscoverySessions(exerciseId?: string): Promise<StoredExerciseSession[]> {
    const all = await this.getAll();
    return all.filter(s => {
      const isDiscovery = s.plan.generatedBy === 'discovery';
      if (!isDiscovery) return false;
      if (exerciseId && s.exerciseId !== exerciseId) return false;
      return true;
    });
  }

  async getMostRecentForExercise(exerciseId: string): Promise<StoredExerciseSession | null> {
    const sessions = await this.getByExercise(exerciseId);
    if (sessions.length === 0) return null;
    // Sessions are already sorted by most recent first from getAll()
    return sessions[0];
  }

  async getInProgress(): Promise<StoredExerciseSession | null> {
    const current = await this.getCurrent();
    if (current && current.status === 'in_progress') {
      return current;
    }
    return null;
  }

  /**
   * Get all sessions, sorted by start time descending.
   */
  private async getAll(): Promise<StoredExerciseSession[]> {
    const index = await this.getIndex();
    const keys = index.map(id => this.getKey(id));
    const results = await this.adapter.getMultiple<StoredExerciseSession>(keys);

    const sessions: StoredExerciseSession[] = [];
    for (const [, session] of results) {
      if (session) {
        sessions.push(session);
      }
    }

    // Sort by start time descending
    return sessions.sort((a, b) => b.startTime - a.startTime);
  }
}

/**
 * Create a repository instance with the given adapter.
 */
export function createExerciseSessionRepository(
  adapter: StorageAdapter
): ExerciseSessionRepository {
  return new ExerciseSessionRepositoryImpl(adapter);
}
