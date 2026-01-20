/**
 * Records Service
 * 
 * Computes personal records from set history.
 */

import type { Set } from '@/domain/workout';
import type { PersonalRecord } from '../models';

/**
 * Compute personal records from a list of sets.
 */
export function computePersonalRecords(sets: Set[]): PersonalRecord[] {
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
    reps: maxWeightSet.reps.length,
    date: maxWeightSet.timestamp.start,
    setId: maxWeightSet.id,
  });
  
  // Max reps (at any weight)
  let maxRepsSet = sets[0];
  for (const s of sets) {
    if (s.reps.length > maxRepsSet.reps.length) {
      maxRepsSet = s;
    }
  }
  records.push({
    type: 'max_reps',
    value: maxRepsSet.reps.length,
    weight: maxRepsSet.weight,
    reps: maxRepsSet.reps.length,
    date: maxRepsSet.timestamp.start,
    setId: maxRepsSet.id,
  });
  
  // Max velocity (peak concentric from any rep)
  let maxVelSet = sets[0];
  let maxVel = getMaxPeakVelocity(maxVelSet);
  for (const s of sets) {
    const peakVel = getMaxPeakVelocity(s);
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
  let maxVol = maxVolSet.weight * maxVolSet.reps.length;
  for (const s of sets) {
    const vol = s.weight * s.reps.length;
    if (vol > maxVol) {
      maxVol = vol;
      maxVolSet = s;
    }
  }
  records.push({
    type: 'max_volume',
    value: maxVol,
    weight: maxVolSet.weight,
    reps: maxVolSet.reps.length,
    date: maxVolSet.timestamp.start,
    setId: maxVolSet.id,
  });
  
  return records;
}

/**
 * Get maximum peak concentric velocity from a set's reps.
 */
function getMaxPeakVelocity(set: Set): number {
  if (set.reps.length === 0) return 0;
  return Math.max(...set.reps.map(r => r.metrics.concentricPeakVelocity));
}
