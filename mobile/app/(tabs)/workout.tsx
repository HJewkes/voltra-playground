import { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useStore } from 'zustand';
import { useSessionStore, useHistoryStore } from '@/stores';
import type { VoltraStoreApi } from '@/stores';
import { MovementPhase, PhaseNames } from '@/protocol';
import { 
  analyzeWorkout, 
  getEffortLabel, 
  getRIRDescription,
} from '@/analytics';
import { ForceCurveChart, VelocityTrendChart, ConnectDevice } from '@/components';
import { colors, getRPEColor } from '@/theme';
import type { StoredWorkout, StoredWorkoutAnalytics, StoredRepData } from '@/data';

export default function Workout() {
  const { width: screenWidth } = useWindowDimensions();
  
  const { primaryDeviceId, devices } = useSessionStore();
  const { saveWorkout } = useHistoryStore();
  
  const voltraStore = primaryDeviceId ? devices.get(primaryDeviceId) : null;
  
  const [selectedWeight, setSelectedWeight] = useState(50);
  const [showSummary, setShowSummary] = useState(false);
  const [lastAnalytics, setLastAnalytics] = useState<StoredWorkoutAnalytics | null>(null);
  const [lastRepCount, setLastRepCount] = useState(0);
  
  if (!voltraStore) {
    return <ConnectDevice subtitle="Connect to your Voltra to start a workout" />;
  }
  
  return (
    <ConnectedWorkoutView
      voltraStore={voltraStore}
      screenWidth={screenWidth}
      selectedWeight={selectedWeight}
      setSelectedWeight={setSelectedWeight}
      showSummary={showSummary}
      setShowSummary={setShowSummary}
      lastAnalytics={lastAnalytics}
      setLastAnalytics={setLastAnalytics}
      lastRepCount={lastRepCount}
      setLastRepCount={setLastRepCount}
      saveWorkout={saveWorkout}
    />
  );
}

// =============================================================================
// Connected Workout View
// =============================================================================

interface ConnectedWorkoutViewProps {
  voltraStore: VoltraStoreApi;
  screenWidth: number;
  selectedWeight: number;
  setSelectedWeight: (w: number) => void;
  showSummary: boolean;
  setShowSummary: (v: boolean) => void;
  lastAnalytics: StoredWorkoutAnalytics | null;
  setLastAnalytics: (a: StoredWorkoutAnalytics | null) => void;
  lastRepCount: number;
  setLastRepCount: (n: number) => void;
  saveWorkout: (workout: StoredWorkout) => Promise<void>;
}

