/**
 * Recording Repository
 *
 * CRUD operations for stored sample recordings.
 * Uses index-based storage pattern.
 */

import type { StorageAdapter } from '@/data/adapters/types';
import { STORAGE_KEYS } from '@/data/adapters/types';
import type { SampleRecording } from './recording-schema';

/**
 * Recording repository interface.
 */
export interface RecordingRepository {
  /** Save a recording (create or update) */
  save(recording: SampleRecording): Promise<void>;

  /** Get recording by ID */
  getById(id: string): Promise<SampleRecording | null>;

  /** Get all recordings */
  getAll(): Promise<SampleRecording[]>;

  /** Get recent recordings (most recent first) */
  getRecent(count: number): Promise<SampleRecording[]>;

  /** Delete a recording */
  delete(id: string): Promise<void>;

  /** Get count of stored recordings */
  count(): Promise<number>;
}

/**
 * Implementation of RecordingRepository using a StorageAdapter.
 */
export class RecordingRepositoryImpl implements RecordingRepository {
  constructor(private adapter: StorageAdapter) {}

  /**
   * Get the index of all recording IDs.
   */
  private async getIndex(): Promise<string[]> {
    const index = await this.adapter.get<string[]>(STORAGE_KEYS.RECORDINGS_INDEX);
    return index ?? [];
  }

  /**
   * Save the index of recording IDs.
   */
  private async saveIndex(ids: string[]): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.RECORDINGS_INDEX, ids);
  }

  /**
   * Get storage key for a recording by ID.
   */
  private getKey(id: string): string {
    return `${STORAGE_KEYS.RECORDING_PREFIX}${id}`;
  }

  async save(recording: SampleRecording): Promise<void> {
    // Save the recording
    await this.adapter.set(this.getKey(recording.id), recording);

    // Update index if needed (add to front for most recent first)
    const index = await this.getIndex();
    if (!index.includes(recording.id)) {
      await this.saveIndex([recording.id, ...index]);
    }
  }

  async getById(id: string): Promise<SampleRecording | null> {
    return this.adapter.get<SampleRecording>(this.getKey(id));
  }

  async getAll(): Promise<SampleRecording[]> {
    const index = await this.getIndex();
    if (index.length === 0) return [];

    const keys = index.map((id) => this.getKey(id));
    const results = await this.adapter.getMultiple<SampleRecording>(keys);

    const recordings: SampleRecording[] = [];
    // Preserve order from index (most recent first)
    for (const id of index) {
      const recording = results.get(this.getKey(id));
      if (recording) {
        recordings.push(recording);
      }
    }

    return recordings;
  }

  async getRecent(count: number): Promise<SampleRecording[]> {
    const index = await this.getIndex();
    const recentIds = index.slice(0, count);

    if (recentIds.length === 0) return [];

    const keys = recentIds.map((id) => this.getKey(id));
    const results = await this.adapter.getMultiple<SampleRecording>(keys);

    const recordings: SampleRecording[] = [];
    for (const id of recentIds) {
      const recording = results.get(this.getKey(id));
      if (recording) {
        recordings.push(recording);
      }
    }

    return recordings;
  }

  async delete(id: string): Promise<void> {
    // Remove from storage
    await this.adapter.remove(this.getKey(id));

    // Remove from index
    const index = await this.getIndex();
    const newIndex = index.filter((i) => i !== id);
    await this.saveIndex(newIndex);
  }

  async count(): Promise<number> {
    const index = await this.getIndex();
    return index.length;
  }
}

/**
 * Create a repository instance with the given adapter.
 */
export function createRecordingRepository(adapter: StorageAdapter): RecordingRepository {
  return new RecordingRepositoryImpl(adapter);
}
