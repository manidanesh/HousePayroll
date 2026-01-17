# iCloud Drive Code Signing Workaround

## Problem

Your project is located in iCloud Drive:
```
/Users/Mani/Library/Mobile Documents/com~apple~CloudDocs/Applications/HousePayroll
```

macOS adds extended attributes (resource forks, Finder info) to files in iCloud Drive, which causes code signing to fail with:
```
resource fork, Finder information, or similar detritus not allowed
```

## Solution: Two-Step Build Process

Instead of building and signing in one step, we'll:
1. Build an unsigned application
2. Sign it manually after cleaning extended attributes

---

## Step 1: Build Unsigned Application

Run this command:
```bash
./build-unsigned.sh
```

This will:
- Clean previous builds
- Compile TypeScript
- Bundle with Webpack
- Package with Electron Builder (WITHOUT signing)
- Create: `release/mac-arm64/Household Payroll.app`

**Time:** ~2-3 minutes

---

## Step 2: Sign the Application

After the unsigned build completes, run:
```bash
./sign-app.sh
```

This will:
- Clean extended attributes from the app
- Sign with your Developer ID certificate
- Verify the signature

**⚠️ IMPORTANT:** When the keychain prompt appears, click **"Always Allow"**

**Time:** ~30 seconds

---

## Verification

After signing, verify it worked:
```bash
./verify-signing.sh
```

**Expected output:**
```
✅ SUCCESS: Application is properly signed!
Signature: Developer ID Application: Mani Danesh (3CXZWALQ26)
```

---

## Alternative: Move Project Out of iCloud

For a permanent solution, move your project to a local directory:

### Option A: Move to Documents
```bash
# From your current location
cd ..
mv HousePayroll ~/Documents/HousePayroll
cd ~/Documents/HousePayroll
```

### Option B: Move to Development folder
```bash
# Create a dev folder
mkdir -p ~/Development
cd ..
mv HousePayroll ~/Development/HousePayroll
cd ~/Development/HousePayroll
```

After moving, you can use the normal build process:
```bash
npm run package
```

---

## Quick Reference

### Build Unsigned
```bash
./build-unsigned.sh
```

### Sign Manually
```bash
./sign-app.sh
```

### Verify
```bash
./verify-signing.sh
```

### Full Process
```bash
./build-unsigned.sh && ./sign-app.sh && ./verify-signing.sh
```

---

## Why This Happens

iCloud Drive syncs files across devices and adds metadata:
- Extended attributes (xattr)
- Resource forks (._* files)
- Finder information

These are incompatible with code signing's requirement for "clean" binaries.

The workaround cleans these attributes before signing.

---

## Troubleshooting

### Build Unsigned Fails
- Check that `npm run build` works
- Ensure `dist/` directory has compiled files

### Signing Fails
- Make sure you clicked "Always Allow" on keychain prompt
- Check certificate in Keychain Access app
- Try running `xattr -cr release/` and sign again

### Still Getting "adhoc" Signature
- The signing step didn't work
- Run `./sign-app.sh` again
- Watch for keychain prompt

---

## Next Steps

Once you have a signed application:
1. Test it locally
2. Create DMG manually if needed
3. Consider moving project out of iCloud for easier builds
4. Proceed with beta testing

