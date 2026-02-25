# Requirements Document

## Introduction

This document specifies requirements for fixing two critical display issues in the paystub PDF generation system. The first issue involves incorrect display of earning rows when there is year-to-date (YTD) activity but no current period activity. The second issue involves overlapping text in the current period summary table headers.

## Glossary

- **Paystub_Generator**: The system component responsible for generating PDF paystubs
- **Earning_Row**: A row in the earnings table displaying rate, hours, current wages, and YTD wages
- **Current_Period**: The pay period for which the paystub is being generated
- **YTD**: Year-to-date cumulative values
- **Summary_Table**: The table displaying gross pay, deductions, and net pay for the current period
- **Rate**: The hourly wage rate for an earning type
- **Earning_Type**: A category of earnings (Regular, Weekend Premium, Holiday Premium, Overtime)

## Requirements

### Requirement 1: Earnings Row Display Logic

**User Story:** As a payroll administrator, I want standard earning types to always be displayed on the paystub, so that I can see all earning categories regardless of current period activity.

#### Acceptance Criteria

1. THE Paystub_Generator SHALL always display rows for Regular Earnings, Weekend Premium, and Holiday Premium (regardless of current or YTD values)
2. WHEN an Earning_Type is Overtime AND has zero Current_Period wages AND zero YTD wages, THEN THE Paystub_Generator SHALL NOT display that Earning_Row
3. WHEN an Earning_Type is Overtime AND has non-zero Current_Period wages OR non-zero YTD wages, THEN THE Paystub_Generator SHALL display that Earning_Row
4. WHEN an Earning_Row is displayed, THE Paystub_Generator SHALL show rate, hours, current wages, and YTD wages

### Requirement 2: Rate Calculation for Zero Activity Rows

**User Story:** As a payroll administrator, I want earning rows with no current activity to display meaningful rate information, so that the paystub shows the applicable rate even when no hours were worked.

#### Acceptance Criteria

1. WHEN an Earning_Row has zero Current_Period hours AND zero Current_Period wages, THE Paystub_Generator SHALL display rate as 0.00
2. WHEN an Earning_Row has non-zero Current_Period hours, THE Paystub_Generator SHALL calculate rate as current wages divided by hours
3. WHEN calculating rate, IF hours are zero, THEN THE Paystub_Generator SHALL use a default divisor of 1 to prevent division by zero

### Requirement 3: Summary Table Header Layout

**User Story:** As a paystub reader, I want clear and non-overlapping column headers in the summary table, so that I can easily understand what each column represents.

#### Acceptance Criteria

1. THE Summary_Table SHALL display four column headers: "Gross Pay", "Employee Deductions", "Employer Taxes", and "Net Pay"
2. WHEN rendering the Summary_Table header, THE Paystub_Generator SHALL position text elements so they do not overlap
3. WHEN rendering the Summary_Table header, THE Paystub_Generator SHALL use consistent font sizing for all column headers
4. THE Summary_Table SHALL use descriptive labels that clearly distinguish between employee deductions and employer taxes

### Requirement 4: Summary Table Visual Clarity

**User Story:** As a paystub reader, I want the summary table to have proper spacing and alignment, so that I can quickly scan the information.

#### Acceptance Criteria

1. WHEN rendering the Summary_Table, THE Paystub_Generator SHALL ensure adequate horizontal spacing between columns
2. WHEN rendering the Summary_Table, THE Paystub_Generator SHALL align column headers with their corresponding values
3. THE Summary_Table SHALL maintain visual consistency with the rest of the paystub design
