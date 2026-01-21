"""Unit tests for BLERelay class."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from main import BLERelay


class TestBLERelayState:
    """Tests for BLERelay state management."""

    def test_initial_state(self, fresh_relay: BLERelay) -> None:
        """Test that a new relay starts disconnected."""
        assert fresh_relay.client is None
        assert fresh_relay.websocket is None
        assert fresh_relay.is_connected is False

    def test_get_status_disconnected(self, fresh_relay: BLERelay) -> None:
        """Test status when disconnected."""
        status = fresh_relay.get_status()
        assert status["connected"] is False
        assert status["device"] is None

    def test_is_connected_with_no_client(self, fresh_relay: BLERelay) -> None:
        """Test is_connected returns False when no client."""
        assert fresh_relay.is_connected is False

    def test_is_connected_with_disconnected_client(
        self, fresh_relay: BLERelay, mock_bleak_client: MagicMock
    ) -> None:
        """Test is_connected returns False when client is disconnected."""
        mock_bleak_client.is_connected = False
        fresh_relay.client = mock_bleak_client
        assert fresh_relay.is_connected is False


class TestBLERelayScan:
    """Tests for BLE scanning."""

    @pytest.mark.asyncio
    async def test_scan_returns_voltra_devices(self, fresh_relay: BLERelay) -> None:
        """Test that scan filters for Voltra devices."""
        mock_device = MagicMock()
        mock_device.name = "VTR-12345"
        mock_device.address = "AA:BB:CC:DD:EE:FF"

        mock_adv_data = MagicMock()
        mock_adv_data.rssi = -50

        mock_other_device = MagicMock()
        mock_other_device.name = "Other Device"
        mock_other_device.address = "11:22:33:44:55:66"

        with patch("main.BleakScanner.discover") as mock_discover:
            mock_discover.return_value = {
                "AA:BB:CC:DD:EE:FF": (mock_device, mock_adv_data),
                "11:22:33:44:55:66": (mock_other_device, None),
            }

            results = await fresh_relay.scan(timeout=1.0)

            assert len(results) == 1
            assert results[0]["id"] == "AA:BB:CC:DD:EE:FF"
            assert results[0]["name"] == "VTR-12345"
            assert results[0]["rssi"] == -50

    @pytest.mark.asyncio
    async def test_scan_returns_empty_for_no_voltra_devices(self, fresh_relay: BLERelay) -> None:
        """Test that scan returns empty list when no Voltra devices found."""
        mock_device = MagicMock()
        mock_device.name = "Other Device"
        mock_device.address = "11:22:33:44:55:66"

        with patch("main.BleakScanner.discover") as mock_discover:
            mock_discover.return_value = {
                "11:22:33:44:55:66": (mock_device, None),
            }

            results = await fresh_relay.scan(timeout=1.0)

            assert len(results) == 0


class TestBLERelayConnect:
    """Tests for BLE connection."""

    @pytest.mark.asyncio
    async def test_connect_success(
        self, fresh_relay: BLERelay, mock_bleak_client: MagicMock
    ) -> None:
        """Test successful connection to a device."""
        with patch("main.BleakClient", return_value=mock_bleak_client):
            await fresh_relay.connect("AA:BB:CC:DD:EE:FF", "VTR-TEST")

            assert fresh_relay.is_connected is True
            assert fresh_relay._connected_device is not None
            assert fresh_relay._connected_device["id"] == "AA:BB:CC:DD:EE:FF"
            assert fresh_relay._connected_device["name"] == "VTR-TEST"

    @pytest.mark.asyncio
    async def test_connect_disconnects_existing(
        self, fresh_relay: BLERelay, mock_bleak_client: MagicMock
    ) -> None:
        """Test that connecting to new device disconnects existing one."""
        # Set up existing connection
        existing_client = MagicMock()
        existing_client.is_connected = True
        existing_client.disconnect = AsyncMock()
        fresh_relay.client = existing_client

        with patch("main.BleakClient", return_value=mock_bleak_client):
            await fresh_relay.connect("AA:BB:CC:DD:EE:FF", "VTR-TEST")

            existing_client.disconnect.assert_called_once()


class TestBLERelayDisconnect:
    """Tests for BLE disconnection."""

    @pytest.mark.asyncio
    async def test_disconnect_clears_state(
        self, fresh_relay: BLERelay, mock_bleak_client: MagicMock
    ) -> None:
        """Test that disconnect clears all state."""
        fresh_relay.client = mock_bleak_client
        fresh_relay._connected_device = {"id": "test", "name": "test"}
        fresh_relay._write_char = MagicMock()
        fresh_relay._notify_char = MagicMock()

        await fresh_relay.disconnect()

        assert fresh_relay.client is None
        assert fresh_relay._connected_device is None
        assert fresh_relay._write_char is None
        assert fresh_relay._notify_char is None


class TestBLERelayWrite:
    """Tests for BLE write operations."""

    @pytest.mark.asyncio
    async def test_write_success(self, fresh_relay: BLERelay, mock_bleak_client: MagicMock) -> None:
        """Test successful write to device."""
        fresh_relay.client = mock_bleak_client
        fresh_relay._write_char = MagicMock()

        await fresh_relay.write(b"\x01\x02\x03")

        mock_bleak_client.write_gatt_char.assert_called_once_with(
            fresh_relay._write_char, b"\x01\x02\x03", response=True
        )

    @pytest.mark.asyncio
    async def test_write_raises_when_not_connected(self, fresh_relay: BLERelay) -> None:
        """Test that write raises error when not connected."""
        with pytest.raises(ConnectionError, match="Not connected"):
            await fresh_relay.write(b"\x01\x02\x03")
