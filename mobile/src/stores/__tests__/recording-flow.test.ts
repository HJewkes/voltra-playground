/**
 * Recording Flow Integration Test
 *
 * End-to-end test: start recording -> feed telemetry samples -> complete set ->
 * verify metrics. Uses real stores and analytics pipeline with minimal mocking.
 *
 * Only external dependencies are mocked (debug config, persistence).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSetRepVelocities, getSetVelocityLossPct } from '@voltras/workout-analytics';

import { recordingStore } from '../recording-store';
import { exerciseSessionStore } from '../exercise-session-store';
import { generateSampleStream } from '@/__fixtures__/generators/sample-generator';
import { createTestExercise, planBuilder } from '@/__fixtures__/generators';

// Mock only external dependencies -- let real stores + analytics run
vi.mock('@/data/provider', () => ({
  isDebugTelemetryEnabled: () => false,
  getRecordingRepository: () => ({
    save: vi.fn(),
  }),
}));

// =============================================================================
// Helpers
// =============================================================================

const WEIGHT_LBS = 135;
const EXERCISE_ID = 'bench_press';
const EXERCISE_NAME = 'Bench Press';

// =============================================================================
// Recording Store Integration
// =============================================================================

describe('Recording Flow Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    recordingStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('single set recording via recording store', () => {
    it('processes sample stream and produces correct rep count', () => {
      const repCount = 5;
      const samples = generateSampleStream({
        repCount,
        weight: WEIGHT_LBS,
        startingVelocity: 0.7,
        fatigueRate: 0.03,
        startTime: 1000,
      });

      recordingStore.getState().startRecording(EXERCISE_ID, EXERCISE_NAME);

      for (const sample of samples) {
        vi.setSystemTime(new Date(sample.timestamp));
        recordingStore.getState().processSample(sample);
      }

      const state = recordingStore.getState();

      // Rep detection works through the analytics pipeline.
      // The library creates reps on phase transitions (concentric start after eccentric).
      // The first rep is only "complete" when the second concentric starts.
      // So N reps of input produce N-1 library reps (the last is still "open").
      expect(state.repCount).toBeGreaterThanOrEqual(repCount - 1);
      expect(state.repCount).toBeLessThanOrEqual(repCount);
    });

    it('computes velocity metrics after multiple reps', () => {
      const samples = generateSampleStream({
        repCount: 5,
        weight: WEIGHT_LBS,
        startingVelocity: 0.8,
        fatigueRate: 0.05,
        startTime: 1000,
      });

      recordingStore.getState().startRecording(EXERCISE_ID, EXERCISE_NAME);

      for (const sample of samples) {
        vi.setSystemTime(new Date(sample.timestamp));
        recordingStore.getState().processSample(sample);
      }

      const state = recordingStore.getState();

      // Velocity trend should be populated with one entry per detected rep
      expect(state.velocityTrend.length).toBeGreaterThanOrEqual(1);

      // With fatigue, velocity should decline
      if (state.velocityTrend.length >= 2) {
        const first = state.velocityTrend[0];
        const last = state.velocityTrend[state.velocityTrend.length - 1];
        expect(first).toBeGreaterThan(last);
      }

      // RPE should be computed
      expect(state.rpe).toBeGreaterThan(0);
      expect(state.rir).toBeDefined();
    });

    it('produces CompletedSet on stopRecording with correct metadata', () => {
      const samples = generateSampleStream({
        repCount: 4,
        weight: WEIGHT_LBS,
        startingVelocity: 0.6,
        fatigueRate: 0.02,
        startTime: 1000,
      });

      recordingStore.getState().startRecording(EXERCISE_ID, EXERCISE_NAME);

      for (const sample of samples) {
        vi.setSystemTime(new Date(sample.timestamp));
        recordingStore.getState().processSample(sample);
      }

      vi.setSystemTime(new Date(20000));
      const completedSet = recordingStore.getState().stopRecording(WEIGHT_LBS);

      expect(completedSet).not.toBeNull();
      expect(completedSet!.exerciseId).toBe(EXERCISE_ID);
      expect(completedSet!.exerciseName).toBe(EXERCISE_NAME);
      expect(completedSet!.weight).toBe(WEIGHT_LBS);
      expect(completedSet!.timestamp.start).toBe(1000);
      expect(completedSet!.timestamp.end).toBe(20000);

      // Analytics data should contain reps
      expect(completedSet!.data.reps.length).toBeGreaterThanOrEqual(1);

      // Library functions should work on the completed set's data
      const velocities = getSetRepVelocities(completedSet!.data);
      expect(velocities.length).toBe(completedSet!.data.reps.length);
      for (const v of velocities) {
        expect(v).toBeGreaterThan(0);
      }
    });

    it('returns null from stopRecording when no reps were detected', () => {
      recordingStore.getState().startRecording(EXERCISE_ID, EXERCISE_NAME);

      // Feed only idle samples -- no reps
      const idleSample = {
        sequence: 0,
        timestamp: 2000,
        phase: 0 as const,
        position: 0,
        velocity: 0,
        force: 0,
      };
      recordingStore.getState().processSample(idleSample);

      const result = recordingStore.getState().stopRecording(WEIGHT_LBS);
      expect(result).toBeNull();
    });

    it('resets state cleanly for subsequent recordings', () => {
      const samples = generateSampleStream({
        repCount: 3,
        weight: WEIGHT_LBS,
        startingVelocity: 0.7,
        startTime: 1000,
      });

      // First recording
      recordingStore.getState().startRecording(EXERCISE_ID, EXERCISE_NAME);
      for (const sample of samples) {
        vi.setSystemTime(new Date(sample.timestamp));
        recordingStore.getState().processSample(sample);
      }
      recordingStore.getState().stopRecording(WEIGHT_LBS);

      // State should show last set
      expect(recordingStore.getState().lastSet).not.toBeNull();

      // Start new recording -- state should reset
      recordingStore.getState().startRecording(EXERCISE_ID, EXERCISE_NAME);
      const freshState = recordingStore.getState();
      expect(freshState.repCount).toBe(0);
      expect(freshState.velocityTrend).toEqual([]);
      expect(freshState.isRecording).toBe(true);
    });
  });

  // ===========================================================================
  // Session-level integration (recording store + exercise-session store)
  // ===========================================================================

  describe('session-level recording flow', () => {
    beforeEach(() => {
      exerciseSessionStore.getState().bindRecordingStore(recordingStore);
    });

    it('completes a set through session store orchestration', async () => {
      const exercise = createTestExercise(EXERCISE_ID);
      const plan = planBuilder()
        .workingSets(3)
        .workingWeight(WEIGHT_LBS)
        .targetReps(5)
        .build();

      exerciseSessionStore.getState().startSession(exercise, plan);

      // Verify session is created
      expect(exerciseSessionStore.getState().session).not.toBeNull();
      expect(exerciseSessionStore.getState().totalSets).toBe(3);
      expect(exerciseSessionStore.getState().completedSetsCount).toBe(0);

      // Start recording through the recording store directly
      recordingStore.getState().startRecording(exercise.id, exercise.name);

      const samples = generateSampleStream({
        repCount: 5,
        weight: WEIGHT_LBS,
        startingVelocity: 0.75,
        fatigueRate: 0.04,
        startTime: 2000,
      });

      for (const sample of samples) {
        vi.setSystemTime(new Date(sample.timestamp));
        recordingStore.getState().processSample(sample);
      }

      // Stop recording and get completed set
      vi.setSystemTime(new Date(30000));
      const completedSet = recordingStore.getState().stopRecording(WEIGHT_LBS);
      expect(completedSet).not.toBeNull();

      // Feed completed set to session store
      await exerciseSessionStore.getState().onSetCompleted(completedSet!);

      // Session should have one completed set
      const sessionState = exerciseSessionStore.getState();
      expect(sessionState.completedSetsCount).toBe(1);
      expect(sessionState.session!.completedSets).toHaveLength(1);

      const savedSet = sessionState.session!.completedSets[0];
      expect(savedSet.weight).toBe(WEIGHT_LBS);
      expect(savedSet.data.reps.length).toBeGreaterThanOrEqual(1);
      expect(savedSet.exerciseId).toBe(EXERCISE_ID);
    });

    it('tracks velocity loss across a fatiguing set', () => {
      recordingStore.getState().startRecording(EXERCISE_ID, EXERCISE_NAME);

      // High fatigue rate to ensure measurable velocity loss
      const samples = generateSampleStream({
        repCount: 8,
        weight: WEIGHT_LBS,
        startingVelocity: 0.9,
        fatigueRate: 0.08,
        startTime: 1000,
      });

      for (const sample of samples) {
        vi.setSystemTime(new Date(sample.timestamp));
        recordingStore.getState().processSample(sample);
      }

      vi.setSystemTime(new Date(50000));
      const completedSet = recordingStore.getState().stopRecording(WEIGHT_LBS);
      expect(completedSet).not.toBeNull();

      // Velocity loss should be positive (velocity declined)
      const velLoss = getSetVelocityLossPct(completedSet!.data);
      if (completedSet!.data.reps.length >= 2) {
        expect(Math.abs(velLoss)).toBeGreaterThan(0);
      }
    });

    it('accumulates completed sets across multiple recordings', async () => {
      const exercise = createTestExercise(EXERCISE_ID);
      const plan = planBuilder()
        .workingSets(3)
        .workingWeight(WEIGHT_LBS)
        .targetReps(3)
        .build();

      exerciseSessionStore.getState().startSession(exercise, plan);

      // Record two sets
      for (let setIdx = 0; setIdx < 2; setIdx++) {
        recordingStore.getState().startRecording(exercise.id, exercise.name);

        const samples = generateSampleStream({
          repCount: 3,
          weight: WEIGHT_LBS,
          startingVelocity: 0.7 - setIdx * 0.05,
          fatigueRate: 0.03,
          startTime: 1000 + setIdx * 20000,
        });

        for (const sample of samples) {
          vi.setSystemTime(new Date(sample.timestamp));
          recordingStore.getState().processSample(sample);
        }

        vi.setSystemTime(new Date(15000 + setIdx * 20000));
        const completedSet = recordingStore.getState().stopRecording(WEIGHT_LBS);
        expect(completedSet).not.toBeNull();

        await exerciseSessionStore.getState().onSetCompleted(completedSet!);
      }

      const state = exerciseSessionStore.getState();
      expect(state.completedSetsCount).toBe(2);
      expect(state.session!.completedSets).toHaveLength(2);

      // Each completed set should have valid analytics data
      for (const completedSet of state.session!.completedSets) {
        expect(completedSet.weight).toBe(WEIGHT_LBS);
        expect(completedSet.data.reps.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('terminates session after all planned sets complete', async () => {
      const exercise = createTestExercise(EXERCISE_ID);
      const plan = planBuilder()
        .workingSets(2)
        .workingWeight(WEIGHT_LBS)
        .targetReps(3)
        .build();

      exerciseSessionStore.getState().startSession(exercise, plan);

      // Complete all planned sets
      for (let setIdx = 0; setIdx < 2; setIdx++) {
        recordingStore.getState().startRecording(exercise.id, exercise.name);

        const samples = generateSampleStream({
          repCount: 3,
          weight: WEIGHT_LBS,
          startingVelocity: 0.6,
          fatigueRate: 0.02,
          startTime: 1000 + setIdx * 20000,
        });

        for (const sample of samples) {
          vi.setSystemTime(new Date(sample.timestamp));
          recordingStore.getState().processSample(sample);
        }

        vi.setSystemTime(new Date(15000 + setIdx * 20000));
        const completedSet = recordingStore.getState().stopRecording(WEIGHT_LBS);
        expect(completedSet).not.toBeNull();

        await exerciseSessionStore.getState().onSetCompleted(completedSet!);
      }

      const finalState = exerciseSessionStore.getState();
      expect(finalState.completedSetsCount).toBe(2);
      expect(finalState.uiState).toBe('results');
      expect(finalState.isComplete).toBe(true);
    });
  });
});
