#!/bin/bash

# Build unsigned application (for testing)
# This avoids the iCloud extended attributes issue

echo "Building unsigned application..."
echo ""

# Clean
rm -rf release/
rm -rf dist/

# Build code
echo "1. Building TypeScript and Webpack..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "2. Packaging with electron-builder (unsigned)..."

# Package without signing
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "Application created at:"
    echo "  release/mac-arm64/Household Payroll.app"
    echo ""
    echo "Note: This is an UNSIGNED build for testing only."
    echo "Users will see security warnings when running it."
    echo ""
    echo "To sign manually, run:"
    echo "  ./sign-app.sh"
else
    echo "❌ Packaging failed"
    exit 1
fi
