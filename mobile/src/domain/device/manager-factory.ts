/**
 * Platform-resolved VoltraManager construction.
 *
 * WHY THIS FILE EXISTS. `@voltras/node-sdk` ships PER-PLATFORM entry points
 * (SDK 0.12.2): the `react-native` export condition resolves the package
 * root to a native-only manager, and `browser` resolves it to a web-only
 * one. That split is what lets Metro bundle the SDK at all — the old
 * single root reached `@stoprocent/noble` -> `node:os` through the adapters
 * barrel and the iOS bundle died outright.
 *
 * The consequence is that `VoltraManager.forWeb()` and `.forNode()` do not
 * exist on a phone, and `.forNative()` does not exist in a browser. A
 * single call site branching across all four cannot typecheck against
 * either entry, so the branch moves HERE and Metro resolves it by platform
 * extension: this file is the default (native), `manager-factory.web.ts`
 * overrides it for the web target.
 *
 * `tsc` has no notion of platform extensions and always reads THIS file,
 * which is why the default is the native one — the platform the app
 * actually ships on. `manager-factory.web.ts` stays type-safe on its own by
 * importing the web manager from its explicit `/web` subpath rather than
 * from the root.
 */
import { VoltraManager } from '@voltras/node-sdk';
import type { BLEEnvironmentInfo } from './environment';

/**
 * Build the manager for the detected environment.
 *
 * `forceMock` wins over everything: it is the `?mock` escape hatch used by
 * Playwright and visual dev, and it must work on every platform.
 *
 * There is no `node` branch. An Expo app with `react-native-ble-plx`'s
 * native entitlements never runs in bare Node, and the SDK's native entry
 * cannot construct a Node backend even if it wanted to. A non-native,
 * non-mock environment reaching this file means platform detection is
 * wrong, so it falls back to the mock rather than throwing at the user.
 */
export function createManager(env: BLEEnvironmentInfo): VoltraManager {
  if (env.forceMock) return VoltraManager.forMock();
  if (env.environment === 'native') return VoltraManager.forNative();
  return VoltraManager.forMock();
}
