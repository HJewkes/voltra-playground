import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speakCue, stopSpeaking, isTTSSupported, _resetTTSModule } from '../tts-service';

const mockSpeak = vi.fn();
const mockStop = vi.fn();
const mockIsSpeakingAsync = vi.fn();

vi.mock('expo-speech', () => ({
  speak: mockSpeak,
  stop: mockStop,
  isSpeakingAsync: mockIsSpeakingAsync,
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

beforeEach(() => {
  vi.clearAllMocks();
  _resetTTSModule();
  mockIsSpeakingAsync.mockResolvedValue(false);
});

describe('speakCue', () => {
  it('calls speak with the cue text', async () => {
    await speakCue('Great form, keep it up!');
    expect(mockSpeak).toHaveBeenCalledWith('Great form, keep it up!', { rate: 0.9, pitch: 1.0 });
  });

  it('stops ongoing speech before speaking', async () => {
    mockIsSpeakingAsync.mockResolvedValue(true);
    await speakCue('Second cue');
    expect(mockStop).toHaveBeenCalledBefore(mockSpeak);
  });

  it('does not call stop when nothing is playing', async () => {
    mockIsSpeakingAsync.mockResolvedValue(false);
    await speakCue('Fresh cue');
    expect(mockStop).not.toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalled();
  });

  it('marks TTS as supported after first call on native', async () => {
    await speakCue('test');
    expect(isTTSSupported()).toBe(true);
  });

  it('does not throw when expo-speech.speak throws', async () => {
    mockSpeak.mockImplementation(() => { throw new Error('TTS error'); });
    await expect(speakCue('error cue')).resolves.toBeUndefined();
  });
});

describe('stopSpeaking', () => {
  it('calls stop on the speech module after module is loaded', async () => {
    await speakCue('load module first');
    vi.clearAllMocks();
    stopSpeaking();
    expect(mockStop).toHaveBeenCalledOnce();
  });

  it('is a no-op when the module has not been loaded yet', () => {
    expect(() => stopSpeaking()).not.toThrow();
    expect(mockStop).not.toHaveBeenCalled();
  });
});

describe('isTTSSupported', () => {
  it('returns false before any call is made', () => {
    expect(isTTSSupported()).toBe(false);
  });

  it('returns true after a successful speakCue call on native', async () => {
    await speakCue('init');
    expect(isTTSSupported()).toBe(true);
  });
});

describe('speakCue on web', () => {
  it('does nothing on web platform', async () => {
    const rn = await import('react-native');
    const original = rn.Platform.OS;
    rn.Platform.OS = 'web';
    _resetTTSModule();

    await speakCue('Should be silent');

    expect(mockSpeak).not.toHaveBeenCalled();
    expect(isTTSSupported()).toBe(false);
    rn.Platform.OS = original;
  });
});
