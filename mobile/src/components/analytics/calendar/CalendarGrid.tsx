/**
 * CalendarGrid
 *
 * Monthly calendar view with dot markers on days that have workouts.
 * Supports month navigation and day selection.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { getCalendarDays, toDateKey } from '@/domain/history';

const t = getSemanticColors('dark');
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface CalendarGridProps {
  year: number;
  month: number;
  workoutDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

/**
 * CalendarGrid - monthly calendar with workout markers.
 */
export function CalendarGrid({
  year,
  month,
  workoutDates,
  selectedDate,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
}: CalendarGridProps) {
  const days = getCalendarDays(year, month);
  const todayKey = toDateKey(Date.now());
  const monthName = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View>
      {/* Month navigation header */}
      <View className="mb-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={onPreviousMonth} className="p-2">
          <Ionicons name="chevron-back" size={24} color={t['text-primary']} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-text-primary">{monthName}</Text>
        <TouchableOpacity onPress={onNextMonth} className="p-2">
          <Ionicons name="chevron-forward" size={24} color={t['text-primary']} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View className="mb-2 flex-row">
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} className="flex-1 items-center">
            <Text className="text-xs font-semibold text-text-disabled">{label}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {Array.from({ length: 6 }, (_, weekIndex) => (
        <View key={weekIndex} className="flex-row">
          {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((dateKey) => {
            const dayNum = parseInt(dateKey.split('-')[2], 10);
            const dayMonth = parseInt(dateKey.split('-')[1], 10) - 1;
            const isCurrentMonth = dayMonth === month;
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDate;
            const hasWorkout = workoutDates.has(dateKey);

            return (
              <TouchableOpacity
                key={dateKey}
                onPress={() => onSelectDate(dateKey)}
                className="flex-1 items-center py-1"
              >
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={[
                    isSelected && { backgroundColor: t['brand-primary'] },
                    isToday && !isSelected && {
                      borderWidth: 1,
                      borderColor: t['brand-primary'],
                    },
                  ].filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {})}
                >
                  <Text
                    style={{
                      color: isSelected
                        ? '#FFFFFF'
                        : isCurrentMonth
                          ? t['text-primary']
                          : t['text-disabled'],
                      fontWeight: isToday || isSelected ? '700' : '400',
                      fontSize: 14,
                    }}
                  >
                    {dayNum}
                  </Text>
                </View>
                {/* Workout dot */}
                <View
                  className="mt-0.5 h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: hasWorkout
                      ? isSelected
                        ? t['brand-primary']
                        : alpha(t['brand-primary'], 0.8)
                      : 'transparent',
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
