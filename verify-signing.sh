#!/bin/bash

# Verification script for code signing

echo "================================================"
echo "Code Signing Verification Script"
echo "================================================"
echo ""

# Check if app exists
APP_PATH="release/mac-arm64/Household Payroll.app"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Application not found at: $APP_PATH"
    echo ""
    echo "Please build the application first:"
    echo "  npm run package"
    exit 1
fi

echo "✅ Application found"
echo ""

# Check signature
echo "📝 Checking code signature..."
echo "----------------------------------------"
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -E "(Authority|Signature|Identifier)"
echo ""

# Extract signature type
SIGNATURE=$(codesign -dv "$APP_PATH" 2>&1 | grep "Signature=" | cut -d'=' -f2)

if [ "$SIGNATURE" = "adhoc" ]; then
    echo "❌ FAIL: Application is NOT properly signed (adhoc signature)"
    echo ""
    echo "This means:"
    echo "  - Users will see security warnings"
    echo "  - macOS Gatekeeper will block the app"
    echo "  - Not suitable for distribution"
    echo ""
    echo "To fix:"
    echo "  1. Make sure you clicked 'Always Allow' on keychain prompt"
    echo "  2. Rebuild: npm run package"
    echo ""
    exit 1
elif [[ "$SIGNATURE" == *"Developer ID"* ]]; then
    echo "✅ SUCCESS: Application is properly signed!"
    echo ""
    echo "Signature: $SIGNATURE"
    echo ""
else
    echo "⚠️  WARNING: Unexpected signature type: $SIGNATURE"
    echo ""
fi

# Check Gatekeeper
echo "🔒 Checking Gatekeeper assessment..."
echo "----------------------------------------"
spctl -a -vv "$APP_PATH" 2>&1

SPCTL_EXIT=$?
echo ""

if [ $SPCTL_EXIT -eq 0 ]; then
    echo "✅ Gatekeeper: PASS"
    echo "   App will run without warnings"
elif [ $SPCTL_EXIT -eq 3 ]; then
    echo "⚠️  Gatekeeper: Not notarized"
    echo "   App is signed but not notarized"
    echo "   Users on macOS 10.15+ may see a warning"
    echo "   Consider notarizing for best user experience"
else
    echo "❌ Gatekeeper: FAIL"
    echo "   App may be blocked by macOS security"
fi

echo ""
echo "================================================"
echo "Verification Complete"
echo "================================================"
