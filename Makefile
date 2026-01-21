# Voltra - Makefile
# 
# Commands for setting up and running the Voltra workout app
#

.PHONY: help setup setup-mobile setup-relay setup-hooks mobile web relay relay-bg ios ios-device ios-sim android test test-watch clean
.PHONY: lint lint-mobile lint-relay lint-fix lint-fix-mobile lint-fix-relay
.PHONY: format format-mobile format-relay format-check format-check-mobile format-check-relay
.PHONY: typecheck typecheck-mobile typecheck-relay
.PHONY: test-unit test-integration test-unit-mobile test-integration-mobile test-unit-relay test-integration-relay test-coverage
.PHONY: security security-audit check check-quick ci

# Default target
help:
	@echo "Voltra Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          - Set up everything (deps + git hooks)"
	@echo "  make setup-mobile   - Install mobile app dependencies"
	@echo "  make setup-relay    - Create Python venv and install relay dependencies"
	@echo "  make setup-hooks    - Set up git hooks (husky)"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint           - Run all linters (ESLint + Ruff)"
	@echo "  make lint-fix       - Auto-fix lint issues"
	@echo "  make format         - Format all code"
	@echo "  make format-check   - Check formatting without changes"
	@echo "  make typecheck      - Run TypeScript + mypy type checking"
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
	@echo "Mac Development (Web + BLE Relay):"
	@echo "  make dev            - Start relay (bg) + web app together"
	@echo "  make web            - Start Expo web dev server only"
	@echo "  make relay          - Start BLE relay service (foreground)"
	@echo "  make relay-bg       - Start BLE relay service (background)"
	@echo "  make relay-stop     - Stop background relay service"
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

setup: setup-relay setup-mobile setup-hooks
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

setup-relay:
	@echo "🔗 Setting up BLE relay service..."
	cd relay && python3 -m venv venv
	cd relay && ./venv/bin/pip install --upgrade pip
	cd relay && ./venv/bin/pip install -r requirements.txt
	@echo "✅ Relay dependencies installed"

setup-hooks:
	@echo "🔧 Setting up git hooks..."
	cd mobile && npm run prepare
	@echo "✅ Git hooks configured"

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
# Linting
# =============================================================================

lint: lint-mobile lint-relay
	@echo "✅ All linting passed!"

lint-mobile:
	@echo "🔍 Linting mobile app..."
	cd mobile && npm run lint

lint-relay:
	@echo "🔍 Linting relay service..."
	cd relay && ./venv/bin/ruff check .

lint-fix: lint-fix-mobile lint-fix-relay
	@echo "✅ All lint fixes applied!"

lint-fix-mobile:
	@echo "🔧 Fixing mobile lint issues..."
	cd mobile && npm run lint:fix

lint-fix-relay:
	@echo "🔧 Fixing relay lint issues..."
	cd relay && ./venv/bin/ruff check --fix .

# =============================================================================
# Formatting
# =============================================================================

format: format-mobile format-relay
	@echo "✅ All formatting applied!"

format-mobile:
	@echo "🎨 Formatting mobile app..."
	cd mobile && npm run format

format-relay:
	@echo "🎨 Formatting relay service..."
	cd relay && ./venv/bin/ruff format .

format-check: format-check-mobile format-check-relay
	@echo "✅ All format checks passed!"

format-check-mobile:
	@echo "🔍 Checking mobile formatting..."
	cd mobile && npm run format:check

format-check-relay:
	@echo "🔍 Checking relay formatting..."
	cd relay && ./venv/bin/ruff format --check .

# =============================================================================
# Type Checking
# =============================================================================

typecheck: typecheck-mobile typecheck-relay
	@echo "✅ All type checks passed!"

typecheck-mobile:
	@echo "🔍 Type checking mobile app..."
	cd mobile && npm run typecheck

typecheck-relay:
	@echo "🔍 Type checking relay service..."
	cd relay && ./venv/bin/mypy main.py

# =============================================================================
# Testing
# =============================================================================

test: test-mobile test-relay
	@echo "✅ All tests passed!"

test-mobile:
	@echo "🧪 Running mobile tests..."
	cd mobile && npm test

test-relay:
	@echo "🧪 Running relay tests..."
	cd relay && ./venv/bin/pytest -v

test-watch:
	@echo "🧪 Running tests in watch mode..."
	cd mobile && npm run test:watch

# Granular test targets
test-unit: test-unit-mobile test-unit-relay
test-integration: test-integration-mobile test-integration-relay

test-unit-mobile:
	@echo "🧪 Running mobile unit tests..."
	cd mobile && npm run test:unit

test-integration-mobile:
	@echo "🧪 Running mobile integration tests..."
	cd mobile && npm run test:integration

test-unit-relay:
	@echo "🧪 Running relay unit tests..."
	cd relay && ./venv/bin/pytest tests/test_relay.py -v

test-integration-relay:
	@echo "🧪 Running relay integration tests..."
	cd relay && ./venv/bin/pytest tests/test_api.py -v

test-coverage:
	@echo "🧪 Running tests with coverage..."
	cd mobile && npm run test:coverage
	cd relay && ./venv/bin/pytest --cov=. --cov-report=term-missing --cov-fail-under=60

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
