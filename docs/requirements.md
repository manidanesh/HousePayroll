## Requirements Document

## Introduction

The Household Payroll System is a MacBook native application (built with Electron/React) designed for a household employer to pay a caregiver while ensuring full U.S. federal and Colorado compliance. The system prioritizes accuracy, legal guardrails, auditability, and historical reproducibility.

## Glossary

- **Household_Employer**: The household entity (you or your spouse) responsible for payroll.
- **Caregiver**: A W-2 household employee (e.g., nanny, caregiver).
- **Payroll_Record**: An immutable historical document of a specific payment.
- **Tax_Computer**: Component encapsulating federal and state tax laws.
- **FUTA**: Federal Unemployment Tax (0.6% on first $7,000).
- **SUTA**: Colorado State Unemployment Tax (Variable on first $16,000).
- **Wage_Statement**: Legally compliant paystub.

## Legal & Compliance Requirements

### Federal Legal Framework & Guardrails
- **Social Security**: 6.2% (Employee & Employer).
- **Medicare**: 1.45% (Employee & Employer).
- **FUTA**: 0.6% on the first **$7,000** of gross wages per employee.
- **Federal Income Tax**: Optional, based on employer-configured withholding.
- **FLSA Exemption for Live-In Caregivers**: Live-in household employees may be exempt from overtime pay, though regular minimum wage still applies.
- **I-9 Completion Tracking**: Employers must verify employment eligibility. The app tracks completion status and maintains audit-ready records.
- **Form 941 Exemption (Hard Constraint)**: Household employers are **exempt from filing quarterly IRS Form 941**.
    - All federal liabilities (FICA, FUTA, FIT) MUST be accumulated for **annual reporting via Schedule H** (Form 1040).
    - The system is prohibited from generating Form 941 data, CSVs, or PDFs to prevent filing errors.

### Colorado Payroll Obligations
- **Colorado SUTA / SUI**: Variable rate on the first configurable wage base (default **$16,000**) of gross wages per employee.
- **Wage Statement Rules**: Paystubs MUST include gross pay, itemized deductions, net pay, pay period dates, pay date, check number, and breakdown of regular vs. holiday/weekend hours.
- **Minimum Wage**: All calculations must satisfy the Colorado minimum wage requirements.
- **Workers' Compensation**: Household employers in Colorado must acknowledge their workers' comp coverage or exemption status.

### Recordkeeping & Immutability
- **Retention**: Maintain records for 3-4 years minimum.
- **Immutability**: Once a payroll record is marked "Paid", it cannot be modified. Errors require a new correction record.
- **Audit Trail**: Every creation, modification, and payment approval must be logged.
- **Versioning**: Store logic version and tax rule version with every record for historical reproducibility.

## Functional Requirements

### 1. Unified Employer & Caregiver Management
- **Employer Profile**: Store name, SSN/EIN, Federal FEIN, Colorado UI Account Number, SUI Premium Rate, SUI Wage Base, SUI Effective Date, and Workers' Comp details (Acknowledge status, carrier, policy #, date).
- **Caregiver Profile**: Store legal name, encrypted SSN, and base hourly rate.
- **Multipliers**: Configurable holiday (e.g., 1.5x) and weekend (e.g., 1.25x) pay multipliers.

### 2. Time Tracking & Holiday Detection
- **Weekly Grid**: Mon-Sun view for efficient hour entry.
- **Automatic Detection**: Identify weekends and U.S. federal holidays.
- **Day Highlighting**: Color-coded view (Blue for weekends, Red for holidays).

### 3. Payroll Calculation Logic
- **Pure Functions**: Calculations must be deterministic and pure.
- **Gross Pay**: Σ(hours × base_rate × multiplier).
- **YTD Tracking**: Track year-to-date wages to enforce FUTA ($7k) and SUTA ($16k) caps.
- **Net Pay**: Gross Pay − Employee Withholdings.

### 4. Paystub & Reporting
- **PDF Generation**: Reproducible PDF paystubs with legal breakdowns.
- **YTD Reporting**: Summary of gross wages, employee withholdings, and employer taxes.
- **Tax Export**: Export CSV/PDF data ready for W-2 and Schedule H filing.

### 5. Audit & Security
- **Local Storage**: All data stored locally in SQLite.
- **Encryption**: SSN and sensitive data encrypted at rest.
- **Audit Log**: System-level tracking of all data mutations.

## Colorado SUTA / SUI Compliance & Reporting

This section defines the requirements for Colorado State Unemployment Insurance (SUI) compliance, employer account tracking, and quarterly reporting.

