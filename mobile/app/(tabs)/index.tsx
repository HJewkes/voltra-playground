import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore, useHistoryStore } from '@/stores';
import { colors, shadows } from '@/theme';
import type { StoredWorkout } from '@/data';

export default function Dashboard() {
  const { primaryDeviceId, devices } = useSessionStore();
  const { recentWorkouts, aggregateStats, loadRecentWorkouts } = useHistoryStore();
  
  const connectedDevice = primaryDeviceId ? devices.get(primaryDeviceId) : null;
  const isConnected = !!connectedDevice;
  const deviceName = connectedDevice?.getState().deviceName ?? 'Voltra';
  
  useEffect(() => {
    loadRecentWorkouts(50);
  }, [loadRecentWorkouts]);
  
  const displayWorkouts: StoredWorkout[] = recentWorkouts.slice(0, 5);
  
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeekWorkouts = recentWorkouts.filter(w => w.date > oneWeekAgo);
  const thisWeekReps = thisWeekWorkouts.reduce((sum, w) => sum + (w.reps?.length ?? 0), 0);
  const thisWeekVolume = thisWeekWorkouts.reduce((sum, w) => sum + w.weight * (w.reps?.length ?? 0), 0);

  return (
    <ScrollView className="flex-1 bg-surface-400">
      <View className="p-4">
        {/* Welcome Card */}
        <View 
          className="rounded-2xl p-6 mb-6 border border-surface-100"
          style={[
            { backgroundColor: isConnected ? colors.success : colors.primary[600] },
            shadows.elevated,
          ]}
        >
          <View className="flex-row items-center mb-3">
            <View 
              className="w-12 h-12 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <Ionicons 
                name={isConnected ? 'flash' : 'fitness'} 
                size={24} 
                color="white" 
              />
            </View>
            <View>
              <Text className="text-white text-lg font-bold">
                {isConnected ? `Connected to ${deviceName}` : 'Ready to Train'}
              </Text>
              <Text className="text-white/80 text-sm">
                {isConnected ? 'Device ready for workout' : 'Connect your Voltra to start'}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Quick Actions */}
        <Text className="text-content-primary text-lg font-bold mb-4">
          Quick Actions
        </Text>
        
        <View className="flex-row gap-4 mb-6">
          <Link href="/(tabs)/workout" asChild>
            <TouchableOpacity 
              className="flex-1 rounded-2xl p-5 border border-surface-100"
              style={{ backgroundColor: colors.surface.card, ...shadows.card }}
            >
              <View 
                className="w-14 h-14 rounded-xl items-center justify-center mb-4"
                style={{ backgroundColor: colors.primary[600] + '20' }}
              >
                <Ionicons name="fitness" size={28} color={colors.primary[500]} />
              </View>
              <Text className="text-content-primary font-semibold text-base">Start Workout</Text>
              <Text className="text-content-tertiary text-sm mt-1">Begin a new session</Text>
            </TouchableOpacity>
          </Link>
          
          <Link href="/(tabs)/settings" asChild>
            <TouchableOpacity 
              className="flex-1 rounded-2xl p-5 border border-surface-100"
              style={{ backgroundColor: colors.surface.card, ...shadows.card }}
            >
              <View 
                className="w-14 h-14 rounded-xl items-center justify-center mb-4"
                style={{ backgroundColor: isConnected ? colors.success + '20' : colors.surface.light }}
              >
                <Ionicons 
                  name={isConnected ? 'bluetooth' : 'bluetooth-outline'} 
                  size={28} 
                  color={isConnected ? colors.success : colors.text.tertiary} 
                />
              </View>
              <Text className="text-content-primary font-semibold text-base">
                {isConnected ? 'Connected' : 'Connect'}
              </Text>
              <Text className="text-content-tertiary text-sm mt-1">
                {isConnected ? deviceName : 'Set up device'}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
        
        {/* Weekly Stats */}
        <Text className="text-content-primary text-lg font-bold mb-4">
          This Week
        </Text>
        
        <View className="flex-row gap-4 mb-6">
          <View 
            className="flex-1 rounded-2xl p-5 border border-surface-100"
            style={{ backgroundColor: colors.surface.card, ...shadows.pressed }}
          >
            <Text className="text-content-tertiary text-sm mb-1">Workouts</Text>
            <Text className="text-content-primary text-2xl font-bold">{thisWeekWorkouts.length}</Text>
          </View>
          <View 
            className="flex-1 rounded-2xl p-5 border border-surface-100"
            style={{ backgroundColor: colors.surface.card, ...shadows.pressed }}
          >
            <Text className="text-content-tertiary text-sm mb-1">Total Reps</Text>
            <Text className="text-content-primary text-2xl font-bold">{thisWeekReps}</Text>
          </View>
          <View 
            className="flex-1 rounded-2xl p-5 border border-surface-100"
            style={{ backgroundColor: colors.surface.card, ...shadows.pressed }}
          >
            <Text className="text-content-tertiary text-sm mb-1">Volume</Text>
            <Text className="text-content-primary text-2xl font-bold">
              {thisWeekVolume > 1000 ? `${(thisWeekVolume / 1000).toFixed(1)}k` : thisWeekVolume}
            </Text>
          </View>
        </View>
        
        {/* Recent Workouts */}
        {displayWorkouts.length > 0 && (
          <>
            <Text className="text-content-primary text-lg font-bold mb-4">
              Recent Workouts
            </Text>
            
            <View 
              className="rounded-2xl overflow-hidden border border-surface-100"
              style={{ backgroundColor: colors.surface.card, ...shadows.card }}
            >
              {displayWorkouts.map((workout, index) => {
                const formattedDate = new Date(workout.date).toLocaleDateString();
                const repCount = workout.reps?.length ?? 0;
                return (
                  <Link key={workout.id} href="/(tabs)/history" asChild>
                    <TouchableOpacity 
                      className={`flex-row items-center p-4 ${
                        index < displayWorkouts.length - 1 ? 'border-b border-surface-100' : ''
                      }`}
                      activeOpacity={0.7}
                    >
                      <View 
                        className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                        style={{ backgroundColor: colors.primary[600] + '20' }}
                      >
                        <Ionicons name="fitness" size={22} color={colors.primary[500]} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-content-primary text-base">
                          {workout.exerciseName || 'Workout'}
                        </Text>
                        <Text className="text-content-tertiary text-sm mt-0.5">{formattedDate}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-bold text-base" style={{ color: colors.primary[500] }}>
                          {repCount} reps
                        </Text>
                        <Text className="text-content-muted text-sm">{workout.weight} lbs</Text>
                      </View>
                    </TouchableOpacity>
                  </Link>
                );
              })}
            </View>
          </>
        )}
        
        {/* Empty State */}
        {displayWorkouts.length === 0 && (
          <View 
            className="rounded-2xl p-8 items-center border border-surface-100"
            style={{ backgroundColor: colors.surface.card, ...shadows.card }}
          >
            <Ionicons name="barbell-outline" size={48} color={colors.text.muted} />
            <Text className="text-content-secondary text-lg font-semibold mt-4">No workouts yet</Text>
            <Text className="text-content-muted text-center mt-2">
              Start your first workout to see your progress here
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
