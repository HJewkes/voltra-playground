/**
 * ManualLogScreen
 *
 * Quick-entry screen for logging free weight sets that aren't connected
 * to a Voltra device. Stores data per-day via ManualLogRepository.
 *
 * Designed for speed: exercise name persists between sets so the user
 * only needs to change weight/reps and tap "Log Set".
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Surface, getSemanticColors, alpha } from '@titan-design/react-ui';

import { getManualLogRepository } from '@/data/provider';
import { createManualSetLog, type ManualSetLog } from '@/data/manual-log';

const t = getSemanticColors('dark');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupedSets {
  exerciseName: string;
  sets: ManualSetLog[];
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function ManualLogScreen() {
  const repo = useMemo(() => getManualLogRepository(), []);

  const [exerciseName, setExerciseName] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showRpe, setShowRpe] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [todaySets, setTodaySets] = useState<ManualSetLog[]>([]);
  const [knownNames, setKnownNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const weightRef = useRef<TextInput>(null);
  const repsRef = useRef<TextInput>(null);

  // Load today's logs and exercise name history on mount
  useEffect(() => {
    void repo.getToday().then(setTodaySets);
    void repo.getExerciseNames().then(setKnownNames);
  }, [repo]);

  const canLog = exerciseName.trim().length > 0
    && weight.length > 0
    && reps.length > 0
    && Number(weight) > 0
    && Number(reps) > 0;

  const handleLog = useCallback(async () => {
    if (!canLog) return;

    const log = createManualSetLog({
      exerciseName: exerciseName.trim(),
      weight: Number(weight),
      reps: Number(reps),
      rpe: rpe ?? undefined,
      notes: notes.trim() || undefined,
    });

    await repo.logSet(log);

    const updated = await repo.getToday();
    setTodaySets(updated);

    const names = await repo.getExerciseNames();
    setKnownNames(names);

    // Keep exercise name, clear set-specific fields for rapid re-entry
    setWeight('');
    setReps('');
    setNotes('');
    setRpe(null);
    setShowRpe(false);
    setShowNotes(false);

    weightRef.current?.focus();
  }, [canLog, exerciseName, weight, reps, rpe, notes, repo]);

  const filteredSuggestions = useMemo(() => {
    if (!exerciseName.trim()) return knownNames.slice(0, 8);
    const lower = exerciseName.toLowerCase();
    return knownNames
      .filter((n) => n.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [exerciseName, knownNames]);

  const grouped = useMemo(() => groupSetsByExercise(todaySets), [todaySets]);

  const handleSelectSuggestion = useCallback((name: string) => {
    setExerciseName(name);
    setShowSuggestions(false);
    weightRef.current?.focus();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface-400" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-center px-4 pt-2 pb-1 gap-2">
        <Ionicons name="barbell-outline" size={18} color={t['brand-primary']} />
        <Text className="text-base font-bold text-text-primary">Log Free Weight Set</Text>
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-4 pb-4">
          {/* Entry form */}
          <Surface elevation={1} className="mt-2 rounded-xl py-3 px-4">
            {/* Exercise name */}
            <View>
              <Label text="Exercise" />
              <TextInput
                value={exerciseName}
                onChangeText={(v) => {
                  setExerciseName(v);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay to allow suggestion tap to register
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="e.g. SSB Squat"
                placeholderTextColor={t['text-tertiary']}
                returnKeyType="next"
                onSubmitEditing={() => weightRef.current?.focus()}
                style={inputStyle}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <SuggestionList
                  suggestions={filteredSuggestions}
                  onSelect={handleSelectSuggestion}
                />
              )}
            </View>

            {/* Weight + Reps row */}
            <View className="flex-row gap-3 mt-3">
              <View className="flex-1">
                <Label text="Weight (lbs)" />
                <TextInput
                  ref={weightRef}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="135"
                  placeholderTextColor={t['text-tertiary']}
                  keyboardType="numeric"
                  returnKeyType="next"
                  onSubmitEditing={() => repsRef.current?.focus()}
                  style={inputStyle}
                />
              </View>
              <View className="flex-1">
                <Label text="Reps" />
                <TextInput
                  ref={repsRef}
                  value={reps}
                  onChangeText={setReps}
                  placeholder="8"
                  placeholderTextColor={t['text-tertiary']}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={inputStyle}
                />
              </View>
            </View>

            {/* Optional fields toggle row */}
            <View className="flex-row gap-3 mt-3">
              <ToggleChip
                label="RPE"
                active={showRpe}
                onPress={() => setShowRpe((v) => !v)}
              />
              <ToggleChip
                label="Notes"
                active={showNotes}
                onPress={() => setShowNotes((v) => !v)}
              />
            </View>

            {/* RPE slider */}
            {showRpe && (
              <View className="mt-3">
                <Label text={`RPE: ${rpe ?? '—'}`} />
                <RpeSelector value={rpe} onChange={setRpe} />
              </View>
            )}

            {/* Notes */}
            {showNotes && (
              <View className="mt-3">
                <Label text="Notes" />
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional notes..."
                  placeholderTextColor={t['text-tertiary']}
                  multiline
                  numberOfLines={2}
                  style={[inputStyle, { minHeight: 56, textAlignVertical: 'top' }]}
                />
              </View>
            )}

            {/* Log button */}
            <TouchableOpacity
              onPress={handleLog}
              disabled={!canLog}
              activeOpacity={0.7}
              style={{
                marginTop: 16,
                backgroundColor: canLog ? t['brand-primary'] : alpha(t['brand-primary'], 0.3),
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Log set"
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                Log Set
              </Text>
            </TouchableOpacity>
          </Surface>

          {/* Today's logged sets */}
          {grouped.length > 0 && (
            <View className="mt-4">
              <Text
                className="text-sm font-semibold text-text-secondary mb-2 px-1"
              >
                Logged today
              </Text>
              {grouped.map((group) => (
                <Surface
                  key={group.exerciseName}
                  elevation={1}
                  className="rounded-xl py-2 px-3 mb-2"
                >
                  <Text className="text-sm font-bold text-text-primary">
                    {group.exerciseName}
                  </Text>
                  <Text
                    className="text-xs text-text-secondary mt-0.5"
                    numberOfLines={2}
                  >
                    {group.sets
                      .map((s) => {
                        let label = `${s.weight}x${s.reps}`;
                        if (s.rpe != null) label += ` @${s.rpe}`;
                        return label;
                      })
                      .join(', ')}
                  </Text>
                </Surface>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Label({ text }: { text: string }) {
  return (
    <Text className="text-xs font-semibold text-text-secondary mb-1">
      {text}
    </Text>
  );
}

function SuggestionList({
  suggestions,
  onSelect,
}: {
  suggestions: string[];
  onSelect: (name: string) => void;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: '#1a1a1a',
          borderRadius: 8,
          marginTop: 4,
        },
        Platform.OS === 'web'
          ? ({ boxShadow: `0 4px 12px ${alpha('#000', 0.4)}` } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            },
      ]}
    >
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            activeOpacity={0.6}
            style={{ paddingVertical: 10, paddingHorizontal: 12 }}
          >
            <Text style={{ color: t['text-primary'], fontSize: 14 }}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: active
          ? alpha(t['brand-primary'], 0.15)
          : alpha('#fff', 0.06),
        borderWidth: active ? 1 : 0,
        borderColor: active ? alpha(t['brand-primary'], 0.3) : 'transparent',
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Ionicons
        name={active ? 'chevron-up' : 'chevron-down'}
        size={12}
        color={active ? t['brand-primary'] : t['text-tertiary']}
      />
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: active ? t['brand-primary'] : t['text-secondary'],
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function RpeSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2 mt-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const selected = value === n;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(selected ? null : n)}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected
                ? t['brand-primary']
                : alpha('#fff', 0.08),
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`RPE ${n}`}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: selected ? '700' : '500',
                color: selected ? '#fff' : t['text-secondary'],
              }}
            >
              {n}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupSetsByExercise(sets: ManualSetLog[]): GroupedSets[] {
  const map = new Map<string, ManualSetLog[]>();
  for (const s of sets) {
    const existing = map.get(s.exerciseName);
    if (existing) {
      existing.push(s);
    } else {
      map.set(s.exerciseName, [s]);
    }
  }
  return Array.from(map.entries()).map(([exerciseName, group]) => ({
    exerciseName,
    sets: group,
  }));
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputStyle = {
  backgroundColor: alpha('#fff', 0.06),
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  fontSize: 15,
  color: t['text-primary'],
} as const;
