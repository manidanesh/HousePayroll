# Household Payroll System - Implementation Plan

This plan outlines the technical approach for implementing a household payroll system that manages multiple caregivers while maintaining compliance with U.S. federal and Colorado employment requirements.

## Problem Summary

The household employer needs a personal payroll application to:
- Manage a single employer account and multiple W-2 caregiver employees
- Track time worked per caregiver per day
- Calculate payroll with correct tax withholdings (Social Security, Medicare, FUTA, Colorado SUTA)
- Generate compliant paystubs in PDF format
- Maintain immutable, auditable payroll records
- Export data for W-2 and Schedule H tax form preparation

The system prioritizes **correctness, compliance, deterministic behavior, and auditability** over scalability or generalization.

## Finalized Technology Decisions

> [!NOTE]
> **Technology Stack: macOS Native Desktop Application**
> 
> **Framework**: Electron with React/TypeScript
> - Self-contained macOS native application
> - No hosting or server setup required
> - Offline-first architecture
> - Full data privacy (all data stored locally)
>
> **Database**: SQLite with SQLCipher
> - Built-in encryption for sensitive data (SSN, PIN)
> - ACID compliance for data integrity
> - File-based database (easy backup)
>
> **PDF Generation**: PDFKit
> - Node.js compatible for Electron main process
> - Professional paystub rendering
>
> **Build Target**: macOS (Apple Silicon and Intel)

> [!IMPORTANT]
> **Authentication: 4-Digit PIN Protection**
> - Simple 4-digit PIN for application access
> - PIN stored encrypted using bcrypt or similar
> - No external authentication services
> - Session-based access (remains unlocked during use)

> [!NOTE]
> **Colorado SUTA Rate: One-Time Configuration (MVP)**
> - Configured once in employer profile setup
> - Can be manually updated in settings if rate changes
> - Future enhancement: versioned rate tracking with effective dates

## Proposed Changes

### Phase 1: Foundation & Data Layer

#### [NEW] Database Schema Design

**Tables Overview:**
```sql
-- Employer table (single record)
employers (id, display_name, ssn_or_ein_encrypted, pay_frequency, 
           default_hourly_rate, federal_withholding_enabled, created_at)

-- Caregivers table (multiple employees)
caregivers (id, full_legal_name, ssn_encrypted, hourly_rate, 
            relationship_note, is_active, created_at, updated_at)

-- Time entries (daily hours per caregiver)
time_entries (id, caregiver_id, work_date, hours_worked, 
              is_finalized, created_at, updated_at)

-- Payroll records (one per caregiver per pay period)
payroll_records (id, caregiver_id, pay_period_start, pay_period_end,
                 total_hours, gross_wages, ss_employee, medicare_employee,
                 federal_withholding, net_pay, ss_employer, medicare_employer,
                 futa, calculation_version, tax_version, is_finalized,
                 check_number, payment_date, created_at)

-- Tax configuration (versioned tax rules)
tax_configurations (id, version, ss_rate_employee, ss_rate_employer,
                    medicare_rate_employee, medicare_rate_employer,
                    futa_rate, colorado_suta_rate, effective_date)

-- Audit log
audit_log (id, table_name, record_id, action, changes_json, 
           calculation_version, timestamp)
```

**Key Design Decisions:**
- SSN encryption at rest using AES-256
- Separate payroll records per caregiver for isolation
- Version tracking for calculations and tax rules
- Immutability enforced via `is_finalized` flags
- Referential integrity with foreign keys

---

### Phase 2: Core Components

#### [NEW] `/src/core/tax-computer.js`
Pure module implementing tax calculations:
```javascript
// Encapsulates all tax rules with versioning
class TaxComputer {
  constructor(taxConfig) { /* version, rates */ }
  
  // Pure functions (no side effects)
  calculateSocialSecurityEmployee(grossWages) { }
  calculateMedicareEmployee(grossWages) { }
  calculateFUTA(grossWages) { }
  calculateColoradoSUTA(grossWages) { }
  calculateEmployerTaxes(grossWages) { }
}
```

