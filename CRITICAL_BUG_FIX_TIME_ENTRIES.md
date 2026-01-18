# CRITICAL BUG FIX: Time Entry Finalization

## Severity: CRITICAL 🔴

## Issue
When generating a payroll preview (without finalizing), the system was marking time entries as finalized. This meant:
- ❌ Dates were locked even though payroll wasn't finalized
- ❌ User couldn't cancel the draft and reuse those dates
- ❌ Violated the immutability requirements (only finalized payroll should be immutable)

## User Impact
**Before Fix:**
1. User generates payroll for Jan 15-18
2. System creates draft and **immediately locks those dates**
3. User reviews and decides not to finalize
4. User tries to delete draft or create new payroll
5. ❌ **Dates are still locked!** Cannot be used again

**After Fix:**
1. User generates payroll for Jan 15-18
2. System creates draft (dates NOT locked)
3. User reviews and decides not to finalize
4. User deletes draft
5. ✅ **Dates are available again!** Can create new payroll

## Root Cause

### The Bug
In `payroll-service.ts`, the `approveDraft()` method was doing this:

```typescript
approveDraft(draftId: number): PayrollRecord {
    // ... validation ...
    
    this.run("UPDATE payroll_records SET status = 'approved' WHERE id = ?", [draftId]);
    
    // ❌ BUG: Marking time entries as finalized too early!
    const entries = TimeEntryService.getTimeEntriesForDateRange(...);
    entries.forEach((entry) => {
        this.run('UPDATE time_entries SET is_finalized = 1 WHERE id = ?', [entry.id]);
    });
    
    return record;
}
```

This was called immediately after creating a draft, before the user even saw the preview!

### The Flow (Broken)
```
Generate Payroll
    ↓
Create Draft (status='draft')
    ↓
Approve Draft (status='approved') ← ❌ Marks time entries as finalized!
    ↓
Show Preview
    ↓
User clicks "Finalize" → Adds check number
```

## The Fix

### What Changed
Removed the time entry finalization from `approveDraft()`:

```typescript
approveDraft(draftId: number): PayrollRecord {
    // ... validation ...
    
    this.run("UPDATE payroll_records SET status = 'approved' WHERE id = ?", [draftId]);
    
    // ✅ REMOVED: Time entry finalization
    // Time entries are now only finalized in finalize() method
    
    return record;
}
```

Time entries are now ONLY finalized in the `finalize()` method (which already had this logic):

```typescript
finalize(id: number, checkNumber: string, ...): PayrollRecord {
    // ... validation ...
    
    this.run("UPDATE payroll_records SET is_finalized = 1, check_number = ? WHERE id = ?", 
        [checkNumber, id]);
    
    // ✅ CORRECT: Finalize time entries only when payroll is finalized
    TimeEntryService.finalizeTimeEntries(record.caregiverId, 
        record.payPeriodStart, record.payPeriodEnd);
    
    return record;
}
```

### The Flow (Fixed)
```
Generate Payroll
    ↓
Create Draft (status='draft', time entries NOT finalized)
    ↓
Approve Draft (status='approved', time entries still NOT finalized)
    ↓
Show Preview
    ↓
User clicks "Finalize" with check number
    ↓
Finalize Payroll (is_finalized=1) ← ✅ NOW marks time entries as finalized!
```

## Data Migration

For existing users with incorrectly finalized time entries:

```sql
-- Unfinalize time entries for unfinalized payroll records
UPDATE time_entries 
SET is_finalized = 0 
WHERE work_date IN (
    SELECT DISTINCT work_date 
    FROM time_entries te
    WHERE EXISTS (
        SELECT 1 FROM payroll_records pr
        WHERE pr.is_finalized = 0
        AND te.work_date BETWEEN pr.pay_period_start AND pr.pay_period_end
    )
);
```

## Testing

### Test Case 1: Cancel Draft
1. ✅ Generate payroll for Jan 20-25
2. ✅ Review preview
3. ✅ Delete draft
4. ✅ Generate new payroll for Jan 20-25 (should work!)

### Test Case 2: Finalize Payroll
1. ✅ Generate payroll for Jan 20-25
2. ✅ Review preview
3. ✅ Click "Finalize" with check number
4. ✅ Time entries are now finalized
5. ❌ Cannot create new payroll for Jan 20-25 (correct behavior)

### Test Case 3: Multiple Drafts
1. ✅ Generate payroll for Jan 20-25 (Draft A)
2. ✅ Delete Draft A
3. ✅ Generate payroll for Jan 20-25 (Draft B)
4. ✅ Delete Draft B
5. ✅ Generate payroll for Jan 20-25 (Draft C)
6. ✅ Finalize Draft C
7. ❌ Cannot create new payroll for Jan 20-25 (correct)

## Requirements Compliance

Per `docs/requirements.md`:

> **Immutability**: Once a payroll record is marked "Paid", it cannot be modified.

**Before Fix:** ❌ Time entries were immutable even for unpaid (draft) payroll  
**After Fix:** ✅ Time entries are only immutable after payroll is finalized

## Files Changed
- `src/services/payroll-service.ts` (lines 539-541 removed)

## Commit
```
fix: CRITICAL - Don't finalize time entries when approving draft
Commit: 094cc6a
```

---

**Status:** ✅ Fixed and deployed  
**Date:** January 17, 2026  
**Severity:** CRITICAL - Data integrity issue  
**Impact:** All users generating payroll previews
