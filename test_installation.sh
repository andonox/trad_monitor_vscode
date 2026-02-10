#!/bin/bash
# TRAD Stock Monitor Extension Installation Test Script

set -e  # Exit on error

echo "=== TRAD Stock Monitor Extension Installation Test ==="
echo ""

# Check if VSCode is available
if ! command -v code &> /dev/null; then
    echo "❌ VSCode 'code' command not found"
    echo "   Please ensure VSCode is installed and 'code' is in PATH"
    exit 1
fi

echo "✅ VSCode 'code' command available"

# Check .vsix file
VSIX_FILE="trad-stock-monitor-0.1.0.vsix"
if [ ! -f "$VSIX_FILE" ]; then
    echo "❌ .vsix file not found: $VSIX_FILE"
    echo "   Run 'vsce package' first to create the extension package"
    exit 1
fi

echo "✅ Found extension package: $VSIX_FILE ($(du -h "$VSIX_FILE" | cut -f1))"

# Get current installed extensions
echo ""
echo "=== Current VSCode Extensions ==="
code --list-extensions | grep -i trad || echo "   No TRAD extensions installed"

# Try to install the extension
echo ""
echo "=== Installing Extension ==="
echo "Note: This may open a confirmation dialog in VSCode"
echo "If installation fails, you may need to install manually from the .vsix file"

# Try to install using code command
if code --install-extension "$VSIX_FILE" 2>&1; then
    echo "✅ Extension installation attempted"
    echo "   Please check VSCode for any confirmation dialogs"
else
    echo "⚠️  Extension installation may have failed or requires confirmation"
    echo "   You may need to install manually:"
    echo "   1. Open VSCode"
    echo "   2. Go to Extensions view (Ctrl+Shift+X)"
    echo "   3. Click '...' menu → 'Install from VSIX...'"
    echo "   4. Select $VSIX_FILE"
fi

echo ""
echo "=== Testing Extension Files ==="

# Check compiled output
if [ -f "out/extension.js" ]; then
    echo "✅ Compiled extension.js found"
else
    echo "❌ Compiled extension.js not found"
    echo "   Run 'npm run compile' first"
fi

# Check Python daemon
if [ -f "scripts/stock_daemon.py" ]; then
    echo "✅ Python daemon script found"
    # Test Python daemon startup
    if python3 -c "import sys; sys.path.append('scripts'); import stock_daemon; print('✅ Python daemon imports OK')" 2>&1 | grep -q "OK"; then
        echo "✅ Python dependencies available"
    else
        echo "⚠️  Python dependencies may be missing"
        echo "   Run: pip install akshare pandas requests aiohttp"
    fi
else
    echo "❌ Python daemon script not found"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Restart VSCode (Ctrl+R) if extension was installed"
echo "2. Check for TRAD icon in the activity bar (left sidebar)"
echo "3. Open the TRAD Stock Monitor view"
echo "4. Click the gear icon to configure stocks"
echo "5. Add a test stock (e.g., 600000 for浦发银行)"
echo "6. Click 'Start Monitoring' to begin real-time updates"

echo ""
echo "=== Troubleshooting ==="
echo "- If extension doesn't appear: Check VSCode's Developer Tools (Help → Toggle Developer Tools)"
echo "- For Python errors: Ensure dependencies are installed: pip install akshare pandas"
echo "- For configuration issues: Configuration is stored at ~/.trad/config.json"

echo ""
echo "=== Extension Information ==="
echo "Name: TRAD Stock Monitor"
echo "Version: 0.1.0"
echo "Publisher: trad"
echo "Category: Other"

echo ""
echo "Test script completed. Please follow the manual testing steps above."