/**
 * Application Configuration
 *
 * Central place for all configuration constants.
 */

// BLE Relay configuration (development only)
export const RELAY_PORT = 8765;
export const RELAY_HOST = 'localhost';
export const RELAY_WS_URL = `ws://${RELAY_HOST}:${RELAY_PORT}/ws`;
export const RELAY_HTTP_URL = `http://${RELAY_HOST}:${RELAY_PORT}`;

// Timeouts (in milliseconds)
export const SCAN_DURATION = 5000; // How long each scan runs
export const SCAN_INTERVAL = 30000; // Auto-scan every 30s when not connected
export const CONNECTION_TIMEOUT = 30000;
export const RELAY_CHECK_TIMEOUT = 3000;
export const RELAY_CHECK_INTERVAL = 10000;

// Storage keys
export const STORAGE_VERSION = 2;
