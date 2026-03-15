/**
 * PlanLoader — clipboard import button + active plan header with coaching cues.
 */

import React, { useCallback } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getSemanticColors, alpha } from '@titan-design/react-ui';

import type { WorkoutPlan, WorkoutExercise } from '@/domain/workout/models/workout-plan';
import { validateWorkoutPlan } from '@/domain/workout/models/workout-plan';
import { getWorkoutPlanRepository } from '@/data/provider';

const t = getSemanticColors('dark');

export interface PlanLoaderProps {
  workoutPlan: WorkoutPlan | null;
  planExerciseIndex: number;
  currentPlanExercise: WorkoutExercise | null;
  isActive: boolean;
  uiState: string;
  onPlanLoaded: (plan: WorkoutPlan) => void;
}

export function PlanLoader({
  workoutPlan,
  planExerciseIndex,
  currentPlanExercise,
  isActive,
  uiState,
  onPlanLoaded,
}: PlanLoaderProps) {
  const handleLoadPlan = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        Alert.alert('Empty Clipboard', 'Copy a workout plan JSON to your clipboard first.');
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        Alert.alert('Invalid JSON', 'Clipboard content is not valid JSON.');
        return;
      }

      const error = validateWorkoutPlan(parsed);
      if (error) {
        Alert.alert('Invalid Plan', error);
        return;
      }

      const plan = parsed as WorkoutPlan;

      const repo = getWorkoutPlanRepository();
      await repo.saveWorkoutPlan(plan);

      onPlanLoaded(plan);

      Alert.alert('Plan Loaded', `"${plan.name}" — ${plan.exercises.length} exercises`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Error', `Failed to load plan: ${message}`);
    }
  }, [onPlanLoaded]);

  const showImportButton = !isActive && uiState !== 'resting' && uiState !== 'results' && !workoutPlan;

  return (
    <>
      {/* Workout plan header */}
      {workoutPlan && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: alpha(t['brand-primary'], 0.08),
            borderBottomWidth: 1,
            borderBottomColor: alpha(t['brand-primary'], 0.15),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="clipboard-outline" size={14} color={t['brand-primary']} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: t['brand-primary'], flex: 1 }}>
              {workoutPlan.name}
            </Text>
            <Text style={{ fontSize: 11, color: t['text-tertiary'] }}>
              {planExerciseIndex + 1}/{workoutPlan.exercises.length}
            </Text>
          </View>
          {workoutPlan.coach && (
            <Text style={{ fontSize: 10, color: t['text-tertiary'], marginTop: 2 }}>
              Coach: {workoutPlan.coach}
            </Text>
          )}
        </View>
      )}

      {/* Coaching cues for current plan exercise */}
      {currentPlanExercise?.cues && currentPlanExercise.cues.length > 0 && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: alpha('#FFD700', 0.06),
            borderBottomWidth: 1,
            borderBottomColor: alpha('#FFD700', 0.1),
          }}
        >
          {currentPlanExercise.cues.map((cue, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
              <Text style={{ fontSize: 11, color: '#FFD700' }}>*</Text>
              <Text style={{ fontSize: 11, color: t['text-secondary'], flex: 1 }}>{cue}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Import button (inline, rendered within ScrollView by parent) */}
      {showImportButton && (
        <TouchableOpacity
          onPress={handleLoadPlan}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: alpha(t['brand-primary'], 0.1),
            borderRadius: 10,
            paddingVertical: 10,
            marginTop: 4,
            marginBottom: 4,
            borderWidth: 1,
            borderColor: alpha(t['brand-primary'], 0.2),
            borderStyle: 'dashed',
          }}
          accessibilityRole="button"
          accessibilityLabel="Load workout plan from clipboard"
        >
          <Ionicons name="clipboard-outline" size={16} color={t['brand-primary']} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: t['brand-primary'] }}>
            Load Plan from Clipboard
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}
