# Bugfix Requirements Document

## Introduction

The payroll system allows multiple "approved" payroll records to be created for the same caregiver and the same pay period. This occurs because `approveDraft` in `PayrollService` transitions a draft to approved status without checking whether an approved (non-voided) record already exists for the same `caregiver_id + pay_period_start + pay_period_end`. Additionally, the `PayrollProcessing` component has two code paths (`handleCalculate` and `handleApprovePayroll`) that both call `saveDraft → approve` without any guard, and `checkOverlappingPayrolls` only looks at `is_finalized = 1` records, completely missing approved-status duplicates.

The fix targets `approveDraft` in `PayrollService`: before promoting a draft to approved, it must query for any existing approved, non-voided record covering the same caregiver and pay period and throw an error if one is found.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `approveDraft` is called for a draft record and an approved (non-voided) payroll record already exists for the same `caregiver_id`, `pay_period_start`, and `pay_period_end` THEN the system approves the draft without error, creating a second approved record for that period.

1.2 WHEN `handleCalculate` in `PayrollProcessing` is invoked for a caregiver and pay period that already has an approved record THEN the system saves a new draft and immediately approves it, resulting in duplicate approved records.

1.3 WHEN `handleApprovePayroll` in `PayrollProcessing` is invoked for a caregiver and pay period that already has an approved record THEN the system saves a new draft and approves it, resulting in duplicate approved records.

1.4 WHEN `checkOverlappingPayrolls` is called THEN the system only checks records where `is_finalized = 1`, ignoring approved-status records and failing to detect the duplicate condition.

### Expected Behavior (Correct)

2.1 WHEN `approveDraft` is called and an approved (non-voided) payroll record already exists for the same `caregiver_id`, `pay_period_start`, and `pay_period_end` THEN the system SHALL throw an error indicating a duplicate approved record exists for that period, leaving both the draft and the existing approved record unchanged.

2.2 WHEN `handleCalculate` attempts to approve a draft for a caregiver and pay period that already has an approved record THEN the system SHALL surface the error from `approveDraft` and display it to the user without creating a duplicate.

2.3 WHEN `handleApprovePayroll` attempts to approve a draft for a caregiver and pay period that already has an approved record THEN the system SHALL surface the error from `approveDraft` and display it to the user without creating a duplicate.

2.4 WHEN `approveDraft` is called and no approved (non-voided) record exists for the same caregiver and pay period THEN the system SHALL approve the draft normally, transitioning its status from `draft` to `approved`.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `approveDraft` is called for a draft with a unique `caregiver_id + pay_period_start + pay_period_end` combination (no existing approved record) THEN the system SHALL CONTINUE TO approve the draft and return the updated record with `status = 'approved'`.

3.2 WHEN `approveDraft` is called and the only existing record for that caregiver and period is voided (`is_voided = 1`) THEN the system SHALL CONTINUE TO approve the draft without error, since a voided record does not constitute an active approved payroll.

3.3 WHEN `approveDraft` is called on a record that is not in `draft` status THEN the system SHALL CONTINUE TO throw an error indicating the payroll is not in draft status.

3.4 WHEN `finalizePayroll` is called on an approved record THEN the system SHALL CONTINUE TO finalize it normally, unaffected by the new duplicate check.

3.5 WHEN `checkOverlappingPayrolls` is called THEN the system SHALL CONTINUE TO return finalized records that overlap the given date range, with no change to its existing behavior.
