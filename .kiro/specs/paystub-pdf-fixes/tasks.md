# Implementation Plan: Paystub PDF Fixes

## Overview

This implementation plan addresses two display issues in the paystub PDF generator: ensuring standard earning types are always displayed, and fixing overlapping text in the summary table headers. The changes will be made to the `PaystubGenerator` class in `src/utils/paystub-generator.ts`.

## Tasks

- [x] 1. Fix earnings row display logic
  - [x] 1.1 Modify drawEarningRow function to accept an optional parameter indicating if the row is mandatory
    - Update the function signature to include `isMandatory?: boolean`
    - Modify the skip logic: if `isMandatory` is true, never skip the row
    - If `isMandatory` is false, use existing logic (skip if both current and YTD are zero)
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.2 Update Regular Earnings, Weekend Premium, and Holiday Premium calls to always display
    - Pass `isMandatory: true` for Regular Earnings row
    - Pass `isMandatory: true` for Weekend Premium row
    - Pass `isMandatory: true` for Holiday Premium row
    - Keep Overtime row with default behavior (only show with activity)
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.3 Write property test for standard earning types always displayed
    - **Property 1: Standard earning types always displayed**
    - **Validates: Requirements 1.1**
  
  - [x] 1.4 Write property test for overtime visibility logic
    - **Property 2: Overtime rows shown only with activity**
    - **Property 3: Overtime rows shown with activity**
    - **Validates: Requirements 1.2, 1.3**

- [x] 2. Fix rate calculation for zero activity rows
  - [x] 2.1 Update rate calculation logic in drawEarningRow
    - When both hours and current wages are zero, display rate as 0.00
    - When hours are non-zero, calculate rate as current / hours
    - Maintain division by zero protection using `|| 1` fallback
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.2 Write property tests for rate calculation
    - **Property 4: Rate calculation for active periods**
    - **Property 5: Rate display for zero activity**
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. Checkpoint - Verify earnings section changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Fix summary table header layout
  - [x] 4.1 Update summary table column headers
    - Change first "Total Deduction" to "Employee Deductions"
    - Change second "Total Deduction" to "Employer Taxes"
    - Remove the overlapping subheader text "(Employee)" and "(Employer)"
    - Use consistent font size (9pt) for all headers
    - _Requirements: 3.1, 3.3, 3.4_
  
  - [x] 4.2 Adjust column positioning for better spacing
    - Review and adjust x-coordinates for the four columns
    - Ensure adequate spacing between "Employee Deductions" and "Employer Taxes"
    - Maintain alignment between headers and values
    - _Requirements: 4.1, 4.2_
  
  - [x] 4.3 Write example tests for summary table
    - **Example Test 1: Summary table contains correct headers**
    - **Example Test 2: Summary table headers use consistent font size**
    - **Example Test 3: Column headers align with values**
    - **Validates: Requirements 3.1, 3.3, 4.2**

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster implementation
- The main changes are in the `drawEarningRow` function and the summary table rendering code
- Property tests will use fast-check library with minimum 100 iterations
- Visual inspection of generated PDFs is recommended after implementation
