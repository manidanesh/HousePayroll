# Release Notes - Version 1.0.1

## 🔴 Critical Bug Fixes

### Time Entry Finalization Bug (CRITICAL)
**Issue:** Time entries were being marked as finalized when generating a payroll preview, even before the user finalized the payroll. This locked dates and prevented users from canceling drafts or reusing those dates.

**Fixed:** Time entries are now only finalized when you click "Finalize" with a check number. You can now:
- Generate payroll previews without locking dates
- Cancel drafts and reuse the same dates
- Create multiple drafts for the same period

**Impact:** All users generating payroll

---

### Caregiver Update Button Bug
**Issue:** The "Update" button remained disabled when editing a caregiver profile, even after making changes.

**Fixed:** The button now properly enables when you edit the caregiver's name, hourly rate, or other fields.

**Impact:** Users editing caregiver profiles

---

## 📦 Installation

### For New Users
1. Download `Household Payroll-1.0.1-arm64.dmg`
2. Open the DMG file
3. Drag the app to Applications folder
4. Launch from Applications

### For Existing Users (Auto-Update)
Your installed app will automatically detect this update:
1. A notification will appear: "Update Available"
2. Click "Download" to download in the background
3. When ready, click "Restart Now" to install
4. Your data will be preserved automatically

### Manual Update
If auto-update doesn't work:
1. Download `Household Payroll-1.0.1-arm64.dmg`
2. Quit the current app
3. Open the DMG and drag to Applications (replace existing)
4. Launch the updated app
5. Your data is safe in `~/Library/Application Support/household-payroll/`

---

## ✅ Data Safety

**Your data is completely safe:**
- Database location: `~/Library/Application Support/household-payroll/`
- This location is NOT affected by app updates
- All your payroll records, caregivers, and settings are preserved
- No data migration needed

---

## 🔧 Technical Details

**Files Changed:**
- `src/services/payroll-service.ts` - Removed premature time entry finalization
- `src/renderer/components/CaregiverManagement.tsx` - Fixed form validation

**Commits:**
- `094cc6a` - CRITICAL: Don't finalize time entries when approving draft
- `2ed13d6` - Enable Update button when editing caregiver profile

---

## 📋 Full Changelog

### Bug Fixes
- **CRITICAL:** Time entries no longer finalized on draft creation ([#094cc6a](https://github.com/manidanesh/HousePayroll/commit/094cc6a))
- **Fixed:** Update button now works when editing caregiver profile ([#2ed13d6](https://github.com/manidanesh/HousePayroll/commit/2ed13d6))

### Documentation
- Added critical bug fix documentation
- Added update button fix documentation
- Updated build success documentation

---

## 🆘 Support

If you encounter any issues:
1. Check logs: `~/Library/Logs/household-payroll/`
2. Report issues: https://github.com/manidanesh/HousePayroll/issues
3. Email: mani.danesh@outlook.com

---

**Release Date:** January 17, 2026  
**Version:** 1.0.1  
**Previous Version:** 1.0.0