#### [NEW] `/src/core/payroll-calculator.js`
Pure functions for payroll computation:
```javascript
// All calculations as pure, testable functions
class PayrollCalculator {
  // Returns payroll object, no persistence
  calculatePayroll({
    caregiverId,
    hoursWorked,
    hourlyRate,
    federalWithholdingAmount,
    taxComputer
  }) {
    const grossWages = hoursWorked * hourlyRate;
    const employeeWithholdings = taxComputer.calculateEmployeeWithholdings(grossWages);
    const netPay = grossWages - employeeWithholdings.total;
    const employerTaxes = taxComputer.calculateEmployerTaxes(grossWages);
    
    return { grossWages, employeeWithholdings, netPay, employerTaxes };
  }
  
  // Batch process multiple caregivers
  calculateMultiCaregiverPayroll(caregiverPayrollData, taxComputer) { }
}
```

#### [NEW] `/src/core/paystub-generator.js`
PDF generation from finalized data:
```javascript
class PaystubGenerator {
  // Renders PDF from payroll record (no recalculation)
  generatePaystub(payrollRecord, employerInfo, caregiverInfo) {
    // Colorado-compliant paystub template
    // Returns PDF buffer
  }
  
  // Ensures reproducibility
  generateReproduciblePaystub(payrollRecordId) { }
}
```

---

### Phase 3: Application Layer

#### [NEW] `/src/services/employer-service.js`
Manages employer profile:
- Create/update single employer account
- Validate and encrypt SSN/EIN
- Manage pay frequency and preferences

#### [NEW] `/src/services/caregiver-service.js`
Manages caregiver profiles:
- CRUD operations for multiple caregivers
- SSN encryption/decryption
- Profile activation/deactivation
- Validation logic

#### [NEW] `/src/services/time-tracking-service.js`
Time entry management:
- Record hours per caregiver per day
- Validation (non-negative, date association)
- Enforce immutability for finalized entries
- Support concurrent multi-caregiver tracking

#### [NEW] `/src/services/payroll-service.js`
Orchestrates payroll processing:
- Aggregate time entries per caregiver
- Invoke PayrollCalculator for each caregiver
- Persist payroll records with versioning
- Coordinate Payment_Tracker for finalization

#### [NEW] `/src/services/payment-tracking-service.js`
Payment and immutability management:
- Record check numbers and payment dates
- Enforce immutability on finalized records
- Implement correction workflow (new record creation)
- Maintain audit trail

#### [NEW] `/src/services/reporting-service.js`
Reports and data export:
- Year-to-date summaries (per caregiver and aggregate)
- FUTA and SUTA summary calculations
- PDF and CSV export generation
- Filtering by caregiver or date range

---

### Phase 4: User Interface

#### [NEW] `/src/ui/employer-profile/`
- Single employer profile management screen
- Configuration for pay frequency, default rate, withholding preferences

#### [NEW] `/src/ui/caregiver-management/`
- List view of all caregivers
- Add/edit/deactivate caregiver forms
- SSN handling with security indicators

#### [NEW] `/src/ui/time-tracking/`
- Calendar-based time entry interface
- Multi-caregiver view for same date
- Visual indicators for finalized entries

#### [NEW] `/src/ui/payroll-processing/`
- Payroll run workflow (select period, review hours, calculate)
- Multi-caregiver batch processing
- Review and finalize screen
- Payment recording (check numbers)

#### [NEW] `/src/ui/reporting-dashboard/`
- YTD summaries with filtering
- Paystub viewing and download
- Export functionality (PDF/CSV)
- Tax summary reports

---

### Phase 5: Data Integrity & Security

#### [NEW] `/src/utils/encryption.js`
- AES-256 encryption for SSN data
- Key management (environment variables or secure storage)

#### [NEW] `/src/utils/versioning.js`
- Calculation version tracking
- Tax rule version management
- Backward compatibility checks

