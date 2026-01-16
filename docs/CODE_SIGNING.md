# Code Signing Setup Guide

## Current Status
You have these certificates:
- ✅ Apple Development: mani.danesh@outlook.com (U265LLJBJD)
- ✅ Apple Distribution: Mani Danesh (3CXZWALQ26)
- ❌ Developer ID Application (NEEDED for DMG distribution)

## To Sign Your App for Distribution

### Step 1: Create Developer ID Application Certificate

1. **Visit Apple Developer Portal:**
   https://developer.apple.com/account/resources/certificates/add

2. **Select Certificate Type:**
   - Choose "Developer ID Application"
   - Click Continue

3. **Create Certificate Signing Request (CSR):**
   - Open **Keychain Access** app
   - Menu: Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
   - Enter your email: `mani.danesh@outlook.com`
   - Common Name: `Mani Danesh`
   - Select: "Saved to disk"
   - Click Continue and save the file

4. **Upload CSR:**
   - Back in the Developer Portal, upload your CSR file
   - Download the certificate (.cer file)
   - Double-click the certificate to install it in Keychain

5. **Verify Installation:**
   ```bash
   security find-identity -v -p codesigning | grep "Developer ID"
   ```
   You should see: "Developer ID Application: Mani Danesh (TEAM_ID)"

### Step 2: Grant Keychain Access to codesign

**Critical:** This is why your builds hang!

When you run `npm run package`, macOS will show a keychain prompt asking for permission.

**You MUST click "Always Allow"** (not just "Allow")

This gives `codesign` permanent access to use your certificate.

### Step 3: Update package.json

Once you have the Developer ID certificate, update `package.json`:

```json
"mac": {
  "category": "public.app-category.finance",
  "target": ["dmg", "zip"],
  "icon": "build/icon.icns",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "identity": "Developer ID Application: Mani Danesh (YOUR_TEAM_ID)"
}
```

### Step 4: Build Signed App

```bash
npm run package
```

When the keychain prompt appears, click **"Always Allow"**.

The build will complete and create a signed DMG.

### Step 5: Verify Signature

```bash
codesign -dv --verbose=4 "release/mac-arm64/Household Payroll.app"
```

Should show your Developer ID certificate.

## Alternative: Use Existing Certificate Temporarily

If you want to test signing now with your Apple Distribution certificate:

```bash
# Update package.json identity to:
"identity": "Apple Distribution: Mani Danesh (3CXZWALQ26)"

# Then build:
npm run package
```

**Note:** This certificate is for App Store, not ideal for DMG distribution.

## Troubleshooting

### Build hangs at signing step
- **Cause:** Keychain prompt waiting for response
- **Fix:** Look for the keychain prompt dialog and click "Always Allow"

### "No identity found" error
- **Cause:** Certificate not installed or expired
- **Fix:** Verify certificate in Keychain Access app

### "User interaction is not allowed" error
- **Cause:** Running in CI/CD or headless mode
- **Fix:** Build on your Mac with GUI access

## Recommended Next Steps

1. Create Developer ID Application certificate (10 minutes)
2. Install it in Keychain
3. Update package.json with the identity
4. Run `npm run package` and click "Always Allow"
5. Distribute your signed DMG!

---

**Need help?** Let me know which step you're on and I can assist!
