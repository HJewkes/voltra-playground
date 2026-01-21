"""Shared test fixtures for relay tests."""

from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from main import BLERelay, app, relay


@pytest.fixture
def mock_ble_device() -> dict[str, Any]:
    """Create a mock BLE device."""
    return {
        "id": "AA:BB:CC:DD:EE:FF",
        "name": "VTR-TEST",
        "rssi": -50,
    }


@pytest.fixture
def mock_bleak_client() -> MagicMock:
    """Create a mock BleakClient."""
    client = MagicMock()
    client.is_connected = True
    client.connect = AsyncMock()
    client.disconnect = AsyncMock()
    client.start_notify = AsyncMock()
    client.write_gatt_char = AsyncMock()

    # Mock services
    mock_char_write = MagicMock()
    mock_char_write.uuid = "a010891d-f50f-44f0-901f-9a2421a9e050"

    mock_char_notify = MagicMock()
    mock_char_notify.uuid = "55ca1e52-7354-25de-6afc-b7df1e8816ac"

    mock_service = MagicMock()
    mock_service.uuid = "e4dada34-0867-8783-9f70-2ca29216c7e4"
    mock_service.characteristics = [mock_char_write, mock_char_notify]

    client.services = [mock_service]

    return client


@pytest.fixture
def fresh_relay() -> Generator[BLERelay, None, None]:
    """Create a fresh BLERelay instance for each test."""
    test_relay = BLERelay()
    yield test_relay
    # Cleanup
    test_relay.client = None
    test_relay.websocket = None


@pytest.fixture
async def async_client() -> AsyncClient:
    """Create an async HTTP client for testing FastAPI endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture(autouse=True)
def reset_global_relay() -> Generator[None, None, None]:
    """Reset the global relay state before each test."""
    relay.client = None
    relay.websocket = None
    relay._write_char = None
    relay._notify_char = None
    relay._connected_device = None
    yield
    # Cleanup after test
    relay.client = None
    relay.websocket = None
    relay._write_char = None
    relay._notify_char = None
    relay._connected_device = None
