#!/usr/bin/env npx tsx
/**
 * Test Node.js Bluetooth Connection
 *
 * Tests the NodeBLEAdapter by connecting to a Voltra device and running
 * a short workout session.
 *
 * Usage:
 *   npx tsx scripts/test-node-connection.ts --name VTR-123456
 *   npx tsx scripts/test-node-connection.ts -n VTR-123456 --weight 50 --duration 10
 *
 * Options:
 *   --name, -n      Device name or prefix to match (e.g., "VTR-123456" or "VTR-")
 *   --weight, -w    Weight in lbs for the workout (default: 20)
 *   --duration, -d  Duration in seconds to run the workout (default: 5)
 *   --timeout, -t   Scan timeout in seconds (default: 10)
 *   --help, -h      Show help
 *
 * Requirements:
 *   - Node.js with Bluetooth support
 *   - webbluetooth npm package (optional dependency)
 *   - macOS, Linux, or Windows with BLE hardware
 */

// Direct imports - the import chain is clean now (BLEServiceConfig moved to types.ts)
import { NodeBLEAdapter, type DeviceChooser } from '../src/domain/bluetooth/adapters/node';
import type { Device } from '../src/domain/bluetooth/adapters/types';
import { Auth, Init, Workout, Timing, BLE } from '../src/domain/voltra/protocol/constants';
import { WeightCommands } from '../src/domain/voltra/protocol/commands';
import { decodeTelemetryFrame, identifyMessageType } from '../src/domain/voltra/protocol/telemetry-decoder';
import { delay } from '../src/domain/shared/utils';

// =============================================================================
// CLI Argument Parsing
// =============================================================================

interface CliOptions {
  name: string | null;
  weight: number;
  duration: number;
  timeout: number;
  help: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    name: null,
    weight: 20,
    duration: 5,
    timeout: 10,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--name':
      case '-n':
        options.name = nextArg;
        i++;
        break;
      case '--weight':
      case '-w':
        options.weight = parseInt(nextArg, 10);
        i++;
        break;
      case '--duration':
      case '-d':
        options.duration = parseInt(nextArg, 10);
        i++;
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(nextArg, 10);
        i++;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Voltra Node.js Bluetooth Connection Test

Usage:
  npx tsx scripts/test-node-connection.ts --name VTR-123456
  npx tsx scripts/test-node-connection.ts -n VTR-123456 --weight 50 --duration 10

Options:
  --name, -n      Device name or prefix to match (e.g., "VTR-123456" or "VTR-")
  --weight, -w    Weight in lbs for the workout (default: 20, range: 5-200)
  --duration, -d  Duration in seconds to run the workout (default: 5)
  --timeout, -t   Scan timeout in seconds (default: 10)
  --help, -h      Show this help message

Examples:
  # Connect to specific device, run 10-second workout at 50 lbs
  npx tsx scripts/test-node-connection.ts -n VTR-123456 -w 50 -d 10

  # Connect to first available Voltra device
  npx tsx scripts/test-node-connection.ts

