/**
 * ExercisePickerModal
 *
 * Scrollable overlay listing catalog exercises grouped by muscle group.
 * Each row shows the exercise name, cable position, and attachment info.
 * Tapping a row fires onSelect and closes the modal.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { webStyle } from '@/utils/web-style';

import { MuscleGroup } from '@/domain/exercise/types';
import { EXERCISE_CATALOG, type Exercise } from '@/domain/exercise/catalog';

const t = getSemanticColors('dark');

// Display-friendly labels for muscle groups
const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  [MuscleGroup.CHEST]: 'Chest',
  [MuscleGroup.BACK]: 'Back',
  [MuscleGroup.SHOULDERS]: 'Shoulders',
  [MuscleGroup.BICEPS]: 'Biceps',
  [MuscleGroup.TRICEPS]: 'Triceps',
  [MuscleGroup.QUADS]: 'Quads',
  [MuscleGroup.HAMSTRINGS]: 'Hamstrings',
  [MuscleGroup.GLUTES]: 'Glutes',
  [MuscleGroup.CORE]: 'Core',
  [MuscleGroup.CALVES]: 'Calves',
};

// Ordered list of groups for display
const GROUP_ORDER: MuscleGroup[] = [
  MuscleGroup.CHEST,
  MuscleGroup.BACK,
  MuscleGroup.SHOULDERS,
  MuscleGroup.BICEPS,
  MuscleGroup.TRICEPS,
  MuscleGroup.QUADS,
  MuscleGroup.HAMSTRINGS,
  MuscleGroup.GLUTES,
  MuscleGroup.CORE,
  MuscleGroup.CALVES,
];

const CABLE_ICON: Record<string, string> = {
  high: '\u2191',
  mid: '\u2194',
  low: '\u2193',
};

export interface ExercisePickerModalProps {
  visible: boolean;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
  /** Exercise IDs to exclude (e.g. "general") */
  excludeIds?: string[];
}

export function ExercisePickerModal({
  visible,
  onSelect,
  onClose,
  excludeIds = ['general'],
}: ExercisePickerModalProps) {
  const grouped = useMemo(() => {
    const exercises = Object.values(EXERCISE_CATALOG).filter((e) => !excludeIds.includes(e.id));

    const groups = new Map<MuscleGroup, Exercise[]>();
    for (const exercise of exercises) {
      const primary = exercise.muscleGroups[0];
      if (!primary) continue;
      const list = groups.get(primary) ?? [];
      list.push(exercise);
      groups.set(primary, list);
    }

    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
      group: g,
      label: MUSCLE_GROUP_LABELS[g],
      exercises: groups.get(g)!,
    }));
  }, [excludeIds]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: alpha('#000', 0.6),
          justifyContent: 'flex-end',
        }}
      >
        {/* Prevent taps inside the sheet from closing */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '80%',
            backgroundColor: '#1a1a1a',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            ...Platform.select({
              web: webStyle({
                boxShadow: `0 -4px 24px ${alpha('#000', 0.5)}`,
              }),
              default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 12,
              },
            }),
          }}
        >
          {/* Handle + header */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: alpha('#fff', 0.2),
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingBottom: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: t['text-primary'] }}>
              Next Exercise
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={t['text-tertiary']} />
            </Pressable>
          </View>

          {/* Scrollable exercise list */}
          <ScrollView
            style={{ paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {grouped.map(({ group, label, exercises }) => (
              <View key={group} style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: t['text-tertiary'],
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 6,
                    paddingHorizontal: 4,
                  }}
                >
                  {label}
                </Text>
                {exercises.map((exercise) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    onPress={() => onSelect(exercise)}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ExerciseRow({ exercise, onPress }: { exercise: Exercise; onPress: () => void }) {
  const setup = exercise.equipmentSetup;
  const cableLabel = setup?.cablePath
    ? `${CABLE_ICON[setup.cablePath] ?? ''} ${setup.cablePath}`
    : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${exercise.name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 2,
        borderRadius: 10,
        backgroundColor: pressed ? alpha('#fff', 0.06) : 'transparent',
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: t['text-primary'] }}>
          {exercise.name}
        </Text>
        {setup && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {cableLabel && (
              <Text style={{ fontSize: 11, color: t['text-tertiary'] }}>{cableLabel}</Text>
            )}
            {setup.attachment && (
              <Text style={{ fontSize: 11, color: t['text-tertiary'], flex: 1 }} numberOfLines={1}>
                {setup.attachment}
              </Text>
            )}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={t['text-tertiary']} />
    </Pressable>
  );
}
