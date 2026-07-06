/**
 * WeightTrainingConfig
 *
 * Configuration panel for weight training mode.
 * Single interactive load profile chart with three handles:
 * left = base weight, middle = chains, right = eccentric.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  Surface,
  Section,
  SectionHeader,
  SectionContent,
  getSemanticColors,
} from '@titan-design/react-ui';
import { LoadProfileChart } from './LoadProfileChart';
import type { VoltraStoreApi } from '@/stores/voltra-store';

const t = getSemanticColors('dark');

const CHART_HEIGHT = 220;

interface WeightTrainingConfigProps {
  voltraStore: VoltraStoreApi;
}

export function WeightTrainingConfig({ voltraStore }: WeightTrainingConfigProps) {
  const weight = useStore(voltraStore, (s) => s.weight);
  const setWeight = useStore(voltraStore, (s) => s.setWeight);

  const { chains, inverseChains } = useStore(
    voltraStore,
    useShallow((s) => ({ chains: s.chains, inverseChains: s.inverseChains }))
  );
  const setChains = useStore(voltraStore, (s) => s.setChains);
  const setInverseChains = useStore(voltraStore, (s) => s.setInverseChains);

  const eccentric = useStore(voltraStore, (s) => s.eccentric);
  const setEccentric = useStore(voltraStore, (s) => s.setEccentric);

  // Local state for drag (don't send to device until release)
  const [localWeight, setLocalWeight] = useState(weight);
  const [localChains, setLocalChains] = useState(chains);
  const [localInverseChains, setLocalInverseChains] = useState(inverseChains);
  const [localEccentric, setLocalEccentric] = useState(eccentric);
  const [isDragging, setIsDragging] = useState(false);

  // Sync from store when not dragging
  const effectiveWeight = isDragging ? localWeight : weight;
  const effectiveChains = isDragging ? localChains : chains;
  const effectiveInverseChains = isDragging ? localInverseChains : inverseChains;
  const effectiveEccentric = isDragging ? localEccentric : eccentric;

  // Chart width from layout
  const [chartWidth, setChartWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  // Drag callbacks (update local state only)
  const handleBaseWeightChange = useCallback((v: number) => {
    setIsDragging(true);
    setLocalWeight(v);
  }, []);

  const handleBaseWeightCommit = useCallback(
    async (v: number) => {
      setIsDragging(false);
      await setWeight(v);
    },
    [setWeight]
  );

  const handleChainsChange = useCallback((v: number) => {
    setIsDragging(true);
    setLocalChains(v);
    setLocalInverseChains(0);
  }, []);

  const handleInverseChainsChange = useCallback((v: number) => {
    setIsDragging(true);
    setLocalInverseChains(v);
    setLocalChains(0);
  }, []);

  const handleEccentricChange = useCallback((v: number) => {
    setIsDragging(true);
    setLocalEccentric(v);
  }, []);

  // Commit callbacks (send to device)
  const handleChainsCommit = useCallback(
    async (v: number) => {
      setIsDragging(false);
      if (inverseChains > 0) await setInverseChains(0);
      await setChains(v);
    },
    [setChains, setInverseChains, inverseChains]
  );

  const handleInverseChainsCommit = useCallback(
    async (v: number) => {
      setIsDragging(false);
      if (chains > 0) await setChains(0);
      await setInverseChains(v);
    },
    [setChains, setInverseChains, chains]
  );

  const handleEccentricCommit = useCallback(
    async (v: number) => {
      setIsDragging(false);
      await setEccentric(v);
    },
    [setEccentric]
  );

  // Summary text
  const chainDesc =
    effectiveInverseChains > 0
      ? `${effectiveInverseChains} lbs inv. chains`
      : effectiveChains > 0
        ? `${effectiveChains} lbs chains`
        : 'no chains';

  const eccDesc =
    effectiveEccentric !== 0
      ? `${effectiveEccentric > 0 ? '+' : ''}${effectiveEccentric}% eccentric`
      : 'balanced eccentric';

  return (
    <Section>
      <SectionHeader title="Load Profile" />
      <SectionContent>
        <Surface elevation={1} className="overflow-hidden rounded-xl">
          <View className="p-2" onLayout={onLayout}>
            {chartWidth > 0 && (
              <LoadProfileChart
                baseWeight={effectiveWeight}
                chains={effectiveChains}
                inverseChains={effectiveInverseChains}
                eccentric={effectiveEccentric}
                onBaseWeightChange={handleBaseWeightChange}
                onBaseWeightCommit={handleBaseWeightCommit}
                onChainsChange={handleChainsChange}
                onInverseChainsChange={handleInverseChainsChange}
                onEccentricChange={handleEccentricChange}
                onChainsCommit={handleChainsCommit}
                onInverseChainsCommit={handleInverseChainsCommit}
                onEccentricCommit={handleEccentricCommit}
                width={chartWidth}
                height={CHART_HEIGHT}
              />
            )}
          </View>
          <View className="px-4 pb-3">
            <Text className="text-center text-xs" style={{ color: t['text-tertiary'] }}>
              {effectiveWeight} lbs base · {chainDesc} · {eccDesc}
            </Text>
          </View>
        </Surface>
      </SectionContent>
    </Section>
  );
}
