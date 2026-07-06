/**
 * TrainingLogScreen
 *
 * Calendar view of training history with weekly volume tracking.
 * Shows workout dots on calendar days and weekly volume vs MEV/MAV/MRV.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { getSemanticColors } from '@titan-design/react-ui';
import { getSessionRepository } from '@/data/provider';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { TrainingLevel } from '@/domain/planning/types';
import {
  groupSessionsByDate,
  getWorkoutDates,
  computeWeeklyVolume,
  compareVolumeLandmarks,
} from '@/domain/history';
import { CalendarGrid, DayDetail, WeeklyVolumeCard } from '@/components/analytics/calendar';

const t = getSemanticColors('dark');

/**
 * TrainingLogScreen - calendar + weekly volume view.
 */
export function TrainingLogScreen() {
  const [sessions, setSessions] = useState<StoredExerciseSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const recent = await getSessionRepository().getRecent(500);
      const completed = recent.filter((s) => s.status === 'completed');
      setSessions(completed);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const workoutDates = useMemo(() => getWorkoutDates(sessions), [sessions]);

  const dayMap = useMemo(() => groupSessionsByDate(sessions), [sessions]);

  const selectedDay = useMemo(
    () => (selectedDate ? (dayMap.get(selectedDate) ?? null) : null),
    [selectedDate, dayMap]
  );

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [selectedDate]);

  const weeklyVolume = useMemo(() => {
    const targetDate = selectedDate ? new Date(selectedDate) : new Date(viewYear, viewMonth, 15);
    return computeWeeklyVolume(sessions, targetDate);
  }, [sessions, selectedDate, viewYear, viewMonth]);

  const volumeComparisons = useMemo(
    () => compareVolumeLandmarks(weeklyVolume.muscleVolumes, TrainingLevel.INTERMEDIATE),
    [weeklyVolume]
  );

  const weekLabel = useMemo(
    () => `${weeklyVolume.weekStart} to ${weeklyVolume.weekEnd}`,
    [weeklyVolume]
  );

  const handlePreviousMonth = useCallback(() => {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  return (
    <ScrollView
      className="bg-surface-400 flex-1"
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={loadSessions}
          tintColor={t['brand-primary']}
        />
      }
    >
      <View className="p-4">
        {/* Calendar */}
        <CalendarGrid
          year={viewYear}
          month={viewMonth}
          workoutDates={workoutDates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
        />

        {/* Day detail */}
        {selectedDate && (
          <View className="mt-4">
            <DayDetail day={selectedDay} dateLabel={selectedDateLabel} />
          </View>
        )}

        {/* Weekly volume */}
        <View className="mt-4">
          <WeeklyVolumeCard
            comparisons={volumeComparisons}
            level={TrainingLevel.INTERMEDIATE}
            weekLabel={weekLabel}
          />
        </View>
      </View>
    </ScrollView>
  );
}
