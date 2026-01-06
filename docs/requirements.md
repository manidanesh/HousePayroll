# Requirements Document

## Introduction

The Household Payroll System is a personal payroll application designed for a single household employer to pay multiple caregivers while maintaining compliance with U.S. federal and Colorado household employment requirements. The system prioritizes payroll correctness, legal compliance, deterministic behavior, auditability, and change isolation over scalability or generalization.

## Glossary

- **Household_Employer**: The single household entity responsible for payroll (may be either spouse but treated as one entity)
- **Caregiver**: A W-2 household employee receiving payroll (system supports multiple caregivers)
- **Payroll_System**: The core application managing time tracking, payroll calculation, and paystub generation
- **Time_Tracker**: Component responsible for recording hours worked per day
- **Payroll_Calculator**: Component that computes gross wages, withholdings, and net pay using pure functions
- **Tax_Computer**: Component that encapsulates all tax rules and rates
- **Paystub_Generator**: Component that renders paystubs from finalized payroll data
- **Payment_Tracker**: Component that tracks check numbers and payment dates
- **Pay_Rate_Multiplier**: A configurable factor applied to base hourly rate for weekend or holiday hours
- **Holiday_Calendar**: System component that identifies U.S. federal holidays and applies appropriate pay multipliers

## Requirements

### Requirement 11: Holiday and Weekend Differential Pay

**User Story:** As a household employer, I want to configure and automatically apply different pay rates for weekend and holiday hours, so that I can fairly compensate caregivers for working on special days without manual calculation.

#### Acceptance Criteria

1. THE Payroll_System SHALL allow employer to configure holiday pay multiplier (e.g., 1.5× base rate)
2. THE Payroll_System SHALL allow employer to configure weekend pay multiplier (e.g., 1.25× base rate)  
3. THE Payroll_System SHALL automatically identify U.S. federal holidays using a Holiday_Calendar component
4. THE Payroll_System SHALL automatically identify weekends (Saturday and Sunday) for all time entries
5. THE Payroll_System SHALL apply the appropriate multiplier when calculating gross wages for holiday or weekend hours
6. THE Payroll_System SHALL display hours breakdown by type (Regular, Weekend, Holiday) on paystubs
7. THE Payroll_System SHALL show effective pay rate and subtotal for each hour type on paystubs
8. THE Payroll_System SHALL provide a calendar view with visual indicators for weekends (blue) and holidays (red)
9. THE Payroll_System SHALL allow employer to override automatic classification if needed
10. THE Payroll_System SHALL calculate gross pay as: Σ(hours × base_rate × applicable_multiplier)
11. THE Payroll_System SHALL maintain multiplier values in employer profile for audit purposes
12. THE Payroll_System SHALL initialize default multipliers as 1.0 (no differential) for new employer profiles

#### U.S. Federal Holidays Recognized

The system recognizes the following U.S. federal holidays:
- New Year's Day (January 1)
- Martin Luther King Jr. Day (Third Monday in January)
- Presidents' Day (Third Monday in February)
- Memorial Day (Last Monday in May)
- Independence Day (July 4)
- Labor Day (First Monday in September)
- Columbus Day (Second Monday in October)
- Veterans Day (November 11)
- Thanksgiving Day (Fourth Thursday in November)
- Christmas Day (December 25)

#### Example Calculation

**Scenario:**
- Base hourly rate: $20/hr
- Holiday multiplier: 1.5×
- Weekend multiplier: 1.25×
- Pay period: December 22-28, 2024

**Hours:**
- Monday-Thursday (Regular): 32 hours @ $20/hr = $640
- Saturday (Weekend): 8 hours @ $25/hr (1.25×) = $200
- Wednesday Dec 25 (Christmas, Holiday): 8 hours @ $30/hr (1.5×) = $240

**Total Gross Pay:** $1,080

