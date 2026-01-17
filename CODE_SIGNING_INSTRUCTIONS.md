# Code Signing Instructions

## ✅ Configuration Complete

Your `package.json` has been updated with the Developer ID certificate:
```json
"identity": "Developer ID Application: Mani Danesh (3CXZWALQ26)"
```

## 🔑 Certificate Verified

Your Developer ID certificate is installed and valid:
```
Developer ID Application: Mani Danesh (3CXZWALQ26)
SHA-1: C5E8B3397752541A61FDF6AA75C43348C97E8925
```

## 📦 Building a Signed Application

### Step 1: Clean Previous Build
```bash
rm -rf release/
rm -rf dist/
```

### Step 2: Build the Application
```bash
npm run package
```

### ⚠️ IMPORTANT: Keychain Access Prompt

When you run the build, macOS will show a dialog asking:

```
codesign wants to sign using key "Developer ID Application: Mani Danesh" 
in your keychain.

[Deny] [Allow] [Always Allow]
```

**YOU MUST CLICK "Always Allow"** (not just "Allow")

This gives the build process permanent access to use your certificate.

If you click "Deny" or "Allow", the build will:
- Either fail with "User interaction is not allowed"
- Or hang waiting for your response
- Or create an unsigned (adhoc) build

### Step 3: Verify the Signature

After the build completes, verify it's properly signed:

```bash
codesign -dv --verbose=4 "release/mac-arm64/Household Payroll.app"
```

**Expected Output:**
```
Authority=Developer ID Application: Mani Danesh (3CXZWALQ26)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
Signature=Developer ID Application: Mani Danesh (3CXZWALQ26)
```

**Bad Output (if not signed):**
```
Signature=adhoc
```

### Step 4: Test the Signed App

```bash
# Check if Gatekeeper will allow it
spctl -a -vv "release/mac-arm64/Household Payroll.app"
```

**Expected:** Should pass or show only notarization warning (which is OK for now)

## 🚨 Troubleshooting

### Build Hangs or Takes Forever
**Cause:** Keychain prompt is waiting for your response  
**Fix:** Look for the keychain dialog and click "Always Allow"

### "User interaction is not allowed" Error
**Cause:** Running in a context where keychain prompts can't be shown  
**Fix:** Make sure you're running the build from Terminal (not SSH or remote session)

### Still Getting "adhoc" Signature
**Possible causes:**
1. Didn't click "Always Allow" on keychain prompt
2. Certificate expired (check in Keychain Access app)
3. Wrong identity name in package.json

**Fix:** 
```bash
# Check certificate validity
security find-identity -v -p codesigning

# If certificate is valid, try building again and watch for the prompt
npm run package
```

### Certificate Not Found
**Cause:** Certificate might have been removed or expired  
**Fix:** Check Keychain Access app → My Certificates → Look for "Developer ID Application"

## 📋 Quick Reference

### Check Certificate
```bash
security find-identity -v -p codesigning | grep "Developer ID"
```

### Clean Build
```bash
rm -rf release/ dist/ && npm run package
```

### Verify Signature
```bash
codesign -dv --verbose=4 "release/mac-arm64/Household Payroll.app"
```

### Check Gatekeeper
```bash
spctl -a -vv "release/mac-arm64/Household Payroll.app"
```

## 🎯 Next Steps After Signing

Once you have a properly signed app:

1. **Test Installation**
   - Copy the DMG to another Mac (if available)
   - Or move it to Downloads and try to install
   - Should open without "unidentified developer" warning

2. **Consider Notarization** (Recommended)
   - Notarization adds an extra layer of trust
   - Required for macOS 10.15+ to avoid warnings
   - See: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution

3. **Create GitHub Release**
   - Upload the signed DMG and ZIP
   - Users can download and install without security warnings

---

**Ready to build?** Run:
```bash
npm run package
```

And remember: **Click "Always Allow"** when the keychain prompt appears!
