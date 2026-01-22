# Voltra - Makefile
# 
# Commands for setting up and running the Voltra workout app
#

.PHONY: help setup setup-mobile setup-hooks mobile web ios ios-device ios-sim android android-device test test-watch clean
.PHONY: lint lint-mobile lint-fix lint-fix-mobile
.PHONY: format format-mobile format-check format-check-mobile
.PHONY: typecheck typecheck-mobile
.PHONY: test-unit test-integration test-unit-mobile test-integration-mobile test-coverage
.PHONY: security security-audit check check-quick ci
.PHONY: stop kill-expo

# Default target
help:
	@echo "Voltra Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          - Set up everything (deps + git hooks)"
	@echo "  make setup-mobile   - Install mobile app dependencies"
	@echo "  make setup-hooks    - Set up git hooks (husky)"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint           - Run linter (ESLint)"
	@echo "  make lint-fix       - Auto-fix lint issues"
	@echo "  make format         - Format all code"
	@echo "  make format-check   - Check formatting without changes"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo ""
	@echo "Testing:"
	@echo "  make test           - Run all tests"
	@echo "  make test-unit      - Run unit tests only"
	@echo "  make test-integration - Run integration tests only"
	@echo "  make test-coverage  - Run tests with coverage report"
	@echo "  make test-watch     - Run tests in watch mode"
	@echo ""
	@echo "Security:"
	@echo "  make security       - Run security checks (npm audit)"
	@echo ""
	@echo "Combined Checks:"
	@echo "  make check          - Run everything (lint + format + types + tests)"
	@echo "  make check-quick    - Fast check (lint + types, no tests)"
	@echo "  make ci             - Full CI simulation (security + check)"
	@echo ""
	@echo "Mac Development (Web):"
	@echo "  make dev            - Start Expo web dev server (stops existing first)"
	@echo "  make web            - Alias for dev"
	@echo "  make stop           - Stop any running Expo dev servers"
	@echo ""
	@echo "iOS Development:"
	@echo "  make ios-device     - Build and run on physical iPhone"
	@echo "  make ios-sim        - Build and run on iOS Simulator"
	@echo "  make ios            - Alias for ios-sim"
	@echo ""
	@echo "Android Development:"
	@echo "  make android        - Build and run on physical Android device"
	@echo ""
	@echo "Other:"
	@echo "  make mobile         - Start Expo dev server (shows QR for Expo Go)"
	@echo "  make clean          - Remove build artifacts and dependencies"
	@echo ""

# =============================================================================
# Setup
# =============================================================================

setup: setup-mobile setup-hooks
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Run 'make check' to verify everything is working."
	@echo ""
	@echo "Quick start for Mac development:"
	@echo "  make dev"
	@echo ""

setup-mobile:
	@echo "📱 Setting up mobile app..."
	cd mobile && npm install
	@echo "✅ Mobile dependencies installed"

setup-hooks:
	@echo "🔧 Setting up git hooks..."
	cd mobile && npm run prepare
	@echo "✅ Git hooks configured"

# =============================================================================
# Mac Development (Web)
# =============================================================================

# Kill any existing Expo processes
kill-expo:
	@echo "🛑 Stopping any existing Expo processes..."
	@-pkill -f "expo start" 2>/dev/null || true
	@-lsof -ti:8081 | xargs kill -9 2>/dev/null || true
	@sleep 1

# Stop alias
stop: kill-expo
	@echo "✅ Stopped"

web: kill-expo
	@echo "🌐 Starting Expo web dev server..."
	@echo "   Open http://localhost:8081 in Chrome/Edge for Web Bluetooth support"
	@echo ""
	cd mobile && CI=false npx expo start --web

dev: web

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

android-device:
	@echo "📱 Building for physical Android device (USB)..."
	@echo ""
	@DEVICE_ID=$$(adb devices 2>/dev/null | grep 'device$$' | head -1 | cut -f1); \
	if [ -z "$$DEVICE_ID" ]; then \
		echo "❌ No Android device detected!"; \
		echo ""; \
		echo "Troubleshooting:"; \
		echo "  1. Ensure USB debugging is enabled (Settings → Developer options)"; \
		echo "  2. Unlock your phone and check for 'Allow USB debugging?' prompt"; \
		echo "  3. Try: Settings → Developer options → Revoke USB debugging authorizations"; \
		echo "     Then unplug/replug the cable and accept the prompt"; \
		echo "  4. Make sure USB mode is 'File transfer' (not 'Charging only')"; \
		echo "  5. Try a different USB cable (some are charge-only)"; \
		echo ""; \
		echo "Run 'adb devices' to check connection status."; \
		echo "See: mobile/docs/ANDROID-DEVELOPMENT.md"; \
		exit 1; \
	fi; \
	echo "✅ Device detected: $$DEVICE_ID"; \
	echo ""; \
	cd mobile && ANDROID_SERIAL="$$DEVICE_ID" npx expo run:android --device

