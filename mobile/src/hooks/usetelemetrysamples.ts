/**
 * useTelemetrySamples
 *
 * Polls the recording store's TelemetryRingBuffer at 4Hz (250ms)
 * and returns a snapshot of live samples for chart rendering.
 *
 * This decouples chart re-renders from the 11Hz sample rate,
 * reducing React reconciliation from ~11 to ~4 renders per second.
 */

import { useState, useEffect, useRef } from 'react';
import type { WorkoutSample } from '@voltras/workout-analytics';
import type { RecordingStoreApi } from '@/stores/recording-store';

const POLL_INTERVAL_MS = 250; // 4Hz

export function useTelemetrySamples(
  store: RecordingStoreApi,
  enabled: boolean,
): WorkoutSample[] {
  const [samples, setSamples] = useState<WorkoutSample[]>([]);
  const lastVersionRef = useRef(-1);

  useEffect(() => {
    if (!enabled) {
      if (lastVersionRef.current !== -1) {
        setSamples([]);
        lastVersionRef.current = -1;
      }
      return;
    }

    const buffer = store.getTelemetryBuffer();

    const id = setInterval(() => {
      const version = buffer.getVersion();
      if (version !== lastVersionRef.current) {
        lastVersionRef.current = version;
        setSamples(buffer.getAll());
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [store, enabled]);

  return samples;
}
