import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Modal,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from 'zustand';
import { useSessionStore, useDiscoveryStore } from '@/stores';
import type { VoltraStoreApi } from '@/stores';
import { 
  TrainingGoal, 
  getKnownExercises, 
  getExerciseName,
  EXERCISE_MUSCLE_GROUPS,
  MuscleGroup,
} from '@/planning';
import { colors, getConfidenceColor } from '@/theme';
import { ConnectDevice } from '@/components';
import type { DiscoveryStep } from '@/planning';

const REST_PERIOD_SECONDS = 60;

function groupExercisesByMuscle() {
  const exercises = getKnownExercises();
  const grouped: Record<string, string[]> = {};
  
  for (const ex of exercises) {
    const muscle = EXERCISE_MUSCLE_GROUPS[ex] ?? MuscleGroup.BACK;
    if (!grouped[muscle]) {
      grouped[muscle] = [];
    }
    grouped[muscle].push(ex);
  }
  
  return grouped;
}

type UIState = 
  | 'select'
  | 'estimate'
  | 'preparing'
  | 'ready'
  | 'countdown'
  | 'recording'
  | 'resting'
  | 'processing'
  | 'results';

export default function Discover() {
  const { primaryDeviceId, devices } = useSessionStore();
  const voltraStore = primaryDeviceId ? devices.get(primaryDeviceId) : null;
  
  if (!voltraStore) {
    return <ConnectDevice subtitle="Connect to your Voltra to use Discovery" />;
  }
  
  return <DiscoveryView voltraStore={voltraStore} />;
}

// =============================================================================
// Discovery View
// =============================================================================

interface DiscoveryViewProps {
  voltraStore: VoltraStoreApi;
}

