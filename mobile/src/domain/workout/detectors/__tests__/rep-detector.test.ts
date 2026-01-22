/**
 * Rep Detector Tests
 *
 * Tests for the rep detection state machine.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RepDetector } from '../rep-detector';
import { MovementPhase, createSample } from '@/domain/workout';

// =============================================================================
// Test Helpers
// =============================================================================

function createSampleSequence(phases: { phase: MovementPhase; count: number }[]) {
  const samples = [];
  let sequence = 0;
  let timestamp = 1000;

  for (const { phase, count } of phases) {
    for (let i = 0; i < count; i++) {
      samples.push(
        createSample(
          sequence++,
          timestamp,
          phase,
          phase === MovementPhase.CONCENTRIC ? i / count : 1 - i / count,
          phase === MovementPhase.IDLE ? 0 : 0.5,
          100
        )
      );
      timestamp += 90;
    }
  }

  return samples;
}

// =============================================================================
// State Getters Tests
// =============================================================================

describe('RepDetector state getters', () => {
  let detector: RepDetector;

  beforeEach(() => {
    detector = new RepDetector();
  });

  describe('initial state', () => {
    it('starts in idle state', () => {
      expect(detector.state).toBe('idle');
    });

    it('starts with zero rep count', () => {
      expect(detector.repCount).toBe(0);
    });

    it('is not in rep initially', () => {
      expect(detector.isInRep).toBe(false);
    });
  });

  describe('state property', () => {
    it('returns current state', () => {
      const sample = createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.5, 100);
      detector.processSample(sample);

      expect(detector.state).toBe('concentric');
    });
  });

  describe('repCount property', () => {
    it('increments after completed rep', () => {
      const samples = createSampleSequence([
        { phase: MovementPhase.CONCENTRIC, count: 5 },
        { phase: MovementPhase.ECCENTRIC, count: 5 },
        { phase: MovementPhase.IDLE, count: 1 },
      ]);

      for (const sample of samples) {
        detector.processSample(sample);
      }

      expect(detector.repCount).toBe(1);
    });
  });

  describe('isInRep property', () => {
    it('returns true when in concentric', () => {
      const sample = createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.5, 100);
      detector.processSample(sample);

      expect(detector.isInRep).toBe(true);
    });

    it('returns true when in eccentric', () => {
      const samples = createSampleSequence([
        { phase: MovementPhase.CONCENTRIC, count: 3 },
        { phase: MovementPhase.ECCENTRIC, count: 1 },
      ]);

      for (const sample of samples) {
        detector.processSample(sample);
      }

      expect(detector.isInRep).toBe(true);
    });

    it('returns false when idle', () => {
      expect(detector.isInRep).toBe(false);
    });
  });
});

// =============================================================================
// Full Rep Cycle Tests
// =============================================================================

describe('RepDetector full rep cycle', () => {
  let detector: RepDetector;

  beforeEach(() => {
    detector = new RepDetector();
  });

  it('detects complete rep with hold phase', () => {
    const samples = createSampleSequence([
      { phase: MovementPhase.IDLE, count: 2 },
      { phase: MovementPhase.CONCENTRIC, count: 5 },
      { phase: MovementPhase.HOLD, count: 2 },
      { phase: MovementPhase.ECCENTRIC, count: 5 },
      { phase: MovementPhase.IDLE, count: 1 },
    ]);

    let boundary = null;
    for (const sample of samples) {
      const result = detector.processSample(sample);
      if (result) boundary = result;
    }

    expect(boundary).not.toBeNull();
    expect(boundary!.repNumber).toBe(1);
    expect(boundary!.phaseSamples.concentric.length).toBe(5);
    expect(boundary!.phaseSamples.holdAtTop.length).toBe(2);
    expect(boundary!.phaseSamples.eccentric.length).toBe(5);
  });

  it('detects complete rep without hold (skip-hold path)', () => {
    const samples = createSampleSequence([
      { phase: MovementPhase.CONCENTRIC, count: 5 },
      { phase: MovementPhase.ECCENTRIC, count: 5 },
      { phase: MovementPhase.IDLE, count: 1 },
    ]);

    let boundary = null;
    for (const sample of samples) {
      const result = detector.processSample(sample);
      if (result) boundary = result;
    }

    expect(boundary).not.toBeNull();
    expect(boundary!.repNumber).toBe(1);
    expect(boundary!.phaseSamples.holdAtTop.length).toBe(0);
  });

  it('returns null for abandoned rep (concentric -> idle)', () => {
    const samples = createSampleSequence([
      { phase: MovementPhase.CONCENTRIC, count: 5 },
      { phase: MovementPhase.IDLE, count: 1 }, // Abandoned - no eccentric
    ]);

    let boundary = null;
    for (const sample of samples) {
      const result = detector.processSample(sample);
      if (result) boundary = result;
    }

    // Should not produce boundary (rep abandoned)
    expect(boundary).toBeNull();
    expect(detector.state).toBe('idle');
    expect(detector.repCount).toBe(0);
  });
});

// =============================================================================
// Multiple Reps Tests
// =============================================================================

describe('RepDetector multiple consecutive reps', () => {
  let detector: RepDetector;

  beforeEach(() => {
    detector = new RepDetector();
  });

  it('detects multiple reps', () => {
    const samples = [];
    for (let rep = 0; rep < 3; rep++) {
      samples.push(
        ...createSampleSequence([
          { phase: MovementPhase.CONCENTRIC, count: 5 },
          { phase: MovementPhase.ECCENTRIC, count: 5 },
          { phase: MovementPhase.IDLE, count: 2 },
        ])
      );
    }

    let repCount = 0;
    for (const sample of samples) {
      const boundary = detector.processSample(sample);
      if (boundary) repCount++;
    }

    expect(repCount).toBe(3);
    expect(detector.repCount).toBe(3);
  });

  it('maintains correct rep numbers', () => {
    const boundaries = [];
    for (let rep = 0; rep < 3; rep++) {
      const repSamples = createSampleSequence([
        { phase: MovementPhase.CONCENTRIC, count: 5 },
        { phase: MovementPhase.ECCENTRIC, count: 5 },
        { phase: MovementPhase.IDLE, count: 2 },
      ]);

      for (const sample of repSamples) {
        const boundary = detector.processSample(sample);
        if (boundary) boundaries.push(boundary);
      }
    }

    expect(boundaries[0].repNumber).toBe(1);
    expect(boundaries[1].repNumber).toBe(2);
    expect(boundaries[2].repNumber).toBe(3);
  });
});

// =============================================================================
// forceComplete() Tests
// =============================================================================

describe('RepDetector forceComplete()', () => {
  let detector: RepDetector;

  beforeEach(() => {
    detector = new RepDetector();
  });

  it('completes rep when in eccentric', () => {
    const samples = createSampleSequence([
      { phase: MovementPhase.CONCENTRIC, count: 5 },
      { phase: MovementPhase.ECCENTRIC, count: 3 },
    ]);

    for (const sample of samples) {
      detector.processSample(sample);
    }

    const boundary = detector.forceComplete();

    expect(boundary).not.toBeNull();
    expect(boundary!.repNumber).toBe(1);
    expect(detector.state).toBe('idle');
  });

  it('returns null when not in eccentric', () => {
    const samples = createSampleSequence([{ phase: MovementPhase.CONCENTRIC, count: 5 }]);

    for (const sample of samples) {
      detector.processSample(sample);
    }

    const boundary = detector.forceComplete();

    expect(boundary).toBeNull();
    expect(detector.state).toBe('concentric');
  });

  it('returns null when idle', () => {
    const boundary = detector.forceComplete();

    expect(boundary).toBeNull();
  });
});

// =============================================================================
// reset() Tests
// =============================================================================

describe('RepDetector reset()', () => {
  let detector: RepDetector;

  beforeEach(() => {
    detector = new RepDetector();
  });

  it('resets state to idle', () => {
    const sample = createSample(0, 1000, MovementPhase.CONCENTRIC, 0, 0.5, 100);
    detector.processSample(sample);

    expect(detector.state).toBe('concentric');

    detector.reset();

    expect(detector.state).toBe('idle');
  });

  it('resets rep count to zero', () => {
    const samples = createSampleSequence([
      { phase: MovementPhase.CONCENTRIC, count: 5 },
      { phase: MovementPhase.ECCENTRIC, count: 5 },
      { phase: MovementPhase.IDLE, count: 1 },
    ]);

    for (const sample of samples) {
      detector.processSample(sample);
    }

    expect(detector.repCount).toBe(1);

    detector.reset();

    expect(detector.repCount).toBe(0);
  });

  it('clears all tracked samples', () => {
    const samples = createSampleSequence([{ phase: MovementPhase.CONCENTRIC, count: 5 }]);

    for (const sample of samples) {
      detector.processSample(sample);
    }

    detector.reset();

    // After reset, should be able to start fresh
    const newSamples = createSampleSequence([
      { phase: MovementPhase.CONCENTRIC, count: 5 },
      { phase: MovementPhase.ECCENTRIC, count: 5 },
      { phase: MovementPhase.IDLE, count: 1 },
    ]);

    let boundary = null;
    for (const sample of newSamples) {
      const result = detector.processSample(sample);
      if (result) boundary = result;
    }

    expect(boundary).not.toBeNull();
    expect(boundary!.repNumber).toBe(1);
  });
});

// =============================================================================
// State Transition Edge Cases
// =============================================================================

describe('RepDetector state transitions', () => {
  let detector: RepDetector;

  beforeEach(() => {
    detector = new RepDetector();
  });

  it('handles hold to concentric transition (resumed pull)', () => {
    const samples = createSampleSequence([
      { phase: MovementPhase.CONCENTRIC, count: 3 },
      { phase: MovementPhase.HOLD, count: 2 },
      { phase: MovementPhase.CONCENTRIC, count: 3 }, // Resume pull
      { phase: MovementPhase.ECCENTRIC, count: 5 },
      { phase: MovementPhase.IDLE, count: 1 },
    ]);

    let boundary = null;
    for (const sample of samples) {
      const result = detector.processSample(sample);
      if (result) boundary = result;
    }

    expect(boundary).not.toBeNull();
    expect(boundary!.repNumber).toBe(1);
    // Should have collected all concentric samples
    expect(boundary!.phaseSamples.concentric.length).toBe(6);
  });

  it('handles hold at bottom during eccentric', () => {
    const samples = createSampleSequence([
      { phase: MovementPhase.CONCENTRIC, count: 5 },
      { phase: MovementPhase.ECCENTRIC, count: 3 },
      { phase: MovementPhase.HOLD, count: 2 }, // Hold at bottom
      { phase: MovementPhase.IDLE, count: 1 },
    ]);

    let boundary = null;
    for (const sample of samples) {
      const result = detector.processSample(sample);
      if (result) boundary = result;
    }

    expect(boundary).not.toBeNull();
    expect(boundary!.phaseSamples.holdAtBottom.length).toBe(2);
  });

  it('stays in idle when receiving idle samples', () => {
    const samples = createSampleSequence([{ phase: MovementPhase.IDLE, count: 10 }]);

    for (const sample of samples) {
      detector.processSample(sample);
    }

    expect(detector.state).toBe('idle');
    expect(detector.repCount).toBe(0);
  });
});

// =============================================================================
// Integration with Behavioral Fixtures
// =============================================================================

describe('RepDetector with Behavioral Fixtures', () => {
  it('detects explosive rep correctly', async () => {
    const { generateExplosiveRep } = await import('@/__fixtures__/generators');
    const { samples } = generateExplosiveRep();

    const detector = new RepDetector();
    let boundary = null;

    for (const sample of samples) {
      const result = detector.processSample(sample);
      if (result) boundary = result;
    }

    expect(boundary).not.toBeNull();
    expect(boundary!.repNumber).toBe(1);
    expect(boundary!.phaseSamples.concentric.length).toBeGreaterThan(0);
    expect(boundary!.phaseSamples.eccentric.length).toBeGreaterThan(0);
  });

  it('does not detect failed rep', async () => {
    const { generateFailedRep } = await import('@/__fixtures__/generators');
    const { samples } = generateFailedRep();

    const detector = new RepDetector();
    let boundary = null;

    for (const sample of samples) {
      const result = detector.processSample(sample);
      if (result) boundary = result;
    }

    // Failed reps don't complete (no eccentric)
    expect(boundary).toBeNull();
    expect(detector.repCount).toBe(0);
  });

  it('detects multiple reps from set composition', async () => {
    const { generateSetFromBehaviors } = await import('@/__fixtures__/generators');
    const { samples } = generateSetFromBehaviors(['normal', 'normal', 'fatiguing']);

    const detector = new RepDetector();
    let repCount = 0;

    for (const sample of samples) {
      const boundary = detector.processSample(sample);
      if (boundary) repCount++;
    }

    expect(repCount).toBe(3);
    expect(detector.repCount).toBe(3);
  });
});