#### [NEW] `/src/middleware/audit-logger.js`
- Automatic audit trail for all changes
- Immutable audit log entries
- Change tracking with timestamps

#### [NEW] `/src/middleware/validation.js`
- Input validation across all services
- Referential integrity checks
- Business rule enforcement

---

### Phase 6: Testing Infrastructure

#### [NEW] `/tests/unit/core/`
Unit tests for pure functions:
- `tax-computer.test.js` (all tax calculations)
- `payroll-calculator.test.js` (wage calculations, withholdings)

#### [NEW] `/tests/integration/`
Integration tests for workflows:
- `payroll-workflow.test.js` (complete payroll run)
- `multi-caregiver.test.js` (concurrent caregiver scenarios)
- `immutability.test.js` (finalized record enforcement)

#### [NEW] `/tests/e2e/`
End-to-end tests:
- Complete payroll cycle from time entry to paystub
- Multi-caregiver scenarios
- Correction workflows

---

## Verification Plan

### Automated Tests

**Unit Tests for Core Calculations:**
```bash
npm test -- tests/unit/core/tax-computer.test.js
npm test -- tests/unit/core/payroll-calculator.test.js
```

Test coverage will include:
- Tax rate calculations (Social Security 6.2%, Medicare 1.45%, FUTA 0.6%)
- Gross wage calculation (hours × rate)
- Withholding computation
- Net pay calculation
- Multi-caregiver batch calculations

**Integration Tests for Services:**
```bash
npm test -- tests/integration/payroll-workflow.test.js
npm test -- tests/integration/multi-caregiver.test.js
```

Test scenarios:
- Complete payroll run for single caregiver
- Batch processing for multiple caregivers
- Immutability enforcement after finalization
- Correction workflow (creating new records)

**End-to-End Tests:**
```bash
npm run test:e2e
```

Test full user workflows:
- Create employer profile → add caregivers → track time → process payroll → generate paystubs
- Multi-caregiver scenarios with different rates and hours
- YTD reporting and export functionality

### Manual Verification

**Colorado Compliance Check:**
1. Generate test paystub for a caregiver
2. Verify all required Colorado wage statement fields are present:
   - Employer name
   - Employee name
   - Pay period dates
   - Pay date
   - Hours worked
   - Hourly rate
   - Gross wages
   - Itemized deductions (SS, Medicare, federal withholding)
   - Net pay
   - Check number
3. Compare against [Colorado Department of Labor wage statement requirements](https://cdle.colorado.gov/)

**Tax Calculation Accuracy:**
1. Use IRS Publication 926 (Household Employer's Tax Guide) test scenarios
2. Manually calculate expected values for:
   - Social Security: gross × 6.2% (employee) + gross × 6.2% (employer)
   - Medicare: gross × 1.45% (employee) + gross × 1.45% (employer)
   - FUTA: gross × 0.6%
3. Compare system calculations with manual calculations

**Data Immutability:**
1. Create and finalize a payroll record
2. Attempt to modify the finalized record via UI
3. Verify modification is blocked
4. Verify correction workflow creates new record instead

**Multi-Caregiver Processing:**
1. Create 3 test caregivers with different hourly rates
2. Add time entries for all 3 on same dates
3. Process payroll for the pay period
4. Verify each caregiver has independent payroll record
5. Verify calculations are correct for each caregiver
6. Generate separate paystubs for each

**Export Functionality:**
1. Process payroll for multiple periods
2. Generate YTD summary report (PDF)
3. Export W-2 preparation data (CSV)
4. Verify accuracy of totals and summaries
5. Verify per-caregiver filtering works correctly

### Browser Testing (if web-based)

If implementing as a web application:
```bash
# Start development server
npm run dev

# Run browser tests
npm run test:browser
```

I will use the browser_subagent tool to:
- Test the complete payroll workflow in a real browser
- Verify UI responsiveness and error handling
- Test PDF paystub generation and download
- Verify time tracking interface for multiple caregivers
- Test reporting dashboard filtering and exports
