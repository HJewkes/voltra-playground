import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHistoryStore } from '@/stores';
import { getEffortLabel } from '@/analytics';
import { colors, getRPEColor } from '@/theme';
import type { StoredWorkout } from '@/data';

export default function History() {
  const { 
    recentWorkouts, 
    aggregateStats,
    isLoading,
    loadRecentWorkouts,
    deleteWorkout,
  } = useHistoryStore();
  
  const [selectedWorkout, setSelectedWorkout] = useState<StoredWorkout | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    loadRecentWorkouts(100);
  }, [loadRecentWorkouts]);
  
  const handleRefresh = useCallback(async () => {
    await loadRecentWorkouts(100);
  }, [loadRecentWorkouts]);
  
  const handleViewDetails = (workout: StoredWorkout) => {
    setSelectedWorkout(workout);
    setShowDetails(true);
  };
  
  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteWorkout(id),
        },
      ]
    );
  };
  
  const getRPEBadgeStyle = (rpe: number | undefined) => {
    if (!rpe) return { bg: colors.surface.dark, text: colors.text.muted };
    if (rpe <= 6) return { bg: colors.success + '20', text: colors.success };
    if (rpe <= 8) return { bg: colors.warning + '20', text: colors.warning };
    return { bg: colors.danger + '20', text: colors.danger };
  };
  
  const getWorkoutRPE = (workout: StoredWorkout): number => {
    return Math.round(workout.analytics?.estimatedRPE ?? 0);
  };
  
  return (
    <ScrollView 
      className="flex-1 bg-surface-400"
      refreshControl={
        <RefreshControl 
          refreshing={isLoading} 
          onRefresh={handleRefresh}
          tintColor={colors.primary[500]}
        />
      }
    >
      <View className="p-4">
        {/* Header Stats */}
        <View 
          className="rounded-3xl p-6 mb-6 border border-surface-100"
          style={[{ backgroundColor: colors.surface.card }]}
        >
          <Text className="text-lg font-bold text-content-primary mb-5">
            All Time Stats
          </Text>
          
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-4xl font-bold" style={{ color: colors.primary[500] }}>
                {aggregateStats.totalWorkouts}
              </Text>
              <Text className="text-content-tertiary text-sm mt-1">Workouts</Text>
            </View>
            <View className="w-px bg-surface-100 mx-2" />
            <View className="items-center flex-1">
              <Text className="text-4xl font-bold" style={{ color: colors.primary[500] }}>
                {aggregateStats.totalReps}
              </Text>
              <Text className="text-content-tertiary text-sm mt-1">Total Reps</Text>
            </View>
            <View className="w-px bg-surface-100 mx-2" />
            <View className="items-center flex-1">
              <Text className="text-4xl font-bold" style={{ color: colors.primary[500] }}>
                {aggregateStats.totalVolume.toLocaleString()}
              </Text>
              <Text className="text-content-tertiary text-sm mt-1">lbs Lifted</Text>
            </View>
          </View>
        </View>
        
        {/* Workout List */}
        <Text className="text-lg font-bold text-content-primary mb-4">
          Past Workouts
        </Text>
        
        {recentWorkouts.length === 0 ? (
          <View 
            className="rounded-3xl p-10 items-center border border-surface-100"
            style={[{ backgroundColor: colors.surface.card }]}
          >
            <View 
              className="w-24 h-24 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: colors.surface.dark }}
            >
              <Ionicons name="fitness-outline" size={48} color={colors.text.muted} />
            </View>
            <Text className="text-2xl font-bold text-content-primary mb-2">
              No Workouts Yet
            </Text>
            <Text className="text-content-secondary text-center">
              Complete your first workout to see it here
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {recentWorkouts.map((workout) => {
              const avgRPE = getWorkoutRPE(workout);
              const repCount = workout.reps?.length ?? 0;
              const formattedDate = new Date(workout.date).toLocaleDateString();
              const badgeStyle = getRPEBadgeStyle(avgRPE);
              
              return (
                <TouchableOpacity
                  key={workout.id}
                  onPress={() => handleViewDetails(workout)}
                  onLongPress={() => handleDelete(workout.id)}
                  className="rounded-2xl p-4 flex-row items-center border border-surface-100"
                  style={[{ backgroundColor: colors.surface.card }]}
                  activeOpacity={0.7}
                >
                  <View 
                    className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                    style={{ backgroundColor: colors.primary[600] + '20' }}
                  >
                    <Ionicons name="fitness" size={26} color={colors.primary[500]} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-content-primary text-base">
                      {workout.exerciseName || 'Workout'}
                    </Text>
                    <Text className="text-content-tertiary text-sm mt-1">
                      {formattedDate}
                    </Text>
                  </View>
                  <View className="items-end mr-3">
                    <Text className="font-bold text-base" style={{ color: colors.primary[500] }}>
                      {repCount} reps
                    </Text>
                    <Text className="text-content-tertiary text-sm mt-1">
                      {workout.weight} lbs
                    </Text>
                  </View>
                  {avgRPE > 0 && (
                    <View 
                      className="px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: badgeStyle.bg }}
                    >
                      <Text className="text-xs font-bold" style={{ color: badgeStyle.text }}>
                        RPE {avgRPE}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        
        {/* Tip */}
        {recentWorkouts.length > 0 && (
          <Text className="text-content-muted text-xs text-center mt-6">
            Long press a workout to delete it
          </Text>
        )}
      </View>
      
      {/* Workout Details Modal */}
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetails(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View 
            className="rounded-t-3xl p-6 max-h-[85%]"
            style={{ backgroundColor: colors.surface.elevated }}
          >
            <View className="items-center mb-5">
              <View className="w-12 h-1 rounded-full mb-4" style={{ backgroundColor: colors.surface.light }} />
              <Text className="text-2xl font-bold text-content-primary">
                {selectedWorkout?.exerciseName || 'Workout Details'}
              </Text>
              <Text className="text-content-tertiary mt-1">
                {selectedWorkout && new Date(selectedWorkout.date).toLocaleDateString()}
              </Text>
            </View>
            
            {selectedWorkout && (
              <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
                {/* Summary Stats */}
                <View 
                  className="flex-row justify-around mb-5 py-5 rounded-2xl"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <View className="items-center">
                    <Text className="text-3xl font-bold" style={{ color: colors.primary[500] }}>
                      {selectedWorkout.reps?.length ?? 0}
                    </Text>
                    <Text className="text-content-tertiary text-sm mt-1">Reps</Text>
                  </View>
                  <View className="w-px bg-surface-100" />
                  <View className="items-center">
                    <Text className="text-3xl font-bold text-content-primary">
                      {selectedWorkout.weight}
                    </Text>
                    <Text className="text-content-tertiary text-sm mt-1">lbs</Text>
                  </View>
                  <View className="w-px bg-surface-100" />
                  <View className="items-center">
                    <Text 
                      className="text-3xl font-bold"
                      style={{ color: getRPEColor(getWorkoutRPE(selectedWorkout) || 5) }}
                    >
                      {getWorkoutRPE(selectedWorkout) || '—'}
                    </Text>
                    <Text className="text-content-tertiary text-sm mt-1">RPE</Text>
                  </View>
                </View>
                
                {/* Analytics */}
                {selectedWorkout.analytics && (
                  <View className="mb-5">
                    <Text className="text-content-secondary font-bold mb-3">Analytics</Text>
                    <View 
                      className="rounded-2xl p-5"
                      style={{ backgroundColor: colors.surface.dark }}
                    >
                      <View className="flex-row justify-between mb-3">
                        <Text className="text-content-tertiary">Effort</Text>
                        <Text className="font-bold text-content-primary">
                          {getEffortLabel(selectedWorkout.analytics.estimatedRPE)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mb-3">
                        <Text className="text-content-tertiary">Velocity Loss</Text>
                        <Text className="font-bold text-content-primary">
                          {selectedWorkout.analytics.velocityLossPercent}%
                        </Text>
                      </View>
                      <View className="flex-row justify-between mb-3">
                        <Text className="text-content-tertiary">Time Under Tension</Text>
                        <Text className="font-bold text-content-primary">
                          {selectedWorkout.analytics.timeUnderTension.toFixed(1)}s
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-content-tertiary">Avg Velocity</Text>
                        <Text className="font-bold text-content-primary">
                          {selectedWorkout.analytics.avgVelocity.toFixed(2)} m/s
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                
                {/* Per-Rep Data */}
                {selectedWorkout.reps && selectedWorkout.reps.length > 0 && (
                  <View className="mb-5">
                    <Text className="text-content-secondary font-bold mb-3">Per-Rep Breakdown</Text>
                    <View 
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: colors.surface.dark }}
                    >
                      {selectedWorkout.reps.map((rep, index) => (
                        <View 
                          key={index}
                          className={`py-3 ${index < selectedWorkout.reps!.length - 1 ? 'border-b border-surface-100' : ''}`}
                        >
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-content-primary font-bold">Rep {rep.repNumber}</Text>
                            {rep.concentricTime && rep.eccentricTime && (
                              <Text className="text-content-tertiary text-sm">
                                {rep.eccentricTime.toFixed(1)}-{rep.concentricTime.toFixed(1)}s
                              </Text>
                            )}
                          </View>
                          <View className="flex-row justify-between">
                            {rep.peakForce != null && (
                              <Text className="text-content-muted text-xs">
                                Force: {Math.round(rep.peakForce)}
                              </Text>
                            )}
                            {rep.maxVelocity != null && (
                              <Text className="text-content-muted text-xs">
                                Vel: {rep.maxVelocity.toFixed(2)}
                              </Text>
                            )}
                            {rep.durationSeconds != null && (
                              <Text className="text-content-muted text-xs">
                                Dur: {rep.durationSeconds.toFixed(1)}s
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity
              onPress={() => setShowDetails(false)}
              className="py-4 rounded-2xl mt-4"
              style={{ backgroundColor: colors.surface.card }}
              activeOpacity={0.7}
            >
              <Text className="text-content-primary text-center font-bold text-lg">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
