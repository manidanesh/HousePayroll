# Design Document: Paystub PDF Fixes

## Overview

This design addresses two display issues in the paystub PDF generation system:

1. **Earnings Row Display**: Ensure that Regular Earnings, Weekend Premium, and Holiday Premium rows are always displayed on every paystub (even with zero activity), while Overtime rows are only shown when there is activity. This provides consistency and clarity for payroll administrators.

2. **Summary Table Headers**: Redesign the summary table header layout to eliminate text overlap and improve readability by using clearer labels and proper spacing.

The fixes will be implemented in the `PaystubGenerator` class within `src/utils/paystub-generator.ts`.

## Architecture

The paystub generation system follows a single-class design pattern where the `PaystubGenerator` class contains static methods for PDF generation. The architecture remains unchanged; only the internal rendering logic will be modified.

**Component Structure:**
- `PaystubGenerator.generatePDF()`: Main PDF generation method
- `drawEarningRow()`: Local function for rendering earning rows (to be modified)
- Summary table rendering code: Inline code block (to be modified)

**No new components or interfaces are required.**

## Components and Interfaces

### Modified Function: drawEarningRow

**Current Signature:**
```typescript
const drawEarningRow = (
  label: string, 
  rate: number, 
  hours: number, 
  current: number, 
  ytdVal: number
) => void
```

**Current Logic:**
- Skips row if both `current === 0` AND `ytdVal === 0`
- Displays row if either value is non-zero
- Calculates rate as `current / hours` (or uses passed rate)

**Modified Logic:**
- Always display Regular Earnings, Weekend Premium, and Holiday Premium rows
- For Overtime: skip row only if both `current === 0` AND `ytdVal === 0`
- When displaying rows with zero current activity, show 0.00 for rate and 0.0 for hours
- Maintain existing rate calculation logic for rows with current activity

**Rationale:** Standard earning types (Regular, Weekend, Holiday) should always appear on paystubs for consistency and to show the complete earning structure, even when there's no activity in those categories for the current period. Overtime is optional and only shown when there's activity.

### Modified Component: Summary Table Header

**Current Implementation:**
- Uses "Total Deduction" label twice
- Overlays subheaders "(Employee)" and "(Employer)" on main headers
- Uses different font sizes (9pt for main, 7pt for sub)
- Creates visual overlap and confusion

**Modified Implementation:**
- Use distinct labels: "Gross Pay", "Employee Deductions", "Employer Taxes", "Net Pay"
- Single font size for all headers (9pt)
- Remove overlapping subheader text
- Adjust column positions for better spacing

**Column Layout:**
```
| Gross Pay | Employee Deductions | Employer Taxes | Net Pay |
|   25      |        70           |      115       |   160   |
```

## Data Models

No changes to data models are required. The existing `PaystubContext`, `PayrollRecord`, `Employer`, and `Caregiver` interfaces remain unchanged.

## Error Handling

**Division by Zero Protection:**
The existing code already handles division by zero by using `|| 1` as a fallback divisor:
```typescript
const rate = (record.weekend_wages || 0) / (record.weekend_hours || 1) || 0;
```

This pattern will be maintained in the modified code. No additional error handling is required since:
- All numeric values are validated before reaching the PDF generator
- The rendering logic is defensive (uses fallback values)
- PDF generation failures would be caught by the jsPDF library

## Testing Strategy

**Unit Testing:**
- Test `drawEarningRow` behavior with various input combinations:
  - current = 0, ytd = 0 → row not rendered
  - current = 0, ytd > 0 → row not rendered
  - current > 0, ytd = 0 → row rendered
  - current > 0, ytd > 0 → row rendered
- Test summary table rendering produces non-overlapping text
- Test column header labels are correct

**Property-Based Testing:**
Property-based tests will validate universal behaviors across randomized inputs using a PBT library (fast-check for TypeScript). Each test will run a minimum of 100 iterations.

**Integration Testing:**
- Generate complete paystubs with various earning combinations
- Verify visual layout matches specifications
- Test with real payroll data samples

**Manual Testing:**
- Visual inspection of generated PDFs
- Verify text positioning and spacing
- Confirm no overlapping elements


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Standard earning types always displayed

*For any* paystub, the rendered output should always contain rows for Regular Earnings, Weekend Premium, and Holiday Premium (regardless of whether current or YTD values are zero).

**Validates: Requirements 1.1**

### Property 2: Overtime rows shown only with activity

*For any* paystub where Overtime has both zero current wages and zero YTD wages, the rendered output should not contain an Overtime row.

**Validates: Requirements 1.2**

### Property 3: Overtime rows shown with activity

*For any* paystub where Overtime has non-zero current wages OR non-zero YTD wages, the rendered output should contain an Overtime row.

**Validates: Requirements 1.3**

### Property 4: Rate calculation for active periods

*For any* earning row with non-zero current hours, the displayed rate should equal the current wages divided by hours (matching to two decimal places).

**Validates: Requirements 2.2**

### Property 5: Rate display for zero activity

*For any* earning row with zero current hours and zero current wages, the displayed rate should be 0.00.

**Validates: Requirements 2.1**

### Example Test 1: Summary table contains correct headers

When rendering the summary table, the PDF should contain the exact text strings "Gross Pay", "Employee Deductions", "Employer Taxes", and "Net Pay" as column headers.

**Validates: Requirements 3.1**

### Example Test 2: Summary table headers use consistent font size

When rendering the summary table headers, all four column header text elements should use the same font size (9pt).

**Validates: Requirements 3.3**

### Example Test 3: Column headers align with values

When rendering the summary table, the x-coordinate of each column header should match the x-coordinate of its corresponding value in the row below (within a tolerance of 1 unit).

**Validates: Requirements 4.2**
