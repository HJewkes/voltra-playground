/**
 * Sample Generator Tests
 *
 * Tests for WorkoutSample and sample stream generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateWorkoutSample,
  generateSampleStream,
  resetSequence,
} from '../generators/sample-generator';
import { MovementPhase } from '@/domain/workout';

// =============================================================================
// Tests
// =============================================================================

describe('Sample Generator', () => {
  beforeEach(() => {
    resetSequence();
  });

  describe('generateWorkoutSample()', () => {
    it('returns valid WorkoutSample with all required fields', () => {
      const sample = generateWorkoutSample();

      expect(sample).toHaveProperty('sequence');
      expect(sample).toHaveProperty('timestamp');
      expect(sample).toHaveProperty('phase');
      expect(sample).toHaveProperty('position');
      expect(sample).toHaveProperty('velocity');
      expect(sample).toHaveProperty('force');
    });

    it('uses provided options when specified', () => {
      const sample = generateWorkoutSample({
        sequence: 42,
        timestamp: 1000,
        phase: MovementPhase.CONCENTRIC,
        position: 0.5,
        velocity: 0.8,
        force: 100,
      });

      expect(sample.sequence).toBe(42);
      expect(sample.timestamp).toBe(1000);
      expect(sample.phase).toBe(MovementPhase.CONCENTRIC);
      expect(sample.position).toBe(0.5);
      expect(sample.velocity).toBe(0.8);
      expect(sample.force).toBe(100);
    });

    it('increments sequence automatically when not specified', () => {
      const sample1 = generateWorkoutSample();
      const sample2 = generateWorkoutSample();
      const sample3 = generateWorkoutSample();

      expect(sample1.sequence).toBe(0);
      expect(sample2.sequence).toBe(1);
      expect(sample3.sequence).toBe(2);
    });

    it('defaults to IDLE phase', () => {
      const sample = generateWorkoutSample();
      expect(sample.phase).toBe(MovementPhase.IDLE);
    });
  });

  describe('resetSequence()', () => {
    it('resets the sequence counter', () => {
      generateWorkoutSample();
      generateWorkoutSample();
      expect(generateWorkoutSample().sequence).toBe(2);

      resetSequence();

      expect(generateWorkoutSample().sequence).toBe(0);
    });
  });

  describe('generateSampleStream()', () => {
    it('generates samples for specified rep count', () => {
      const samples = generateSampleStream({ repCount: 3 });

      // Should have samples (exact count depends on timing parameters)
      expect(samples.length).toBeGreaterThan(0);
    });

    it('includes all movement phases', () => {
      const samples = generateSampleStream({ repCount: 2 });

      const phases = new Set(samples.map(s => s.phase));

      expect(phases.has(MovementPhase.IDLE)).toBe(true);
      expect(phases.has(MovementPhase.CONCENTRIC)).toBe(true);
      expect(phases.has(MovementPhase.HOLD)).toBe(true);
      expect(phases.has(MovementPhase.ECCENTRIC)).toBe(true);
    });

    it('applies fatigue (velocity decreases across reps)', () => {
      const samples = generateSampleStream({
        repCount: 3,
        startingVelocity: 1.0,
        fatigueRate: 0.1,
      });

      // Find concentric samples and group by rep
      const concentricSamples = samples.filter(
        s => s.phase === MovementPhase.CONCENTRIC
      );

      // Get peak velocity from first and last rep's concentric phases
      // First rep samples come first, last rep samples come last
      const firstRepSamples = concentricSamples.slice(0, 10);
      const lastRepSamples = concentricSamples.slice(-10);

      const firstRepPeak = Math.max(...firstRepSamples.map(s => s.velocity));
      const lastRepPeak = Math.max(...lastRepSamples.map(s => s.velocity));

      expect(lastRepPeak).toBeLessThan(firstRepPeak);
    });

    it('timestamps increment correctly', () => {
      const samples = generateSampleStream({
        repCount: 1,
        sampleRate: 11, // 11 Hz = ~91ms per sample
      });

      // Check timestamps are increasing
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i].timestamp).toBeGreaterThan(samples[i - 1].timestamp);
      }

      // Check approximate sample rate (should be ~91ms apart)
      const deltas: number[] = [];
      for (let i = 1; i < Math.min(10, samples.length); i++) {
        deltas.push(samples[i].timestamp - samples[i - 1].timestamp);
      }
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

      // 1000ms / 11Hz ≈ 91ms, allow some tolerance
      expect(avgDelta).toBeGreaterThan(80);
      expect(avgDelta).toBeLessThan(100);
    });

    it('sequences are continuous', () => {
      const samples = generateSampleStream({ repCount: 2 });

      for (let i = 0; i < samples.length; i++) {
        expect(samples[i].sequence).toBe(i);
      }
    });

    it('uses provided startTime', () => {
      const startTime = 1000000;
      const samples = generateSampleStream({
        repCount: 1,
        startTime,
      });

      expect(samples[0].timestamp).toBe(startTime);
    });

    it('force is proportional to weight', () => {
      const lightSamples = generateSampleStream({ repCount: 1, weight: 50 });
      const heavySamples = generateSampleStream({ repCount: 1, weight: 200 });

      const lightMaxForce = Math.max(
        ...lightSamples.filter(s => s.phase === MovementPhase.CONCENTRIC).map(s => s.force)
      );
      const heavyMaxForce = Math.max(
        ...heavySamples.filter(s => s.phase === MovementPhase.CONCENTRIC).map(s => s.force)
      );

      expect(heavyMaxForce).toBeGreaterThan(lightMaxForce);
    });
  });
});
