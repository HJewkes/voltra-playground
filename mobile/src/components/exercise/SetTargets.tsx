/**
 * SetTargets — inline target configuration with scroll dials.
 *
 * A row of combination-lock dials for setting optional workout targets.
 * Each section (Reps/RIR, Tempo, Sets) has a toggleable header pill that
 * enables/disables that target. Disabled sections collapse to just the pill.
 *
 * - Reps/RIR: two-state toggle pill, single dial
 * - Tempo: enable pill, four dials (Con/Hold/Ecc/Pause)
 * - Sets: enable pill, single dial
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { alpha, getSemanticColors } from '@titan-design/react-ui';
import { ScrollDial } from './ScrollDial';
import type { TempoTarget } from '@/domain/workout';

const t = getSemanticColors('dark');

export type TargetMode = 'reps' | 'rir';

export interface SetTargetsState {
  targetMode: TargetMode;
  targetReps: number;
  rirTarget: number;
  targetTempo: TempoTarget;
  targetSets: number;
  /** Rest time in 15-second blocks (0 = off, 1 = 15s, 2 = 30s, ...) */
  restBlocks: number;
  /** Which sections are enabled */
  enabledSections: {
    effort: boolean;
    tempo: boolean;
    sets: boolean;
    rest: boolean;
  };
}

export const EMPTY_TARGETS: SetTargetsState = {
  targetMode: 'reps',
  targetReps: 0,
  rirTarget: 0,
  targetTempo: { concentric: 0, eccentric: 0, pauseTop: 0, pauseBottom: 0 },
  targetSets: 0,
  restBlocks: 0,
  enabledSections: { effort: false, tempo: false, sets: false, rest: false },
};

interface SetTargetsProps {
  targets: SetTargetsState;
  onChange: (targets: SetTargetsState) => void;
  disabled?: boolean;
  /** Optional element rendered between Reps/RIR and Tempo (e.g. vertical weight jog) */
  weightSlot?: React.ReactNode;
}