  # Extended scan for hard-to-find devices
  npx tsx scripts/test-node-connection.ts -t 30

Requirements:
  - Node.js with native Bluetooth support
  - webbluetooth npm package (installed as optional dependency)
  - Bluetooth hardware on macOS, Linux, or Windows
`);
}

// =============================================================================
// Telemetry Stats Tracking
// =============================================================================

interface TelemetryStats {
  framesReceived: number;
  maxForce: number;
  maxPosition: number;
  lastSequence: number;
}

function createStats(): TelemetryStats {
  return {
    framesReceived: 0,
    maxForce: 0,
    maxPosition: 0,
    lastSequence: 0,
  };
}

// =============================================================================
// Main Test Flow
// =============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Validate weight
  if (!WeightCommands.isValid(options.weight)) {
    console.error(`❌ Invalid weight: ${options.weight}. Must be ${WeightCommands.MIN}-${WeightCommands.MAX} in increments of ${WeightCommands.INCREMENT}.`);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Voltra Node.js Bluetooth Connection Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(`  Target device:  ${options.name ?? 'Any Voltra device'}`);
  console.log(`  Weight:         ${options.weight} lbs`);
  console.log(`  Duration:       ${options.duration} seconds`);
  console.log(`  Scan timeout:   ${options.timeout} seconds`);
  console.log();

  // Create adapter with BLE config
  const adapter = new NodeBLEAdapter({
    ble: {
      serviceUUID: BLE.SERVICE_UUID,
      notifyCharUUID: BLE.NOTIFY_CHAR_UUID,
      writeCharUUID: BLE.WRITE_CHAR_UUID,
      deviceNamePrefix: BLE.DEVICE_NAME_PREFIX,
    },
  });

  // Set up device chooser if name specified
  if (options.name) {
    const chooser: DeviceChooser = (devices: Device[]) => {
      // Find device that matches the name (exact or prefix)
      const match = devices.find((d) => 
        d.name === options.name || 
        (d.name && d.name.startsWith(options.name!))
      );
      if (match) {
        console.log(`  ✓ Found matching device: ${match.name}`);
      }
      return match ?? null;
    };
    adapter.setDeviceChooser(chooser);
  }

  // Track telemetry stats
  const stats = createStats();
  let notificationCount = 0;

  // Set up notification handler
  adapter.onNotification((data: Uint8Array) => {
    notificationCount++;
    
    const messageType = identifyMessageType(data);
    
    if (messageType === 'telemetry_stream') {
      const frame = decodeTelemetryFrame(data);
      if (frame) {
        stats.framesReceived++;
        stats.lastSequence = frame.sequence;
        stats.maxForce = Math.max(stats.maxForce, Math.abs(frame.force));
        stats.maxPosition = Math.max(stats.maxPosition, frame.position);
        
        // Log every 10th frame to avoid spam
        if (stats.framesReceived % 10 === 0) {
          console.log(`  📊 Frame ${stats.framesReceived}: seq=${frame.sequence}, pos=${frame.position}, force=${frame.force}, phase=${frame.phase}`);
        }
      } else {
        // Debug: frame failed to decode
        if (stats.framesReceived === 0 && notificationCount < 5) {
          console.log(`  ⚠️  Stream message (${data.length} bytes) failed to decode`);
        }
      }
    } else if (messageType !== 'unknown') {
      console.log(`  📨 Received ${messageType} message`);
    }
  });

  // Set up connection state listener
  adapter.onConnectionStateChange((state) => {
    console.log(`  🔌 Connection state: ${state}`);
  });

  try {
    // Step 1: Scan for devices
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 1: Scanning for Voltra devices...');
    console.log('───────────────────────────────────────────────────────────────');

    const devices = await adapter.scan(options.timeout);
    
    if (devices.length === 0) {
      console.error('❌ No Voltra devices found. Make sure the device is powered on.');
      process.exit(1);
    }

    console.log(`  Found ${devices.length} device(s):`);
    devices.forEach((d) => console.log(`    - ${d.name ?? 'Unknown'} (${d.id})`));

    const discoveredDevices = adapter.getDiscoveredDevices();
    const selectedDevice = discoveredDevices[0];
    
    if (!selectedDevice) {
      console.error('❌ No device was selected during scan.');
      process.exit(1);
    }

    // Step 2: Connect
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`Step 2: Connecting to ${selectedDevice.name}...`);
    console.log('───────────────────────────────────────────────────────────────');

    await adapter.connect(selectedDevice.id, { immediateWrite: Auth.DEVICE_ID });
    console.log('  ✓ Connected and authenticated');

    // Wait for auth to process
    console.log(`  Waiting ${Timing.AUTH_TIMEOUT_MS}ms for auth...`);
    await delay(Timing.AUTH_TIMEOUT_MS);

    // Step 3: Send init sequence
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 3: Sending initialization sequence...');
    console.log('───────────────────────────────────────────────────────────────');

    for (let i = 0; i < Init.SEQUENCE.length; i++) {
      const cmd = Init.SEQUENCE[i];
      console.log(`  Sending init command ${i + 1}/${Init.SEQUENCE.length}...`);
      await adapter.write(cmd);
      await delay(Timing.INIT_COMMAND_DELAY_MS);
    }
    console.log('  ✓ Initialization complete');

    // Step 4: Set weight
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`Step 4: Setting weight to ${options.weight} lbs...`);
    console.log('───────────────────────────────────────────────────────────────');

    const weightCmd = WeightCommands.get(options.weight);
    if (!weightCmd) {
      console.error(`❌ Could not build weight command for ${options.weight} lbs`);
      await adapter.disconnect();
      process.exit(1);
    }

    await adapter.write(weightCmd);
    console.log('  ✓ Weight set');
    await delay(100);

    // Step 5: Prepare workout
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 5: Preparing workout mode...');
    console.log('───────────────────────────────────────────────────────────────');

    await adapter.write(Workout.PREPARE);
    await delay(100);
    await adapter.write(Workout.SETUP);
    await delay(100);
    console.log('  ✓ Workout mode prepared');

    // Step 6: Start workout (engage motor)
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 6: Starting workout (engaging motor)...');
    console.log('───────────────────────────────────────────────────────────────');

    await adapter.write(Workout.GO);
    console.log('  ✓ Motor engaged - workout active!');
    console.log();
    console.log(`  🏋️  Workout running for ${options.duration} seconds...`);
    console.log('     Move the handle to generate telemetry data.');
    console.log();

    // Wait for workout duration
    const startTime = Date.now();
    while (Date.now() - startTime < options.duration * 1000) {
      await delay(1000);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = options.duration - elapsed;
      if (remaining > 0) {
        process.stdout.write(`\r  ⏱️  ${remaining}s remaining... (${stats.framesReceived} frames received)    `);
      }
    }
    console.log();

    // Step 7: Stop workout
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 7: Stopping workout...');
    console.log('───────────────────────────────────────────────────────────────');

    await adapter.write(Workout.STOP);
    console.log('  ✓ Workout stopped');

    // Wait a moment for final telemetry
    await delay(500);

    // Step 8: Disconnect
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 8: Disconnecting...');
    console.log('───────────────────────────────────────────────────────────────');

    await adapter.disconnect();
    console.log('  ✓ Disconnected');

    // Summary
    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Test Complete - Summary');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();
    console.log(`  Total notifications:  ${notificationCount}`);
    console.log(`  Telemetry frames:     ${stats.framesReceived}`);
    console.log(`  Max force:            ${stats.maxForce.toFixed(1)} lbs`);
    console.log(`  Max position:         ${stats.maxPosition}`);
    console.log(`  Last sequence:        ${stats.lastSequence}`);
    console.log();
    console.log('  ✅ Node.js Bluetooth connection test passed!');
    console.log();

    process.exit(0);

  } catch (error) {
    console.error();
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('  Test Failed');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error();
    console.error('  Error:', error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.stack) {
      console.error();
      console.error('  Stack trace:');
      console.error(error.stack.split('\n').map(l => '    ' + l).join('\n'));
    }

    // Try to disconnect cleanly
    try {
      await adapter.disconnect();
    } catch {
      // Ignore disconnect errors during cleanup
    }

    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
