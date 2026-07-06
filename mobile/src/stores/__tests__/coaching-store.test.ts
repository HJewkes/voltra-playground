import { describe, it, expect, beforeEach } from 'vitest';
import { createCoachingStore, type CoachingStoreApi } from '../coaching-store';

describe('coaching-store', () => {
  let store: CoachingStoreApi;

  beforeEach(() => {
    store = createCoachingStore();
  });

  describe('enqueueCue', () => {
    it('does nothing when coaching is disabled', () => {
      store.getState().enqueueCue({
        type: 'informational',
        message: 'Test cue',
        setNumber: 1,
        timestamp: Date.now(),
      });

      expect(store.getState().queuedCues).toHaveLength(0);
    });

    it('adds cue to queue when enabled', () => {
      store.getState().setEnabled(true);
      store.getState().enqueueCue({
        type: 'informational',
        message: 'Test cue',
        setNumber: 1,
        timestamp: 1000,
      });

      expect(store.getState().queuedCues).toHaveLength(1);
      expect(store.getState().queuedCues[0].message).toBe('Test cue');
      expect(store.getState().queuedCues[0].reaction).toBeNull();
      expect(store.getState().queuedCues[0].dismissed).toBe(false);
    });

    it('assigns unique IDs to each cue', () => {
      store.getState().setEnabled(true);
      store
        .getState()
        .enqueueCue({ type: 'informational', message: 'A', setNumber: 1, timestamp: 1000 });
      store
        .getState()
        .enqueueCue({ type: 'encouragement', message: 'B', setNumber: 1, timestamp: 1001 });

      const ids = store.getState().queuedCues.map((c) => c.id);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe('flushQueue', () => {
    it('moves first queued cue to activeCue', () => {
      store.getState().setEnabled(true);
      store
        .getState()
        .enqueueCue({ type: 'informational', message: 'First', setNumber: 1, timestamp: 1000 });
      store
        .getState()
        .enqueueCue({ type: 'encouragement', message: 'Second', setNumber: 1, timestamp: 1001 });

      store.getState().flushQueue();

      expect(store.getState().activeCue?.message).toBe('First');
      expect(store.getState().queuedCues).toHaveLength(1);
      expect(store.getState().queuedCues[0].message).toBe('Second');
    });

    it('adds cue to session log', () => {
      store.getState().setEnabled(true);
      store
        .getState()
        .enqueueCue({ type: 'informational', message: 'Logged', setNumber: 1, timestamp: 1000 });

      store.getState().flushQueue();

      expect(store.getState().sessionLog).toHaveLength(1);
      expect(store.getState().sessionLog[0].kind).toBe('cue');
      expect(store.getState().sessionLog[0].cue?.message).toBe('Logged');
    });

    it('does nothing when queue is empty', () => {
      store.getState().flushQueue();
      expect(store.getState().activeCue).toBeNull();
    });
  });

  describe('dismissActiveCue', () => {
    it('clears active cue and marks as dismissed in log', () => {
      store.getState().setEnabled(true);
      store.getState().enqueueCue({
        type: 'informational',
        message: 'Dismiss me',
        setNumber: 1,
        timestamp: 1000,
      });
      store.getState().flushQueue();

      store.getState().dismissActiveCue();

      expect(store.getState().activeCue).toBeNull();
      expect(store.getState().sessionLog[0].cue?.dismissed).toBe(true);
    });

    it('auto-flushes next queued cue after dismiss', () => {
      store.getState().setEnabled(true);
      store
        .getState()
        .enqueueCue({ type: 'informational', message: 'First', setNumber: 1, timestamp: 1000 });
      store
        .getState()
        .enqueueCue({ type: 'encouragement', message: 'Second', setNumber: 1, timestamp: 1001 });
      store.getState().flushQueue();

      store.getState().dismissActiveCue();

      expect(store.getState().activeCue?.message).toBe('Second');
    });
  });

  describe('reactToCue', () => {
    it('updates reaction on active cue and session log', () => {
      store.getState().setEnabled(true);
      store.getState().enqueueCue({
        type: 'informational',
        message: 'React to me',
        setNumber: 1,
        timestamp: 1000,
      });
      store.getState().flushQueue();

      const cueId = store.getState().activeCue!.id;
      store.getState().reactToCue(cueId, 'thumbs_up');

      expect(store.getState().activeCue?.reaction).toBe('thumbs_up');
      expect(store.getState().sessionLog[0].cue?.reaction).toBe('thumbs_up');
    });

    it('allows toggling reaction to null', () => {
      store.getState().setEnabled(true);
      store
        .getState()
        .enqueueCue({ type: 'informational', message: 'Toggle', setNumber: 1, timestamp: 1000 });
      store.getState().flushQueue();

      const cueId = store.getState().activeCue!.id;
      store.getState().reactToCue(cueId, 'thumbs_up');
      store.getState().reactToCue(cueId, null);

      expect(store.getState().activeCue?.reaction).toBeNull();
    });
  });

  describe('addSetMarker', () => {
    it('adds set marker to session log', () => {
      store.getState().addSetMarker(3);

      expect(store.getState().sessionLog).toHaveLength(1);
      expect(store.getState().sessionLog[0].kind).toBe('set_marker');
      expect(store.getState().sessionLog[0].setNumber).toBe(3);
    });
  });

  describe('getReactedCues', () => {
    it('returns only cues with non-null reactions', () => {
      store.getState().setEnabled(true);

      store
        .getState()
        .enqueueCue({ type: 'informational', message: 'Reacted', setNumber: 1, timestamp: 1000 });
      store.getState().flushQueue();
      const cueId = store.getState().activeCue!.id;
      store.getState().reactToCue(cueId, 'thumbs_up');
      store.getState().dismissActiveCue();

      store.getState().enqueueCue({
        type: 'encouragement',
        message: 'Not reacted',
        setNumber: 2,
        timestamp: 2000,
      });
      store.getState().flushQueue();
      store.getState().dismissActiveCue();

      const reacted = store.getState().getReactedCues();
      expect(reacted).toHaveLength(1);
      expect(reacted[0].message).toBe('Reacted');
    });
  });

  describe('toggleLog', () => {
    it('toggles log visibility', () => {
      expect(store.getState().logVisible).toBe(false);
      store.getState().toggleLog();
      expect(store.getState().logVisible).toBe(true);
      store.getState().toggleLog();
      expect(store.getState().logVisible).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all coaching state except enabled flag', () => {
      store.getState().setEnabled(true);
      store
        .getState()
        .enqueueCue({ type: 'informational', message: 'A', setNumber: 1, timestamp: 1000 });
      store.getState().flushQueue();
      store.getState().addSetMarker(1);
      store.getState().toggleLog();

      store.getState().reset();

      expect(store.getState().queuedCues).toHaveLength(0);
      expect(store.getState().activeCue).toBeNull();
      expect(store.getState().sessionLog).toHaveLength(0);
      expect(store.getState().logVisible).toBe(false);
      expect(store.getState().enabled).toBe(true);
    });
  });

  describe('safety: queuing during recording', () => {
    it('accumulates cues in queue without displaying', () => {
      store.getState().setEnabled(true);

      store.getState().enqueueCue({
        type: 'informational',
        message: 'During recording 1',
        setNumber: 1,
        timestamp: 1000,
      });
      store.getState().enqueueCue({
        type: 'load_adjustment',
        message: 'During recording 2',
        setNumber: 1,
        timestamp: 1001,
        suggestedWeight: 55,
      });

      expect(store.getState().activeCue).toBeNull();
      expect(store.getState().queuedCues).toHaveLength(2);

      store.getState().flushQueue();

      expect(store.getState().activeCue?.message).toBe('During recording 1');
      expect(store.getState().queuedCues).toHaveLength(1);
    });
  });

  describe('cue types', () => {
    it('preserves suggestedWeight on load_adjustment cues', () => {
      store.getState().setEnabled(true);
      store.getState().enqueueCue({
        type: 'load_adjustment',
        message: 'Increase weight',
        suggestedWeight: 65,
        setNumber: 2,
        timestamp: 1000,
      });

      store.getState().flushQueue();

      expect(store.getState().activeCue?.type).toBe('load_adjustment');
      expect(store.getState().activeCue?.suggestedWeight).toBe(65);
    });
  });
});
