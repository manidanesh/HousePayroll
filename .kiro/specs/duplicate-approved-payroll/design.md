# Duplicate Approved Payroll Bugfix Design

## Overview

`approveDraft` in `PayrollService` promotes a draft record to `approved` status without checking whether an approved, non-voided record already exists for the same `caregiver_id + pay_period_start + pay_period_end`. This allows duplicate approved payroll records to accumulate silently. The fix adds a single duplicate guard query at the top of `approveDraft` that throws a descriptive error when a conflict is detected. No other code paths need to change — `PayrollProcessing.tsx` already wraps both `handleCalculate` and `handleApprovePayroll` in `try/catch` blocks that display errors to the user.

## Glossary

- **Bug_Condition (C)**: `approveDraft` is called for a draft whose `caregiver_id + pay_period_start + pay_period_end` matches an existing approved, non-voided record.
- **Property (P)**: When the bug condition holds, `approveDraft` SHALL throw `"An approved payroll record already exists for this caregiver and pay period."` and leave all records unchanged.
- **Preservation**: All existing behavior of `approveDraft` for non-duplicate inputs, plus all other `PayrollService` methods, must remain unchanged.
- **approveDraft**: The method in `src/services/payroll-service.ts` (line 524) that transitions a payroll record from `status = 'draft'` to `status = 'approved'`.
- **approved record**: A `payroll_records` row with `status = 'approved'` and `is_voided = 0`.
- **draft record**: A `payroll_records` row with `status = 'draft'`.

## Bug Details

### Bug Condition

The bug manifests when `approveDraft` is called for a draft record and an approved, non-voided payroll record already exists for the same `caregiver_id`, `pay_period_start`, and `pay_period_end`. The function performs no duplicate check before executing the `UPDATE` statement, so the second approval succeeds silently.

**Formal Specification:**
```
FUNCTION isBugCondition(draftId)
  INPUT: draftId of type number
  OUTPUT: boolean

  draft := getPayrollRecordById(draftId)
  RETURN draft IS NOT NULL
         AND draft.status = 'draft'
         AND EXISTS (
           SELECT 1 FROM payroll_records
           WHERE caregiver_id    = draft.caregiver_id
             AND pay_period_start = draft.pay_period_start
             AND pay_period_end   = draft.pay_period_end
             AND status           = 'approved'
             AND is_voided        = 0
             AND id              != draftId
         )
END FUNCTION
```

### Examples

- Caregiver 1, period 2025-01-01 → 2025-01-07 already has an approved record (id=10). Calling `approveDraft(15)` for the same caregiver and period should throw — currently it silently creates a second approved record.
- Caregiver 1, period 2025-01-01 → 2025-01-07 has only a voided approved record (id=10, `is_voided=1`). Calling `approveDraft(15)` should succeed — the voided record is not an active duplicate.
- Caregiver 1, period 2025-01-08 → 2025-01-14 has no approved record. Calling `approveDraft(20)` should succeed normally.
- Caregiver 2, period 2025-01-01 → 2025-01-07 has an approved record. Calling `approveDraft` for Caregiver 1 on the same dates should succeed — different caregiver.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `approveDraft` for a draft with a unique `caregiver_id + pay_period_start + pay_period_end` must continue to return the updated record with `status = 'approved'`.
- `approveDraft` when the only existing record for that caregiver and period is voided must continue to approve without error.
- `approveDraft` on a non-draft record must continue to throw `"Payroll is not in draft status"`.
- `finalizePayroll` must continue to finalize approved records normally.
- `checkOverlappingPayrolls` must continue to return finalized records that overlap the given date range, with no change to its behavior.
- `saveDraft`, `deleteDraft`, `getDrafts`, `voidPayrollRecord`, and all other `PayrollService` methods must be completely unaffected.

**Scope:**
All inputs where `isBugCondition` returns false must be completely unaffected by this fix. This includes:
- Approving a draft for a caregiver/period with no prior approved record
- Approving a draft for a caregiver/period where the only prior record is voided
- All non-`approveDraft` operations

## Hypothesized Root Cause

Based on the bug description and code review of `approveDraft` (line 524):

1. **Missing Duplicate Guard**: The method checks that the target record is in `draft` status but never queries for an existing approved record with the same `caregiver_id + pay_period_start + pay_period_end`. The `UPDATE` statement runs unconditionally once the draft status check passes.

2. **Overlap Check Blind Spot**: `checkOverlappingPayrolls` filters on `is_finalized = 1`, so approved-but-not-yet-finalized records are invisible to it. This means the UI-level overlap warning never fires for the duplicate scenario.

3. **Two UI Code Paths**: Both `handleCalculate` and `handleApprovePayroll` in `PayrollProcessing.tsx` independently call `saveDraft → approve`, doubling the surface area for duplicates. However, fixing `approveDraft` at the service layer is sufficient — both paths will automatically surface the error via their existing `try/catch` handlers.

## Correctness Properties

Property 1: Bug Condition - Duplicate Approved Record Rejected

_For any_ `draftId` where `isBugCondition(draftId)` returns true (an approved, non-voided record already exists for the same caregiver and pay period), the fixed `approveDraft` function SHALL throw an error with the message `"An approved payroll record already exists for this caregiver and pay period."` and SHALL NOT modify any record in the database.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Normal Approval Unaffected

