/**
 * ConfigSection — QuickConfig bar + AdvancedAccordion, wrapped in a Surface card.
 *
 * Owns quick-config local state (effort, tempo, targets). Exposes getTargets()
 * via ref so the parent can read current values when starting a workout.
 */

import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { View } from 'react-native';
import { Surface, alpha } from '@titan-design/react-ui';

import type { TempoTarget } from '@/domain/workout';
import { AdvancedAccordion } from '@/components/mode';
import { QuickConfig, VerticalWeightJog } from '@/components/exercise';
import type { TargetMode } from '@/components/exercise';
import type { VoltraStoreApi } from '@/stores/voltra-store';

export interface QuickConfigTargets {
  effortEnabled: boolean;
  targetMode: TargetMode;
  targetReps: number;
  rirTarget: number;
  tempoEnabled: boolean;
  targetTempo: TempoTarget;
}

export interface ConfigSectionRef {
  getTargets: () => QuickConfigTargets;
}

export interface ConfigSectionProps {
  voltraStore: VoltraStoreApi;
  weight: number;
  eccentric: number;
  setEccentric: (v: number) => Promise<void>;
  chains: number;
  inverseChains: number;
  setChains: (v: number) => Promise<void>;
  setInverseChains: (v: number) => Promise<void>;
  showEccentric: boolean;
  showChains: boolean;
  isActive: boolean;
  onAddSet: (targets: QuickConfigTargets) => void;
  plannedSetCount: number;
}

export const ConfigSection = forwardRef<ConfigSectionRef, ConfigSectionProps>(
  function ConfigSection(
    {
      voltraStore,
      weight,
      eccentric,
      setEccentric,
      chains,
      inverseChains,
      setChains,
      setInverseChains,
      showEccentric,
      showChains,
      isActive,
      onAddSet,
      plannedSetCount,
    },
    ref,
  ) {
    const [effortEnabled, setEffortEnabled] = useState(false);
    const [targetMode, setTargetMode] = useState<TargetMode>('reps');
    const [targetReps, setTargetReps] = useState(0);
    const [rirTarget, setRirTarget] = useState(0);
    const [tempoEnabled, setTempoEnabled] = useState(false);
    const [targetTempo, setTargetTempo] = useState<TempoTarget>({
      concentric: 0, eccentric: 0, pauseTop: 0, pauseBottom: 0,
    });

    useImperativeHandle(ref, () => ({
      getTargets: () => ({ effortEnabled, targetMode, targetReps, rirTarget, tempoEnabled, targetTempo }),
    }), [effortEnabled, targetMode, targetReps, rirTarget, tempoEnabled, targetTempo]);

    const isReps = targetMode === 'reps';
    const mainValue = isReps ? targetReps : rirTarget;
    const mainMax = isReps ? 30 : 5;

    const cycleEffort = useCallback(() => {
      if (!effortEnabled) {
        setEffortEnabled(true);
        setTargetMode('reps');
      } else if (targetMode === 'reps') {
        setTargetMode('rir');
      } else {
        setEffortEnabled(false);
      }
    }, [effortEnabled, targetMode]);

    const handleTargetChange = useCallback((v: number) => {
      if (isReps) setTargetReps(v);
      else setRirTarget(v);
    }, [isReps]);

    const handleAddSet = useCallback(() => {
      onAddSet({ effortEnabled, targetMode, targetReps, rirTarget, tempoEnabled, targetTempo });
    }, [onAddSet, effortEnabled, targetMode, targetReps, rirTarget, tempoEnabled, targetTempo]);

    const handleTempoChange = useCallback((key: keyof TempoTarget, v: number) => {
      setTargetTempo((prev) => ({ ...prev, [key]: v }));
    }, []);

    return (
      <Surface elevation={1} className="mt-1 rounded-xl py-3 px-2">
        <QuickConfig
          effortEnabled={effortEnabled}
          targetMode={targetMode}
          targetValue={mainValue}
          maxValue={mainMax}
          onCycleEffort={cycleEffort}
          onTargetChange={handleTargetChange}
          weightSlot={
            <VerticalWeightJog
              weight={weight}
              onWeightChange={(w) => { voltraStore.getState().setWeight(w); }}
              disabled={isActive}
            />
          }
          onAddSet={handleAddSet}
          setCount={plannedSetCount}
          addSetDisabled={isActive}
          disabled={isActive}
        />
        {(showEccentric || showChains) && !isActive && (
          <View
            className="px-1 mt-2 pt-2"
            style={{
              opacity: isActive ? 0.4 : 1,
              borderTopWidth: 1,
              borderTopColor: alpha('#fff', 0.06),
              marginHorizontal: 4,
            }}
            pointerEvents={isActive ? 'none' : 'auto'}
          >
            <AdvancedAccordion
              showEccentric={showEccentric}
              showChains={showChains}
              eccentric={eccentric}
              setEccentric={setEccentric}
              chains={chains}
              inverseChains={inverseChains}
              setChains={setChains}
              setInverseChains={setInverseChains}
              tempoEnabled={tempoEnabled}
              targetTempo={targetTempo}
              onToggleTempo={() => setTempoEnabled((v) => !v)}
              onTempoChange={handleTempoChange}
            />
          </View>
        )}
      </Surface>
    );
  },
);