**Paystub Breakdown:**
```
Regular Hours:    32.00 hrs @ $20.00/hr = $640.00
Weekend Hours:     8.00 hrs @ $25.00/hr = $200.00
Holiday Hours:     8.00 hrs @ $30.00/hr = $240.00
                                        ─────────
Total Gross Pay:                        $1,080.00
```

## Requirements

### Requirement 1: Single Household Account Management

**User Story:** As a household employer, I want to manage a single employer profile, so that I can maintain my payroll information and preferences.

#### Acceptance Criteria

1. THE Payroll_System SHALL support exactly one household employer account
2. WHEN employer profile is created, THE Payroll_System SHALL store employer display name, SSN or EIN, pay frequency, default hourly rate, and federal income tax withholding preference
3. THE Payroll_System SHALL fix the employer's state of employment to Colorado
4. THE Payroll_System SHALL support pay frequency options of weekly, bi-weekly, or monthly
5. THE Payroll_System SHALL provide device-based or password-based access without external authentication

### Requirement 2: Multiple Caregiver Profile Management

**User Story:** As a household employer, I want to manage multiple caregiver profiles, so that I can maintain accurate employee information for payroll processing of all my caregivers.

#### Acceptance Criteria

1. THE Payroll_System SHALL support multiple caregiver profiles, each classified as a W-2 household employee
2. WHEN a caregiver profile is created, THE Payroll_System SHALL require full legal name, Social Security Number, and hourly rate
3. THE Payroll_System SHALL allow optional relationship note for informational purposes for each caregiver
4. THE Payroll_System SHALL allow adding, editing, and deactivating caregiver profiles
5. THE Payroll_System SHALL encrypt SSN data at rest for all caregivers
6. THE Payroll_System SHALL assign unique identifiers to each caregiver profile

### Requirement 3: Time Tracking Management

**User Story:** As a household employer, I want to record hours worked per day for each caregiver, so that I can accurately calculate payroll for all my caregivers.

#### Acceptance Criteria

1. THE Time_Tracker SHALL record hours worked per day for each caregiver separately
2. WHEN time entries are used in finalized payroll, THE Time_Tracker SHALL make them immutable
3. THE Time_Tracker SHALL not contain payroll or tax calculation logic
4. THE Time_Tracker SHALL validate that hours worked are non-negative numbers
5. THE Time_Tracker SHALL associate each time entry with a specific date and caregiver
6. THE Time_Tracker SHALL support tracking multiple caregivers' hours for the same date

### Requirement 4: Payroll Calculation Processing

**User Story:** As a household employer, I want accurate payroll calculations for each caregiver, so that I can ensure correct wages and tax compliance for all employees.

#### Acceptance Criteria

1. THE Payroll_Calculator SHALL compute gross wages as Total Hours × Hourly Rate for each caregiver individually
2. THE Payroll_Calculator SHALL calculate employee withholdings for Social Security (6.2%) and Medicare (1.45%) for each caregiver
3. WHEN federal income tax withholding is enabled for a caregiver, THE Payroll_Calculator SHALL apply the configured withholding amount
4. THE Payroll_Calculator SHALL compute employer taxes for Social Security (6.2%), Medicare (1.45%), and FUTA (0.6%) for each caregiver
5. THE Payroll_Calculator SHALL calculate net pay as Gross Pay minus Employee Withholdings for each caregiver
6. THE Payroll_Calculator SHALL implement all calculations as pure functions without side effects
7. THE Payroll_Calculator SHALL not read directly from persistence layers
8. THE Payroll_Calculator SHALL process multiple caregivers in a single payroll run

### Requirement 5: Tax Computation Management

**User Story:** As a household employer, I want accurate tax calculations, so that I can maintain compliance with federal and Colorado tax requirements.

#### Acceptance Criteria

1. THE Tax_Computer SHALL encapsulate all federal and state tax rules and rates
2. THE Tax_Computer SHALL apply federal rates of Social Security (6.2%), Medicare (1.45%), and FUTA (0.6%)
3. THE Tax_Computer SHALL support manual entry of Colorado SUTA rate
4. THE Tax_Computer SHALL prevent tax logic from existing outside this component
5. THE Tax_Computer SHALL maintain version information for tax rule changes

