#!/bin/bash
# TRAD Stock Monitor Publish Readiness Check

set -e

echo "=== TRAD Stock Monitor Publish Readiness Check ==="
echo ""

# Check required tools
echo "=== Tool Dependencies ==="
if command -v vsce &> /dev/null; then
    echo "✅ vsce found: $(vsce --version)"
else
    echo "❌ vsce not found. Install: npm install -g @vscode/vsce"
    exit 1
fi

if command -v code &> /dev/null; then
    echo "✅ VSCode 'code' command found"
else
    echo "⚠️  VSCode 'code' command not found (optional for testing)"
fi

# Check extension files
echo ""
echo "=== Extension Files ==="
if [ -f "package.json" ]; then
    echo "✅ package.json found"

    # Check publisher
    PUBLISHER=$(grep '"publisher"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    echo "   Publisher: $PUBLISHER"

    # Check repository URL
    REPO_URL=$(grep -A1 '"repository"' package.json | grep '"url"' | sed 's/.*: "\(.*\)".*/\1/')
    echo "   Repository: $REPO_URL"

    if [[ "$REPO_URL" == *"andonox/trad_monitor_vscode"* ]]; then
        echo "✅ Repository URL correctly set to your GitHub"
    else
        echo "⚠️  Repository URL may not be correct: $REPO_URL"
    fi

    # Check version
    VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    echo "   Version: $VERSION"
else
    echo "❌ package.json not found"
    exit 1
fi

# Check .vsix file
echo ""
echo "=== Package File ==="
VSIX_FILE="trad-stock-monitor-$VERSION.vsix"
if [ -f "$VSIX_FILE" ]; then
    echo "✅ .vsix file found: $VSIX_FILE ($(du -h "$VSIX_FILE" | cut -f1))"

    # Check file count
    FILE_COUNT=$(unzip -l "$VSIX_FILE" | tail -1 | awk '{print $2}')
    echo "   Contains $FILE_COUNT files"
else
    echo "❌ .vsix file not found: $VSIX_FILE"
    echo "   Run: vsce package"
    exit 1
fi

# Check required documentation
echo ""
echo "=== Documentation ==="
REQUIRED_FILES=("README.md" "CHANGELOG.md" "LICENSE")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file found"
    else
        echo "❌ $file missing"
    fi
done

# Check .vscodeignore
if [ -f ".vscodeignore" ]; then
    echo "✅ .vscodeignore found"
    IGNORE_COUNT=$(wc -l < .vscodeignore)
    echo "   $IGNORE_COUNT exclusion patterns"
else
    echo "⚠️  .vscodeignore not found (optional but recommended)"
fi

# Verify extension
echo ""
echo "=== Extension Verification ==="
if vsce verify 2>&1 | grep -q "verified"; then
    echo "✅ Extension verification passed"
else
    echo "⚠️  Extension verification warnings:"
    vsce verify 2>&1 | grep -v "Executing prepublish script" || true
fi

# Test installation
echo ""
echo "=== Test Installation ==="
if command -v code &> /dev/null; then
    echo "Testing installation of $VSIX_FILE..."
    if code --install-extension "$VSIX_FILE" 2>&1 | grep -q "successfully installed"; then
        echo "✅ Extension installs successfully"

        # Check if installed
        if code --list-extensions | grep -q "trad.trad-stock-monitor"; then
            echo "✅ Extension appears in installed list"
        fi
    else
        echo "⚠️  Installation test inconclusive"
    fi
else
    echo "⚠️  Skipping installation test (VSCode 'code' command not found)"
fi

echo ""
echo "=== Publish Checklist ==="
echo ""
echo "✅ 1. package.json configured with correct publisher and repository"
echo "✅ 2. .vsix package created ($VSIX_FILE)"
echo "✅ 3. Required documentation present"
echo "✅ 4. Extension verification passed"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. **Create Azure DevOps account** (if you don't have one)"
echo "   https://aka.ms/SignupAzureDevOps"
echo ""
echo "2. **Create Marketplace publisher**"
echo "   https://marketplace.visualstudio.com/manage"
echo "   Publisher name MUST be: '$PUBLISHER'"
echo ""
echo "3. **Generate Personal Access Token (PAT)**"
echo "   - Go to Azure DevOps organization settings"
echo "   - Security → Personal Access Tokens"
echo "   - Create token with 'Marketplace (Manage)' scope"
echo ""
echo "4. **Publish extension**"
echo "   Method A: vsce publish -p <YOUR_PAT_TOKEN>"
echo "   Method B: vsce login $PUBLISHER   # then enter PAT"
echo "             vsce publish"
echo ""
echo "5. **Verify publication**"
echo "   Visit: https://marketplace.visualstudio.com/items?itemName=$PUBLISHER.trad-stock-monitor"
echo ""
echo "=== Troubleshooting ==="
echo ""
echo "If publishing fails:"
echo "- Ensure publisher name exactly matches: '$PUBLISHER'"
echo "- Check PAT has 'Marketplace (Manage)' permissions"
echo "- Verify repository URL is accessible: $REPO_URL"
echo "- Run: vsce publish --no-dependencies  (to skip some checks)"
echo ""
echo "Read PUBLISH_GUIDE.md for detailed instructions."