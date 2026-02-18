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
import { Card, CardContent, HStack, VStack, Surface, getSemanticColors, alpha } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

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
          backgroundColor: alpha(t['status-success'], 0.08),
          borderWidth: 1,
          borderColor: alpha(t['status-success'], 0.19),
        }}
      >
        <View
          className="mb-4 h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: t['status-success'] }}
        >
          <Ionicons name="checkmark" size={48} color="white" />
        </View>
        <Text className="mb-2 text-2xl font-bold text-status-success">
          Discovery Complete!
        </Text>
        <Text className="text-center text-status-success-light">
          Your optimal working weight has been found.
        </Text>
      </View>

      {/* Main recommendation */}
      <Card elevation={1} className="mb-4">
        <CardContent className="p-6">
          <Text className="mb-2 text-sm font-medium text-text-disabled">
            {exerciseId ? getExerciseName(exerciseId) : 'Exercise'} • {GOAL_LABELS[goal]}
          </Text>

          <View className="mb-5 flex-row items-baseline">
            <Text className="text-6xl font-bold text-brand-primary">
              {recommendation.workingWeight}
            </Text>
            <Text className="ml-2 text-2xl text-text-disabled">lbs</Text>
          </View>

          <Surface elevation={0} className="rounded-xl bg-surface-input">
            <HStack justify="between" style={{ padding: 16 }}>
              <View className="flex-1 items-center">
                <Text className="text-sm text-text-disabled">Rep Range</Text>
                <Text className="mt-1 text-lg font-bold text-text-primary">
                  {recommendation.repRange[0]}-{recommendation.repRange[1]}
                </Text>
              </View>
              <View className="w-px bg-surface-100" />
              <View className="flex-1 items-center">
                <Text className="text-sm text-text-disabled">Confidence</Text>
                <Text
                  className="mt-1 text-lg font-bold"
                  style={{
                    color:
                      recommendation.confidence === 'high'
                        ? t['status-success']
                        : recommendation.confidence === 'medium'
                          ? t['status-warning']
                          : t['text-tertiary'],
                  }}
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
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-disabled">
            Analysis
          </Text>
          <Text className="leading-6 text-text-secondary">{recommendation.explanation}</Text>
        </CardContent>
      </Card>

      {/* Warmup sequence */}
      {recommendation.warmupSets && recommendation.warmupSets.length > 0 && (
        <Card elevation={1} className="mb-4">
          <CardContent className="p-6">
            <Text className="mb-4 text-xs font-bold uppercase tracking-wider text-text-disabled">
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
                    style={{ backgroundColor: t['background-subtle'] }}
                  >
                    <Text className="font-bold text-text-secondary">{i + 1}</Text>
                  </View>
                  <Text className="font-medium text-text-primary">
                    {set.weight} lbs × {set.reps}
                  </Text>
                </View>
                <Text className="text-sm text-text-disabled">{set.restSeconds}s rest</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <VStack gap={2} style={{ marginBottom: 32 }}>
        <TouchableOpacity
          className="items-center rounded-2xl p-5"
          style={{ backgroundColor: t['brand-primary-dark'] }}
          onPress={handleStartTraining}
          activeOpacity={0.8}
        >
          <Text className="text-lg font-bold text-white">Start Training</Text>
        </TouchableOpacity>

        {onDiscoverAnother && (
          <TouchableOpacity
            className="items-center rounded-2xl p-5"
            style={{ backgroundColor: t['surface-elevated'] }}
            onPress={onDiscoverAnother}
            activeOpacity={0.7}
          >
            <Text className="font-bold text-text-secondary">Discover Another Exercise</Text>
          </TouchableOpacity>
        )}
      </VStack>
    </ScrollView>
  );
}
