/**
 * WeightTrainingConfig
 *
 * Configuration panel for weight training mode.
 * Shows controls for weight, chains, and eccentric adjustment.
 */

import React from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { WeightPicker } from '@/components/ui';
import { Surface, Section, SectionHeader, SectionContent } from '@titan-design/react-ui';
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
      <Section>
        <SectionHeader title="Base Weight" />
        <SectionContent>
          <Surface elevation={1} className="rounded-xl">
            <WeightPicker value={weight} onChange={setWeight} min={5} max={200} step={1} />
          </Surface>
        </SectionContent>
      </Section>

      <Section>
        <SectionHeader title="Chains" />
        <SectionContent>
          <Surface elevation={1} className="rounded-xl">
            <ChainsSelector
              chains={chains}
              inverseChains={inverseChains}
              onChainsChange={setChains}
              onInverseChainsChange={setInverseChains}
            />
          </Surface>
        </SectionContent>
      </Section>

      <Section>
        <SectionHeader title="Eccentric Load" />
        <SectionContent>
          <Surface elevation={1} className="rounded-xl">
            <EccentricSlider value={eccentric} onChange={setEccentric} />
          </Surface>
        </SectionContent>
      </Section>
    </>
  );
}
