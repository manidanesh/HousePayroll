# Release Notes - Version 1.0.2

## 🔧 Auto-Update Fix

### GitHub Repository Configuration (CRITICAL)
**Issue:** The app was unable to detect updates because it was checking the wrong GitHub repository name (`household-payroll` instead of `HousePayroll`).

**Fixed:** Updated the auto-updater configuration to point to the correct repository. The app will now properly detect and notify you of updates.

**Impact:** All users - auto-update now works correctly

---

## 🔴 Previous Bug Fixes (from v1.0.1)

### Time Entry Finalization Bug (CRITICAL)
**Issue:** Time entries were being marked as finalized when generating a payroll preview, even before the user finalized the payroll.

**Fixed:** Time entries are now only finalized when you click "Finalize" with a check number.

### Caregiver Update Button Bug
**Issue:** The "Update" button remained disabled when editing a caregiver profile.

**Fixed:** The button now properly enables when you edit the caregiver's information.

---

## 📦 Installation

### For Existing Users (Auto-Update) - NOW WORKING!
Your installed app will automatically detect this update:
1. A notification will appear: "Update Available"
2. Click "Download" to download in the background
3. When ready, click "Restart Now" to install
4. Your data will be preserved automatically

### For New Users
1. Download `Household Payroll-1.0.2-arm64.dmg`
2. Open the DMG file
3. Drag the app to Applications folder
4. Launch from Applications

---

## ✅ Data Safety
**Your data is completely safe:**
- Database location: `~/Library/Application Support/household-payroll/`
- This location is NOT affected by app updates
- All your payroll records, caregivers, and settings are preserved

---

**Release Date:** January 17, 2026  
**Version:** 1.0.2  
**Previous Version:** 1.0.1
