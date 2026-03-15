/**
 * Coaching Context Builder Tests
 *
 * Verifies that telemetry from across the domain is correctly assembled
 * into structured coaching context and prompt format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateStoredSession,
  generateStoredSet,
} from '@/__fixtures__/generators/session-generator';
import type { StoredExerciseSession } from '@/data/exercise-session';
import type { SessionMetrics } from '@/domain/workout/metrics/types';
import {
  buildCoachingContext,
  toPrompt,
  type BuildContextInput,
  type AutoRegulationInput,
} from '../coaching-context-builder';
import type { PreviousCoachingCue } from '../types';

// =============================================================================
// Test Helpers
// =============================================================================

function createDefaultInput(overrides: Partial<BuildContextInput> = {}): BuildContextInput {
  const storedSet = generateStoredSet({
    setIndex: 2,
    weight: 150,
    repCount: 8,
    startingVelocity: 0.75,
    fatigueRate: 0.04,
  });

  return {
    currentSet: {
      exerciseId: 'cable_row',
      exerciseName: 'Seated Cable Row',
      setNumber: 3,
      storedSet,
    },
    session: {
      setsCompleted: 3,
      setsPlanned: 5,
      startTime: Date.now() - 15 * 60 * 1000,
      trainingGoal: 'hypertrophy',
    },
    sessionMetrics: createMockMetrics(),
    autoRegulation: null,
    exerciseHistory: [],
    previousCues: [],
    ...overrides,
  };
}

function createMockMetrics(overrides: Partial<SessionMetrics> = {}): SessionMetrics {
  return {
    strength: { estimated1RM: 200, confidence: 0.8, source: 'session' },
    readiness: {
      zone: 'green',
      velocityPercent: 98,
      confidence: 0.85,
      adjustments: { weight: 0, volume: 1.0 },
      message: 'Normal readiness',
    },
    fatigue: {
      level: 0.3,
      isJunkVolume: false,
      velocityRecoveryPercent: 88,
      repDropPercent: 12,
    },
    volumeAccumulated: 3600,
    effectiveVolume: 3200,
    ...overrides,
  };
}

function createMockAutoRegulation(
  overrides: Partial<AutoRegulationInput> = {},
): AutoRegulationInput {
  return {
    loadSuggestion: null,
    velocityWarning: null,
    junkVolumeAlert: null,
    ...overrides,
  };
}

// =============================================================================
// buildCoachingContext
// =============================================================================

describe('buildCoachingContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('current set summary', () => {
    it('extracts set data from stored set', () => {
      const input = createDefaultInput();
      const ctx = buildCoachingContext(input);

      expect(ctx.currentSet.exerciseName).toBe('Seated Cable Row');
      expect(ctx.currentSet.exerciseId).toBe('cable_row');
      expect(ctx.currentSet.setNumber).toBe(3);
      expect(ctx.currentSet.load).toBe(150);
      expect(ctx.currentSet.reps).toBe(8);
    });

    it('computes mean velocity from stored set', () => {
      const input = createDefaultInput();
      const ctx = buildCoachingContext(input);

      expect(ctx.currentSet.meanVelocity).toBeGreaterThan(0);
      expect(ctx.currentSet.meanVelocity).toBeLessThan(2);
    });

    it('computes peak velocity from concentric samples', () => {
      const input = createDefaultInput();
      const ctx = buildCoachingContext(input);

      expect(ctx.currentSet.peakVelocity).toBeGreaterThan(0);
      expect(ctx.currentSet.peakVelocity).toBeGreaterThanOrEqual(
        ctx.currentSet.meanVelocity,
      );
    });

    it('includes velocity loss and RPE/RIR', () => {
      const input = createDefaultInput();
      const ctx = buildCoachingContext(input);

      expect(ctx.currentSet.velocityLossPercent).toBeGreaterThanOrEqual(0);
      expect(ctx.currentSet.estimatedRPE).toBeGreaterThan(0);
      expect(ctx.currentSet.estimatedRIR).toBeGreaterThanOrEqual(0);
    });

    it('extracts tempo data from rep samples', () => {
      const input = createDefaultInput();
      const ctx = buildCoachingContext(input);

      expect(ctx.currentSet.tempo).toBeDefined();
      expect(ctx.currentSet.tempo!.concentricMs).toBeGreaterThan(0);
      expect(ctx.currentSet.tempo!.eccentricMs).toBeGreaterThan(0);
    });

    it('returns undefined tempo when set has no reps', () => {
      const emptySet = generateStoredSet({ repCount: 0 });
      // Override reps to empty since generator may produce 0 reps differently
      emptySet.reps = [];

      const input = createDefaultInput({
        currentSet: {
          exerciseId: 'cable_row',
          exerciseName: 'Seated Cable Row',
          setNumber: 1,
          storedSet: emptySet,
        },
      });
      const ctx = buildCoachingContext(input);

      expect(ctx.currentSet.tempo).toBeUndefined();
    });
  });

  describe('session context', () => {
    it('includes set progress and training goal', () => {
      const input = createDefaultInput();
      const ctx = buildCoachingContext(input);

      expect(ctx.session.setsCompleted).toBe(3);
      expect(ctx.session.setsPlanned).toBe(5);
      expect(ctx.session.trainingGoal).toBe('hypertrophy');
    });

    it('computes session duration in minutes', () => {
      const input = createDefaultInput();
      const ctx = buildCoachingContext(input);

      expect(ctx.session.sessionDurationMinutes).toBeGreaterThan(0);
    });

    it('includes fatigue trend from session metrics', () => {
      const input = createDefaultInput();
      const ctx = buildCoachingContext(input);

      expect(ctx.session.fatigueTrend.velocityRecoveryPercent).toBe(88);
      expect(ctx.session.fatigueTrend.repDropPercent).toBe(12);
      expect(ctx.session.fatigueTrend.isJunkVolume).toBe(false);
      expect(ctx.session.fatigueTrend.fatigueLevel).toBe(0.3);
    });

    it('uses defaults when session metrics are null', () => {
      const input = createDefaultInput({ sessionMetrics: null });
      const ctx = buildCoachingContext(input);

      expect(ctx.session.fatigueTrend.velocityRecoveryPercent).toBe(100);
      expect(ctx.session.fatigueTrend.repDropPercent).toBe(0);
      expect(ctx.session.fatigueTrend.isJunkVolume).toBe(false);
    });
  });

  describe('athlete history', () => {
    it('returns empty history when no sessions exist', () => {
      const input = createDefaultInput({ exerciseHistory: [] });
      const ctx = buildCoachingContext(input);

      expect(ctx.athleteHistory.recentSessions).toHaveLength(0);
      expect(ctx.athleteHistory.sessionCount).toBe(0);
      expect(ctx.athleteHistory.baselineVelocityAtLoad).toBeNull();
      expect(ctx.athleteHistory.personalRecords).toHaveLength(0);
    });

    it('limits history to 5 most recent sessions', () => {
      const sessions: StoredExerciseSession[] = [];
      for (let i = 0; i < 8; i++) {
        sessions.push(generateStoredSession({ daysAgo: i * 3, weight: 150 }));
      }

      const input = createDefaultInput({ exerciseHistory: sessions });
      const ctx = buildCoachingContext(input);

      expect(ctx.athleteHistory.recentSessions).toHaveLength(5);
      expect(ctx.athleteHistory.sessionCount).toBe(8);
    });

    it('orders recent sessions most-recent first', () => {
      const sessions = [
        generateStoredSession({ daysAgo: 10, weight: 150 }),
        generateStoredSession({ daysAgo: 3, weight: 150 }),
        generateStoredSession({ daysAgo: 7, weight: 150 }),
      ];

      const input = createDefaultInput({ exerciseHistory: sessions });
      const ctx = buildCoachingContext(input);

      const dates = ctx.athleteHistory.recentSessions.map((s) => s.date);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThan(dates[i - 1]);
      }
    });

    it('computes baseline velocity at current load', () => {
      const sessions = [
        generateStoredSession({ weight: 150, daysAgo: 2 }),
        generateStoredSession({ weight: 150, daysAgo: 5 }),
      ];

      const input = createDefaultInput({ exerciseHistory: sessions });
      const ctx = buildCoachingContext(input);

      expect(ctx.athleteHistory.baselineVelocityAtLoad).not.toBeNull();
      expect(ctx.athleteHistory.baselineVelocityAtLoad).toBeGreaterThan(0);
    });

    it('returns null baseline when no sets match current load', () => {
      const sessions = [generateStoredSession({ weight: 200 })];

      const input = createDefaultInput({ exerciseHistory: sessions });
      const ctx = buildCoachingContext(input);

      expect(ctx.athleteHistory.baselineVelocityAtLoad).toBeNull();
    });

    it('includes personal records', () => {
      const sessions = [
        generateStoredSession({ weight: 150, daysAgo: 2 }),
        generateStoredSession({ weight: 180, daysAgo: 5 }),
      ];

      const input = createDefaultInput({ exerciseHistory: sessions });
      const ctx = buildCoachingContext(input);

      expect(ctx.athleteHistory.personalRecords.length).toBeGreaterThan(0);
      for (const pr of ctx.athleteHistory.personalRecords) {
        expect(['max_weight', 'max_reps', 'max_velocity', 'max_volume']).toContain(
          pr.type,
        );
        expect(pr.value).toBeGreaterThan(0);
      }
    });

    it('extracts session-level stats for historical entries', () => {
      const sessions = [
        generateStoredSession({ weight: 150, setCount: 3, targetReps: 8 }),
      ];

      const input = createDefaultInput({ exerciseHistory: sessions });
      const ctx = buildCoachingContext(input);

      const recent = ctx.athleteHistory.recentSessions[0];
      expect(recent.sets).toBe(3);
      expect(recent.totalReps).toBe(24);
      expect(recent.load).toBe(150);
      expect(recent.avgMeanVelocity).toBeGreaterThan(0);
    });

    it('excludes non-completed sessions from history', () => {
      const completed = generateStoredSession({ weight: 150, daysAgo: 2 });
      const abandoned: StoredExerciseSession = {
        ...generateStoredSession({ weight: 150, daysAgo: 1 }),
        status: 'abandoned',
      };

      const input = createDefaultInput({
        exerciseHistory: [completed, abandoned],
      });
      const ctx = buildCoachingContext(input);

      expect(ctx.athleteHistory.sessionCount).toBe(1);
      expect(ctx.athleteHistory.recentSessions).toHaveLength(1);
    });
  });

  describe('auto-regulation signals', () => {
    it('uses defaults when auto-regulation is null', () => {
      const input = createDefaultInput({ autoRegulation: null });
      const ctx = buildCoachingContext(input);

      expect(ctx.autoRegulation.readinessZone).toBe('green');
      expect(ctx.autoRegulation.velocityWarningSeverity).toBeNull();
      expect(ctx.autoRegulation.junkVolumeDetected).toBe(false);
      expect(ctx.autoRegulation.loadSuggestion).toBeNull();
    });

    it('propagates velocity warning from auto-regulation', () => {
      const autoReg = createMockAutoRegulation({
        velocityWarning: {
          severity: 'warning',
          message: 'Velocity dropping - fatigue accumulating',
        },
      });

      const input = createDefaultInput({ autoRegulation: autoReg });
      const ctx = buildCoachingContext(input);

      expect(ctx.autoRegulation.velocityWarningSeverity).toBe('warning');
      expect(ctx.autoRegulation.velocityWarningMessage).toBe(
        'Velocity dropping - fatigue accumulating',
      );
    });

    it('propagates junk volume detection', () => {
      const autoReg = createMockAutoRegulation({
        junkVolumeAlert: {
          isJunkVolume: true,
        },
      });

      const input = createDefaultInput({ autoRegulation: autoReg });
      const ctx = buildCoachingContext(input);

      expect(ctx.autoRegulation.junkVolumeDetected).toBe(true);
    });

    it('propagates load suggestion', () => {
      const autoReg = createMockAutoRegulation({
        loadSuggestion: {
          currentWeight: 150,
          suggestedWeight: 140,
          direction: 'decrease',
          reason: 'Velocity too low',
        },
      });

      const input = createDefaultInput({ autoRegulation: autoReg });
      const ctx = buildCoachingContext(input);

      expect(ctx.autoRegulation.loadSuggestion).not.toBeNull();
      expect(ctx.autoRegulation.loadSuggestion!.suggestedWeight).toBe(140);
      expect(ctx.autoRegulation.loadSuggestion!.direction).toBe('decrease');
    });

    it('reads readiness from session metrics', () => {
      const metrics = createMockMetrics({
        readiness: {
          zone: 'yellow',
          velocityPercent: 90,
          confidence: 0.7,
          adjustments: { weight: -10, volume: 0.9 },
          message: 'Slightly fatigued',
        },
      });

      const input = createDefaultInput({ sessionMetrics: metrics });
      const ctx = buildCoachingContext(input);

      expect(ctx.autoRegulation.readinessZone).toBe('yellow');
      expect(ctx.autoRegulation.readinessConfidence).toBe(0.7);
    });
  });

  describe('previous coaching cues', () => {
    it('passes through previous cues unchanged', () => {
      const cues: PreviousCoachingCue[] = [
        {
          message: 'Slow down the eccentric',
          timestamp: Date.now() - 5 * 60_000,
          setNumber: 1,
          followed: true,
        },
        {
          message: 'Good velocity — maintain load',
          timestamp: Date.now() - 3 * 60_000,
          setNumber: 2,
          followed: null,
        },
      ];

      const input = createDefaultInput({ previousCues: cues });
      const ctx = buildCoachingContext(input);

      expect(ctx.previousCues).toHaveLength(2);
      expect(ctx.previousCues[0].message).toBe('Slow down the eccentric');
      expect(ctx.previousCues[0].followed).toBe(true);
      expect(ctx.previousCues[1].followed).toBeNull();
    });

    it('defaults to empty cues when not provided', () => {
      const input = createDefaultInput();
      delete input.previousCues;
      const ctx = buildCoachingContext(input);

      expect(ctx.previousCues).toEqual([]);
    });
  });

  it('includes generation timestamp', () => {
    const input = createDefaultInput();
    const ctx = buildCoachingContext(input);

    expect(ctx.generatedAt).toBe(Date.now());
  });
});

// =============================================================================
// toPrompt
// =============================================================================

describe('toPrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns system and user message strings', () => {
    const input = createDefaultInput();
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(typeof prompt.system).toBe('string');
    expect(typeof prompt.user).toBe('string');
    expect(prompt.system.length).toBeGreaterThan(0);
    expect(prompt.user.length).toBeGreaterThan(0);
  });

  it('system prompt describes the coaching role', () => {
    const input = createDefaultInput();
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.system).toContain('strength and conditioning coach');
    expect(prompt.system).toContain('velocity-based training');
  });

  it('user prompt includes current set details', () => {
    const input = createDefaultInput();
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).toContain('Current Set');
    expect(prompt.user).toContain('Seated Cable Row');
    expect(prompt.user).toContain('150 lbs');
    expect(prompt.user).toContain('8 reps');
  });

  it('user prompt includes session progress', () => {
    const input = createDefaultInput();
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).toContain('3/5 sets');
    expect(prompt.user).toContain('hypertrophy');
  });

  it('user prompt includes auto-regulation signals', () => {
    const autoReg = createMockAutoRegulation({
      velocityWarning: {
        severity: 'critical',
        message: 'Velocity dropped significantly',
      },
    });

    const input = createDefaultInput({ autoRegulation: autoReg });
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).toContain('Auto-Regulation');
    expect(prompt.user).toContain('critical');
    expect(prompt.user).toContain('Velocity dropped significantly');
  });

  it('user prompt includes history when available', () => {
    const sessions = [
      generateStoredSession({ weight: 150, daysAgo: 3 }),
      generateStoredSession({ weight: 150, daysAgo: 7 }),
    ];

    const input = createDefaultInput({ exerciseHistory: sessions });
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).toContain('History');
    expect(prompt.user).toContain('2 sessions');
  });

  it('user prompt shows no-history message when empty', () => {
    const input = createDefaultInput({ exerciseHistory: [] });
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).toContain('No previous sessions');
  });

  it('user prompt includes previous coaching cues', () => {
    const cues: PreviousCoachingCue[] = [
      {
        message: 'Focus on explosive concentric',
        timestamp: Date.now() - 5 * 60_000,
        setNumber: 1,
        followed: true,
      },
    ];

    const input = createDefaultInput({ previousCues: cues });
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).toContain('Previous Coaching');
    expect(prompt.user).toContain('Focus on explosive concentric');
    expect(prompt.user).toContain('followed');
  });

  it('omits previous coaching section when no cues exist', () => {
    const input = createDefaultInput({ previousCues: [] });
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).not.toContain('Previous Coaching');
  });

  it('user prompt includes load suggestion when present', () => {
    const autoReg = createMockAutoRegulation({
      loadSuggestion: {
        currentWeight: 150,
        suggestedWeight: 140,
        direction: 'decrease',
        reason: 'Velocity below threshold',
      },
    });

    const input = createDefaultInput({ autoRegulation: autoReg });
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).toContain('decrease');
    expect(prompt.user).toContain('140');
  });

  it('user prompt flags junk volume detection', () => {
    const metrics = createMockMetrics({
      fatigue: {
        level: 0.8,
        isJunkVolume: true,
        velocityRecoveryPercent: 55,
        repDropPercent: 60,
      },
    });

    const input = createDefaultInput({ sessionMetrics: metrics });
    const ctx = buildCoachingContext(input);
    const prompt = toPrompt(ctx);

    expect(prompt.user).toContain('JUNK VOLUME DETECTED');
  });
});
