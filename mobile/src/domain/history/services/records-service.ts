/**
 * Records Service
 *
 * Computes personal records from set history.
 */

import type { CompletedSet } from '@/domain/workout';
import { getSetPeakVelocity } from '@voltras/workout-analytics';
import type { PersonalRecord } from '../models';

/**
 * Compute personal records from a list of sets.
 */
export function computePersonalRecords(sets: CompletedSet[]): PersonalRecord[] {
  if (sets.length === 0) return [];

  const records: PersonalRecord[] = [];

  // Max weight
  let maxWeightSet = sets[0];
  for (const s of sets) {
    if (s.weight > maxWeightSet.weight) {
      maxWeightSet = s;
    }
  }
  records.push({
    type: 'max_weight',
    value: maxWeightSet.weight,
    weight: maxWeightSet.weight,
    reps: maxWeightSet.data.reps.length,
    date: maxWeightSet.timestamp.start,
    setId: maxWeightSet.id,
  });

  // Max reps (at any weight)
  let maxRepsSet = sets[0];
  for (const s of sets) {
    if (s.data.reps.length > maxRepsSet.data.reps.length) {
      maxRepsSet = s;
    }
  }
  records.push({
    type: 'max_reps',
    value: maxRepsSet.data.reps.length,
    weight: maxRepsSet.weight,
    reps: maxRepsSet.data.reps.length,
    date: maxRepsSet.timestamp.start,
    setId: maxRepsSet.id,
  });

  // Max velocity (peak from any rep)
  let maxVelSet = sets[0];
  let maxVel = getSetPeakVelocity(maxVelSet.data);
  for (const s of sets) {
    const peakVel = getSetPeakVelocity(s.data);
    if (peakVel > maxVel) {
      maxVel = peakVel;
      maxVelSet = s;
    }
  }
  records.push({
    type: 'max_velocity',
    value: maxVel,
    weight: maxVelSet.weight,
    date: maxVelSet.timestamp.start,
    setId: maxVelSet.id,
  });

  // Max volume (weight × reps)
  let maxVolSet = sets[0];
  let maxVol = maxVolSet.weight * maxVolSet.data.reps.length;
  for (const s of sets) {
    const vol = s.weight * s.data.reps.length;
    if (vol > maxVol) {
      maxVol = vol;
      maxVolSet = s;
    }
  }
  records.push({
    type: 'max_volume',
    value: maxVol,
    weight: maxVolSet.weight,
    reps: maxVolSet.data.reps.length,
    date: maxVolSet.timestamp.start,
    setId: maxVolSet.id,
  });

  return records;
}
