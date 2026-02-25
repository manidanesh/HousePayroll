# Release Notes - Version 1.0.5

**Release Date:** February 24, 2026

## Overview
This release fixes critical display issues in the paystub PDF generation system, improving clarity and consistency for payroll administrators.

## Bug Fixes

### Paystub PDF Display Issues
- **Fixed:** Standard earning types (Regular Earnings, Weekend Premium, Holiday Premium) now always display on paystubs, even when there's no activity in the current period
- **Fixed:** Overlapping text in summary table headers - now clearly shows "Employee Deductions" and "Employer Taxes" with proper spacing
- **Fixed:** Rate calculation display for earning rows with zero activity now shows 0.00 instead of incorrect values
- **Improved:** Summary table layout with better column spacing and alignment

## Technical Details

### Changes Made
- Modified `PaystubGenerator.drawEarningRow()` to support mandatory display of standard earning types
- Updated summary table header rendering to use distinct, non-overlapping labels
- Improved rate calculation logic for zero-activity periods
- Added comprehensive property-based tests to validate paystub generation correctness

### Testing
- 9 new tests added (5 property-based tests, 3 example tests)
- All tests passing with 100+ iterations per property test
- Validates requirements for earning row display, rate calculation, and summary table layout

## Impact
- Users will see more consistent paystub formatting
- Easier to understand employee vs employer tax obligations
- Better visual clarity in summary tables
- No data migration required - fixes apply to newly generated paystubs

## Upgrade Instructions
The app will auto-update to version 1.0.5. After updating:
1. Regenerate any paystubs you need with the corrected format
2. Old PDF files remain unchanged - only newly generated paystubs will have the fixes

## Dependencies
- No new dependencies added
- Added `fast-check` (dev dependency) for property-based testing

---

For questions or issues, please contact support or file an issue on GitHub.