function ConnectedWorkoutView({
  voltraStore,
  screenWidth,
  selectedWeight,
  setSelectedWeight,
  showSummary,
  setShowSummary,
  lastAnalytics,
  setLastAnalytics,
  lastRepCount,
  setLastRepCount,
  saveWorkout,
}: ConnectedWorkoutViewProps) {
  const weight = useStore(voltraStore, s => s.weight);
  const workoutState = useStore(voltraStore, s => s.workoutState);
  const error = useStore(voltraStore, s => s.error);
  const repCount = useStore(voltraStore, s => s.repCount);
  const reps = useStore(voltraStore, s => s.reps);
  const currentFrame = useStore(voltraStore, s => s.currentFrame);
  const recentFrames = useStore(voltraStore, s => s.recentFrames);
  const liveVelocityLoss = useStore(voltraStore, s => s.liveVelocityLoss);
  const liveRPE = useStore(voltraStore, s => s.liveRPE);
  const liveRIR = useStore(voltraStore, s => s.liveRIR);
  
  const setWeight = useStore(voltraStore, s => s.setWeight);
  const startWorkout = useStore(voltraStore, s => s.startWorkout);
  const stopWorkout = useStore(voltraStore, s => s.stopWorkout);
  
  const isActive = workoutState === 'active';
  
  const liveMessage = useMemo(() => {
    if (repCount < 2) return 'Keep going...';
    if (liveRPE < 6) return 'Feeling light - maintain form';
    if (liveRPE < 7.5) return 'Good pace - controlled effort';
    if (liveRPE < 8.5) return 'Getting harder - stay focused';
    if (liveRPE < 9.5) return 'High effort - 1-2 reps left';
    return 'Maximum effort - consider stopping';
  }, [repCount, liveRPE]);
  
  const velocityTrend = useMemo(() => {
    return reps.map(r => r.maxVelocity);
  }, [reps]);
  
  const handleSetWeight = useCallback(async () => {
    await setWeight(selectedWeight);
  }, [setWeight, selectedWeight]);
  
  const handleStartWorkout = useCallback(async () => {
    if (weight === 0) {
      Alert.alert('Set Weight', 'Please set weight before starting workout');
      return;
    }
    await startWorkout();
  }, [weight, startWorkout]);
  
  const handleStopWorkout = useCallback(async () => {
    const stats = await stopWorkout();
    const analytics = analyzeWorkout(stats);
    
    if (stats.repCount > 0) {
      const storedWorkout: StoredWorkout = {
        id: `workout-${Date.now()}`,
        exerciseId: 'unknown',
        exerciseName: 'Workout',
        date: stats.startTime,
        dateString: new Date(stats.startTime).toLocaleDateString(),
        weight: stats.weightLbs ?? weight,
        reps: stats.reps.map(r => stripFrames(r)),
        duration: stats.totalDuration,
        analytics: {
          velocityLossPercent: analytics.velocityLossPercent,
          estimatedRIR: analytics.estimatedRIR,
          estimatedRPE: analytics.estimatedRPE,
          avgVelocity: analytics.avgVelocity,
          peakVelocity: Math.max(...stats.reps.map(r => r.maxVelocity), 0),
          timeUnderTension: analytics.timeUnderTension,
          avgRepDuration: analytics.avgRepDuration,
          velocityByRep: stats.reps.map(r => r.maxVelocity),
          avgConcentricTime: analytics.avgConcentricTime,
          avgEccentricTime: analytics.avgEccentricTime,
          avgTopPauseTime: analytics.avgTopPauseTime,
          avgBottomPauseTime: analytics.avgBottomPauseTime,
          avgTempo: analytics.avgTempo,
        },
      };
      
      await saveWorkout(storedWorkout);
    }
    
    setLastAnalytics({
      velocityLossPercent: analytics.velocityLossPercent,
      estimatedRIR: analytics.estimatedRIR,
      estimatedRPE: analytics.estimatedRPE,
      avgVelocity: analytics.avgVelocity,
      peakVelocity: Math.max(...stats.reps.map(r => r.maxVelocity), 0),
      timeUnderTension: analytics.timeUnderTension,
      avgRepDuration: analytics.avgRepDuration,
      velocityByRep: stats.reps.map(r => r.maxVelocity),
      avgConcentricTime: analytics.avgConcentricTime,
      avgEccentricTime: analytics.avgEccentricTime,
      avgTopPauseTime: analytics.avgTopPauseTime,
      avgBottomPauseTime: analytics.avgBottomPauseTime,
      avgTempo: analytics.avgTempo,
    });
    setLastRepCount(stats.repCount);
    setShowSummary(true);
  }, [stopWorkout, weight, saveWorkout, setLastAnalytics, setLastRepCount, setShowSummary]);
  
  const getPhaseColor = (phase: MovementPhase) => {
    switch (phase) {
      case MovementPhase.CONCENTRIC:
        return colors.success;
      case MovementPhase.HOLD:
        return colors.warning;
      case MovementPhase.ECCENTRIC:
        return colors.info;
      default:
        return colors.surface.light;
    }
  };
  
  const getPhaseStyle = (phase: MovementPhase) => {
    return { backgroundColor: getPhaseColor(phase) };
  };
  
  return (
    <ScrollView className="flex-1 bg-surface-400">
      <View className="p-4">
        {/* Weight Control (when not active) */}
        {!isActive && (
          <View 
            className="rounded-3xl p-6 mb-4 border border-surface-100"
            style={[{ backgroundColor: colors.surface.card }]}
          >
            <Text className="text-lg font-bold text-content-primary mb-6">
              Set Weight
            </Text>
            
            <View className="flex-row items-center justify-center mb-6">
              <TouchableOpacity
                onPress={() => setSelectedWeight(Math.max(5, selectedWeight - 5))}
                className="w-14 h-14 rounded-full items-center justify-center border border-surface-100"
                style={{ backgroundColor: colors.surface.dark }}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={28} color={colors.text.secondary} />
              </TouchableOpacity>
              
              <View className="mx-10 items-center">
                <Text className="text-6xl font-bold" style={{ color: colors.primary[500] }}>
                  {selectedWeight}
                </Text>
                <Text className="text-content-tertiary text-lg">lbs</Text>
              </View>
              
              <TouchableOpacity
                onPress={() => setSelectedWeight(Math.min(200, selectedWeight + 5))}
                className="w-14 h-14 rounded-full items-center justify-center border border-surface-100"
                style={{ backgroundColor: colors.surface.dark }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={28} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              onPress={handleSetWeight}
              className="rounded-2xl py-4"
              style={[{ backgroundColor: colors.primary[600] }]}
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-bold text-lg">
                Set Weight
              </Text>
            </TouchableOpacity>
            
            {weight > 0 && (
              <Text className="text-center text-content-tertiary mt-3">
                Current: {weight} lbs
              </Text>
            )}
          </View>
        )}
        
        {/* Live Display (when active) */}
        {isActive && (
          <>
            {/* Main Stats Card */}
            <View 
              className="rounded-3xl p-6 mb-4 border border-surface-100"
              style={[{ backgroundColor: colors.surface.card }]}
            >
              {/* Phase Indicator */}
              <View className="flex-row items-center justify-between mb-5">
                <Text className="text-content-secondary font-medium">
                  {weight} lbs
                </Text>
                <View 
                  className="px-5 py-2 rounded-full"
                  style={getPhaseStyle(currentFrame?.phase ?? MovementPhase.IDLE)}
                >
                  <Text className="text-white font-bold text-sm">
                    {PhaseNames[currentFrame?.phase ?? MovementPhase.IDLE]}
                  </Text>
                </View>
              </View>
              
              {/* Rep Counter & Live RPE */}
              <View className="flex-row items-center justify-around mb-5">
                <View className="items-center">
                  <Text className="text-8xl font-bold" style={{ color: colors.primary[500] }}>
                    {repCount}
                  </Text>
                  <Text className="text-content-tertiary text-lg">reps</Text>
                </View>
                
                <View className="w-px h-24" style={{ backgroundColor: colors.surface.light }} />
                
                <View className="items-center">
                  <Text 
                    className="text-6xl font-bold"
                    style={{ color: getRPEColor(liveRPE) }}
                  >
                    {liveRPE.toFixed(1)}
                  </Text>
                  <Text className="text-content-tertiary text-lg">RPE</Text>
                  <Text className="text-content-muted text-sm mt-1">
                    {liveRIR.toFixed(0)} RIR
                  </Text>
                </View>
              </View>
              
              {/* Live Status Message */}
              <View 
                className="rounded-2xl p-4 mb-5"
                style={{ backgroundColor: getRPEColor(liveRPE) + '15' }}
              >
                <Text 
                  className="text-center font-bold text-base"
                  style={{ color: getRPEColor(liveRPE) }}
                >
                  {liveMessage}
                </Text>
              </View>
              
              {/* Position Bar */}
              <View className="mb-5">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-content-tertiary text-sm">Position</Text>
                  <Text className="text-content-secondary text-sm font-medium">
                    {currentFrame?.position ?? 0}
                  </Text>
                </View>
                <View 
                  className="h-3 rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, ((currentFrame?.position ?? 0) / 600) * 100)}%`,
                      backgroundColor: colors.primary[500],
                    }}
                  />
                </View>
              </View>
              
              {/* Quick Stats Grid */}
              <View className="flex-row gap-3">
                <View 
                  className="flex-1 rounded-2xl p-4"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <Text className="text-content-muted text-xs font-medium mb-1">Force</Text>
                  <Text className="text-2xl font-bold text-content-primary">
                    {Math.abs(currentFrame?.force ?? 0)}
                  </Text>
                </View>
                <View 
                  className="flex-1 rounded-2xl p-4"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <Text className="text-content-muted text-xs font-medium mb-1">Velocity</Text>
                  <Text className="text-2xl font-bold text-content-primary">
                    {currentFrame?.velocity ?? 0}
                  </Text>
                </View>
                <View 
                  className="flex-1 rounded-2xl p-4"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <Text className="text-content-muted text-xs font-medium mb-1">Vel Loss</Text>
                  <Text 
                    className="text-2xl font-bold"
                    style={{ color: getRPEColor(liveRPE) }}
                  >
                    {liveVelocityLoss > 0 ? '-' : ''}
                    {Math.round(liveVelocityLoss)}%
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Force Curve Chart */}
            <View 
              className="rounded-3xl p-5 mb-4 border border-surface-100"
              style={[{ backgroundColor: colors.surface.card }]}
            >
              <Text className="text-content-secondary font-bold mb-3">Force Curve</Text>
              <ForceCurveChart
                frames={recentFrames}
                width={screenWidth - 48}
                height={120}
                maxFrames={100}
              />
            </View>
            
            {/* Velocity Trend */}
            {reps.length >= 2 && (
              <View 
                className="rounded-3xl p-5 mb-4 border border-surface-100"
                style={[{ backgroundColor: colors.surface.card }]}
              >
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-content-secondary font-bold">Velocity Trend</Text>
                  <Text className="text-content-muted text-xs">per rep</Text>
                </View>
                <VelocityTrendChart
                  velocities={velocityTrend}
                  width={screenWidth - 48}
                  height={60}
                />
              </View>
            )}
            
            {/* Rep History */}
            {reps.length > 0 && (
              <View 
                className="rounded-3xl p-5 mb-4 border border-surface-100"
                style={[{ backgroundColor: colors.surface.card }]}
              >
                <Text className="text-content-secondary font-bold mb-4">Rep History</Text>
                
                {/* Header */}
                <View className="flex-row pb-3 border-b border-surface-100 mb-2">
                  <Text className="text-content-muted text-xs font-medium w-10">#</Text>
                  <Text className="text-content-muted text-xs font-medium flex-1">Tempo</Text>
                  <Text className="text-content-muted text-xs font-medium w-16 text-right">Vel</Text>
                  <Text className="text-content-muted text-xs font-medium w-16 text-right">Force</Text>
                </View>
                
                {/* Rep rows */}
                {reps.map((rep, index) => {
                  const isLatest = index === reps.length - 1;
                  const tempo = `${rep.eccentricTime.toFixed(1)}-${rep.topPauseTime.toFixed(1)}-${rep.concentricTime.toFixed(1)}-${rep.bottomPauseTime.toFixed(1)}`;
                  return (
                    <View 
                      key={rep.repNumber}
                      className={`flex-row items-center py-3 ${
                        index < reps.length - 1 ? 'border-b border-surface-100/50' : ''
                      }`}
                      style={isLatest ? { 
                        backgroundColor: colors.primary[600] + '15', 
                        marginHorizontal: -12, 
                        paddingHorizontal: 12,
                        borderRadius: 12,
                      } : undefined}
                    >
                      <Text className={`w-10 font-bold ${isLatest ? '' : ''}`} style={{ color: isLatest ? colors.primary[500] : colors.text.secondary }}>
                        {rep.repNumber}
                      </Text>
                      <View className="flex-1">
                        <Text className="text-content-primary text-sm font-mono">
                          {tempo}
                        </Text>
                        <View className="flex-row gap-2 mt-1">
                          <Text className="text-xs" style={{ color: colors.info }}>
                            E:{rep.eccentricTime.toFixed(1)}
                          </Text>
                          {rep.topPauseTime > 0.1 && (
                            <Text className="text-xs" style={{ color: colors.warning }}>
                              P:{rep.topPauseTime.toFixed(1)}
                            </Text>
                          )}
                          <Text className="text-xs" style={{ color: colors.success }}>
                            C:{rep.concentricTime.toFixed(1)}
                          </Text>
                        </View>
                      </View>
                      <Text className={`w-16 text-right font-bold`} style={{ color: isLatest ? colors.primary[500] : colors.text.primary }}>
                        {rep.maxVelocity}
                      </Text>
                      <Text className="w-16 text-right text-content-secondary">
                        {rep.peakForce}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
        
        {/* Start/Stop Button */}
        <TouchableOpacity
          onPress={isActive ? handleStopWorkout : handleStartWorkout}
          className="py-5 rounded-3xl"
          style={[
            { backgroundColor: isActive ? colors.danger : colors.primary[600] },
          ]}
          activeOpacity={0.8}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons 
              name={isActive ? 'stop' : 'play'} 
              size={24} 
              color="white" 
              style={{ marginRight: 8 }}
            />
            <Text className="text-white text-center text-xl font-bold">
              {isActive ? 'Stop Workout' : 'Start Workout'}
            </Text>
          </View>
        </TouchableOpacity>
        
        {/* Error Display */}
        {error && (
          <View 
            className="rounded-2xl p-4 mt-4 flex-row items-center"
            style={{ backgroundColor: colors.danger + '20' }}
          >
            <Ionicons name="alert-circle" size={24} color={colors.danger} />
            <Text className="text-danger-light ml-3 flex-1">{error}</Text>
          </View>
        )}
      </View>
      
      {/* Summary Modal */}
      <Modal
        visible={showSummary}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSummary(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View 
            className="rounded-t-3xl p-6"
            style={{ backgroundColor: colors.surface.elevated }}
          >
            <View className="items-center mb-6">
              <View className="w-12 h-1 rounded-full mb-4" style={{ backgroundColor: colors.surface.light }} />
              <Text className="text-3xl font-bold text-content-primary">
                Set Complete!
              </Text>
            </View>
            
            {lastAnalytics && (
              <>
                {/* Main Stats */}
                <View className="flex-row justify-around mb-6">
                  <View className="items-center">
                    <Text className="text-5xl font-bold" style={{ color: colors.primary[500] }}>
                      {lastRepCount}
                    </Text>
                    <Text className="text-content-tertiary text-base">Reps</Text>
                  </View>
                  <View className="items-center">
                    <Text 
                      className="text-5xl font-bold"
                      style={{ color: getRPEColor(lastAnalytics.estimatedRPE) }}
                    >
                      {lastAnalytics.estimatedRPE}
                    </Text>
                    <Text className="text-content-tertiary text-base">RPE</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-5xl font-bold text-content-primary">
                      {lastAnalytics.estimatedRIR}
                    </Text>
                    <Text className="text-content-tertiary text-base">RIR</Text>
                  </View>
                </View>
                
                {/* Effort Bar */}
                <View 
                  className="rounded-2xl p-5 mb-4"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <View className="flex-row justify-between mb-3">
                    <Text className="text-content-secondary font-bold">Effort</Text>
                    <Text className="text-content-primary font-bold">
                      {getEffortLabel(lastAnalytics.estimatedRPE)}
                    </Text>
                  </View>
                  <View 
                    className="h-4 rounded-full overflow-hidden"
                    style={{ backgroundColor: colors.surface.card }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{ 
                        width: `${lastAnalytics.estimatedRPE * 10}%`,
                        backgroundColor: getRPEColor(lastAnalytics.estimatedRPE),
                      }}
                    />
                  </View>
                  <Text className="text-content-muted text-sm mt-3">
                    {getRIRDescription(lastAnalytics.estimatedRIR)}
                  </Text>
                </View>
                
                {/* Velocity Stats */}
                <View className="flex-row gap-3 mb-4">
                  <View 
                    className="flex-1 rounded-2xl p-4"
                    style={{ backgroundColor: colors.surface.dark }}
                  >
                    <Text className="text-content-muted text-xs font-medium">Velocity Loss</Text>
                    <Text className="text-xl font-bold text-content-primary mt-1">
                      {lastAnalytics.velocityLossPercent > 0 ? '-' : '+'}
                      {Math.abs(lastAnalytics.velocityLossPercent)}%
                    </Text>
                  </View>
                  <View 
                    className="flex-1 rounded-2xl p-4"
                    style={{ backgroundColor: colors.surface.dark }}
                  >
                    <Text className="text-content-muted text-xs font-medium">Avg Velocity</Text>
                    <Text className="text-xl font-bold text-content-primary mt-1">
                      {lastAnalytics.avgVelocity}
                    </Text>
                  </View>
                  <View 
                    className="flex-1 rounded-2xl p-4"
                    style={{ backgroundColor: colors.surface.dark }}
                  >
                    <Text className="text-content-muted text-xs font-medium">TUT</Text>
                    <Text className="text-xl font-bold text-content-primary mt-1">
                      {lastAnalytics.timeUnderTension}s
                    </Text>
                  </View>
                </View>
                
                {/* Tempo */}
                <View 
                  className="rounded-2xl p-5 mb-6"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <View className="flex-row justify-between mb-3">
                    <Text className="text-content-secondary font-bold">Avg Tempo</Text>
                    <Text className="text-content-primary font-bold">
                      {lastAnalytics.avgTempo}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1 items-center">
                      <Text className="font-bold" style={{ color: colors.info }}>
                        {lastAnalytics.avgEccentricTime.toFixed(1)}s
                      </Text>
                      <Text className="text-content-muted text-xs mt-1">Ecc</Text>
                    </View>
                    <View className="flex-1 items-center">
                      <Text className="font-bold" style={{ color: colors.warning }}>
                        {lastAnalytics.avgTopPauseTime.toFixed(1)}s
                      </Text>
                      <Text className="text-content-muted text-xs mt-1">Top</Text>
                    </View>
                    <View className="flex-1 items-center">
                      <Text className="font-bold" style={{ color: colors.success }}>
                        {lastAnalytics.avgConcentricTime.toFixed(1)}s
                      </Text>
                      <Text className="text-content-muted text-xs mt-1">Con</Text>
                    </View>
                    <View className="flex-1 items-center">
                      <Text className="font-bold text-content-secondary">
                        {lastAnalytics.avgBottomPauseTime.toFixed(1)}s
                      </Text>
                      <Text className="text-content-muted text-xs mt-1">Bot</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
            
            <TouchableOpacity
              onPress={() => setShowSummary(false)}
              className="py-5 rounded-2xl"
              style={[{ backgroundColor: colors.primary[600] }]}
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-bold text-lg">
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function stripFrames(rep: import('@/protocol/telemetry').RepData): StoredRepData {
  const { frames, ...rest } = rep;
  return rest;
}
