# Manual Update Required - One Time Only

## Why Manual Update is Needed

Your installed app (v1.0.0) was built with the wrong GitHub repository name in its configuration:
- **Looking for:** `manidanesh/household-payroll` (doesn't exist)
- **Actual repo:** `manidanesh/HousePayroll`

This is why you're not seeing update notifications - the app can't find the releases.

## Solution: Install v1.0.2 Manually (One Time)

### Step 1: Quit the Current App
Close "Household Payroll" if it's running.

### Step 2: Install v1.0.2 DMG
1. Open: `/Users/Mani/Documents/MyProjects/CareGiver/release/Household Payroll-1.0.2-arm64.dmg`
2. Drag "Household Payroll" to Applications folder
3. Click "Replace" when asked

### Step 3: Launch the Updated App
1. Open "Household Payroll" from Applications
2. Your data is safe - it's stored separately in `~/Library/Application Support/household-payroll/`

### Step 4: Auto-Update Now Works!
From now on, the app will automatically detect updates from the correct repository.

---

## What Was Fixed in v1.0.2

1. **Auto-Update Configuration** - Now points to correct GitHub repo
2. **Time Entry Bug** - Time entries only finalized when you click "Finalize"
3. **Update Button Bug** - Update button works when editing caregiver profiles

---

## Future Updates

After installing v1.0.2, you'll never need to manually update again:
- App checks for updates every 3 seconds on launch
- Shows "Update Available" notification
- Downloads and installs automatically
- All data preserved

---

## Your Data is Safe

Your database is stored at:
```
~/Library/Application Support/household-payroll/
```

This location is NOT affected by app updates. All your:
- Employer profile
- Caregivers
- Time entries
- Payroll records
- Settings

...are completely safe and will be there after the update.
