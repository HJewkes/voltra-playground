/**
 * RecommendationCard
 *
 * Displays the final weight recommendation with analysis and warmup sequence.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrainingGoal, type DiscoveryRecommendation } from '@/domain/planning';
import { getExerciseName } from '@/domain/exercise';
import { colors, getConfidenceColor } from '@/theme';
import { Card, CardContent, HStack, VStack, Surface } from '@titan-design/react-ui';

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
        className="mb-4 items-center rounded-3xl p-6"
        style={{
          backgroundColor: colors.success.DEFAULT + '15',
          borderWidth: 1,
          borderColor: colors.success.DEFAULT + '30',
        }}
      >
        <View
          className="mb-4 h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.success.DEFAULT }}
        >
          <Ionicons name="checkmark" size={48} color="white" />
        </View>
        <Text className="mb-2 text-2xl font-bold" style={{ color: colors.success.DEFAULT }}>
          Discovery Complete!
        </Text>
        <Text className="text-center" style={{ color: colors.success.light }}>
          Your optimal working weight has been found.
        </Text>
      </View>

      {/* Main recommendation */}
      <Card elevation={1} className="mb-4">
        <CardContent className="p-6">
          <Text className="mb-2 text-sm font-medium text-content-muted">
            {exerciseId ? getExerciseName(exerciseId) : 'Exercise'} • {GOAL_LABELS[goal]}
          </Text>

          <View className="mb-5 flex-row items-baseline">
            <Text className="text-6xl font-bold" style={{ color: colors.primary[500] }}>
              {recommendation.workingWeight}
            </Text>
            <Text className="ml-2 text-2xl text-content-muted">lbs</Text>
          </View>

          <Surface elevation={0} className="rounded-xl bg-surface-input">
            <HStack justify="between" style={{ padding: 16 }}>
              <View className="flex-1 items-center">
                <Text className="text-sm text-content-muted">Rep Range</Text>
                <Text className="mt-1 text-lg font-bold text-content-primary">
                  {recommendation.repRange[0]}-{recommendation.repRange[1]}
                </Text>
              </View>
              <View className="w-px bg-surface-100" />
              <View className="flex-1 items-center">
                <Text className="text-sm text-content-muted">Confidence</Text>
                <Text
                  className="mt-1 text-lg font-bold"
                  style={{ color: getConfidenceColor(recommendation.confidence) }}
                >
                  {recommendation.confidence.charAt(0).toUpperCase() +
                    recommendation.confidence.slice(1)}
                </Text>
              </View>
            </HStack>
          </Surface>
        </CardContent>
      </Card>

      {/* Analysis */}
      <Card elevation={1} className="mb-4">
        <CardContent className="p-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
            Analysis
          </Text>
          <Text className="leading-6 text-content-secondary">{recommendation.explanation}</Text>
        </CardContent>
      </Card>

      {/* Warmup sequence */}
      {recommendation.warmupSets && recommendation.warmupSets.length > 0 && (
        <Card elevation={1} className="mb-4">
          <CardContent className="p-6">
            <Text className="mb-4 text-xs font-bold uppercase tracking-wider text-content-muted">
              Recommended Warmup
            </Text>
            {recommendation.warmupSets.map((set, i: number) => (
              <View
                key={i}
                className={`flex-row items-center justify-between py-3 ${
                  i < recommendation.warmupSets!.length - 1 ? 'border-b border-surface-100' : ''
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className="mr-4 h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: colors.surface.dark }}
                  >
                    <Text className="font-bold text-content-secondary">{i + 1}</Text>
                  </View>
                  <Text className="font-medium text-content-primary">
                    {set.weight} lbs × {set.reps}
                  </Text>
                </View>
                <Text className="text-sm text-content-muted">{set.restSeconds}s rest</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <VStack gap={2} style={{ marginBottom: 32 }}>
        <TouchableOpacity
          className="items-center rounded-2xl p-5"
          style={{ backgroundColor: colors.primary[600] }}
          onPress={handleStartTraining}
          activeOpacity={0.8}
        >
          <Text className="text-lg font-bold text-white">Start Training</Text>
        </TouchableOpacity>

        {onDiscoverAnother && (
          <TouchableOpacity
            className="items-center rounded-2xl p-5"
            style={{ backgroundColor: colors.surface.card }}
            onPress={onDiscoverAnother}
            activeOpacity={0.7}
          >
            <Text className="font-bold text-content-secondary">Discover Another Exercise</Text>
          </TouchableOpacity>
        )}
      </VStack>
    </ScrollView>
  );
}
