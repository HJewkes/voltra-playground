/**
 * Discovery Repository Implementation
 * 
 * Handles persistence of weight discovery sessions.
 */

import { StorageAdapter, STORAGE_KEYS } from '@/data/adapters';
import { DiscoverySession } from '@/data/models';
import type { DiscoveryRepository } from './types';

const CURRENT_SESSION_KEY = 'voltra:discovery:current';

/**
 * Implementation of DiscoveryRepository using a StorageAdapter.
 */
export class DiscoveryRepositoryImpl implements DiscoveryRepository {
  constructor(private adapter: StorageAdapter) {}
  
  /**
   * Get the index of all session IDs.
   */
  private async getIndex(): Promise<string[]> {
    const index = await this.adapter.get<string[]>(STORAGE_KEYS.DISCOVERY_INDEX);
    return index ?? [];
  }
  
  /**
   * Save the index of session IDs.
   */
  private async saveIndex(ids: string[]): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.DISCOVERY_INDEX, ids);
  }
  
  /**
   * Get storage key for a session by ID.
   */
  private getKey(id: string): string {
    return `${STORAGE_KEYS.DISCOVERY_PREFIX}${id}`;
  }
  
  async getById(id: string): Promise<DiscoverySession | null> {
    return this.adapter.get<DiscoverySession>(this.getKey(id));
  }
  
  async getAll(): Promise<DiscoverySession[]> {
    const index = await this.getIndex();
    const keys = index.map(id => this.getKey(id));
    const results = await this.adapter.getMultiple<DiscoverySession>(keys);
    
    const sessions: DiscoverySession[] = [];
    for (const [, session] of results) {
      if (session) {
        sessions.push(session);
      }
    }
    
    // Sort by start time descending
    return sessions.sort((a, b) => b.startTime - a.startTime);
  }
  
  async save(session: DiscoverySession): Promise<void> {
    // Save the session
    await this.adapter.set(this.getKey(session.id), session);
    
    // Update index if needed
    const index = await this.getIndex();
    if (!index.includes(session.id)) {
      // Add to front (most recent)
      await this.saveIndex([session.id, ...index]);
    }
  }
  
  async delete(id: string): Promise<void> {
    // Remove from storage
    await this.adapter.remove(this.getKey(id));
    
    // Remove from index
    const index = await this.getIndex();
    const newIndex = index.filter(i => i !== id);
    await this.saveIndex(newIndex);
  }
  
  async getByExercise(exerciseId: string): Promise<DiscoverySession[]> {
    const all = await this.getAll();
    return all.filter(s => s.exerciseId === exerciseId);
  }
  
  async getLatest(): Promise<DiscoverySession | null> {
    const index = await this.getIndex();
    if (index.length === 0) return null;
    
    return this.getById(index[0]);
  }
  
  async getCurrentSession(): Promise<DiscoverySession | null> {
    return this.adapter.get<DiscoverySession>(CURRENT_SESSION_KEY);
  }
  
  async saveCurrentSession(session: DiscoverySession): Promise<void> {
    await this.adapter.set(CURRENT_SESSION_KEY, session);
  }
  
  async clearCurrentSession(): Promise<void> {
    await this.adapter.remove(CURRENT_SESSION_KEY);
  }
}
