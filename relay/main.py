"""
BLE Relay Service

Minimal WebSocket server that proxies raw BLE operations.
Used for development testing of the React Native app on Mac.

The BLE connection is maintained independently of WebSocket clients,
so browser refreshes don't disconnect from the Voltra device.
"""

import asyncio
import json
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

# BLE Configuration (same as in the mobile app)
SERVICE_UUID = "E4DADA34-0867-8783-9F70-2CA29216C7E4"
NOTIFY_CHAR_UUID = "55CA1E52-7354-25DE-6AFC-B7DF1E8816AC"
WRITE_CHAR_UUID = "A010891D-F50F-44F0-901F-9A2421A9E050"
DEVICE_NAME_PREFIX = "VTR-"


class BLERelay:
    """
    Manages a single BLE connection and relays data via WebSocket.
    
    The BLE connection is maintained independently of WebSocket clients,
    allowing browser refreshes without losing the device connection.
    """
    
    def __init__(self):
        self.client: Optional[BleakClient] = None
        self.websocket: Optional[WebSocket] = None
        self._write_char = None
        self._notify_char = None
        self._connected_device: Optional[dict] = None  # Track connected device info
    
    async def scan(self, timeout: float = 5.0) -> list[dict]:
        """Scan for Voltra devices."""
        devices = await BleakScanner.discover(timeout=timeout, return_adv=True)
        results = []
        for address, (device, adv_data) in devices.items():
            if device.name and device.name.startswith(DEVICE_NAME_PREFIX):
                results.append({
                    "id": device.address,
                    "name": device.name,
                    "rssi": adv_data.rssi if adv_data else None,
                })
        return results
    
    async def connect(self, device_id: str, device_name: str = None) -> None:
        """Connect to a device by address."""
        if self.client and self.client.is_connected:
            await self.disconnect()
        
        self.client = BleakClient(device_id, disconnected_callback=self._on_disconnect)
        await self.client.connect()
        
        if not self.client.is_connected:
            raise ConnectionError("Failed to connect")
        
        # Find characteristics
        for svc in self.client.services:
            if svc.uuid.lower() == SERVICE_UUID.lower():
                for char in svc.characteristics:
                    if char.uuid.lower() == WRITE_CHAR_UUID.lower():
                        self._write_char = char
                    elif char.uuid.lower() == NOTIFY_CHAR_UUID.lower():
                        self._notify_char = char
        
        if not self._write_char or not self._notify_char:
            await self.disconnect()
            raise ConnectionError("Required characteristics not found")
        
        # Store connected device info
        self._connected_device = {
            "id": device_id,
            "name": device_name or device_id,
        }
        
        # Enable notifications and forward to WebSocket
        await self.client.start_notify(self._notify_char, self._on_notification)
        await self.client.start_notify(self._write_char, self._on_notification)
        
        print(f"[Relay] Connected to {self._connected_device['name']}")
        
        # Notify connected
        if self.websocket:
            await self._send_ws({"type": "connected", "device": self._connected_device})
    
    def _on_disconnect(self, client: BleakClient):
        """Handle unexpected BLE disconnection."""
        print(f"[Relay] Device disconnected unexpectedly")
        self.client = None
        self._write_char = None
        self._notify_char = None
        device = self._connected_device
        self._connected_device = None
        
        if self.websocket:
            asyncio.create_task(
                self._send_ws({"type": "disconnected", "device": device, "unexpected": True})
            )
    
    def _on_notification(self, sender, data: bytearray):
        """Forward BLE notification to WebSocket."""
        if self.websocket:
            hex_data = data.hex()
            asyncio.create_task(
                self._send_ws({
                    "type": "notification",
                    "data": hex_data,
                })
            )
    
    async def _send_ws(self, msg: dict):
        """Send message to WebSocket if connected."""
        if self.websocket:
            try:
                await self.websocket.send_json(msg)
            except Exception as e:
                print(f"[Relay] WebSocket send error: {e}")
    
    async def disconnect(self) -> None:
        """Disconnect from the device."""
        device = self._connected_device
        if self.client and self.client.is_connected:
            await self.client.disconnect()
        self.client = None
        self._write_char = None
        self._notify_char = None
        self._connected_device = None
        
        print(f"[Relay] Disconnected")
        
        if self.websocket:
            await self._send_ws({"type": "disconnected", "device": device})
    
    async def write(self, data: bytes) -> None:
        """Write raw bytes to the device."""
        if not self.client or not self.client.is_connected:
            raise ConnectionError("Not connected")
        
        await self.client.write_gatt_char(self._write_char, data, response=True)
    
    @property
    def is_connected(self) -> bool:
        return self.client is not None and self.client.is_connected
    
    def get_status(self) -> dict:
        """Get current connection status."""
        return {
            "connected": self.is_connected,
            "device": self._connected_device,
        }


# Global relay instance
relay = BLERelay()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cleanup on shutdown."""
    yield
    if relay.is_connected:
        await relay.disconnect()


app = FastAPI(
    title="BLE Relay",
    description="WebSocket relay for BLE communication (development only)",
    lifespan=lifespan,
)

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "status": "ok", 
        "service": "BLE Relay", 
        **relay.get_status(),
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for BLE relay.
    
    Messages from client:
    - {"action": "scan", "timeout": 5.0}
    - {"action": "connect", "device_id": "...", "device_name": "..."}
    - {"action": "disconnect"}
    - {"action": "write", "data": "hex_string"}
    - {"action": "status"} - get current connection status
    
    Messages to client:
    - {"type": "connected", "device": {...}}
    - {"type": "disconnected", "device": {...}}
    - {"type": "notification", "data": "hex_string"}
    - {"type": "status", ...} - sent on connect
    - {"id": "...", "data": ...} (response to request)
    - {"id": "...", "error": "..."} (error response)
    """
    await websocket.accept()
    relay.websocket = websocket
    
    # Immediately send current status to new WebSocket client
    # This allows reconnecting to existing BLE session after browser refresh
    status = relay.get_status()
    await websocket.send_json({"type": "status", **status})
    print(f"[Relay] WebSocket connected, BLE {'connected to ' + status['device']['name'] if status['connected'] else 'not connected'}")
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            msg_id = msg.get("id")
            action = msg.get("action")
            
            try:
                result = None
                
                if action == "scan":
                    timeout = msg.get("timeout", 5.0)
                    result = await relay.scan(timeout)
                    
                elif action == "connect":
                    device_id = msg["device_id"]
                    device_name = msg.get("device_name")
                    await relay.connect(device_id, device_name)
                    result = {"status": "connected", "device": relay._connected_device}
                    
                elif action == "disconnect":
                    await relay.disconnect()
                    result = {"status": "disconnected"}
                    
                elif action == "write":
                    hex_data = msg["data"]
                    data_bytes = bytes.fromhex(hex_data)
                    await relay.write(data_bytes)
                    result = {"status": "ok"}
                
                elif action == "status":
                    result = relay.get_status()
                    
                else:
                    raise ValueError(f"Unknown action: {action}")
                
                # Send response
                if msg_id:
                    await websocket.send_json({"id": msg_id, "data": result})
                    
            except Exception as e:
                error_msg = str(e)
                print(f"[Relay] Error handling {action}: {error_msg}")
                if msg_id:
                    await websocket.send_json({"id": msg_id, "error": error_msg})
                else:
                    await websocket.send_json({"type": "error", "error": error_msg})
                    
    except WebSocketDisconnect:
        print("[Relay] WebSocket disconnected (BLE connection maintained)")
    finally:
        relay.websocket = None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
