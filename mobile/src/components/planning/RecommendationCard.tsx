/**
 * RecommendationCard
 * 
 * Displays the final weight recommendation with analysis and warmup sequence.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrainingGoal, type DiscoveryRecommendation } from '@/domain/planning';
import { getExerciseName } from '@/domain/exercise';
import { colors, getConfidenceColor } from '@/theme';
import { Card, Stack, Surface } from '../ui';

type WeightRecommendation = DiscoveryRecommendation;

export interface RecommendationCardProps {
  /** The weight recommendation data */
  recommendation: WeightRecommendation;
  /** Selected exercise ID */
  exerciseId: string | null;
  /** Selected training goal */
  goal: TrainingGoal;
  /** Called when user wants to start training */
  onStartTraining?: () => void;
  /** Called when user wants to discover another exercise */
  onDiscoverAnother?: () => void;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
}

const GOAL_LABELS: Record<TrainingGoal, string> = {
  [TrainingGoal.STRENGTH]: 'Strength',
  [TrainingGoal.HYPERTROPHY]: 'Muscle Growth',
  [TrainingGoal.ENDURANCE]: 'Endurance',
};

/**
 * RecommendationCard component - displays discovery results.
 * 
 * @example
 * ```tsx
 * <RecommendationCard
 *   recommendation={recommendation}
 *   exerciseId={selectedExercise}
 *   goal={selectedGoal}
 *   onStartTraining={() => navigation.navigate('Workout')}
 *   onDiscoverAnother={handleReset}
 * />
 * ```
 */
export function RecommendationCard({
  recommendation,
  exerciseId,
  goal,
  onStartTraining,
  onDiscoverAnother,
  style,
}: RecommendationCardProps) {
  const handleStartTraining = () => {
    if (onStartTraining) {
      onStartTraining();
    } else {
      Alert.alert('Ready!', `Go to Workout tab. Weight: ${recommendation.workingWeight} lbs`);
    }
  };
  
  return (
    <ScrollView style={style} className="flex-1">
      {/* Success banner */}
      <View 
        className="rounded-3xl p-6 mb-4 items-center"
        style={{ 
          backgroundColor: colors.success.DEFAULT + '15',
          borderWidth: 1,
          borderColor: colors.success.DEFAULT + '30',
        }}
      >
        <View 
          className="w-20 h-20 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: colors.success.DEFAULT }}
        >
          <Ionicons name="checkmark" size={48} color="white" />
        </View>
        <Text className="font-bold text-2xl mb-2" style={{ color: colors.success.DEFAULT }}>
          Discovery Complete!
        </Text>
        <Text className="text-center" style={{ color: colors.success.light }}>
          Your optimal working weight has been found.
        </Text>
      </View>
      
      {/* Main recommendation */}
      <Card elevation={1} padding="lg">
        <Text className="text-content-muted font-medium text-sm mb-2">
          {exerciseId ? getExerciseName(exerciseId) : 'Exercise'} • {GOAL_LABELS[goal]}
        </Text>
        
        <View className="flex-row items-baseline mb-5">
          <Text className="text-6xl font-bold" style={{ color: colors.primary[500] }}>
            {recommendation.workingWeight}
          </Text>
          <Text className="text-2xl text-content-muted ml-2">lbs</Text>
        </View>
        
        <Surface elevation="inset" radius="lg" border={false}>
          <Stack direction="row" justify="space-between" style={{ padding: 16 }}>
            <View className="items-center flex-1">
              <Text className="text-content-muted text-sm">Rep Range</Text>
              <Text className="text-content-primary font-bold text-lg mt-1">
                {recommendation.repRange[0]}-{recommendation.repRange[1]}
              </Text>
            </View>
            <View className="w-px bg-surface-100" />
            <View className="items-center flex-1">
              <Text className="text-content-muted text-sm">Confidence</Text>
              <Text 
                className="font-bold text-lg mt-1"
                style={{ color: getConfidenceColor(recommendation.confidence) }}
              >
                {recommendation.confidence.charAt(0).toUpperCase() + recommendation.confidence.slice(1)}
              </Text>
            </View>
          </Stack>
        </Surface>
      </Card>
      
      {/* Analysis */}
      <Card elevation={1} padding="lg">
        <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">
          Analysis
        </Text>
        <Text className="text-content-secondary leading-6">
          {recommendation.explanation}
        </Text>
      </Card>
      
      {/* Warmup sequence */}
      {recommendation.warmupSets && recommendation.warmupSets.length > 0 && (
        <Card elevation={1} padding="lg">
          <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-4">
            Recommended Warmup
          </Text>
          {recommendation.warmupSets.map((set, i: number) => (
            <View 
              key={i} 
              className={`flex-row justify-between items-center py-3 ${
                i < recommendation.warmupSets!.length - 1 ? 'border-b border-surface-100' : ''
              }`}
            >
              <View className="flex-row items-center">
                <View 
                  className="w-9 h-9 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <Text className="text-content-secondary font-bold">{i + 1}</Text>
                </View>
                <Text className="text-content-primary font-medium">
                  {set.weight} lbs × {set.reps}
                </Text>
              </View>
              <Text className="text-content-muted text-sm">{set.restSeconds}s rest</Text>
            </View>
          ))}
        </Card>
      )}
      
      {/* Action buttons */}
      <Stack gap="sm" style={{ marginBottom: 32 }}>
        <TouchableOpacity
          className="rounded-2xl p-5 items-center"
          style={{ backgroundColor: colors.primary[600] }}
          onPress={handleStartTraining}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-lg">Start Training</Text>
        </TouchableOpacity>
        
        {onDiscoverAnother && (
          <TouchableOpacity
            className="rounded-2xl p-5 items-center"
            style={{ backgroundColor: colors.surface.card }}
            onPress={onDiscoverAnother}
            activeOpacity={0.7}
          >
            <Text className="text-content-secondary font-bold">Discover Another Exercise</Text>
          </TouchableOpacity>
        )}
      </Stack>
    </ScrollView>
  );
}