function DiscoveryView({ voltraStore }: DiscoveryViewProps) {
  const weight = useStore(voltraStore, s => s.weight);
  const workoutState = useStore(voltraStore, s => s.workoutState);
  const error = useStore(voltraStore, s => s.error);
  const repCount = useStore(voltraStore, s => s.repCount);
  const lastRep = useStore(voltraStore, s => s.lastRep);
  
  const setWeight = useStore(voltraStore, s => s.setWeight);
  const startWorkout = useStore(voltraStore, s => s.startWorkout);
  const stopWorkout = useStore(voltraStore, s => s.stopWorkout);
  const resetWorkout = useStore(voltraStore, s => s.resetWorkout);
  
  const isActive = workoutState === 'active';
  
  const {
    phase: discoveryPhase,
    currentStep,
    completedSets,
    recommendation,
    start: startDiscovery,
    recordSet: recordDiscoverySet,
    cancel: cancelDiscovery,
    reset: resetDiscovery,
  } = useDiscoveryStore();
  
  const [uiState, setUIState] = useState<UIState>('select');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<TrainingGoal>(TrainingGoal.HYPERTROPHY);
  const [userEstimate, setUserEstimate] = useState<string>('');
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [instruction, setInstruction] = useState<string>('');
  const [subInstruction, setSubInstruction] = useState<string>('');
  const [targetReps, setTargetReps] = useState<number>(5);
  const [restCountdown, setRestCountdown] = useState<number>(0);
  const [startCountdown, setStartCountdown] = useState<number>(0);
  
  const targetRepsRef = useRef<number>(5);
  const hasAutoStoppedRef = useRef<boolean>(false);
  const currentStepRef = useRef<DiscoveryStep | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const groupedExercises = useMemo(() => groupExercisesByMuscle(), []);
  
  useEffect(() => {
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      if (startTimerRef.current) clearInterval(startTimerRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (discoveryPhase === 'complete' && recommendation) {
      setUIState('results');
    }
  }, [discoveryPhase, recommendation]);
  
  const prepareNextSet = useCallback(async (step: DiscoveryStep, isFirstSet: boolean = false) => {
    currentStepRef.current = step;
    setUIState('preparing');
    setInstruction(`Setting weight to ${step.weight} lbs...`);
    setSubInstruction('Please wait');
    
    try {
      await setWeight(step.weight);
    } catch (e) {
      Alert.alert('Error', `Failed to set weight: ${e}`);
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    targetRepsRef.current = step.targetReps;
    setTargetReps(step.targetReps);
    hasAutoStoppedRef.current = false;
    
    if (isFirstSet) {
      setUIState('ready');
      setInstruction(`Do ${step.targetReps} reps`);
      setSubInstruction('Press START when ready');
      Vibration.vibrate(100);
    } else {
      setUIState('resting');
      setRestCountdown(REST_PERIOD_SECONDS);
      setInstruction('Rest');
      setSubInstruction(`Next: ${step.weight} lbs × ${step.targetReps} reps`);
      
      restTimerRef.current = setInterval(() => {
        setRestCountdown(prev => {
          if (prev <= 1) {
            if (restTimerRef.current) clearInterval(restTimerRef.current);
            startGetReadyCountdown(step);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [setWeight]);
  
  const startGetReadyCountdown = useCallback((step: DiscoveryStep) => {
    setUIState('countdown');
    setStartCountdown(3);
    setInstruction('Get Ready');
    setSubInstruction(`${step.weight} lbs × ${step.targetReps} reps`);
    
    Vibration.vibrate(100);
    
    startTimerRef.current = setInterval(() => {
      setStartCountdown(prev => {
        if (prev <= 1) {
          if (startTimerRef.current) clearInterval(startTimerRef.current);
          autoStartSet();
          return 0;
        }
        Vibration.vibrate(50);
        return prev - 1;
      });
    }, 1000);
  }, []);
  
  const autoStartSet = useCallback(async () => {
    resetWorkout();
    hasAutoStoppedRef.current = false;
    await startWorkout();
    setUIState('recording');
    setInstruction(`${targetRepsRef.current} reps - GO!`);
    setSubInstruction('Full effort on each rep');
    Vibration.vibrate([0, 100, 50, 100]);
  }, [startWorkout, resetWorkout]);
  
  useEffect(() => {
    if (uiState === 'recording' && !hasAutoStoppedRef.current) {
      if (repCount >= targetRepsRef.current) {
        hasAutoStoppedRef.current = true;
        handleAutoComplete();
      }
    }
  }, [repCount, uiState]);
  
  const handleAutoComplete = useCallback(async () => {
    Vibration.vibrate(200);
    await new Promise(resolve => setTimeout(resolve, 300));
    const stats = await stopWorkout();
    setUIState('processing');
    
    if (stats.repCount === 0) {
      setInstruction('No reps detected');
      setSubInstruction('Try again');
      setUIState('ready');
      return;
    }
    
    const next = await recordDiscoverySet(stats.reps, stats);
    
    if ('stepNumber' in next) {
      await prepareNextSet(next as DiscoveryStep, false);
    }
  }, [stopWorkout, recordDiscoverySet, prepareNextSet]);
  
  const handleManualStop = useCallback(async (failed: boolean = false) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    if (startTimerRef.current) clearInterval(startTimerRef.current);
    
    const stats = await stopWorkout();
    setUIState('processing');
    
    const next = await recordDiscoverySet(stats.reps, stats);
    
    if ('stepNumber' in next) {
      await prepareNextSet(next as DiscoveryStep, false);
    }
  }, [stopWorkout, recordDiscoverySet, prepareNextSet]);
  
  const handleStartDiscovery = useCallback(async () => {
    if (!selectedExercise) return;
    
    const goalMap: Record<TrainingGoal, 'strength' | 'hypertrophy' | 'endurance'> = {
      [TrainingGoal.STRENGTH]: 'strength',
      [TrainingGoal.HYPERTROPHY]: 'hypertrophy',
      [TrainingGoal.ENDURANCE]: 'endurance',
    };
    
    const firstStep = startDiscovery(
      selectedExercise,
      getExerciseName(selectedExercise),
      goalMap[selectedGoal]
    );
    
    if (!firstStep || !firstStep.weight) {
      Alert.alert('Error', 'Failed to get first step');
      return;
    }
    
    await prepareNextSet(firstStep, true);
  }, [selectedExercise, selectedGoal, startDiscovery, prepareNextSet]);
  
  const handleStartReps = useCallback(async () => {
    resetWorkout();
    hasAutoStoppedRef.current = false;
    await startWorkout();
    setUIState('recording');
    setInstruction(`${targetReps} reps - GO!`);
    setSubInstruction('Full effort on each rep');
  }, [startWorkout, resetWorkout, targetReps]);
  
  const handleSkipRest = useCallback(() => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    const step = currentStepRef.current;
    if (step) {
      startGetReadyCountdown(step);
    }
  }, [startGetReadyCountdown]);
  
  const handleStopDiscovery = useCallback(() => {
    Alert.alert(
      'Stop Discovery?',
      'Your data will be saved for analysis.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Stop & Save', 
          style: 'destructive',
          onPress: async () => {
            if (restTimerRef.current) clearInterval(restTimerRef.current);
            if (startTimerRef.current) clearInterval(startTimerRef.current);
            
            if (isActive) {
              await stopWorkout();
            }
            
            await cancelDiscovery();
            
            handleReset();
          }
        },
      ]
    );
  }, [isActive, stopWorkout, cancelDiscovery]);
  
  const handleReset = useCallback(() => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    if (startTimerRef.current) clearInterval(startTimerRef.current);
    
    resetDiscovery();
    setSelectedExercise(null);
    setUserEstimate('');
    setInstruction('');
    setSubInstruction('');
    setRestCountdown(0);
    setStartCountdown(0);
    setUIState('select');
  }, [resetDiscovery]);
  
  // Exercise selection modal
  const renderExerciseModal = () => (
    <Modal
      visible={showExerciseModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowExerciseModal(false)}
    >
      <View className="flex-1" style={{ backgroundColor: colors.surface.background }}>
        <View 
          className="px-5 py-5 flex-row justify-between items-center border-b"
          style={{ backgroundColor: colors.surface.elevated, borderColor: colors.surface.light }}
        >
          <Text className="text-xl font-bold text-content-primary">Select Exercise</Text>
          <TouchableOpacity 
            onPress={() => setShowExerciseModal(false)}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.surface.dark }}
          >
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        
        <ScrollView className="flex-1 p-4">
          {Object.entries(groupedExercises).map(([muscle, exercises]) => (
            <View key={muscle} className="mb-6">
              <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">
                {muscle}
              </Text>
              {exercises.map(ex => (
                <TouchableOpacity
                  key={ex}
                  className="rounded-2xl p-4 mb-2"
                  style={[
                    { backgroundColor: colors.surface.card },
                    selectedExercise === ex && { 
                      borderWidth: 2, 
                      borderColor: colors.primary[500],
                      backgroundColor: colors.primary[600] + '15',
                    }
                  ]}
                  onPress={() => {
                    setSelectedExercise(ex);
                    setShowExerciseModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text 
                    className="font-semibold"
                    style={{ color: selectedExercise === ex ? colors.primary[500] : colors.text.primary }}
                  >
                    {getExerciseName(ex)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
  
  // Step 1: Select exercise
  const renderSelectStep = () => (
    <ScrollView className="flex-1 p-4">
      <View 
        className="rounded-3xl p-6 mb-4 border border-surface-100"
        style={[{ backgroundColor: colors.surface.card }]}
      >
        <View className="flex-row items-center mb-5">
          <View 
            className="w-14 h-14 rounded-xl items-center justify-center mr-4"
            style={{ backgroundColor: colors.primary[600] + '20' }}
          >
            <Ionicons name="compass" size={28} color={colors.primary[500]} />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-content-primary">Find Your Weight</Text>
            <Text className="text-content-tertiary mt-1">Automatic weight discovery</Text>
          </View>
        </View>
        
        <Text className="text-content-secondary leading-6">
          We'll automatically set different weights and guide you through sets to find your optimal working weight.
        </Text>
      </View>
      
      {/* Exercise Selection */}
      <View 
        className="rounded-3xl p-5 mb-4 border border-surface-100"
        style={[{ backgroundColor: colors.surface.card }]}
      >
        <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">Exercise</Text>
        <TouchableOpacity
          className="rounded-2xl p-4 flex-row justify-between items-center"
          style={{ backgroundColor: colors.surface.dark }}
          onPress={() => setShowExerciseModal(true)}
          activeOpacity={0.7}
        >
          <Text className={selectedExercise ? 'text-content-primary font-semibold' : 'text-content-muted'}>
            {selectedExercise ? getExerciseName(selectedExercise) : 'Select an exercise...'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
        </TouchableOpacity>
      </View>
      
      {/* Training Goal */}
      <View 
        className="rounded-3xl p-5 mb-6 border border-surface-100"
        style={[{ backgroundColor: colors.surface.card }]}
      >
        <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-4">Training Goal</Text>
        <View className="flex-row gap-3">
          {[
            { goal: TrainingGoal.STRENGTH, label: 'Strength', icon: 'flash' },
            { goal: TrainingGoal.HYPERTROPHY, label: 'Muscle', icon: 'body' },
            { goal: TrainingGoal.ENDURANCE, label: 'Endurance', icon: 'fitness' },
          ].map(({ goal, label, icon }) => (
            <TouchableOpacity
              key={goal}
              className="flex-1 rounded-2xl p-4 items-center"
              style={[
                { backgroundColor: colors.surface.dark },
                selectedGoal === goal && { 
                  backgroundColor: colors.primary[600] + '20',
                  borderWidth: 2,
                  borderColor: colors.primary[500],
                }
              ]}
              onPress={() => setSelectedGoal(goal)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={icon as any} 
                size={28} 
                color={selectedGoal === goal ? colors.primary[500] : colors.text.muted} 
              />
              <Text 
                className="text-sm mt-2 font-semibold"
                style={{ color: selectedGoal === goal ? colors.primary[500] : colors.text.secondary }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <TouchableOpacity
        className="rounded-2xl p-5 items-center"
        style={[
          { backgroundColor: selectedExercise ? colors.primary[600] : colors.surface.dark },
          selectedExercise && { borderColor: colors.primary[500], borderWidth: 2 },
        ]}
        onPress={() => setUIState('estimate')}
        disabled={!selectedExercise}
        activeOpacity={0.8}
      >
        <Text 
          className="font-bold text-lg"
          style={{ color: selectedExercise ? 'white' : colors.text.muted }}
        >
          Continue
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
  
  // Step 2: Optional estimate
  const renderEstimateStep = () => (
    <ScrollView className="flex-1 p-4">
      <View 
        className="rounded-3xl p-6 mb-6 border border-surface-100"
        style={[{ backgroundColor: colors.surface.card }]}
      >
        <Text className="text-2xl font-bold text-content-primary mb-3">
          Starting Point (Optional)
        </Text>
        <Text className="text-content-secondary leading-6 mb-6">
          If you have a rough idea of your max, enter it below.
        </Text>
        
        <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">
          Estimated Max (lbs)
        </Text>
        <TextInput
          className="rounded-2xl p-4 text-lg"
          style={[
            { backgroundColor: colors.surface.dark, color: colors.text.primary },
          ]}
          placeholder="e.g., 100"
          placeholderTextColor={colors.text.muted}
          keyboardType="numeric"
          value={userEstimate}
          onChangeText={setUserEstimate}
        />
        
        <Text className="text-content-muted text-sm mt-3">
          Leave blank if you're not sure
        </Text>
      </View>
      
      <View className="flex-row gap-3">
        <TouchableOpacity
          className="flex-1 rounded-2xl p-5 items-center"
          style={{ backgroundColor: colors.surface.card }}
          onPress={() => setUIState('select')}
          activeOpacity={0.7}
        >
          <Text className="text-content-secondary font-bold text-base">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 rounded-2xl p-5 items-center"
          style={[{ backgroundColor: colors.primary[600] }]}
          onPress={handleStartDiscovery}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-base">Start</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
  
  // Active discovery screen
  const renderActiveDiscovery = () => {
    const isRecording = uiState === 'recording';
    const isPreparing = uiState === 'preparing' || uiState === 'processing';
    const isResting = uiState === 'resting';
    const isCountdown = uiState === 'countdown';
    
    const getStateColor = () => {
      if (isRecording) return colors.success;
      if (isResting) return colors.primary[600];
      if (isCountdown) return colors.warning;
      if (isPreparing) return colors.surface.light;
      return colors.primary[500];
    };
    
    return (
      <View className="flex-1 p-4">
        {/* Progress indicator */}
        <View 
          className="rounded-2xl p-4 mb-4 border border-surface-100"
          style={[{ backgroundColor: colors.surface.card }]}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-content-secondary font-semibold">Discovery Progress</Text>
            <Text className="font-bold" style={{ color: colors.primary[500] }}>
              Set {completedSets.length + 1}
            </Text>
          </View>
          <View 
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: colors.surface.dark }}
          >
            <View 
              className="h-full rounded-full"
              style={{ 
                width: `${Math.min(100, (completedSets.length / 4) * 100)}%`,
                backgroundColor: colors.primary[500],
              }}
            />
          </View>
          <Text className="text-content-muted text-xs mt-2">
            Device: {weight} lbs | Target: {currentStepRef.current?.weight ?? '-'} lbs
          </Text>
          {error && (
            <Text className="text-danger-light text-sm mt-2">Error: {error}</Text>
          )}
        </View>
        
        {/* Main instruction display */}
        <View 
          className="flex-1 rounded-3xl p-8 items-center justify-center mb-4"
          style={{ backgroundColor: getStateColor() }}
        >
          {isPreparing ? (
            <View className="items-center">
              <Ionicons name="hourglass-outline" size={64} color="white" />
              <Text className="text-white text-2xl font-bold mt-5 text-center">
                {instruction}
              </Text>
              <Text className="text-white/70 text-lg mt-2">{subInstruction}</Text>
            </View>
          ) : isResting ? (
            <View className="items-center">
              <Text className="text-white/70 text-xl mb-3">REST</Text>
              <Text className="text-white text-9xl font-bold">{restCountdown}</Text>
              <Text className="text-white/70 text-lg mt-5">{subInstruction}</Text>
              <TouchableOpacity
                className="mt-8 rounded-2xl px-8 py-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                onPress={handleSkipRest}
                activeOpacity={0.7}
              >
                <Text className="text-white font-bold text-base">Skip Rest</Text>
              </TouchableOpacity>
            </View>
          ) : isCountdown ? (
            <View className="items-center">
              <Text className="text-white/70 text-xl mb-3">GET READY</Text>
              <Text className="text-white font-bold" style={{ fontSize: 120 }}>{startCountdown}</Text>
              <Text className="text-white/70 text-lg mt-5">{subInstruction}</Text>
            </View>
          ) : isRecording ? (
            <View className="items-center">
              <Text className="text-white/70 text-xl mb-2">REPS</Text>
              <Text className="text-white text-9xl font-bold">{repCount}</Text>
              <Text className="text-white text-3xl mt-2">/ {targetReps}</Text>
              {lastRep && (
                <View 
                  className="mt-8 rounded-2xl px-8 py-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
                  <Text className="text-white text-xl font-bold">
                    {lastRep.maxVelocity.toFixed(2)} m/s
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View className="items-center">
              <Text className="text-white text-5xl font-bold text-center">{instruction}</Text>
              <Text className="text-white/70 text-xl mt-5 text-center">{subInstruction}</Text>
              {currentStepRef.current && (
                <View 
                  className="mt-8 rounded-2xl px-8 py-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
                  <Text className="text-white text-xl font-bold">
                    {currentStepRef.current.weight} lbs × {currentStepRef.current.targetReps}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Completed sets */}
        {completedSets.length > 0 && (
          <View 
            className="rounded-2xl p-4 mb-4 border border-surface-100"
            style={[{ backgroundColor: colors.surface.card }]}
          >
            <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">Completed</Text>
            <View className="flex-row flex-wrap gap-2">
              {completedSets.map((set, i) => (
                <View 
                  key={i} 
                  className="rounded-xl px-4 py-2"
                  style={{ backgroundColor: colors.surface.dark }}
                >
                  <Text className="text-content-secondary text-sm font-medium">
                    {set.weight}lbs × {set.actualReps} @ {set.meanVelocity.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* Action buttons */}
        <View className="gap-3">
          {uiState === 'ready' && (
            <TouchableOpacity
              className="rounded-2xl p-5 items-center flex-row justify-center"
              style={[{ backgroundColor: colors.success }]}
              onPress={handleStartReps}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={28} color="white" />
              <Text className="text-white font-bold text-xl ml-3">START</Text>
            </TouchableOpacity>
          )}
          
          {uiState === 'recording' && (
            <>
              <TouchableOpacity
                className="rounded-2xl p-4 items-center flex-row justify-center"
                style={{ backgroundColor: colors.primary[600] }}
                onPress={() => handleManualStop(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="stop" size={24} color="white" />
                <Text className="text-white font-bold text-lg ml-3">Done (fewer reps)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="rounded-2xl p-4 items-center flex-row justify-center"
                style={{ backgroundColor: colors.danger }}
                onPress={() => handleManualStop(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={24} color="white" />
                <Text className="text-white font-bold text-lg ml-3">Too Heavy - Failed</Text>
              </TouchableOpacity>
            </>
          )}
          
          <TouchableOpacity
            className="rounded-2xl p-4 items-center"
            style={{ backgroundColor: colors.surface.card }}
            onPress={handleStopDiscovery}
            activeOpacity={0.7}
          >
            <Text className="text-content-secondary font-bold">Stop & Save Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Results screen
  const renderResultsStep = () => {
    if (!recommendation) return null;
    
    const goalLabels: Record<TrainingGoal, string> = {
      [TrainingGoal.STRENGTH]: 'Strength',
      [TrainingGoal.HYPERTROPHY]: 'Muscle Growth',
      [TrainingGoal.ENDURANCE]: 'Endurance',
    };
    
    return (
      <ScrollView className="flex-1 p-4">
        <View 
          className="rounded-3xl p-6 mb-4 items-center"
          style={{ 
            backgroundColor: colors.success + '15',
            borderWidth: 1,
            borderColor: colors.success + '30',
          }}
        >
          <View 
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: colors.success }}
          >
            <Ionicons name="checkmark" size={48} color="white" />
          </View>
          <Text className="font-bold text-2xl mb-2" style={{ color: colors.success }}>
            Discovery Complete!
          </Text>
          <Text className="text-center" style={{ color: colors.successLight }}>
            Your optimal working weight has been found.
          </Text>
        </View>
        
        <View 
          className="rounded-3xl p-6 mb-4 border border-surface-100"
          style={[{ backgroundColor: colors.surface.card }]}
        >
          <Text className="text-content-muted font-medium text-sm mb-2">
            {selectedExercise ? getExerciseName(selectedExercise) : 'Exercise'} • {goalLabels[selectedGoal]}
          </Text>
          
          <View className="flex-row items-baseline mb-5">
            <Text className="text-6xl font-bold" style={{ color: colors.primary[500] }}>
              {recommendation.workingWeight}
            </Text>
            <Text className="text-2xl text-content-muted ml-2">lbs</Text>
          </View>
          
          <View 
            className="flex-row justify-between rounded-2xl p-4"
            style={{ backgroundColor: colors.surface.dark }}
          >
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
          </View>
        </View>
        
        <View 
          className="rounded-3xl p-5 mb-4 border border-surface-100"
          style={[{ backgroundColor: colors.surface.card }]}
        >
          <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">Analysis</Text>
          <Text className="text-content-secondary leading-6">{recommendation.explanation}</Text>
        </View>
        
        {recommendation.warmupSequence && recommendation.warmupSequence.length > 0 && (
          <View 
            className="rounded-3xl p-5 mb-6 border border-surface-100"
            style={[{ backgroundColor: colors.surface.card }]}
          >
            <Text className="text-xs font-bold text-content-muted uppercase tracking-wider mb-4">
              Recommended Warmup
            </Text>
            {recommendation.warmupSequence.map((set, i) => (
              <View 
                key={i} 
                className={`flex-row justify-between items-center py-3 ${
                  i < recommendation.warmupSequence!.length - 1 ? 'border-b border-surface-100' : ''
                }`}
              >
                <View className="flex-row items-center">
                  <View 
                    className="w-9 h-9 rounded-full items-center justify-center mr-4"
                    style={{ backgroundColor: colors.surface.dark }}
                  >
                    <Text className="text-content-secondary font-bold">{i + 1}</Text>
                  </View>
                  <Text className="text-content-primary font-medium">{set.weight} lbs × {set.reps}</Text>
                </View>
                <Text className="text-content-muted text-sm">{set.restSeconds}s rest</Text>
              </View>
            ))}
          </View>
        )}
        
        <View className="gap-3 mb-8">
          <TouchableOpacity
            className="rounded-2xl p-5 items-center"
            style={[{ backgroundColor: colors.primary[600] }]}
            onPress={() => {
              Alert.alert('Ready!', `Go to Workout tab. Weight: ${recommendation.workingWeight} lbs`);
            }}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-lg">Start Training</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className="rounded-2xl p-5 items-center"
            style={{ backgroundColor: colors.surface.card }}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Text className="text-content-secondary font-bold">Discover Another Exercise</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };
  
  return (
    <View className="flex-1 bg-surface-400">
      {uiState === 'select' && renderSelectStep()}
      {uiState === 'estimate' && renderEstimateStep()}
      {(uiState === 'preparing' || uiState === 'ready' || uiState === 'countdown' || uiState === 'recording' || uiState === 'resting' || uiState === 'processing') && renderActiveDiscovery()}
      {uiState === 'results' && renderResultsStep()}
      {renderExerciseModal()}
    </View>
  );
}
