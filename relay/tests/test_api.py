"""Integration tests for FastAPI endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


class TestRootEndpoint:
    """Tests for the root endpoint."""

    @pytest.mark.asyncio
    async def test_root_returns_status(self, async_client: AsyncClient) -> None:
        """Test that root endpoint returns service status."""
        response = await async_client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "BLE Relay"
        assert "connected" in data

    @pytest.mark.asyncio
    async def test_root_shows_disconnected_by_default(self, async_client: AsyncClient) -> None:
        """Test that root shows disconnected state by default."""
        response = await async_client.get("/")

        data = response.json()
        assert data["connected"] is False
        assert data["device"] is None


class TestWebSocketEndpoint:
    """Tests for WebSocket endpoint."""

    @pytest.mark.asyncio
    async def test_websocket_scan_action(self, async_client: AsyncClient) -> None:
        """Test scan action via WebSocket."""
        mock_device = MagicMock()
        mock_device.name = "VTR-TEST"
        mock_device.address = "AA:BB:CC:DD:EE:FF"

        mock_adv = MagicMock()
        mock_adv.rssi = -50

        with patch("main.BleakScanner.discover") as mock_discover:
            mock_discover.return_value = {
                "AA:BB:CC:DD:EE:FF": (mock_device, mock_adv),
            }

            # Note: Testing WebSocket requires a different approach
            # This is a simplified example - full WebSocket testing would use
            # starlette.testclient.TestClient with websocket_connect
            # For now, we test the underlying relay methods directly

            from main import relay

            results = await relay.scan(timeout=1.0)

            assert len(results) == 1
            assert results[0]["name"] == "VTR-TEST"


class TestWebSocketMessages:
    """Tests for WebSocket message handling logic."""

    @pytest.mark.asyncio
    async def test_relay_status_action(self) -> None:
        """Test status action returns current state."""
        from main import relay

        status = relay.get_status()

        assert "connected" in status
        assert "device" in status

    @pytest.mark.asyncio
    async def test_relay_connect_action(self) -> None:
        """Test connect action with mocked BLE."""
        from main import relay

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

        with patch("main.BleakClient", return_value=mock_client):
            await relay.connect("AA:BB:CC:DD:EE:FF", "VTR-TEST")

            assert relay.is_connected is True
            assert relay._connected_device["id"] == "AA:BB:CC:DD:EE:FF"

    @pytest.mark.asyncio
    async def test_relay_disconnect_action(self) -> None:
        """Test disconnect action."""
        from main import relay

        # Setup connected state
        mock_client = MagicMock()
        mock_client.is_connected = True
        mock_client.disconnect = AsyncMock()

        relay.client = mock_client
        relay._connected_device = {"id": "test", "name": "test"}

        await relay.disconnect()

        assert relay.client is None
        assert relay._connected_device is None

    @pytest.mark.asyncio
    async def test_relay_write_action(self) -> None:
        """Test write action."""
        from main import relay

        mock_client = MagicMock()
        mock_client.is_connected = True
        mock_client.write_gatt_char = AsyncMock()

        relay.client = mock_client
        relay._write_char = MagicMock()

        await relay.write(b"\x01\x02\x03")

        mock_client.write_gatt_char.assert_called_once()