android:
	@echo "📱 Building for Android..."
	@echo "   Note: Will show device picker if multiple devices/emulators available"
	@echo "   For physical device only, use: make android-device"
	@echo ""
	cd mobile && npx expo run:android

# =============================================================================
# Expo Go (Limited - No Native BLE)
# =============================================================================

mobile: kill-expo
	@echo "📱 Starting Expo dev server..."
	@echo "   Note: Expo Go does NOT support native BLE"
	@echo "   For BLE testing, use: make ios-device"
	@echo ""
	cd mobile && CI=false npx expo start

# =============================================================================
# Linting
# =============================================================================

lint: lint-mobile
	@echo "✅ All linting passed!"

lint-mobile:
	@echo "🔍 Linting mobile app..."
	cd mobile && npm run lint

lint-fix: lint-fix-mobile
	@echo "✅ All lint fixes applied!"

lint-fix-mobile:
	@echo "🔧 Fixing mobile lint issues..."
	cd mobile && npm run lint:fix

# =============================================================================
# Formatting
# =============================================================================

format: format-mobile
	@echo "✅ All formatting applied!"

format-mobile:
	@echo "🎨 Formatting mobile app..."
	cd mobile && npm run format

format-check: format-check-mobile
	@echo "✅ All format checks passed!"

format-check-mobile:
	@echo "🔍 Checking mobile formatting..."
	cd mobile && npm run format:check

# =============================================================================
# Type Checking
# =============================================================================

typecheck: typecheck-mobile
	@echo "✅ All type checks passed!"

typecheck-mobile:
	@echo "🔍 Type checking mobile app..."
	cd mobile && npm run typecheck

# =============================================================================
# Testing
# =============================================================================

test: test-mobile
	@echo "✅ All tests passed!"

test-mobile:
	@echo "🧪 Running mobile tests..."
	cd mobile && npm test

test-watch:
	@echo "🧪 Running tests in watch mode..."
	cd mobile && npm run test:watch

# Granular test targets
test-unit: test-unit-mobile
test-integration: test-integration-mobile

test-unit-mobile:
	@echo "🧪 Running mobile unit tests..."
	cd mobile && npm run test:unit

test-integration-mobile:
	@echo "🧪 Running mobile integration tests..."
	cd mobile && npm run test:integration

test-coverage:
	@echo "🧪 Running tests with coverage..."
	cd mobile && npm run test:coverage

# =============================================================================
# Security
# =============================================================================

security: security-audit
	@echo "✅ Security checks passed!"

security-audit:
	@echo "🔒 Running npm audit..."
	cd mobile && npm audit --audit-level=high

# =============================================================================
# Combined Checks
# =============================================================================

check: lint format-check typecheck test
	@echo ""
	@echo "========================================"
	@echo "✅ All checks passed!"
	@echo "========================================"

check-quick: lint typecheck
	@echo "✅ Quick checks passed!"

ci: security check
	@echo "✅ CI simulation complete!"

clean: clean-mobile
	@echo "✅ Cleanup complete"

clean-mobile:
	@echo "🧹 Cleaning mobile build artifacts..."
	rm -rf mobile/node_modules
	rm -rf mobile/.expo
	rm -rf mobile/android
	rm -rf mobile/ios

# =============================================================================
# Info
# =============================================================================

info:
	@echo "Project Structure:"
	@echo "  mobile/     - React Native app (Expo)"
	@echo ""
	@echo "Development Options:"
	@echo "  1. Mac + Web: make dev (uses Web Bluetooth API)"
	@echo "  2. iOS Device: make ios-device (native BLE)"
	@echo "  3. Android Device: make android (native BLE)"
	@echo "  4. iOS Simulator: make ios-sim (no BLE)"
	@echo ""
	@echo "Documentation:"
	@echo "  mobile/docs/ANDROID-DEVELOPMENT.md"
	@echo "  mobile/docs/iOS-DEVELOPMENT.md"