export function SetTargets({ targets, onChange, disabled, weightSlot }: SetTargetsProps) {
  const { targetMode, targetReps, rirTarget, targetTempo, targetSets, restBlocks, enabledSections } = targets;

  const update = useCallback(
    (patch: Partial<SetTargetsState>) => onChange({ ...targets, ...patch }),
    [targets, onChange],
  );

  const toggleSection = useCallback(
    (section: keyof typeof enabledSections) =>
      update({ enabledSections: { ...enabledSections, [section]: !enabledSections[section] } }),
    [enabledSections, update],
  );

  // Three-phase cycle: Off → Reps → RIR → Off
  const cycleEffort = useCallback(() => {
    if (!enabledSections.effort) {
      update({ enabledSections: { ...enabledSections, effort: true }, targetMode: 'reps' });
    } else if (targetMode === 'reps') {
      update({ targetMode: 'rir' });
    } else {
      update({ enabledSections: { ...enabledSections, effort: false } });
    }
  }, [enabledSections, targetMode, update]);

  const isReps = targetMode === 'reps';
  const mainValue = isReps ? targetReps : rirTarget;
  const mainMax = isReps ? 30 : 5;

  const setMainValue = useCallback(
    (v: number) => update(isReps ? { targetReps: v } : { rirTarget: v }),
    [isReps, update],
  );

  const setTempo = useCallback(
    (key: keyof TempoTarget, v: number) =>
      update({ targetTempo: { ...targetTempo, [key]: v } }),
    [targetTempo, update],
  );

  const outerOpacity = disabled ? 0.4 : 1;

  return (
    <View style={{ opacity: outerOpacity }} pointerEvents={disabled ? 'none' : 'auto'}>
      {/* 3-2-3 column grid: Volume | Weight | Tempo */}
      <View className="flex-row items-start">
        {/* Volume column (flex 3): Reps + Sets + Rest */}
        <View style={{ flex: 3 }}>
          <View className="flex-row items-start justify-center" style={{ gap: 6 }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <EnablePill
                label={enabledSections.effort ? (isReps ? 'Reps' : 'RIR') : 'Reps'}
                active={enabledSections.effort}
                onPress={cycleEffort}
              />
              <View className="mt-1.5">
                <ScrollDial
                  value={mainValue}
                  min={0}
                  max={mainMax}
                  onChange={setMainValue}
                  formatValue={dashZero}
                  activeColor={enabledSections.effort && mainValue > 0 ? t['brand-primary'] : t['text-disabled']}
                  disabled={!enabledSections.effort}
                />
              </View>
            </View>

            <Divider />

            <View style={{ alignItems: 'center', flex: 1 }}>
              <EnablePill
                label="Sets"
                active={enabledSections.sets}
                onPress={() => toggleSection('sets')}
              />
              <View className="mt-1.5">
                <ScrollDial
                  value={targetSets}
                  min={1}
                  max={10}
                  onChange={(v) => update({ targetSets: v })}
                  formatValue={dashZero}
                  activeColor={enabledSections.sets && targetSets > 0 ? t['brand-primary'] : t['text-disabled']}
                  disabled={!enabledSections.sets}
                />
              </View>
            </View>

            <Divider />

            <View style={{ alignItems: 'center', flex: 1 }}>
              <EnablePill
                label="Rest"
                active={enabledSections.rest}
                onPress={() => toggleSection('rest')}
              />
              <View className="mt-1.5">
                <ScrollDial
                  value={restBlocks}
                  min={0}
                  max={20}
                  onChange={(v) => update({ restBlocks: v })}
                  formatValue={formatRest}
                  activeColor={enabledSections.rest && restBlocks > 0 ? t['text-secondary'] : t['text-disabled']}
                  disabled={!enabledSections.rest}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Weight column (flex 2): centered jog shuttle */}
        {weightSlot && (
          <View style={{ flex: 2, alignItems: 'center', paddingTop: 26 }}>
            {weightSlot}
          </View>
        )}

        {/* Tempo column (flex 3): just tempo dials */}
        <View style={{ flex: 3, alignItems: 'center' }}>
          <EnablePill
            label="Tempo"
            active={enabledSections.tempo}
            onPress={() => toggleSection('tempo')}
          />
          <View className="mt-1.5 flex-row" style={{ gap: 3 }}>
            <ScrollDial
              value={targetTempo.concentric}
              min={0}
              max={10}
              onChange={(v) => setTempo('concentric', v)}
              label="Con"
              width={32}
              formatValue={dashZero}
              activeColor={enabledSections.tempo && targetTempo.concentric > 0 ? t['status-success'] : t['text-disabled']}
              disabled={!enabledSections.tempo}
            />
            <ScrollDial
              value={targetTempo.pauseTop}
              min={0}
              max={5}
              onChange={(v) => setTempo('pauseTop', v)}
              label="Hold"
              width={32}
              formatValue={dashZero}
              activeColor={enabledSections.tempo && targetTempo.pauseTop > 0 ? t['brand-primary'] : t['text-disabled']}
              disabled={!enabledSections.tempo}
            />
            <ScrollDial
              value={targetTempo.eccentric}
              min={0}
              max={10}
              onChange={(v) => setTempo('eccentric', v)}
              label="Ecc"
              width={32}
              formatValue={dashZero}
              activeColor={enabledSections.tempo && targetTempo.eccentric > 0 ? t['status-warning'] : t['text-disabled']}
              disabled={!enabledSections.tempo}
            />
            <ScrollDial
              value={targetTempo.pauseBottom}
              min={0}
              max={5}
              onChange={(v) => setTempo('pauseBottom', v)}
              label="Pause"
              width={32}
              formatValue={dashZero}
              activeColor={enabledSections.tempo && targetTempo.pauseBottom > 0 ? t['text-secondary'] : t['text-disabled']}
              disabled={!enabledSections.tempo}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

/** Pill that enables/disables a section. Active = highlighted, tappable to toggle off. */
function EnablePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: active ? alpha(t['brand-primary'], 0.15) : '#1a1a1a',
        ...Platform.select({
          web: {
            boxShadow: active
              ? [
                  `0 1px 2px ${alpha('#000', 0.4)}`,
                  `inset 0 1px 0 ${alpha(t['brand-primary'], 0.15)}`,
                ].join(', ')
              : [
                  `inset 0 1px 3px ${alpha('#000', 0.4)}`,
                  `0 1px 0 ${alpha('#fff', 0.04)}`,
                ].join(', '),
          } as any,
          default: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: active ? 1 : 0 },
            shadowOpacity: active ? 0.3 : 0,
            shadowRadius: active ? 2 : 0,
          },
        }),
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: active ? '700' : '500',
          color: active ? t['brand-primary'] : t['text-disabled'],
          ...Platform.select({
            web: active ? {
              textShadow: `0 0 8px ${alpha(t['brand-primary'], 0.4)}`,
            } as any : {},
            default: {},
          }),
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}


function Divider() {
  return (
    <View
      style={{
        width: 1,
        alignSelf: 'center',
        height: 40,
        backgroundColor: alpha('#000', 0.4),
        ...Platform.select({
          web: {
            boxShadow: `1px 0 0 ${alpha('#fff', 0.04)}`,
          } as any,
          default: {},
        }),
      }}
    />
  );
}

function dashZero(v: number): string {
  return v === 0 ? '–' : String(v);
}

/** Format rest blocks (×15s) as m:ss */
function formatRest(blocks: number): string {
  if (blocks === 0) return '–';
  const totalSec = blocks * 15;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}