### 1. Employer Configuration
The system must capture and permanently store the mandatory fields for SUI calculation and reporting:
- **Employer FEIN**: 9-digit Federal Employer ID (encrypted).
- **Colorado UI Account Number**: 8-digit State UI Account Number (encrypted).
- **SUI Premium Rate**: Configurable decimal rate.
- **SUI Wage Base**: Configurable wage base (default **$16,000** for COLORADO).
- **SUI Effective Date**: Legal date when the rate becomes active.

### 2. Calculation Rules
- **Tax Formula**: `SUI Tax Due = min(Gross Wages this Period, Wage Base - YTD Wages) × SUI Premium Rate`.
- **Wage Base Capping**: Apply SUI tax only up to the configured wage base per employee, per year.
- **Historical Accuracy**: Preserve the rates and account numbers used at the time of each historical payroll record for accurate lookbacks.

### 3. Quarterly CSV Export (CDLE MyUI+)
The system must generate a versioned CSV export compatible with the Colorado Department of Labor & Employment (CDLE) **MyUI+ batch upload** portal.
- **Mandatory CSV Fields**:
    - Employer FEIN
    - Colorado UI Account Number
    - Payroll Quarter (Q1, Q2, Q3, or Q4)
    - Employee Full Legal Name
    - Employee SSN (decrypted for export only)
    - Taxable Wages (subject to SUI wage base)
    - SUI Tax Due
    - Check/Payment Reference (for audit trail)
- **Format**: Must include headers as required by CDLE.
- **Versioning**: Each export MUST be versioned to track exactly what was provided to the state.

### 4. Audit Trail & Retention
- **Export Logging**: Log the creation of each CSV, including timestamp, payroll run IDs included, and the specific rates used.
- **Data Retention**: Retain all records and exported CSV data for a minimum of **3 years** to satisfy Colorado compliance audits.

## Colorado FAMLI (Paid Family & Medical Leave)

The system must track and calculate contributions for the Colorado Paid Family and Medical Leave Insurance (FAMLI) program.

### 1. Contribution Rates
- **Employee Share**: Default **0.45%** of gross wages.
- **Employer Share**: Default **0.45%** of gross wages (for employers with < 10 employees).
- **Configurability**: Rates must be configurable via settings to accommodate future legal updates.

### 2. Calculation & Immutability
- **Net Pay**: Employee contributions must be deducted from gross wages.
- **Employer Contribution**: Tracked as an informational employer-paid tax (not deducted from employee).
- **Historical Accuracy**: The rates in effect at the time of payroll must be stored with the record.

### 3. Reporting & Audit
- **Paystub**: Clearly itemize Employee FAMLI Deduction and show Employer FAMLI contribution separately.
- **Quarterly Export**: Generate a CSV for the **My FAMLI+** portal including Employee Name, SSN, Gross Wages, and both contribution amounts.
- **Audit Log**: Log any changes to FAMLI rate configurations.

## Colorado Workers' Compensation Acknowledgment

The system must track the employer's acknowledgment of Workers' Compensation (WC) coverage as a legally required record for Colorado.

### 1. WC Configuration Fields (Employer-Only)
- **WC Coverage Acknowledged**: Boolean toggle.
- **Carrier/Policy/Date**: Metadata for verified coverage.
- **Privacy**: Information is employer-facing only and never shared with employees.

### 2. Legal Guardrails
- **Payroll Guardrail**: The system **blocks payroll finalization** if WC acknowledgment is missing.

## Colorado Pay Frequency & Timing Compliance

### 1. Pay Frequency & 10-Day Rule
- **Employer Choice**: Weekly, Bi-Weekly, or Monthly pay frequency.
- **Timing Validator**: Paydays must occur within **10 days following the close of each pay period**.
- **Advisory Warning**: Display a prominent alert if a selected `pay_date` exceeds the 10-day limit.

### 2. Reporting
- **Paystub Dates**: Must display Period Start, Period End, and Payment Date.
- **Compliance Badge**: Highlight late payments in reports with a "LATE" badge.

## Federal I-9 Employment Eligibility Compliance

Federal law requires all employers to verify the identity and employment eligibility of their workers using Form I-9.

### 1. I-9 Tracking (Employer-Only)
- **Status Recording**: Track I-9 completion (Yes/No), completion date, and optional verification notes.
- **Historical Immutability**: The I-9 status must be snapshotted at the moment of payroll creation. Past records must retain the status they had at the time of payment.

### 2. Compliance Guardrails
- **Payroll Flag**: Display a "Missing Federal Form I-9" compliance flag in the payroll flow if no completion record exists for the caregiver.
- **Audit Badge**: Highlight records in history with a "NO I-9" badge for easy compliance monitoring.
- **Internal Export**: Include detailed I-9 completion logs in the consolidated Year-End Compliance Audit export.

## Compliance Note
> [!IMPORTANT]
> This application **does not automatically file taxes**. It prepares data and reports to facilitate the employer's manual or batch filing with the IRS and CDLE.