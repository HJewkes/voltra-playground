# Voltra - Makefile
# 
# Commands for setting up and running the Voltra workout app
#

.PHONY: help setup setup-mobile setup-relay mobile web relay relay-bg ios ios-device ios-sim android clean

# Default target
help:
	@echo "Voltra Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          - Set up both mobile app and relay service"
	@echo "  make setup-mobile   - Install mobile app dependencies"
	@echo "  make setup-relay    - Create Python venv and install relay dependencies"
	@echo ""
	@echo "Mac Development (Web + BLE Relay):"
	@echo "  make dev            - Start relay (bg) + web app together"
	@echo "  make web            - Start Expo web dev server only"
	@echo "  make relay          - Start BLE relay service (foreground)"
	@echo "  make relay-bg       - Start BLE relay service (background)"
	@echo "  make relay-stop     - Stop background relay service"
	@echo ""
	@echo "iOS Development:"
	@echo "  make ios-device     - Build and run on physical iPhone (requires setup)"
	@echo "  make ios-sim        - Build and run on iOS Simulator"
	@echo "  make ios            - Alias for ios-sim"
	@echo ""
	@echo "Android Development:"
	@echo "  make android        - Build and run on physical Android device"
	@echo ""
	@echo "Other:"
	@echo "  make mobile         - Start Expo dev server (shows QR for Expo Go)"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo "  make clean          - Remove build artifacts and dependencies"
	@echo ""
	@echo "Documentation:"
	@echo "  mobile/docs/ANDROID-DEVELOPMENT.md - Android setup guide"
	@echo "  mobile/docs/iOS-DEVELOPMENT.md     - iOS setup guide"
	@echo "  mobile/docs/MAC-DEVELOPMENT.md     - Mac/web development guide"
	@echo ""

# =============================================================================
# Setup
# =============================================================================

setup: setup-relay setup-mobile
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Quick start for Mac development:"
	@echo "  make dev"
	@echo ""
	@echo "For native device development:"
	@echo "  iOS:     mobile/docs/iOS-DEVELOPMENT.md"
	@echo "  Android: mobile/docs/ANDROID-DEVELOPMENT.md"
	@echo ""

setup-mobile:
	@echo "📱 Setting up mobile app..."
	cd mobile && npm install
	@echo "✅ Mobile dependencies installed"

setup-relay:
	@echo "🔗 Setting up BLE relay service..."
	cd relay && python3 -m venv venv
	cd relay && ./venv/bin/pip install --upgrade pip
	cd relay && ./venv/bin/pip install -r requirements.txt
	@echo "✅ Relay dependencies installed"

# =============================================================================
# Mac Development (Web + Relay)
# =============================================================================

web:
	@echo "🌐 Starting Expo web dev server..."
	@echo "   Open http://localhost:8081 in your browser"
	@echo ""
	cd mobile && CI=false npx expo start --web

relay:
	@echo "🔗 Starting BLE relay service on ws://localhost:8765..."
	@echo "   Press Ctrl+C to stop"
	cd relay && ./venv/bin/python main.py

relay-bg:
	@echo "🔗 Starting BLE relay service in background..."
	@cd relay && ./venv/bin/python main.py > /tmp/voltra-relay.log 2>&1 & echo $$! > /tmp/voltra-relay.pid
	@sleep 1
	@echo "   PID: $$(cat /tmp/voltra-relay.pid)"
	@echo "   Logs: /tmp/voltra-relay.log"
	@echo "   Stop with: make relay-stop"

relay-stop:
	@if [ -f /tmp/voltra-relay.pid ]; then \
		kill $$(cat /tmp/voltra-relay.pid) 2>/dev/null || true; \
		rm -f /tmp/voltra-relay.pid; \
		echo "🛑 Relay service stopped"; \
	else \
		echo "No relay service running"; \
	fi

dev: relay-bg
	@echo ""
	@sleep 1
	@$(MAKE) web

# =============================================================================
# iOS Development
# =============================================================================

ios-device:
	@echo "📱 Building for physical iPhone..."
	@echo "   Note: Requires Xcode code signing setup"
	@echo "   See: mobile/docs/iOS-DEVELOPMENT.md"
	@echo ""
	cd mobile && npx expo run:ios --device

ios-sim:
	@echo "📱 Building for iOS Simulator..."
	cd mobile && CI=false npx expo run:ios

ios: ios-sim

# =============================================================================
# Android Development
# =============================================================================

android:
	@echo "📱 Building for physical Android device..."
	@echo "   Note: Requires Android Studio + JDK setup"
	@echo "   See: mobile/docs/ANDROID-DEVELOPMENT.md"
	@echo ""
	cd mobile && npx expo run:android

# =============================================================================
# Expo Go (Limited - No Native BLE)
# =============================================================================

mobile:
	@echo "📱 Starting Expo dev server..."
	@echo "   Note: Expo Go does NOT support native BLE"
	@echo "   For BLE testing, use: make ios-device"
	@echo ""
	cd mobile && CI=false npx expo start

# =============================================================================
# Utilities
# =============================================================================

typecheck:
	@echo "🔍 Running TypeScript type check..."
	cd mobile && npx tsc --noEmit

lint:
	@echo "🔍 Running linter..."
	cd mobile && npx expo lint

clean: clean-mobile clean-relay
	@echo "✅ Cleanup complete"

clean-mobile:
	@echo "🧹 Cleaning mobile build artifacts..."
	rm -rf mobile/node_modules
	rm -rf mobile/.expo
	rm -rf mobile/android
	rm -rf mobile/ios

clean-relay:
	@echo "🧹 Cleaning relay venv..."
	rm -rf relay/venv

# =============================================================================
# Info
# =============================================================================

info:
	@echo "Project Structure:"
	@echo "  mobile/     - React Native app (Expo)"
	@echo "  relay/      - Python BLE passthrough (Mac dev only)"
	@echo ""
	@echo "Development Options:"
	@echo "  1. Mac + Web: make dev (uses relay for BLE)"
	@echo "  2. iOS Device: make ios-device (native BLE)"
	@echo "  3. Android Device: make android (native BLE)"
	@echo "  4. iOS Simulator: make ios-sim (no BLE)"
	@echo ""
	@echo "Documentation:"
	@echo "  mobile/docs/ANDROID-DEVELOPMENT.md"
	@echo "  mobile/docs/iOS-DEVELOPMENT.md"
	@echo "  mobile/docs/MAC-DEVELOPMENT.md"
