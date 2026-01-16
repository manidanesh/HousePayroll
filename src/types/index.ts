/**
 * Centralized Type Definitions
 * 
 * This file contains all type definitions for:
 * - IPC payloads (request/response)
 * - Database row types
 * - Service input/output types
 * - Common shared types
 */

import { DayType } from '../utils/holiday-calendar';

// ============================================================================
// EMPLOYER TYPES
// ============================================================================

export interface CreateEmployerInput {
    displayName: string;
    childName?: string;
    ssnOrEin: string;
    payFrequency: 'weekly' | 'bi-weekly' | 'monthly';
    defaultHourlyRate: number;
    federalWithholdingEnabled: boolean;
    coloradoSutaRate: number;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    paystubTitle?: string;
    serviceAddress?: string;
    holidayPayMultiplier?: number;
    weekendPayMultiplier?: number;
    stripePublishableKey?: string;
    stripeSecretKey?: string;
    stripeAccountId?: string;
    fein?: string;
    uiAccountNumber?: string;
    suiWageBase?: number;
    suiEffectiveDate?: string;
    wcAcknowledged?: boolean;
    wcCarrier?: string;
    wcPolicyNumber?: string;
    wcAcknowledgmentDate?: string;
    coloradoFamliRateEE?: number;
    coloradoFamliRateER?: number;
    maskedFundingAccount?: string;
    paymentVerificationStatus?: 'none' | 'pending' | 'verified';
}

export interface UpdateEmployerInput extends Partial<CreateEmployerInput> {
    id?: number;
}

