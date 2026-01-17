#!/bin/bash

# Manually sign the application after building unsigned

APP_PATH="release/mac-arm64/Household Payroll.app"
IDENTITY="Developer ID Application: Mani Danesh (3CXZWALQ26)"
ENTITLEMENTS="build/entitlements.mac.plist"

echo "================================================"
echo "Manual Code Signing Script"
echo "================================================"
echo ""

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Application not found at: $APP_PATH"
    echo ""
    echo "Please build the unsigned app first:"
    echo "  ./build-unsigned.sh"
    exit 1
fi

echo "✅ Application found"
echo ""

# Clean extended attributes from the app
echo "Cleaning extended attributes..."
xattr -cr "$APP_PATH"
find "$APP_PATH" -name "._*" -delete 2>/dev/null

echo "✅ Cleaned"
echo ""

# Sign the app
echo "Signing application..."
echo "Identity: $IDENTITY"
echo ""

codesign --sign "$IDENTITY" \
    --force \
    --deep \
    --timestamp \
    --options runtime \
    --entitlements "$ENTITLEMENTS" \
    "$APP_PATH"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Application signed successfully!"
    echo ""
    echo "Verifying signature..."
    codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -E "(Authority|Signature|Identifier)"
    echo ""
    echo "Run verification script:"
    echo "  ./verify-signing.sh"
else
    echo ""
    echo "❌ Signing failed"
    echo ""
    echo "Common issues:"
    echo "  1. Keychain prompt - make sure to click 'Always Allow'"
    echo "  2. Certificate expired - check Keychain Access"
    echo "  3. Extended attributes - try cleaning again"
    exit 1
fi