_For any_ `draftId` where `isBugCondition(draftId)` returns false (no approved, non-voided record exists for the same caregiver and pay period, or the draft itself is invalid), the fixed `approveDraft` function SHALL produce exactly the same result as the original function — approving the draft normally or throwing the existing status-check error — preserving all current behavior for non-duplicate inputs.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `src/services/payroll-service.ts`

**Function**: `approveDraft`

**Specific Changes**:

1. **Add Duplicate Guard Query**: After fetching the draft and verifying its status, execute a `SELECT` query for any existing approved, non-voided record with the same `caregiver_id`, `pay_period_start`, `pay_period_end`, and `employer_id`, excluding the draft itself.

2. **Throw on Conflict**: If the query returns a row, throw `new Error('An approved payroll record already exists for this caregiver and pay period.')` before the `UPDATE` statement runs.

3. **No Other Changes**: The `UPDATE` statement, audit log, and return value remain identical. No changes to `PayrollProcessing.tsx`, `checkOverlappingPayrolls`, or any other method.

**Pseudocode for the guard:**
```
FUNCTION approveDraft(draftId)
  employer := getEmployer()
  IF employer IS NULL THEN THROW 'No employer found'

  draft := getPayrollRecordById(draftId)
  IF draft IS NULL THEN THROW 'Draft payroll not found'

  row := SELECT status FROM payroll_records WHERE id = draftId AND employer_id = employer.id
  IF row IS NULL OR row.status != 'draft' THEN THROW 'Payroll is not in draft status'

  // NEW: duplicate guard
  existing := SELECT id FROM payroll_records
              WHERE caregiver_id     = draft.caregiverId
                AND pay_period_start = draft.payPeriodStart
                AND pay_period_end   = draft.payPeriodEnd
                AND employer_id      = employer.id
                AND status           = 'approved'
                AND is_voided        = 0
                AND id              != draftId
  IF existing IS NOT NULL THEN
    THROW 'An approved payroll record already exists for this caregiver and pay period.'
  END IF

  UPDATE payroll_records SET status = 'approved' WHERE id = draftId AND employer_id = employer.id
  AuditService.log(...)
  RETURN getPayrollRecordById(draftId)
END FUNCTION
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write a test that saves a draft, approves it, saves a second draft for the same caregiver and period, then calls `approveDraft` on the second draft. Assert that an error is thrown. Run this test on the UNFIXED code to observe that it passes without error (confirming the bug).

**Test Cases**:
1. **Direct Duplicate Test**: Save draft A, approve it, save draft B (same caregiver + period), call `approveDraft(B.id)` — expect error (will NOT throw on unfixed code, confirming the bug).
2. **Voided Record Bypass Test**: Save draft A, approve it, void it, save draft B (same caregiver + period), call `approveDraft(B.id)` — expect success (should pass on both unfixed and fixed code).
3. **Different Caregiver Test**: Save draft A for caregiver 1, approve it, save draft B for caregiver 2 (same period), call `approveDraft(B.id)` — expect success (should pass on both unfixed and fixed code).

**Expected Counterexamples**:
- Test 1 passes without throwing on unfixed code, demonstrating that `approveDraft` does not guard against duplicates.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function throws the expected error.

**Pseudocode:**
```
FOR ALL draftId WHERE isBugCondition(draftId) DO
  ASSERT approveDraft_fixed(draftId) THROWS
         'An approved payroll record already exists for this caregiver and pay period.'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL draftId WHERE NOT isBugCondition(draftId) DO
  ASSERT approveDraft_original(draftId) = approveDraft_fixed(draftId)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-duplicate inputs

**Test Plan**: Observe behavior on UNFIXED code first for normal approvals (unique caregiver/period, voided-only prior records), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Normal Approval Preservation**: Verify that approving a draft with no prior approved record continues to return `status = 'approved'` after the fix.
2. **Voided Record Preservation**: Verify that approving a draft when the only prior record is voided continues to succeed after the fix.
3. **Non-Draft Status Preservation**: Verify that calling `approveDraft` on a non-draft record continues to throw `"Payroll is not in draft status"` after the fix.
4. **Other Methods Unaffected**: Verify `finalizePayroll`, `checkOverlappingPayrolls`, `saveDraft`, and `deleteDraft` produce identical results before and after the fix.

### Unit Tests

- Test that `approveDraft` throws when an approved non-voided record exists for the same caregiver and period.
- Test that `approveDraft` succeeds when the only prior record for that period is voided.
- Test that `approveDraft` succeeds when no prior record exists for that period.
- Test that `approveDraft` still throws `"Payroll is not in draft status"` for non-draft records.
- Test that `approveDraft` succeeds for the same period but a different caregiver.

### Property-Based Tests

- Generate random caregiver IDs and pay periods; verify that approving a draft always succeeds when no approved non-voided record exists for that combination.
- Generate random sequences of save/approve/void operations; verify that at most one non-voided approved record exists per `caregiver_id + pay_period_start + pay_period_end` after any sequence.
- Generate random non-duplicate inputs; verify that the fixed `approveDraft` returns the same result as the original for all such inputs.

### Integration Tests

- Test the full `handleCalculate` flow in `PayrollProcessing` for a period that already has an approved record; verify the error is displayed to the user and no duplicate is created.
- Test the full `handleApprovePayroll` flow for a period that already has an approved record; verify the error is displayed and no duplicate is created.
- Test the full happy path (calculate → approve → finalize) for a unique period; verify it completes without error and the fix introduces no regression.
