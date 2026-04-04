# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Duplicate Approved Record Not Rejected
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case - same caregiver + same pay period, two sequential approve calls
  - In `src/services/__tests__/payroll-service.test.ts`, add a describe block `approveDraft - bug condition`
  - Test: save draft A, call `approveDraft(A.id)`, save draft B (same caregiverId + same pay_period_start + pay_period_end), call `approveDraft(B.id)` — assert it throws `"An approved payroll record already exists for this caregiver and pay period."`
  - Also test voided bypass: approve draft A, void it, save draft B same period — assert `approveDraft(B.id)` does NOT throw (this case should pass on both unfixed and fixed code)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: The duplicate test FAILS (no error thrown) — this proves the bug exists
  - Document counterexample: `approveDraft(B.id)` returns successfully instead of throwing, leaving two approved records for the same caregiver and period
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal Approval Behavior Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `approveDraft` for a draft with no prior approved record returns `status = 'approved'`
  - Observe on UNFIXED code: `approveDraft` on a non-draft record throws `"Payroll is not in draft status"`
  - Observe on UNFIXED code: `approveDraft` when the only prior record is voided succeeds normally
  - In `src/services/__tests__/payroll-service.test.ts`, add a describe block `approveDraft - preservation`
  - Write property-based tests covering: unique caregiver/period approval, voided-only prior record approval, non-draft status rejection, different caregiver same period approval
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix duplicate approved payroll guard in approveDraft

  - [x] 3.1 Implement the duplicate guard in `approveDraft`
    - In `src/services/payroll-service.ts`, inside `approveDraft`, after the `row.status !== 'draft'` check and before the `UPDATE` statement
    - Add a `SELECT` query: `SELECT id FROM payroll_records WHERE caregiver_id = ? AND pay_period_start = ? AND pay_period_end = ? AND employer_id = ? AND status = 'approved' AND is_voided = 0 AND id != ?`
    - Bind params: `[draft.caregiverId, draft.payPeriodStart, draft.payPeriodEnd, employer.id, draftId]`
    - If the query returns a row, throw `new Error('An approved payroll record already exists for this caregiver and pay period.')`
    - Leave the `UPDATE` statement, audit log, and return value completely unchanged
    - _Bug_Condition: isBugCondition(draftId) — draft.caregiverId + draft.payPeriodStart + draft.payPeriodEnd matches an existing approved, non-voided record with id != draftId_
    - _Expected_Behavior: approveDraft throws "An approved payroll record already exists for this caregiver and pay period." and no records are modified_
    - _Preservation: all inputs where isBugCondition returns false must produce identical results to the original function_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Duplicate Approved Record Rejected
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: `approveDraft` throws when a duplicate exists
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Normal Approval Behavior Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
    - Confirm unique-period approval, voided-bypass, non-draft rejection, and different-caregiver cases all behave identically to pre-fix behavior

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full `payroll-service` test suite: `npx jest src/services/__tests__/payroll-service.test.ts --run`
  - Ensure all tests pass, ask the user if questions arise
