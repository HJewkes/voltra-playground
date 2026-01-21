/**
 * Voltra Device Controller
 *
 * Handles device setting commands: weight, chains, eccentric.
 */

import type { BLEAdapter } from '@/domain/bluetooth/adapters';
import {
  WeightCommands,
  ChainsCommands,
  EccentricCommands,
} from '@/domain/voltra/protocol/commands';
import { Timing } from '@/domain/voltra/protocol/constants';
import { delay } from '@/domain/shared';
import { type VoltraDevice } from '@/domain/voltra/models/device';

/**
 * Error thrown when an invalid weight value is provided.
 */
export class InvalidWeightError extends Error {
  constructor(value: number) {
    super(`Invalid weight value: ${value}. Must be 5-200 in increments of 5.`);
    this.name = 'InvalidWeightError';
  }
}

/**
 * Error thrown when an invalid chains value is provided.
 */
export class InvalidChainsError extends Error {
  constructor(value: number) {
    super(`Invalid chains value: ${value}. Must be 0-100.`);
    this.name = 'InvalidChainsError';
  }
}

/**
 * Error thrown when an invalid eccentric value is provided.
 */
export class InvalidEccentricError extends Error {
  constructor(value: number) {
    super(`Invalid eccentric value: ${value}. Must be -195 to +195.`);
    this.name = 'InvalidEccentricError';
  }
}

/**
 * Error thrown when device is not connected.
 */
export class NotConnectedError extends Error {
  constructor() {
    super('Device is not connected');
    this.name = 'NotConnectedError';
  }
}

/**
 * Controller for Voltra device settings.
 */
export class VoltraDeviceController {
  constructor(
    private device: VoltraDevice,
    private adapter: BLEAdapter | null
  ) {}

  /**
   * Update the BLE adapter (used when connection changes).
   */
  setAdapter(adapter: BLEAdapter | null): void {
    this.adapter = adapter;
  }

  /**
   * Check if device is connected.
   */
  private ensureConnected(): void {
    if (!this.adapter) {
      throw new NotConnectedError();
    }
  }

  /**
   * Set weight in pounds.
   * @param lbs Weight in pounds (5-200 in increments of 5)
   */
  async setWeight(lbs: number): Promise<void> {
    this.ensureConnected();

    const cmd = WeightCommands.get(lbs);
    if (!cmd) {
      throw new InvalidWeightError(lbs);
    }

    await this.adapter!.write(cmd);
    this.device.updateSettings({ weight: lbs });
  }

  /**
   * Set chains (reverse resistance) in pounds.
   * @param lbs Chains weight (0-100)
   */
  async setChains(lbs: number): Promise<void> {
    this.ensureConnected();

    const cmds = ChainsCommands.get(lbs);
    if (!cmds) {
      throw new InvalidChainsError(lbs);
    }

    // Dual command - send step1, wait, send step2
    await this.adapter!.write(cmds.step1);
    await delay(Timing.DUAL_COMMAND_DELAY_MS);
    await this.adapter!.write(cmds.step2);

    this.device.updateSettings({ chains: lbs });
  }

  /**
   * Set eccentric load adjustment.
   * @param pct Eccentric adjustment (-195 to +195)
   */
  async setEccentric(pct: number): Promise<void> {
    this.ensureConnected();

    const cmds = EccentricCommands.get(pct);
    if (!cmds) {
      throw new InvalidEccentricError(pct);
    }

    // Dual command - send step1, wait, send step2
    await this.adapter!.write(cmds.step1);
    await delay(Timing.DUAL_COMMAND_DELAY_MS);
    await this.adapter!.write(cmds.step2);

    this.device.updateSettings({ eccentric: pct });
  }

  /**
   * Get available weight values.
   */
  getAvailableWeights(): number[] {
    return WeightCommands.getAvailable();
  }

  /**
   * Get available chains values.
   */
  getAvailableChains(): number[] {
    return ChainsCommands.getAvailable();
  }

  /**
   * Get available eccentric values.
   */
  getAvailableEccentric(): number[] {
    return EccentricCommands.getAvailable();
  }
}