### Requirement 6: Paystub Generation and Compliance

**User Story:** As a household employer, I want compliant paystubs for each caregiver, so that I can meet Colorado wage statement requirements and provide proper documentation.

#### Acceptance Criteria

1. THE Paystub_Generator SHALL include employer name, caregiver name, pay period dates, pay date, hours worked, hourly rate, gross wages, itemized deductions, net pay, and check number for each caregiver
2. THE Paystub_Generator SHALL generate paystubs as reproducible PDF documents for each caregiver
3. THE Paystub_Generator SHALL comply with Colorado wage statement requirements for all caregivers
4. THE Paystub_Generator SHALL not recompute wages or taxes during generation
5. THE Paystub_Generator SHALL render paystubs only from finalized payroll data
6. THE Paystub_Generator SHALL generate separate paystubs for each caregiver in a payroll run

### Requirement 7: Payment Tracking and Immutability

**User Story:** As a household employer, I want to track payments for all caregivers and ensure data integrity, so that I can maintain accurate records and prevent accidental changes.

#### Acceptance Criteria

1. THE Payment_Tracker SHALL record check number and payment date for each caregiver's payroll
2. WHEN payroll is marked as paid for any caregiver, THE Payment_Tracker SHALL make that caregiver's payroll record immutable
3. THE Payment_Tracker SHALL prevent modification of finalized payroll records for all caregivers
4. THE Payment_Tracker SHALL require creation of new payroll records for corrections for any caregiver
5. THE Payment_Tracker SHALL maintain historical payroll reproducibility for all caregivers
6. THE Payment_Tracker SHALL support independent payment tracking for multiple caregivers in the same payroll period

### Requirement 8: Reporting and Export Capabilities

**User Story:** As a household employer, I want comprehensive reporting for all caregivers, so that I can prepare tax forms and maintain proper records.

#### Acceptance Criteria

1. THE Payroll_System SHALL provide year-to-date summaries of gross wages, employee withholdings, and employer tax liabilities for each caregiver and in aggregate
2. THE Payroll_System SHALL generate FUTA and Colorado SUTA summaries for all caregivers
3. THE Payroll_System SHALL export data in PDF and CSV formats for W-2 and Schedule H preparation for each caregiver
4. THE Payroll_System SHALL not file or submit any tax forms automatically
5. THE Payroll_System SHALL maintain historical accuracy in all reports for all caregivers
6. THE Payroll_System SHALL support filtering reports by individual caregiver or viewing aggregate data

### Requirement 9: Data Integrity and Audit Trail

**User Story:** As a household employer, I want reliable data integrity for all caregivers, so that I can trust the accuracy of my payroll records and maintain compliance.

#### Acceptance Criteria

1. THE Payroll_System SHALL store all data in a single logical database with support for multiple caregivers
2. THE Payroll_System SHALL maintain immutable finalized payroll records for all caregivers
3. THE Payroll_System SHALL store calculation logic version and tax rule version with each payroll record for each caregiver
4. THE Payroll_System SHALL ensure backward compatibility for historical payroll outputs for all caregivers
5. THE Payroll_System SHALL contain failures within components without corrupting payroll data for any caregiver
6. THE Payroll_System SHALL maintain referential integrity between caregivers and their associated payroll records

### Requirement 10: System Architecture and Modularity

**User Story:** As a system architect, I want clear component separation, so that the system maintains simplicity, correctness, and change isolation.

#### Acceptance Criteria

1. THE Payroll_System SHALL implement modular architecture with UI layer, core payroll logic, and data persistence layer
2. THE Payroll_System SHALL isolate payroll and tax logic from UI and storage concerns
3. THE Payroll_System SHALL prevent logic leakage across component boundaries
4. THE Payroll_System SHALL implement explicit data flows between components
5. THE Payroll_System SHALL maintain clear component ownership and responsibilities