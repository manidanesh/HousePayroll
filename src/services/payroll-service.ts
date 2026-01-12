/**
 * PayrollService - Manages payroll record operations and YTD tracking
 */

import { getDatabase } from '../database/db';
import { EnhancedPayrollResult } from '../core/enhanced-payroll-calculator';
import { AuditService } from './audit-service';
import { TimeEntryService } from './time-entry-service';
import { CaregiverService } from './caregiver-service';
import { EmployerService } from './employer-service';
import { YTDService } from './ytd-service';

export interface PayrollRecord {
    id: number;
    caregiverId: number;
    employerId?: number;
    payPeriodStart: string;
    payPeriodEnd: string;
    totalHours: number;
    regular_hours?: number;
    weekend_hours?: number;
    holiday_hours?: number;
    overtime_hours?: number; // Added
    grossWages: number;
    regular_wages?: number;
    weekend_wages?: number;
    holiday_wages?: number;
    overtime_wages?: number; // Added
    ssEmployee: number;
    medicareEmployee: number;
    federalWithholding: number;
    netPay: number;
    ssEmployer: number;
    medicareEmployer: number;
    futa: number;
    colorado_suta?: number;
    colorado_famli_employee?: number; // Added
    colorado_famli_employer?: number; // Added
    employerSuiRate?: number;
    employerSuiPaid?: number;
    calculationVersion: string;
    taxVersion: string;
    isFinalized: boolean;
    isMinimumWageCompliant?: boolean;
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

export class PayrollService {
    /**
     * Create a new payroll record from calculator results
     */
    static createPayrollRecord(result: EnhancedPayrollResult, payPeriodStart: string, payPeriodEnd: string): PayrollRecord {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No active employer profile found');

        const caregiver = CaregiverService.getCaregiverById(result.caregiverId);
        const i9Snapshot = caregiver?.i9Completed ? 1 : 0;

        const res = db.prepare(`
            INSERT INTO payroll_records (
                caregiver_id, employer_id, pay_period_start, pay_period_end, total_hours, 
                regular_hours, weekend_hours, holiday_hours, overtime_hours,
                gross_wages, 
                regular_wages, weekend_wages, holiday_wages, overtime_wages,
                ss_employee, medicare_employee, federal_withholding, net_pay,
                ss_employer, medicare_employer, futa, colorado_suta,
                colorado_famli_employee, colorado_famli_employer, colorado_state_income_tax,
                employer_sui_rate, employer_sui_paid,
                calculation_version, tax_version,
                is_finalized, is_minimum_wage_compliant, i9_snapshot
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(
            result.caregiverId,
            employer.id,
            payPeriodStart,
            payPeriodEnd,
            result.totalHours,
            result.hoursByType.regular,
            result.hoursByType.weekend,
            result.hoursByType.holiday,
            result.hoursByType.overtime,
            result.grossWages,
            result.wagesByType.regular.subtotal,
            result.wagesByType.weekend.subtotal,
            result.wagesByType.holiday.subtotal,
            result.wagesByType.overtime.subtotal,
            result.taxes.socialSecurityEmployee,
            result.taxes.medicareEmployee,
            result.federalWithholding,
            result.netPay,
            result.taxes.socialSecurityEmployer,
            result.taxes.medicareEmployer,
            result.taxes.futa,
            result.taxes.coloradoSuta,
            result.taxes.coloradoFamliEmployee,
            result.taxes.coloradoFamliEmployer,
            result.taxes.coloradoStateIncomeTax,
            employer.coloradoSutaRate,
            result.taxes.coloradoSuta,
            result.calculationVersion,
            result.taxVersion,
            result.isMinimumWageCompliant ? 1 : 0,
            i9Snapshot
        );

        const record = this.getPayrollRecordById(res.lastInsertRowid as number)!;

        // Log audit
        AuditService.log({
            tableName: 'payroll_records',
            recordId: record.id,
            action: 'CREATE',
            changesJson: JSON.stringify({
                grossWages: result.grossWages,
                netPay: result.netPay,
                isMinimumWageCompliant: result.isMinimumWageCompliant
            }),
            calculationVersion: result.calculationVersion
        });

        return record;
    }

    /**
     * Get payroll record by ID
     */
    static getPayrollRecordById(id: number): PayrollRecord | null {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return null;

        const row = db.prepare('SELECT * FROM payroll_records WHERE id = ? AND employer_id = ?').get(id, employer.id) as any;

        if (!row) return null;

        return {
            id: row.id,
            caregiverId: row.caregiver_id,
            employerId: row.employer_id,
            payPeriodStart: row.pay_period_start,
            payPeriodEnd: row.pay_period_end,
            totalHours: row.total_hours,
            grossWages: row.gross_wages,
            ssEmployee: row.ss_employee,
            medicareEmployee: row.medicare_employee,
            federalWithholding: row.federal_withholding,
            netPay: row.net_pay,
            ssEmployer: row.ss_employer,
            medicareEmployer: row.medicare_employer,
            futa: row.futa,
            colorado_suta: row.colorado_suta,
            colorado_famli_employee: row.colorado_famli_employee,
            colorado_famli_employer: row.colorado_famli_employer,
            employerSuiRate: row.employer_sui_rate,
            employerSuiPaid: row.employer_sui_paid,
            overtime_hours: row.overtime_hours,
            overtime_wages: row.overtime_wages,
            calculationVersion: row.calculation_version,
            taxVersion: row.tax_version,
            isFinalized: row.is_finalized === 1,
            isMinimumWageCompliant: row.is_minimum_wage_compliant === 1,
            checkNumber: row.check_number,
            paymentDate: row.payment_date,
            paymentMethod: row.payment_method,
            isVoided: row.is_voided === 1,
            voidReason: row.void_reason,
            isLatePayment: row.is_late_payment === 1,
            i9Snapshot: row.i9_snapshot === 1,
            createdAt: row.created_at,
        };
    }

    /**
     * Get YTD Gross Wages for a caregiver
     * @deprecated Use YTDService.getYTDGrossWages() instead
     */
    static getYTDGrossWages(caregiverId: number, year: number): number {
        return YTDService.getYTDGrossWages(caregiverId, year);
    }

    /**
     * Void a payroll record
     */
    static voidPayrollRecord(id: number, reason: string): void {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return;

        db.prepare(`
            UPDATE payroll_records
            SET is_voided = 1, void_reason = ?
            WHERE id = ? AND employer_id = ?
        `).run(reason, id, employer.id);

        // Fetch record to log audit properly
        const record = this.getPayrollRecordById(id);

        // Log audit
        AuditService.log({
            tableName: 'payroll_records',
            recordId: id,
            action: 'UPDATE',
            changesJson: JSON.stringify({ isVoided: true, voidReason: reason })
        });
    }

    /**
     * Check if a check number is already in use
     * @param checkNumber - The check number to validate
     * @param employerId - The employer ID
     * @param excludeRecordId - Optional record ID to exclude from check (for updates)
     * @returns true if duplicate exists, false otherwise
     */
    static checkDuplicateCheckNumber(
        checkNumber: string,
        employerId: number,
        excludeRecordId?: number
    ): boolean {
        const db = getDatabase();

        const query = excludeRecordId
            ? `SELECT id FROM payroll_records 
               WHERE check_number = ? AND employer_id = ? AND id != ?`
            : `SELECT id FROM payroll_records 
               WHERE check_number = ? AND employer_id = ?`;

        const params = excludeRecordId
            ? [checkNumber, employerId, excludeRecordId]
            : [checkNumber, employerId];

        const row = db.prepare(query).get(...params);
        return !!row; // Returns true if duplicate exists
    }

    /**
     * Finalize payroll (Mark as Paid)
     * Once finalized, records are immutable
     */
    static finalizePayroll(id: number, checkNumber: string, paymentDate: string, pdfData?: Uint8Array, isLatePayment: boolean = false, paymentMethod?: string, checkBankName?: string, checkAccountOwner?: string): void {
        const db = getDatabase();

        const record = this.getPayrollRecordById(id);
        if (!record) throw new Error('Payroll record not found');

        // Enforce immutability: Prevent modification of finalized records
        if (record.isFinalized) {
            throw new Error('Cannot modify finalized payroll record. Payroll has already been finalized and is immutable.');
        }

        // Check for duplicate check number
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer found');

        const isDuplicate = this.checkDuplicateCheckNumber(
            checkNumber,
            employer.id,
            id
        );

        if (isDuplicate) {
            throw new Error(`Check number "${checkNumber}" is already in use. Please enter a different check number.`);
        }

        // 1. Mark payroll record as finalized with optional PDF blob
        if (pdfData) {
            db.prepare(`
                UPDATE payroll_records
                SET is_finalized = 1, check_number = ?, payment_date = ?, payment_method = ?, check_bank_name = ?, check_account_owner = ?, paystub_pdf = ?, is_late_payment = ?
                WHERE id = ? AND employer_id = ?
            `).run(checkNumber, paymentDate, paymentMethod, checkBankName, checkAccountOwner, Buffer.from(pdfData), isLatePayment ? 1 : 0, id, record.employerId || 0);
        } else {
            db.prepare(`
                UPDATE payroll_records
                SET is_finalized = 1, check_number = ?, payment_date = ?, payment_method = ?, check_bank_name = ?, check_account_owner = ?, is_late_payment = ?
                WHERE id = ? AND employer_id = ?
            `).run(checkNumber, paymentDate, paymentMethod, checkBankName, checkAccountOwner, isLatePayment ? 1 : 0, id, record.employerId || 0);
        }

        // 2. Mark associated time entries as finalized
        TimeEntryService.finalizeTimeEntries(record.caregiverId, record.payPeriodStart, record.payPeriodEnd);

        // 3. Calculate and apply HFWA accrual (Colorado: 1h per 30h worked, capped at 48h/year)
        const accruedHours = record.totalHours / 30;

        // Update caregiver's HFWA balance with a 48h annual cap check
        // Calculate total accrued this year already
        const yearStart = `${record.payPeriodEnd.substring(0, 4)}-01-01`;
        const yearEnd = `${record.payPeriodEnd.substring(0, 4)}-12-31`;

        const row = db.prepare(`
            SELECT SUM(total_hours) / 30.0 as total 
            FROM payroll_records 
            WHERE caregiver_id = ? AND is_finalized = 1 AND is_voided = 0 
            AND pay_period_end BETWEEN ? AND ?
        `).get(record.caregiverId, yearStart, yearEnd) as { total: number } | undefined;

        const currentYearAccrual = row?.total || 0;

        const HFWA_ANNUAL_CAP = 48;
        const remainingCap = Math.max(0, HFWA_ANNUAL_CAP - currentYearAccrual);
        const actualAccrual = Math.min(accruedHours, remainingCap);

        if (actualAccrual > 0) {
            db.prepare('UPDATE caregivers SET hfwa_balance = hfwa_balance + ? WHERE id = ?')
                .run(actualAccrual, record.caregiverId);
        }

        // 4. Log audit
        AuditService.log({
            tableName: 'payroll_records',
            recordId: id,
            action: 'FINALIZED',
            changesJson: JSON.stringify({ checkNumber, checkBankName, checkAccountOwner, paymentDate, accruedHours, isLatePayment }),
            calculationVersion: record.calculationVersion
        });
    }

    /**
     * Get Paystub Context with comprehensive YTD data for a specific record
     */
    static getPaystubContext(recordId: number): { record: PayrollRecord, ytd: any } | null {
        const record = this.getPayrollRecordById(recordId);
        if (!record) return null;

        const ytd = YTDService.getYTDForPaystub(
            record.caregiverId,
            record.employerId || 0,
            record.id,
            record.payPeriodEnd
        );

        return { record, ytd };
    }
    /**
     * Get YTD Context for data prior to current calculation (for UI preview)
     * @deprecated Use YTDService.getYTDContext() instead
     */
    static getYTDContext(caregiverId: number, year: number): any {
        return YTDService.getYTDContext(caregiverId, year);
    }

    /**
     * Get Payroll History (Finalized Records)
     */
    static getPayrollHistory(): PayrollRecord[] {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const rows = db.prepare(`
            SELECT pr.*, c.full_legal_name as caregiver_name 
            FROM payroll_records pr
            JOIN caregivers c ON pr.caregiver_id = c.id
            WHERE pr.employer_id = ? AND pr.is_finalized = 1 
            ORDER BY pr.payment_date DESC, pr.id DESC
        `).all(employer.id) as any[];

        return rows.map(row => ({
            id: row.id,
            caregiverId: row.caregiver_id,
            caregiverName: row.caregiver_name,
            employerId: row.employer_id,
            payPeriodStart: row.pay_period_start,
            payPeriodEnd: row.pay_period_end,
            totalHours: row.total_hours,
            grossWages: row.gross_wages,
            ssEmployee: row.ss_employee,
            medicareEmployee: row.medicare_employee,
            federalWithholding: row.federal_withholding,
            netPay: row.net_pay,
            ssEmployer: row.ss_employer,
            medicareEmployer: row.medicare_employer,
            futa: row.futa,
            colorado_suta: row.colorado_suta,
            colorado_famli_employee: row.colorado_famli_employee,
            colorado_famli_employer: row.colorado_famli_employer,
            employerSuiRate: row.employer_sui_rate,
            employerSuiPaid: row.employer_sui_paid,
            overtime_hours: row.overtime_hours,
            overtime_wages: row.overtime_wages,
            calculationVersion: row.calculation_version,
            taxVersion: row.tax_version,
            isFinalized: row.is_finalized === 1,
            isMinimumWageCompliant: row.is_minimum_wage_compliant === 1,
            checkNumber: row.check_number,
            paymentDate: row.payment_date,
            paymentMethod: row.payment_method,
            isVoided: row.is_voided === 1,
            voidReason: row.void_reason,
            isLatePayment: row.is_late_payment === 1,
            i9Snapshot: row.i9_snapshot === 1,
            createdAt: row.created_at,
        }));
    }

    /**
     * Get the last finalized pay period end date for a caregiver
     */
    static getLastFinalizedDate(caregiverId: number): string | null {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return null;

        const result = db.prepare(`
            SELECT MAX(pay_period_end) as last_date 
            FROM payroll_records 
            WHERE caregiver_id = ? AND employer_id = ? AND is_finalized = 1 AND is_voided = 0
        `).get(caregiverId, employer.id) as { last_date: string };

        return result.last_date || null;
    }

    /**
     * Check if a date range overlaps with any finalized payroll periods
     * Returns array of overlapping payroll records
     */
    static checkOverlappingPayrolls(caregiverId: number, startDate: string, endDate: string): any[] {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const overlapping = db.prepare(`
            SELECT id, pay_period_start, pay_period_end, check_number, payment_date
            FROM payroll_records
            WHERE caregiver_id = ? 
              AND employer_id = ? 
              AND is_finalized = 1 
              AND is_voided = 0
              AND (
                -- New period starts during existing period
                (? BETWEEN pay_period_start AND pay_period_end)
                OR
                -- New period ends during existing period
                (? BETWEEN pay_period_start AND pay_period_end)
                OR
                -- New period completely contains existing period
                (? <= pay_period_start AND ? >= pay_period_end)
              )
            ORDER BY pay_period_start
        `).all(caregiverId, employer.id, startDate, endDate, startDate, endDate) as any[];

        return overlapping;
    }

    /**
     * Preview payroll calculation without saving to database
     * Used for review workflow - calculate and display details before approval
     */
    static previewPayroll(result: EnhancedPayrollResult): EnhancedPayrollResult {
        // Simply return the calculation result for preview
        // No database operations
        return result;
    }

    /**
     * Save payroll as draft (status = 'draft')
     * Allows saving calculation for later approval
     */
    static saveDraft(result: EnhancedPayrollResult, periodStart: string, periodEnd: string): PayrollRecord {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer found');

        const caregiver = CaregiverService.getCaregiverById(result.caregiverId);
        if (!caregiver) throw new Error('Caregiver not found');

        const i9Snapshot = caregiver.i9CompletionDate ? 1 : 0;

        const res = db.prepare(`
            INSERT INTO payroll_records (
                caregiver_id, employer_id, pay_period_start, pay_period_end,
                total_hours, regular_hours, weekend_hours, holiday_hours, overtime_hours,
                gross_wages, regular_wages, weekend_wages, holiday_wages, overtime_wages,
                ss_employee, medicare_employee, federal_withholding, net_pay,
                ss_employer, medicare_employer, futa, colorado_suta,
                colorado_famli_employee, colorado_famli_employer, colorado_state_income_tax,
                employer_sui_rate, employer_sui_paid,
                calculation_version, tax_version, is_minimum_wage_compliant, i9_snapshot,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `).run(
            result.caregiverId,
            employer.id,
            periodStart,
            periodEnd,
            result.totalHours,
            result.hoursByType.regular,
            result.hoursByType.weekend,
            result.hoursByType.holiday,
            result.hoursByType.overtime,
            result.grossWages,
            result.wagesByType.regular.subtotal,
            result.wagesByType.weekend.subtotal,
            result.wagesByType.holiday.subtotal,
            result.wagesByType.overtime.subtotal,
            result.taxes.socialSecurityEmployee,
            result.taxes.medicareEmployee,
            result.federalWithholding,
            result.netPay,
            result.taxes.socialSecurityEmployer,
            result.taxes.medicareEmployer,
            result.taxes.futa,
            result.taxes.coloradoSuta,
            result.taxes.coloradoFamliEmployee,
            result.taxes.coloradoFamliEmployer,
            result.taxes.coloradoStateIncomeTax,
            employer.coloradoSutaRate,
            result.taxes.coloradoSuta,
            result.calculationVersion,
            result.taxVersion,
            result.isMinimumWageCompliant ? 1 : 0,
            i9Snapshot
        );

        const record = this.getPayrollRecordById(res.lastInsertRowid as number)!;

        AuditService.log({
            tableName: 'payroll_records',
            recordId: record.id,
            action: 'CREATE',
            changesJson: JSON.stringify({ status: 'draft', grossWages: result.grossWages }),
            calculationVersion: result.calculationVersion
        });

        return record;
    }

    /**
     * Approve draft payroll - change status from 'draft' to 'approved'
     * Finalizes time entries and marks payroll as approved
     */
    static approveDraft(draftId: number): PayrollRecord {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer found');

        // Get draft record
        const draft = this.getPayrollRecordById(draftId);
        if (!draft) throw new Error('Draft payroll not found');

        // Verify it's actually a draft
        const row = db.prepare('SELECT status FROM payroll_records WHERE id = ? AND employer_id = ?')
            .get(draftId, employer.id) as { status: string } | undefined;

        if (!row || row.status !== 'draft') {
            throw new Error('Payroll is not in draft status');
        }

        // Update status to approved
        db.prepare('UPDATE payroll_records SET status = \'approved\' WHERE id = ? AND employer_id = ?')
            .run(draftId, employer.id);

        // Finalize time entries for this period
        const entries = TimeEntryService.getTimeEntriesForDateRange(draft.payPeriodStart, draft.payPeriodEnd);
        entries.filter((e: any) => e.caregiverId === draft.caregiverId).forEach((entry: any) => {
            // Mark entry as finalized by updating it
            const db = getDatabase();
            db.prepare('UPDATE time_entries SET is_finalized = 1 WHERE id = ?').run(entry.id);
        });

        AuditService.log({
            tableName: 'payroll_records',
            recordId: draftId,
            action: 'UPDATE',
            changesJson: JSON.stringify({ status: 'draft -> approved' }),
            calculationVersion: draft.calculationVersion
        });

        return this.getPayrollRecordById(draftId)!;
    }

    /**
     * Delete draft payroll
     * Only drafts can be deleted, approved payrolls must be voided
     */
    static deleteDraft(draftId: number): void {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer found');

        // Verify it's a draft
        const row = db.prepare('SELECT status FROM payroll_records WHERE id = ? AND employer_id = ?')
            .get(draftId, employer.id) as { status: string } | undefined;

        if (!row) throw new Error('Payroll not found');
        if (row.status !== 'draft') {
            throw new Error('Only draft payrolls can be deleted. Use void for approved payrolls.');
        }

        // Delete the draft
        db.prepare('DELETE FROM payroll_records WHERE id = ? AND employer_id = ?')
            .run(draftId, employer.id);

        AuditService.log({
            tableName: 'payroll_records',
            recordId: draftId,
            action: 'DELETE',
            changesJson: JSON.stringify({ status: 'draft', deleted: true }),
            calculationVersion: ''
        });
    }

    /**
     * Get all draft payrolls
     */
    static getDrafts(): PayrollRecord[] {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const rows = db.prepare(`
            SELECT * FROM payroll_records 
            WHERE employer_id = ? AND status = 'draft'
            ORDER BY created_at DESC
        `).all(employer.id) as any[];

        return rows.map(row => ({
            id: row.id,
            caregiverId: row.caregiver_id,
            employerId: row.employer_id,
            payPeriodStart: row.pay_period_start,
            payPeriodEnd: row.pay_period_end,
            totalHours: row.total_hours,
            grossWages: row.gross_wages,
            ssEmployee: row.ss_employee,
            medicareEmployee: row.medicare_employee,
            federalWithholding: row.federal_withholding,
            netPay: row.net_pay,
            ssEmployer: row.ss_employer,
            medicareEmployer: row.medicare_employer,
            futa: row.futa,
            calculationVersion: row.calculation_version,
            taxVersion: row.tax_version,
            isFinalized: row.is_finalized === 1,
            regular_hours: row.regular_hours,
            weekend_hours: row.weekend_hours,
            holiday_hours: row.holiday_hours,
            overtime_hours: row.overtime_hours,
            regular_wages: row.regular_wages,
            weekend_wages: row.weekend_wages,
            holiday_wages: row.holiday_wages,
            overtime_wages: row.overtime_wages,
            colorado_suta: row.colorado_suta,
            colorado_famli_employee: row.colorado_famli_employee,
            colorado_famli_employer: row.colorado_famli_employer,
            createdAt: row.created_at,
        }));
    }
}