export interface Employer {
    id: number;
    displayName: string;
    childName?: string;
    ssnOrEin: string;
    payFrequency: 'weekly' | 'bi-weekly' | 'monthly';
    defaultHourlyRate: number;
    federalWithholdingEnabled: boolean;
    coloradoSutaRate: number;
    holidayPayMultiplier: number;
    weekendPayMultiplier: number;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    paystubTitle?: string;
    serviceAddress?: string;
    stripePublishableKey?: string;
    stripeSecretKey?: string;
    stripeAccountId?: string;
    paymentVerificationStatus: 'none' | 'pending' | 'verified';
    maskedFundingAccount?: string;
    fein?: string;
    uiAccountNumber?: string;
    suiWageBase: number;
    suiEffectiveDate?: string;
    wcAcknowledged: boolean;
    wcCarrier?: string;
    wcPolicyNumber?: string;
    wcAcknowledgmentDate?: string;
    coloradoFamliRateEE: number;
    coloradoFamliRateER: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// CAREGIVER TYPES
// ============================================================================

export interface CreateCaregiverInput {
    fullLegalName: string;
    ssn: string;
    hourlyRate: number;
    relationshipNote?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    i9Completed?: boolean;
    i9CompletionDate?: string;
    i9Notes?: string;
    stripeCustomerId?: string;
    stripeBankAccountId?: string;
    payoutMethod?: 'check' | 'electronic';
    maskedDestinationAccount?: string;
    stripePayoutId?: string;
    // W-4 Federal Withholding Information
    w4FilingStatus?: 'single' | 'married' | 'head_of_household';
    w4MultipleJobs?: boolean;
    w4DependentsAmount?: number;
    w4OtherIncome?: number;
    w4Deductions?: number;
    w4ExtraWithholding?: number;
    // W-4 Change Tracking
    w4LastUpdated?: string; // Date when W-4 was last changed
    w4EffectiveDate?: string; // Date when W-4 change takes effect
}

export interface UpdateCaregiverInput extends Partial<CreateCaregiverInput> {
    id?: number;
}

export interface Caregiver {
    id: number;
    fullLegalName: string;
    ssn: string; // ⚠️ SENSITIVE: Only use when absolutely necessary (tax forms, etc.)
    maskedSsn: string; // Safe for display: XXX-XX-1234
    hourlyRate: number;
    relationshipNote: string | null;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    employerId: number;
    isActive: boolean;
    hfwaBalance: number;
    i9Completed: boolean;
    i9CompletionDate?: string;
    i9Notes?: string;
    stripeCustomerId?: string;
    stripeBankAccountId?: string;
    payoutMethod: 'check' | 'electronic';
    maskedDestinationAccount?: string;
    stripePayoutId?: string;
    // W-4 Federal Withholding Information
    w4FilingStatus?: 'single' | 'married' | 'head_of_household';
    w4MultipleJobs?: boolean;
    w4DependentsAmount?: number;
    w4OtherIncome?: number;
    w4Deductions?: number;
    w4ExtraWithholding?: number;
    // W-4 Change Tracking
    w4LastUpdated?: string;
    w4EffectiveDate?: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Renderer-safe version of Caregiver that excludes the SSN field.
 * Use this type when sending caregiver data to the renderer process.
 */
export type RendererSafeCaregiver = Omit<Caregiver, 'ssn'>;

// ============================================================================
// TIME ENTRY TYPES
// ============================================================================

export interface CreateTimeEntryInput {
    caregiverId: number;
    workDate: string;
    hoursWorked: number;
}

export interface TimeEntry {
    id: number;
    caregiverId: number;
    employerId: number;
    workDate: string;
    hoursWorked: number;
    isFinalized: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TimeEntryWithCaregiver extends TimeEntry {
    caregiverName: string;
}

// ============================================================================
// PAYROLL TYPES
// ============================================================================

export interface TimeEntryForPayroll {
    date: string;
    hours: number;
    dayType?: DayType;
}

export interface PayrollCalculationInput {
    caregiverId: number;
    timeEntries: TimeEntryForPayroll[];
    baseHourlyRate: number;
    holidayMultiplier: number;
    weekendMultiplier: number;
    federalWithholdingAmount?: number;
    ytdWagesBefore?: number;
    disableOvertime?: boolean;
    payPeriodEnd?: string; // For tax year determination
}

export interface HoursByType {
    regular: number;
    weekend: number;
    holiday: number;
    overtime: number;
}

export interface WageDetail {
    hours: number;
    rate: number;
    subtotal: number;
}

export interface WagesByType {
    regular: WageDetail;
    weekend: WageDetail;
    holiday: WageDetail;
    overtime: WageDetail;
}

export interface TaxAmounts {
    socialSecurityEmployee: number;
    socialSecurityEmployer: number;
    medicareEmployee: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta: number;
    coloradoFamliEmployee: number;
    coloradoFamliEmployer: number;
    coloradoStateIncomeTax: number;
    totalEmployeeWithholdings: number;
    totalEmployerTaxes: number;
}

export interface PayrollCalculationResult {
    caregiverId: number;
    totalHours: number;
    hoursByType: HoursByType;
    wagesByType: WagesByType;
    grossWages: number;
    taxes: TaxAmounts;
    federalWithholding: number;
    netPay: number;
    calculationVersion: string;
    taxVersion: string;
    isMinimumWageCompliant: boolean;
}

export interface PayrollRecord {
    id: number;
    caregiverId: number;
    employerId: number;
    payPeriodStart: string;
    payPeriodEnd: string;
    totalHours: number;
    regularHours?: number;
    weekendHours?: number;
    holidayHours?: number;
    overtimeHours?: number;
    grossWages: number;
    regularWages?: number;
    weekendWages?: number;
    holidayWages?: number;
    overtimeWages?: number;
    ssEmployee: number;
    medicareEmployee: number;
    federalWithholding: number;
    netPay: number;
    ssEmployer: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta?: number;
    coloradoFamliEmployee?: number;
    coloradoFamliEmployer?: number;
    coloradoStateIncomeTax?: number;
    employerSuiRate?: number;
    employerSuiPaid?: number;
    calculationVersion: string;
    taxVersion: string;
    isFinalized: boolean;
    isMinimumWageCompliant?: boolean;
    status?: 'draft' | 'approved';
    checkNumber?: string;
    checkBankName?: string;
    checkAccountOwner?: string;
    paymentDate?: string;
    isVoided?: boolean;
    voidReason?: string;
    paymentMethod?: string;
    isLatePayment?: boolean;
    i9Snapshot?: boolean;
    createdAt: string;
}


// ============================================================================
// PAYMENT TYPES
// ============================================================================

export interface CreatePaymentInput {
    caregiverId: number;
    payrollRecordId?: number;
    amount: number;
    currency?: string;
    stripeId?: string;
    status: 'pending' | 'paid' | 'failed';
    errorMessage?: string;
}

export interface Payment {
    id: number;
    employerId: number;
    caregiverId: number;
    payrollRecordId?: number;
    amount: number;
    currency: string;
    stripeId?: string;
    status: 'pending' | 'paid' | 'failed';
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// TAX CONFIGURATION TYPES
// ============================================================================

export interface TaxConfiguration {
    id: number;
    year: number;
    socialSecurityRate: number;
    medicareRate: number;
    futaRate: number;
    ssWageBase: number;
    futaWageBase: number;
    notes?: string;
    taxYear?: number; // Alias for year
}

export interface TaxConfigurationInput {
    year: number;
    socialSecurityRate: number;
    medicareRate: number;
    futaRate: number;
    ssWageBase: number;
    futaWageBase: number;
    notes?: string;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditEntry {
    id: number;
    userId?: string;
    action: string;
    entityType: string;
    entityId?: number;
    details?: string;
    timestamp: string;
}

// ============================================================================
// REPORTING TYPES
// ============================================================================

export interface YTDSummary {
    grossWages: number;
    federalWithholding: number;
    ssEmployee: number;
    medicareEmployee: number;
    ssEmployer: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta: number;
    coloradoFamliEmployee: number;
    coloradoFamliEmployer: number;
}

export interface QuarterlyTaxSummary {
    quarter: number;
    year: number;
    totalGrossWages: number;
    totalFederalWithholding: number;
    totalSsEmployee: number;
    totalMedicareEmployee: number;
    totalSsEmployer: number;
    totalMedicareEmployer: number;
}

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

/**
 * Database row types use snake_case to match actual database column names.
 * These are used when querying the database directly.
 * Service layer methods should map these to camelCase domain types.
 */

export interface EmployerRow {
    id: number;
    display_name: string;
    ssn_or_ein_encrypted: string;
    pay_frequency: string;
    default_hourly_rate: number;
    federal_withholding_enabled: number;
    colorado_suta_rate: number;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    paystub_title: string | null;
    service_address: string | null;
    stripe_publishable_key_enc: string | null;
    stripe_secret_key_enc: string | null;
    stripe_account_id_enc: string | null;
    payment_verification_status: string | null;
    masked_funding_account: string | null;
    fein_enc: string | null;
    is_active: number;
    holiday_pay_multiplier: number;
    weekend_pay_multiplier: number;
    colorado_sui_account_number: string | null;
    colorado_sui_rate: number | null;
    colorado_sui_wage_base: number | null;
    colorado_sui_effective_date: string | null;
    workers_comp_acknowledged: number;
    workers_comp_policy_number: string | null;
    workers_comp_carrier: string | null;
    workers_comp_acknowledgment_date: string | null;
    colorado_famli_employee_rate: number;
    colorado_famli_employer_rate: number;
    created_at: string;
    updated_at: string;
}

export interface CaregiverRow {
    id: number;
    full_legal_name: string;
    ssn_encrypted: string;
    hourly_rate: number;
    relationship_note: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    employer_id: number;
    is_active: number;
    hfwa_balance: number;
    i9_completed: number;
    i9_completion_date: string | null;
    i9_notes: string | null;
    stripe_customer_id: string | null;
    stripe_bank_account_id: string | null;
    payout_method: string;
    masked_destination_account: string | null;
    stripe_payout_id_enc: string | null;
    // W-4 Federal Withholding Information
    w4_filing_status: string | null;
    w4_multiple_jobs: number | null;
    w4_dependents_amount: number | null;
    w4_other_income: number | null;
    w4_deductions: number | null;
    w4_extra_withholding: number | null;
    w4_last_updated: string | null;
    w4_effective_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface TimeEntryRow {
    id: number;
    caregiver_id: number;
    employer_id: number;
    work_date: string;
    hours_worked: number;
    is_finalized: number;
    created_at: string;
    updated_at: string;
}

export interface PayrollRecordRow {
    id: number;
    caregiver_id: number;
    employer_id: number;
    pay_period_start: string;
    pay_period_end: string;
    total_hours: number;
    regular_hours: number | null;
    weekend_hours: number | null;
    holiday_hours: number | null;
    overtime_hours: number | null;
    gross_wages: number;
    regular_wages: number | null;
    weekend_wages: number | null;
    holiday_wages: number | null;
    overtime_wages: number | null;
    ss_employee: number;
    medicare_employee: number;
    federal_withholding: number;
    net_pay: number;
    ss_employer: number;
    medicare_employer: number;
    futa: number;
    colorado_suta: number | null;
    colorado_famli_employee: number | null;
    colorado_famli_employer: number | null;
    colorado_state_income_tax: number | null;
    employer_sui_rate: number | null;
    employer_sui_paid: number | null;
    calculation_version: string;
    tax_version: string;
    is_finalized: number;
    is_minimum_wage_compliant: number | null;
    check_number: string | null;
    check_bank_name: string | null;
    check_account_owner: string | null;
    payment_date: string | null;
    is_voided: number | null;
    void_reason: string | null;
    payment_method: string | null;
    is_late_payment: number | null;
    i9_snapshot: number | null;
    paystub_pdf: Buffer | null;
    created_at: string;
}

export interface PaymentRow {
    id: number;
    employer_id: number;
    caregiver_id: number;
    payroll_record_id: number | null;
    amount: number;
    currency: string;
    stripe_id: string | null;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface TaxConfigurationRow {
    id: number;
    year: number;
    social_security_rate: number;
    medicare_rate: number;
    futa_rate: number;
    ss_wage_base: number;
    futa_wage_base: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AuditLogRow {
    id: number;
    employer_id: number;
    table_name: string;
    record_id: number | null;
    action: string;
    changes_json: string | null;
    calculation_version: string | null;
    timestamp: string;
}
