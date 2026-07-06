import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMatchingThreshold,
  fireRestTimerCues,
  DEFAULT_CUE_THRESHOLDS,
  type RestTimerCueSettings,
  type CueThreshold,
} from '../rest-timer-cues';
import { triggerHaptic, triggerNotificationHaptic } from '../haptic-service';
import { playAudioCue } from '../audio-cue-service';

vi.mock('../haptic-service', () => ({
  triggerHaptic: vi.fn().mockResolvedValue(undefined),
  triggerNotificationHaptic: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../audio-cue-service', () => ({ playAudioCue: vi.fn().mockResolvedValue(undefined) }));

describe('getMatchingThreshold', () => {
  it('returns warning threshold at 30s', () => {
    expect(getMatchingThreshold(30)).toEqual({ seconds: 30, type: 'warning' });
  });
  it('returns warning threshold at 10s', () => {
    expect(getMatchingThreshold(10)).toEqual({ seconds: 10, type: 'warning' });
  });
  it('returns complete threshold at 0s', () => {
    expect(getMatchingThreshold(0)).toEqual({ seconds: 0, type: 'complete' });
  });
  it('returns null for non-threshold values', () => {
    expect(getMatchingThreshold(45)).toBeNull();
    expect(getMatchingThreshold(15)).toBeNull();
  });
  it('supports custom thresholds', () => {
    const custom: CueThreshold[] = [
      { seconds: 60, type: 'warning' },
      { seconds: 5, type: 'complete' },
    ];
    expect(getMatchingThreshold(60, custom)).toEqual({ seconds: 60, type: 'warning' });
    expect(getMatchingThreshold(30, custom)).toBeNull();
  });
});

describe('DEFAULT_CUE_THRESHOLDS', () => {
  it('has three thresholds', () => {
    expect(DEFAULT_CUE_THRESHOLDS).toHaveLength(3);
    expect(DEFAULT_CUE_THRESHOLDS[0]).toEqual({ seconds: 30, type: 'warning' });
    expect(DEFAULT_CUE_THRESHOLDS[2]).toEqual({ seconds: 0, type: 'complete' });
  });
});

describe('fireRestTimerCues', () => {
  const allEnabled: RestTimerCueSettings = { hapticEnabled: true, audioEnabled: true };
  const hapticOnly: RestTimerCueSettings = { hapticEnabled: true, audioEnabled: false };
  const audioOnly: RestTimerCueSettings = { hapticEnabled: false, audioEnabled: true };
  const allDisabled: RestTimerCueSettings = { hapticEnabled: false, audioEnabled: false };
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('fires light haptic and warning audio at 30s', async () => {
    await fireRestTimerCues(30, allEnabled);
    expect(triggerHaptic).toHaveBeenCalledWith('light');
    expect(playAudioCue).toHaveBeenCalledWith('warning');
    expect(triggerNotificationHaptic).not.toHaveBeenCalled();
  });
  it('fires light haptic and warning audio at 10s', async () => {
    await fireRestTimerCues(10, allEnabled);
    expect(triggerHaptic).toHaveBeenCalledWith('light');
    expect(playAudioCue).toHaveBeenCalledWith('warning');
  });
  it('fires notification haptic and complete audio at 0s', async () => {
    await fireRestTimerCues(0, allEnabled);
    expect(triggerNotificationHaptic).toHaveBeenCalledWith('success');
    expect(playAudioCue).toHaveBeenCalledWith('complete');
    expect(triggerHaptic).not.toHaveBeenCalled();
  });
  it('does nothing at non-threshold values', async () => {
    await fireRestTimerCues(45, allEnabled);
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(triggerNotificationHaptic).not.toHaveBeenCalled();
    expect(playAudioCue).not.toHaveBeenCalled();
  });
  it('skips audio when disabled', async () => {
    await fireRestTimerCues(30, hapticOnly);
    expect(triggerHaptic).toHaveBeenCalledWith('light');
    expect(playAudioCue).not.toHaveBeenCalled();
  });
  it('skips haptic when disabled', async () => {
    await fireRestTimerCues(30, audioOnly);
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playAudioCue).toHaveBeenCalledWith('warning');
  });
  it('does nothing when both disabled', async () => {
    await fireRestTimerCues(30, allDisabled);
    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playAudioCue).not.toHaveBeenCalled();
  });
  it('does nothing when both disabled at complete', async () => {
    await fireRestTimerCues(0, allDisabled);
    expect(triggerNotificationHaptic).not.toHaveBeenCalled();
    expect(playAudioCue).not.toHaveBeenCalled();
  });
});
