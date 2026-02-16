/**
 * WeightTrainingConfig
 *
 * Configuration panel for weight training mode.
 * Shows controls for weight, chains, and eccentric adjustment.
 */

import React from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Section } from '@/components/ui/layout';
import { Surface, WeightPicker } from '@/components/ui';
import { ChainsSelector } from './ChainsSelector';
import { EccentricSlider } from './EccentricSlider';
import type { VoltraStoreApi } from '@/stores/voltra-store';

interface WeightTrainingConfigProps {
  voltraStore: VoltraStoreApi;
}

export function WeightTrainingConfig({ voltraStore }: WeightTrainingConfigProps) {
  // Granular selectors - isolated re-render scopes
  const weight = useStore(voltraStore, (s) => s.weight);
  const setWeight = useStore(voltraStore, (s) => s.setWeight);

  const { chains, inverseChains } = useStore(
    voltraStore,
    useShallow((s) => ({ chains: s.chains, inverseChains: s.inverseChains })),
  );
  const setChains = useStore(voltraStore, (s) => s.setChains);
  const setInverseChains = useStore(voltraStore, (s) => s.setInverseChains);

  const eccentric = useStore(voltraStore, (s) => s.eccentric);
  const setEccentric = useStore(voltraStore, (s) => s.setEccentric);

  return (
    <>
      <Section title="Base Weight">
        <Surface elevation={1} radius="lg" border={false}>
          <WeightPicker value={weight} onChange={setWeight} min={5} max={200} step={1} />
        </Surface>
      </Section>

      <Section title="Chains">
        <Surface elevation={1} radius="lg" border={false}>
          <ChainsSelector
            chains={chains}
            inverseChains={inverseChains}
            onChainsChange={setChains}
            onInverseChainsChange={setInverseChains}
          />
        </Surface>
      </Section>

      <Section title="Eccentric Load">
        <Surface elevation={1} radius="lg" border={false}>
          <EccentricSlider value={eccentric} onChange={setEccentric} />
        </Surface>
      </Section>
    </>
  );
}
