#!/usr/bin/env npx tsx
/**
 * Test Node.js Bluetooth Connection
 *
 * Tests the Node.js SDK by connecting to a Voltra device and running
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

import {
  VoltraManager,
  type VoltraClient,
  type TelemetryFrame,
  delay,
} from '@voltras/node-sdk';

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

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Voltra Node.js Bluetooth Connection Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(`  Target device:  ${options.name ?? 'Any Voltra device'}`);
  console.log(`  Weight:         ${options.weight} lbs`);
  console.log(`  Duration:       ${options.duration} seconds`);
  console.log(`  Scan timeout:   ${options.timeout} seconds`);
  console.log();

  // Create manager for Node.js
  const manager = VoltraManager.forNode();

  // Track telemetry stats
  const stats = createStats();
  let client: VoltraClient | null = null;

  try {
    // Step 1: Scan and connect
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 1: Scanning for Voltra devices...');
    console.log('───────────────────────────────────────────────────────────────');

    if (options.name) {
      // Connect by name
      client = await manager.connectByName(options.name, {
        timeout: options.timeout * 1000,
        matchMode: 'contains',
      });
    } else {
      // Connect to first device
      client = await manager.connectFirst({
        timeout: options.timeout * 1000,
      });
    }

    console.log(`  ✓ Connected to ${client.connectedDeviceName ?? 'Voltra'}`);

    // Set up telemetry listener
    client.onFrame((frame: TelemetryFrame) => {
      stats.framesReceived++;
      stats.lastSequence = frame.sequence;
      stats.maxForce = Math.max(stats.maxForce, Math.abs(frame.force));
      stats.maxPosition = Math.max(stats.maxPosition, frame.position);

      // Log every 10th frame to avoid spam
      if (stats.framesReceived % 10 === 0) {
        console.log(
          `  📊 Frame ${stats.framesReceived}: seq=${frame.sequence}, pos=${frame.position}, force=${frame.force.toFixed(1)}, phase=${frame.phase}`
        );
      }
    });

    // Step 2: Set weight
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`Step 2: Setting weight to ${options.weight} lbs...`);
    console.log('───────────────────────────────────────────────────────────────');

    await client.setWeight(options.weight);
    console.log('  ✓ Weight set');

    // Step 3: Start workout
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 3: Starting workout (engaging motor)...');
    console.log('───────────────────────────────────────────────────────────────');

    await client.startRecording();
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
        process.stdout.write(
          `\r  ⏱️  ${remaining}s remaining... (${stats.framesReceived} frames received)    `
        );
      }
    }
    console.log();

    // Step 4: Stop workout
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 4: Stopping workout...');
    console.log('───────────────────────────────────────────────────────────────');

    await client.stopRecording();
    console.log('  ✓ Workout stopped');

    // Wait a moment for final telemetry
    await delay(500);

    // Step 5: Disconnect
    console.log();
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Step 5: Disconnecting...');
    console.log('───────────────────────────────────────────────────────────────');

    await client.disconnect();
    console.log('  ✓ Disconnected');

    // Summary
    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Test Complete - Summary');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();
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
      console.error(
        error.stack
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n')
      );
    }

    // Try to disconnect cleanly
    try {
      if (client) {
        await client.disconnect();
      }
      manager.dispose();
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
