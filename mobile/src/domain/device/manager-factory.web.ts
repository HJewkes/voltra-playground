/**
 * Web-target override for {@link createManager} — see `manager-factory.ts`
 * for why the platform branch lives in a resolved file rather than at the
 * call site.
 *
 * Metro picks this over the base file when `platform === 'web'`. `tsc` never
 * reads it as the module (it always resolves the extensionless base), so it
 * imports the web manager from the EXPLICIT `/web` subpath rather than from
 * the package root: that keeps this file type-correct under the same
 * `react-native` condition tsc uses for everything else, instead of
 * depending on which condition happens to be active.
 */
import { VoltraWebManager } from '@voltras/node-sdk/web';
import type { BLEEnvironmentInfo } from './environment';

/**
 * Build the manager for a browser.
 *
 * `forceMock` (the `?mock` query param) wins, same as on native — it is how
 * Playwright and visual dev run without hardware. Otherwise this is real Web
 * Bluetooth, which is a supported development path for the app in a browser.
 */
export function createManager(env: BLEEnvironmentInfo): VoltraWebManager {
  if (env.forceMock) return VoltraWebManager.forMock();
  return VoltraWebManager.forWeb();
}
