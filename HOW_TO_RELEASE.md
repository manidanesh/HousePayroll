# How to Create GitHub Release for Auto-Update

## Files to Upload

You need to upload these 3 files from the `release/` folder:

1. **Household Payroll-1.0.1-arm64.dmg** (131 MB)
   - The installer for new users

2. **Household Payroll-1.0.1-arm64-mac.zip** (125 MB)
   - Alternative download format

3. **latest-mac.yml** (535 bytes)
   - **CRITICAL:** This file tells the auto-updater about the new version

## Steps to Create Release

### Option 1: Using GitHub Web Interface (Recommended)

1. **Go to GitHub Releases:**
   ```
   https://github.com/manidanesh/HousePayroll/releases/new
   ```

2. **Fill in the form:**
   - **Tag:** Select `v1.0.1` (already created)
   - **Release title:** `v1.0.1 - Critical Bug Fixes`
   - **Description:** Copy the content from `RELEASE_NOTES_v1.0.1.md`

3. **Upload files:**
   - Click "Attach binaries by dropping them here or selecting them"
   - Upload these 3 files:
     - `Household Payroll-1.0.1-arm64.dmg`
     - `Household Payroll-1.0.1-arm64-mac.zip`
     - `latest-mac.yml`

4. **Publish:**
   - Check "Set as the latest release"
   - Click "Publish release"

### Option 2: Using GitHub CLI

If you have `gh` CLI installed:

```bash
cd /Users/Mani/Documents/MyProjects/CareGiver

gh release create v1.0.1 \
  "release/Household Payroll-1.0.1-arm64.dmg" \
  "release/Household Payroll-1.0.1-arm64-mac.zip" \
  "release/latest-mac.yml" \
  --title "v1.0.1 - Critical Bug Fixes" \
  --notes-file RELEASE_NOTES_v1.0.1.md
```

## What Happens After Release

### For Users with Installed App (Auto-Update)

1. **Within 4 hours** (or on next app launch), the app checks for updates
2. User sees notification: "Update Available - A new version (1.0.1) is available!"
3. User clicks "Download" → Downloads in background
4. When complete: "Update Ready - Version 1.0.1 has been downloaded"
5. User clicks "Restart Now" → App updates and restarts
6. **Data is preserved** - stored in `~/Library/Application Support/household-payroll/`

### For New Users

1. Go to: https://github.com/manidanesh/HousePayroll/releases
2. Download `Household Payroll-1.0.1-arm64.dmg`
3. Install normally

## Verification

After creating the release, verify:

1. **Check release page:**
   ```
   https://github.com/manidanesh/HousePayroll/releases/tag/v1.0.1
   ```

2. **Verify files are uploaded:**
   - ✅ Household Payroll-1.0.1-arm64.dmg
   - ✅ Household Payroll-1.0.1-arm64-mac.zip
   - ✅ latest-mac.yml

3. **Test auto-update:**
   - Open your installed app (v1.0.0)
   - Wait a few seconds
   - Should see "Update Available" notification

## Important Notes

### The `latest-mac.yml` File

This file is **CRITICAL** for auto-update. It contains:
```yaml
version: 1.0.1
files:
  - url: Household Payroll-1.0.1-arm64-mac.zip
    sha512: [checksum]
    size: [bytes]
path: Household Payroll-1.0.1-arm64-mac.zip
sha512: [checksum]
releaseDate: '2026-01-17T...'
```

Without this file, the auto-updater won't detect the new version!

### Data Safety

User data is stored separately from the app:
- **App location:** `/Applications/Household Payroll.app`
- **Data location:** `~/Library/Application Support/household-payroll/`

When the app updates:
- ✅ App files are replaced
- ✅ Data files are NOT touched
- ✅ Database remains intact
- ✅ Settings preserved

## Troubleshooting

### Auto-update not working?

1. **Check release is published:**
   - Must be marked as "latest release"
   - All 3 files must be uploaded

2. **Check app configuration:**
   - `package.json` has correct GitHub repo
   - App is running packaged version (not dev mode)

3. **Force check:**
   - Restart the app
   - Auto-update checks on startup

### Manual update if needed:

1. Download DMG from GitHub releases
2. Quit current app
3. Open DMG and drag to Applications (replace)
4. Launch updated app
5. Data is preserved automatically

---

**Next Release:** When you fix more bugs or add features, repeat this process with v1.0.2, v1.1.0, etc.
