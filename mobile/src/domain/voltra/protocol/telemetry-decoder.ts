/**
 * Telemetry Decoder
 * 
 * Low-level protocol decoder for Voltra BLE telemetry notifications.
 * Only handles parsing bytes into typed data - no business logic.
 */

import { MessageTypes, TelemetryOffsets, MovementPhase } from '@/domain/voltra/protocol/constants';
import { createFrame, type TelemetryFrame } from '@/domain/voltra/models/telemetry/frame';

// =============================================================================
// Byte Parsing Helpers
// =============================================================================

/**
 * Read a little-endian uint16 from a Uint8Array.
 */
function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

/**
 * Read a little-endian int16 from a Uint8Array.
 */
function readInt16LE(data: Uint8Array, offset: number): number {
  const value = readUint16LE(data, offset);
  return value > 0x7fff ? value - 0x10000 : value;
}

/**
 * Check if two byte arrays are equal.
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// =============================================================================
// Message Types
// =============================================================================

/**
 * Types of messages that can be decoded.
 */
export type MessageType = 
  | 'telemetry_stream'
  | 'rep_summary'
  | 'set_summary'
  | 'status_update'
  | 'unknown';

/**
 * Identify the message type from raw bytes.
 */
export function identifyMessageType(data: Uint8Array): MessageType {
  if (data.length < 4) return 'unknown';
  
  const msgType = data.slice(0, 4);
  
  if (bytesEqual(msgType, MessageTypes.TELEMETRY_STREAM)) {
    return 'telemetry_stream';
  } else if (bytesEqual(msgType, MessageTypes.REP_SUMMARY)) {
    return 'rep_summary';
  } else if (bytesEqual(msgType, MessageTypes.SET_SUMMARY)) {
    return 'set_summary';
  } else if (bytesEqual(msgType, MessageTypes.STATUS_UPDATE)) {
    return 'status_update';
  }
  
  return 'unknown';
}

// =============================================================================
// Decode Results
// =============================================================================

/**
 * Result of decoding a telemetry notification.
 */
export type DecodeResult = 
  | { type: 'frame'; frame: TelemetryFrame }
  | { type: 'rep_boundary' }  // Device signals rep completion
  | { type: 'set_boundary' }  // Device signals set completion
  | { type: 'status'; data: Uint8Array }
  | null;

// =============================================================================
// Decoder
// =============================================================================

/**
 * Decode a telemetry stream message into a TelemetryFrame.
 */
export function decodeTelemetryFrame(data: Uint8Array): TelemetryFrame | null {
  if (data.length < 30) {
    return null;
  }
  
  // Sequence number
  const sequence = readUint16LE(data, TelemetryOffsets.SEQUENCE);
  
  // Phase
  const phaseByte = data[TelemetryOffsets.PHASE];
  let phase: MovementPhase;
  if (phaseByte >= 0 && phaseByte <= 3) {
    phase = phaseByte as MovementPhase;
  } else {
    phase = MovementPhase.UNKNOWN;
  }
  
  // Sensor data
  const position = readUint16LE(data, TelemetryOffsets.POSITION);
  const force = readInt16LE(data, TelemetryOffsets.FORCE);
  const velocity = readUint16LE(data, TelemetryOffsets.VELOCITY);
  
  return createFrame(sequence, phase, position, force, velocity);
}

/**
 * Decode a BLE notification.
 * Returns structured data based on message type.
 */
export function decodeNotification(data: Uint8Array): DecodeResult {
  const msgType = identifyMessageType(data);
  
  switch (msgType) {
    case 'telemetry_stream': {
      const frame = decodeTelemetryFrame(data);
      return frame ? { type: 'frame', frame } : null;
    }
    
    case 'rep_summary':
      // Device is signaling a rep boundary (end of concentric or eccentric)
      return { type: 'rep_boundary' };
    
    case 'set_summary':
      // Device is signaling set completion
      return { type: 'set_boundary' };
    
    case 'status_update':
      return { type: 'status', data };
    
    default:
      return null;
  }
}
