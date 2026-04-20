# v1.1.0 — Tax Compliance & Filing Center

## What's New

This release delivers a complete, legally compliant tax form generation system for household employers. All federal and Colorado state tax forms are now generated from your actual payroll data with a single click.

### 📋 Tax Season Center (new)
A dedicated **Tax Center** in the sidebar gives you a single place to:
- Generate, preview, and download all required tax forms
- See colour-coded deadline banners (Jan 31 and Apr 15)
- View your full form generation history
- Get notified when filing season approaches

### 📄 IRS Form W-2 — 6 Critical Fixes
- **Box 3** — Social Security wages now correctly capped at $168,600 (2024 wage base)
- **Box 14** — Colorado FAMLI premiums moved from Box 19 → Box 14 (legally correct)
- **Box 15** — Now uses your real UI Account Number from your employer profile
- **Box 17** — Colorado State Income Tax withheld now correctly included (was missing entirely)
- **Box e** — Employee name now properly split into First / MI / Last
- **Box 19** — Removed incorrect local income tax entry (N/A for Colorado household employers)

### 📋 IRS Schedule H (Form 1040) — 2024 Compliance
- Corrected all line numbers to match the official 2024 IRS form (Lines 1–8, 15–16, 25–26)
- Added pre-screening Questions A, B, C (required at top of official form)
- Added Additional Medicare Tax (Line 5 / Line 6) for wages over $200,000
- Line 2 + 4 + 6 + 7 = Line 8 cross-validation

### 📤 IRS Form W-3 — New
- Transmittal cover sheet summarising all W-2 forms for SSA submission
- Box b pre-checked as **"Hshld. emp."** (household employer)
- Correctly aggregates per-employee SS wage caps, employee-share taxes, and CO totals
- Filing electronically via BSO? Paper W-3 not required — form notes this clearly

### 🏔 Colorado DR 1093 — Fully Reconciled
- **CDOR Payment Tracker**: Record each quarterly payment you make to Colorado Revenue Online
- Line 1 (withheld) vs Line 2 (remitted) reconciliation shown in real time
- `✅ Verified` (green) when payments are logged, `⚠️ Not recorded` (amber) when missing
- Generated PDF reflects actual payment data, not an estimate

### 📤 SSA BSO Filing Guide (new)
In-app step-by-step guide for submitting W-2 Copy A electronically via SSA Business Services Online:
- 7 steps with tips, cautions, and direct link to BSO
- W-2 copy distribution reference (Copy A–D, 1–2)
- Clarifies when paper W-3 is and isn't required

### ⏰ Tax Deadline Notifications
- Automatic alerts as January 31 and April 15 approach
- Multi-tier colours: info → warning → urgent → overdue
- Weekend deadline adjustment (Jan 31, 2026 is Saturday → notifies Feb 2)
- Red badge on Tax Center sidebar item and optional banner across all screens

### 🧪 Compliance Test Suite
- 104 automated tests covering every W-2 box, every Schedule H line, all DR 1093 fields, deadline logic, and all 7 previously fixed bugs

## Filing Reminders
| Form | Deadline | Where to File |
|------|---------|--------------|
| W-2 Copy A + W-3 | January 31 | SSA via ssa.gov/employer (BSO) |
| W-2 Copies B/C/2 | January 31 | Provide to each caregiver |
| Colorado DR 1093 | January 31 | Colorado Revenue Online |
| Schedule H | April 15 | File with personal Form 1040 |

## Data Safety
Your payroll data is not affected by this update. The app adds 3 new database tables (`tax_form_log`, `tax_notification_dismissals`, `co_tax_payments`) automatically on first launch — no action required.
