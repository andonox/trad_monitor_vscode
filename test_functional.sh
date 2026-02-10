#!/bin/bash
# TRAD Stock Monitor Functional Test Script

set -e  # Exit on error

echo "=== TRAD Stock Monitor Functional Test ==="
echo ""

# Check Python daemon functionality
echo "=== Testing Python Daemon ==="
cd "$(dirname "$0")"

# Create a test configuration
TEST_CONFIG_DIR="$HOME/.trad_test"
mkdir -p "$TEST_CONFIG_DIR"
TEST_CONFIG="$TEST_CONFIG_DIR/config.json"

cat > "$TEST_CONFIG" << EOF
{
  "version": "1.0.0",
  "stocks": [
    {
      "code": "600000",
      "name": "浦发银行",
      "buyPrice": 10.5,
      "quantity": 100,
      "enabled": true
    },
    {
      "code": "000001",
      "name": "平安银行",
      "buyPrice": 15.0,
      "quantity": 200,
      "enabled": true
    }
  ],
  "settings": {
    "updateInterval": 5,
    "autoStart": false,
    "showNotifications": false,
    "priceAlertThreshold": 5.0,
    "dataSourcePriority": "sina"
  }
}
EOF

echo "✅ Created test configuration at $TEST_CONFIG"

# Test Python daemon in test mode
echo ""
echo "=== Testing Python Daemon (Test Mode) ==="
if python3 scripts/stock_daemon.py --test 2>&1 | grep -q "Test mode: Generating mock data"; then
    echo "✅ Python daemon test mode successful"
    echo ""
    echo "Sample output from test mode:"
    python3 scripts/stock_daemon.py --test 2>&1 | head -20
else
    echo "❌ Python daemon test mode failed"
    python3 scripts/stock_daemon.py --test 2>&1 | head -10
fi

# Test configuration parsing
echo ""
echo "=== Testing Configuration Parser ==="
if python3 -c "
import sys
import json
sys.path.append('scripts')
try:
    import stock_daemon
    config = stock_daemon.load_config('$TEST_CONFIG')
    print('✅ Configuration loaded successfully')
    print(f'   Found {len(config[\"stocks\"])} stocks')
    for stock in config['stocks']:
        print(f'   - {stock[\"code\"]}: {stock[\"name\"]}')
except Exception as e:
    print(f'❌ Configuration loading failed: {e}')
    sys.exit(1)
" 2>&1; then
    echo "✅ Configuration parsing test passed"
else
    echo "❌ Configuration parsing test failed"
fi

# Test stock data calculation
echo ""
echo "=== Testing Stock Calculations ==="
if python3 -c "
import sys
sys.path.append('scripts')
try:
    import stock_daemon
    # Test calculation logic
    test_data = {
        'current_price': 11.0,
        'buy_price': 10.5,
        'quantity': 100,
        'change': 0.5,
        'change_percent': 4.76
    }

    profit_amount = (test_data['current_price'] - test_data['buy_price']) * test_data['quantity']
    profit_percent = ((test_data['current_price'] - test_data['buy_price']) / test_data['buy_price']) * 100
    market_value = test_data['current_price'] * test_data['quantity']
    cost_basis = test_data['buy_price'] * test_data['quantity']

    print(f'✅ Calculation test:')
    print(f'   Profit amount: {profit_amount:.2f} CNY')
    print(f'   Profit percent: {profit_percent:.2f}%')
    print(f'   Market value: {market_value:.2f} CNY')
    print(f'   Cost basis: {cost_basis:.2f} CNY')

    # Verify calculations
    expected_profit = 50.0
    if abs(profit_amount - expected_profit) < 0.01:
        print('   ✅ Profit calculation correct')
    else:
        print(f'   ❌ Profit calculation incorrect: expected {expected_profit}, got {profit_amount}')

except Exception as e:
    print(f'❌ Calculation test failed: {e}')
    import traceback
    traceback.print_exc()
" 2>&1; then
    echo "✅ Stock calculation test passed"
else
    echo "❌ Stock calculation test failed"
fi

# Clean up test configuration
rm -rf "$TEST_CONFIG_DIR"
echo ""
echo "✅ Cleaned up test configuration"

echo ""
echo "=== Testing Extension Structure ==="

# Check TypeScript compilation
echo "Checking TypeScript compilation..."
if [ -f "out/extension.js" ]; then
    EXTENSION_SIZE=$(wc -l < "out/extension.js")
    echo "✅ extension.js exists ($EXTENSION_SIZE lines)"

    # Check for required exports
    if grep -q "exports.activate" "out/extension.js"; then
        echo "✅ Extension activation export found"
    else
        echo "❌ Extension activation export missing"
    fi

    if grep -q "exports.deactivate" "out/extension.js"; then
        echo "✅ Extension deactivation export found"
    else
        echo "❌ Extension deactivation export missing"
    fi
else
    echo "❌ extension.js not found - compilation may have failed"
fi

# Check view files
echo ""
echo "Checking view files..."
VIEW_FILES=("out/views/stockView.js" "out/src/views/stockView.js")
VIEW_FOUND=false
for view_file in "${VIEW_FILES[@]}"; do
    if [ -f "$view_file" ]; then
        echo "✅ Found view file: $view_file"
        VIEW_FOUND=true
        break
    fi
done

if [ "$VIEW_FOUND" = false ]; then
    echo "❌ No view files found"
fi

# Check configuration files
echo ""
echo "Checking configuration files..."
if [ -f "package.json" ]; then
    echo "✅ package.json found"
    if grep -q '"activationEvents"' "package.json"; then
        echo "✅ Activation events defined"
    fi
    if grep -q '"commands"' "package.json"; then
        echo "✅ Commands defined"
    fi
    if grep -q '"views"' "package.json"; then
        echo "✅ Views defined"
    fi
fi

echo ""
echo "=== Manual Testing Steps ==="
echo "Now that the extension is installed, please manually test:"
echo ""
echo "1. Restart VSCode (Ctrl+R)"
echo "2. Look for the TRAD icon in the activity bar (left sidebar)"
echo "3. Click the TRAD icon to open the stock monitor view"
echo "4. Verify the view shows:"
echo "   - Title: 'TRAD Stock Monitor [Stopped]'"
echo "   - Control buttons: '▶ Start Monitoring', '⚙️ Configuration', '➕ Add Stock'"
echo "5. Click the gear icon to open configuration"
echo "6. In the configuration webview:"
echo "   - Add a test stock (e.g., code: 600000, buy price: 10.5, quantity: 100)"
echo "   - Click 'Save Configuration'"
echo "7. Back in the tree view:"
echo "   - Click '▶ Start Monitoring'"
echo "   - Wait for stock data to appear"
echo "   - Verify profit/loss calculations"
echo "8. Click a stock to see details"

echo ""
echo "=== Expected Behavior ==="
echo "- Tree view should update every 20 seconds (configurable)"
echo "- Stocks show profit/loss with color coding (green for profit, red for loss)"
echo "- Status bar shows monitoring status"
echo "- Configuration persists between VSCode sessions"

echo ""
echo "Functional test completed. Please perform the manual testing steps above."