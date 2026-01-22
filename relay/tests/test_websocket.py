"""Integration tests for WebSocket endpoint."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient

from main import app, relay


class TestWebSocketEndpoint:
    """Tests for the WebSocket /ws endpoint."""

    def test_websocket_sends_initial_status(self) -> None:
        """Test that WebSocket sends status on connection."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            # First message should be status
            data = websocket.receive_json()

            assert data["type"] == "status"
            assert "connected" in data
            assert "device" in data

    def test_websocket_status_action(self) -> None:
        """Test status action returns current state."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            # Skip initial status message
            websocket.receive_json()

            # Send status request
            websocket.send_json({"id": "test-1", "action": "status"})
            response = websocket.receive_json()

            assert response["id"] == "test-1"
            assert "connected" in response["data"]
            assert "device" in response["data"]

    def test_websocket_scan_action(self) -> None:
        """Test scan action via WebSocket."""
        client = TestClient(app)

        mock_device = MagicMock()
        mock_device.name = "VTR-TEST"
        mock_device.address = "AA:BB:CC:DD:EE:FF"

        mock_adv = MagicMock()
        mock_adv.rssi = -50

        with patch("main.BleakScanner.discover") as mock_discover:
            mock_discover.return_value = {
                "AA:BB:CC:DD:EE:FF": (mock_device, mock_adv),
            }

            with client.websocket_connect("/ws") as websocket:
                # Skip initial status
                websocket.receive_json()

                # Send scan request
                websocket.send_json({"id": "scan-1", "action": "scan", "timeout": 1.0})
                response = websocket.receive_json()

                assert response["id"] == "scan-1"
                assert len(response["data"]) == 1
                assert response["data"][0]["name"] == "VTR-TEST"

    def test_websocket_unknown_action(self) -> None:
        """Test that unknown action returns error."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            # Skip initial status
            websocket.receive_json()

            # Send unknown action
            websocket.send_json({"id": "bad-1", "action": "unknown_action"})
            response = websocket.receive_json()

            assert response["id"] == "bad-1"
            assert "error" in response
            assert "Unknown action" in response["error"]

    def test_websocket_action_error_without_id(self) -> None:
        """Test error handling when no message id provided."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            # Skip initial status
            websocket.receive_json()

            # Send action without id
            websocket.send_json({"action": "unknown_action"})
            response = websocket.receive_json()

            assert response["type"] == "error"
            assert "Unknown action" in response["error"]

    def test_websocket_connect_action(self) -> None:
        """Test connect action via WebSocket."""
        client = TestClient(app)

        mock_client = MagicMock()
        mock_client.is_connected = True
        mock_client.connect = AsyncMock()
        mock_client.disconnect = AsyncMock()
        mock_client.start_notify = AsyncMock()

        # Mock service with characteristics
        mock_char_write = MagicMock()
        mock_char_write.uuid = "a010891d-f50f-44f0-901f-9a2421a9e050"

        mock_char_notify = MagicMock()
        mock_char_notify.uuid = "55ca1e52-7354-25de-6afc-b7df1e8816ac"

        mock_service = MagicMock()
        mock_service.uuid = "e4dada34-0867-8783-9f70-2ca29216c7e4"
        mock_service.characteristics = [mock_char_write, mock_char_notify]

        mock_client.services = [mock_service]

        with (
            patch("main.BleakClient", return_value=mock_client),
            client.websocket_connect("/ws") as websocket,
        ):
            # Skip initial status
            websocket.receive_json()

            # Send connect request
            websocket.send_json(
                {
                    "id": "conn-1",
                    "action": "connect",
                    "device_id": "AA:BB:CC:DD:EE:FF",
                    "device_name": "VTR-TEST",
                }
            )

            # Should receive connect response
            response = websocket.receive_json()
            # May receive connected notification or response
            if response.get("type") == "connected":
                response = websocket.receive_json()

            # Check response
            assert response.get("id") == "conn-1" or response.get("type") == "connected"

    def test_websocket_disconnect_action(self) -> None:
        """Test disconnect action via WebSocket."""
        client = TestClient(app)

        # Setup connected state
        mock_client = MagicMock()
        mock_client.is_connected = True
        mock_client.disconnect = AsyncMock()
        relay.client = mock_client
        relay._connected_device = {"id": "test", "name": "test"}

        try:
            with client.websocket_connect("/ws") as websocket:
                # Skip initial status
                websocket.receive_json()

                # Send disconnect request
                websocket.send_json({"id": "disc-1", "action": "disconnect"})
                response = websocket.receive_json()

                # May receive disconnected notification first
                if response.get("type") == "disconnected":
                    response = websocket.receive_json()

                assert response["id"] == "disc-1"
                assert response["data"]["status"] == "disconnected"
        finally:
            # Clean up
            relay.client = None
            relay._connected_device = None

    def test_websocket_write_action(self) -> None:
        """Test write action via WebSocket."""
        client = TestClient(app)

        mock_client = MagicMock()
        mock_client.is_connected = True
        mock_client.write_gatt_char = AsyncMock()

        relay.client = mock_client
        relay._write_char = MagicMock()
        relay._connected_device = {"id": "test-device", "name": "VTR-TEST"}

        try:
            with client.websocket_connect("/ws") as websocket:
                # Skip initial status
                websocket.receive_json()

                # Send write request
                websocket.send_json({"id": "write-1", "action": "write", "data": "0102030405"})
                response = websocket.receive_json()

                assert response["id"] == "write-1"
                assert response["data"]["status"] == "ok"
                mock_client.write_gatt_char.assert_called_once()
        finally:
            # Clean up
            relay.client = None
            relay._write_char = None
            relay._connected_device = None

    def test_websocket_write_error_when_not_connected(self) -> None:
        """Test write action returns error when not connected."""
        client = TestClient(app)

        # Ensure disconnected state
        relay.client = None
        relay._write_char = None

        with client.websocket_connect("/ws") as websocket:
            # Skip initial status
            websocket.receive_json()

            # Send write request
            websocket.send_json({"id": "write-err", "action": "write", "data": "0102030405"})
            response = websocket.receive_json()

            assert response["id"] == "write-err"
            assert "error" in response
            assert "Not connected" in response["error"]


class TestBLERelayCallbacks:
    """Tests for BLE relay callback functions."""

    @pytest.mark.asyncio
    async def test_on_notification_forwards_to_websocket(self) -> None:
        """Test that notifications are forwarded to WebSocket."""
        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock()
        relay.websocket = mock_ws

        # Create a mock characteristic
        mock_sender = MagicMock()

        # Call the notification handler
        relay._on_notification(mock_sender, bytearray([0x01, 0x02, 0x03]))

        # Wait for async task
        import asyncio

        await asyncio.sleep(0.1)

        # Check that WebSocket received the notification
        mock_ws.send_json.assert_called()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "notification"
        assert call_args["data"] == "010203"

        # Clean up
        relay.websocket = None

    @pytest.mark.asyncio
    async def test_on_notification_does_nothing_without_websocket(self) -> None:
        """Test that notifications are ignored when no WebSocket."""
        relay.websocket = None

        # Create a mock characteristic
        mock_sender = MagicMock()

        # Should not raise
        relay._on_notification(mock_sender, bytearray([0x01, 0x02, 0x03]))

    @pytest.mark.asyncio
    async def test_on_disconnect_callback(self) -> None:
        """Test the disconnect callback clears state."""
        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock()
        relay.websocket = mock_ws

        # Setup some state
        mock_client = MagicMock()
        relay.client = mock_client
        relay._write_char = MagicMock()
        relay._notify_char = MagicMock()
        relay._connected_device = {"id": "test", "name": "test"}

        # Call disconnect callback
        relay._on_disconnect(mock_client)

        # Wait for async task
        import asyncio

        await asyncio.sleep(0.1)

        # State should be cleared
        assert relay.client is None
        assert relay._write_char is None
        assert relay._notify_char is None
        assert relay._connected_device is None

        # WebSocket should be notified
        mock_ws.send_json.assert_called()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "disconnected"
        assert call_args["unexpected"] is True

        # Clean up
        relay.websocket = None

    @pytest.mark.asyncio
    async def test_send_ws_handles_errors(self) -> None:
        """Test that _send_ws handles WebSocket errors gracefully."""
        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock(side_effect=Exception("WebSocket error"))
        relay.websocket = mock_ws

        # Should not raise
        await relay._send_ws({"type": "test"})

        # Clean up
        relay.websocket = None


class TestLifespan:
    """Tests for app lifespan management."""

    @pytest.mark.asyncio
    async def test_lifespan_disconnects_on_shutdown(self) -> None:
        """Test that lifespan disconnects BLE on shutdown."""
        mock_client = MagicMock()
        mock_client.is_connected = True
        mock_client.disconnect = AsyncMock()

        relay.client = mock_client
        relay._connected_device = {"id": "test", "name": "test"}

        # Simulate lifespan shutdown
        from main import lifespan

        async with lifespan(app):
            pass

        # Disconnect should have been called
        mock_client.disconnect.assert_called_once()

        # Clean up
        relay.client = None
        relay._connected_device = None
