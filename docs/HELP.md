# Household Payroll - User Help Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Initial Setup](#initial-setup)
3. [Managing Caregivers](#managing-caregivers)
4. [Tracking Hours](#tracking-hours)
5. [Processing Payroll](#processing-payroll)
6. [Viewing Reports](#viewing-reports)
7. [Settings & Configuration](#settings--configuration)
8. [Troubleshooting](#troubleshooting)
9. [Security & Privacy](#security--privacy)
10. [FAQ](#faq)

---

## Getting Started

### System Requirements
- **macOS** 10.15 (Catalina) or later
- **Storage**: 100 MB free space
- **iCloud**: Enabled for database sync (recommended)

### First Launch
1. **Locate the app** in your Applications folder or Downloads
2. **Right-click** on "Household Payroll.app"
3. Select **"Open"** from the menu
4. Click **"Open"** in the security dialog (first time only)

> **Note**: The app is unsigned, so you must use right-click → Open the first time.

---

## Initial Setup

### Onboarding Wizard
On first launch, you'll be guided through setup:

#### Step 1: Employer Information
Enter your household employer details:
- **Full Legal Name**: Your name as employer
- **Address**: Your home address
- **EIN**: Your Employer Identification Number (from IRS)
- **State**: Currently supports Colorado only

> **Where to get an EIN**: Apply at [IRS.gov](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online)

#### Step 2: First Caregiver
Add your first employee:
- **Full Legal Name**: Employee's legal name
- **SSN**: Social Security Number (encrypted)
- **Hourly Rate**: Pay rate in dollars
- **Relationship Note**: Optional (e.g., "Live-in caregiver")

#### Step 3: W-4 Information
Enter employee's W-4 election:
- **Filing Status**: Single, Married, or Head of Household
- **Multiple Jobs**: Check if applicable
- **Dependents Amount**: From W-4 Step 3
- **Other Income**: From W-4 Step 4(a)
- **Deductions**: From W-4 Step 4(b)
- **Extra Withholding**: From W-4 Step 4(c)

#### Step 4: I-9 Information
- **I-9 Completed**: Check when verified
- **Completion Date**: Date I-9 was completed
- **Notes**: Optional verification notes

---

## Managing Caregivers

### Adding a New Caregiver
1. Click **"Caregivers"** in the sidebar
2. Click **"Add New Caregiver"**
3. Fill in all required fields
4. Click **"Save"**

### Editing Caregiver Information
1. Go to **Caregivers** page
2. Click **"Edit"** next to the caregiver
3. Update information (SSN cannot be changed)
4. Click **"Save Changes"**

> **Security Note**: SSN is never displayed after initial entry. You'll see only a masked version (XXX-XX-1234).

### Updating W-4 Information
When an employee submits a new W-4:
1. Edit the caregiver
2. Update W-4 fields
3. Set **"Effective Date"** (when new withholding starts)
4. Save changes

The system will:
- Track W-4 history
- Apply new withholding from the effective date
- Log the change in audit trail

---

## Tracking Hours

### Adding Time Entries
1. Click **"Time Entries"** in sidebar
2. Click **"Add Time Entry"**
3. Select:
   - **Caregiver**: Employee who worked
   - **Date**: Work date
   - **Hours**: Hours worked (decimal, e.g., 8.5)
   - **Notes**: Optional (e.g., "Overtime")
4. Click **"Save"**

### Editing Time Entries
- You can edit **pending** time entries
- **Finalized** entries cannot be modified (data integrity)

### Pay Periods
The system automatically groups hours into bi-weekly pay periods:
- Pay periods start on Saturday
- Each period is 14 days
- Status shows: Pending, Partial, or Finalized

---

## Processing Payroll

### Running Payroll
1. Click **"Payroll"** in sidebar
2. Select a **pay period**
3. Review hours for each caregiver
4. Click **"Calculate Payroll"**

The system calculates:
- **Gross Pay**: Hours × Hourly Rate
- **Federal Withholding**: Based on W-4
- **Social Security**: 6.2% (up to wage base)
- **Medicare**: 1.45%
- **Colorado SUTA**: Current rate
- **Net Pay**: Amount to pay employee

### Reviewing Calculations
Before finalizing, review:
- ✅ All hours are correct
- ✅ Tax calculations look reasonable
- ✅ Net pay amount is accurate

### Finalizing Payroll
1. Click **"Finalize Payroll"**
2. Confirm the action
3. **Important**: Once finalized, records are immutable

After finalization:
- Paystub PDF is generated
- Payment record is created
- Time entries are locked
- Audit log is updated

### Generating Paystubs
1. Go to **Payroll History**
2. Find the payroll record
3. Click **"Download Paystub"**
4. PDF opens automatically

Paystub includes:
- Employee and employer information
- Pay period dates
- Hours worked
- Gross pay
- All deductions (itemized)
- Net pay
- Year-to-date totals

---

## Viewing Reports

### Payroll History
View all past payroll records:
- Filter by caregiver
- Filter by date range
- See finalized vs. pending
- Download paystubs

### Audit Log
Complete history of all changes:
- Who made the change
- What was changed
- When it happened
- Before/after values (sanitized)

### Year-End Reports
At tax time:
1. Click **"Year-End"** in sidebar
2. Select tax year
3. Generate:
   - **W-2 Data**: For employee tax returns
   - **Schedule H Data**: For your tax return
   - **Annual Summary**: Complete year overview

### Exporting Data
Export to CSV for:
- Tax preparation
- Accounting software
- Record keeping

---

## Settings & Configuration

### Tax Configuration
Update tax rates annually:
1. Go to **Settings** → **Tax Configuration**
2. Enter new year's rates:
   - Social Security wage base
   - FUTA wage base
   - Colorado SUTA rate
3. Save changes

> **Note**: Tax rates apply to payroll processed after the effective date.

### PIN Protection
Set up optional PIN security:
1. Go to **Settings** → **Security**
2. Click **"Set PIN"**
3. Enter 4-6 digit PIN
4. Confirm PIN
5. Enable **"Require PIN on launch"**

### Backup & Restore
The database is automatically synced to iCloud at:
```
~/Library/Mobile Documents/com~apple~CloudDocs/Applications/HousePayroll/DB/
```

**Manual Backup**:
1. Go to **Settings** → **Backup**
2. Click **"Create Backup"**
3. Choose location
4. Backup includes database + encryption key

**Restore**:
1. Go to **Settings** → **Backup**
2. Click **"Restore from Backup"**
3. Select backup file
4. Confirm restoration

> **Warning**: Restore overwrites current data!

---

## Troubleshooting

### App Won't Open
**Problem**: "App can't be opened" error  
**Solution**:
1. Right-click the app
2. Select "Open"
3. Click "Open" in dialog

### Blank Screen on Launch
**Problem**: App opens but shows blank page  
**Solution**:
1. Quit the app
2. Delete database files (backup first!):
   ```
   ~/Library/Mobile Documents/com~apple~CloudDocs/Applications/HousePayroll/DB/
   ```
3. Relaunch app (will create fresh database)

### Decryption Failed Error
**Problem**: "DECRYPTION FAILED" message  
**Cause**: Encryption key mismatch  
**Solution**:
1. Check if `.key.enc` file exists in DB folder
2. If missing, database cannot be decrypted
3. Restore from backup or start fresh

### Payroll Calculations Seem Wrong
**Check**:
1. W-4 information is correct
2. Tax rates are current for the year
3. Hours are entered correctly
4. Pay period dates are correct

**Still wrong?**:
1. Go to Audit Log
2. Check recent changes
3. Contact support with details

### Can't Edit Time Entry
**Reason**: Time entry is finalized  
**Solution**: Finalized entries cannot be edited (by design for compliance)  
**Workaround**: Create adjustment entry with notes

---

## Security & Privacy

### Data Encryption
- **SSNs**: Encrypted using AES-256-CBC
- **EINs**: Encrypted using AES-256-CBC
- **Encryption Key**: Stored in macOS Keychain
- **Database**: Stored locally, synced via iCloud

### What Gets Logged
- All database changes (audit log)
- User actions
- Errors and warnings

### What NEVER Gets Logged
- Plain-text SSNs
- Plain-text EINs
- Passwords or PINs
- Encryption keys

All sensitive data is automatically redacted with `[REDACTED]` in logs.

### Data Location
```
Database: ~/Library/Mobile Documents/.../HousePayroll/DB/
Logs:     ~/Library/Mobile Documents/.../HousePayroll/DB/logs/
```

### Sharing Data
**Never share**:
- Database files
- Encryption key (`.key.enc`)
- Backup files containing sensitive data

**Safe to share**:
- Paystub PDFs (for employees)
- Year-end reports (for tax preparation)
- Exported CSV (review for sensitive data first)

---

## FAQ

### Q: Can I use this for multiple households?
**A**: Currently, the app supports one household employer. Multi-household support is planned for a future version.

### Q: What states are supported?
**A**: Currently only Colorado. Federal taxes work for all states, but state-specific taxes are Colorado-only.

### Q: Can I process payroll for contractors (1099)?
**A**: No, this app is designed for W-2 household employees only.

### Q: How do I handle overtime?
**A**: Household employers are generally exempt from overtime requirements, but you can track overtime hours in the notes field.

### Q: Can I pay via direct deposit?
**A**: The app has Stripe integration for payment processing, but you'll need to set up a Stripe account separately.

### Q: What if I make a mistake after finalizing payroll?
**A**: Finalized records cannot be edited. You can create a correction entry in the next pay period with detailed notes.

### Q: How long should I keep payroll records?
**A**: IRS recommends keeping employment tax records for at least 4 years.

### Q: Is my data backed up?
**A**: If iCloud is enabled, the database syncs automatically. You can also create manual backups.

### Q: Can I access this on my iPhone?
**A**: Not currently. The app is macOS-only. Mobile support is on the roadmap.

### Q: What happens if I lose my encryption key?
**A**: Without the encryption key, encrypted data (SSNs, EINs) cannot be recovered. Always backup the entire DB folder including `.key.enc`.

---

## Getting Help

### Support Resources
- **GitHub Issues**: https://github.com/manidanesh/HousePayroll/issues
- **Documentation**: See `docs/` folder
- **Email**: [Your support email]

### Reporting Bugs
When reporting issues, include:
1. macOS version
2. App version (see About menu)
3. Steps to reproduce
4. Screenshots (redact sensitive data!)
5. Error messages from logs

### Log Files
Logs are located at:
```
~/Library/Mobile Documents/.../HousePayroll/DB/logs/
```

**Before sharing logs**: They are automatically sanitized, but review for any sensitive data.

---

## Legal & Compliance

### Disclaimer
This software is provided as-is for personal use. You are responsible for:
- Verifying tax calculations
- Maintaining compliance with employment laws
- Filing required tax forms
- Keeping accurate records

### Tax Filing
This app helps with record-keeping but does NOT:
- File taxes for you
- Submit W-2s to SSA
- File Schedule H with IRS
- Handle state unemployment filings

You must still file required forms with appropriate agencies.

### Compliance
Consult with:
- **Tax Professional**: For tax advice
- **Accountant**: For financial guidance
- **Attorney**: For legal compliance

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-15  
**For**: Household Payroll Application
