/**
 * PayrollService - Manages payroll record operations and YTD tracking
 */

import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { EnhancedPayrollResult } from '../core/enhanced-payroll-calculator';
import { AuditService } from './audit-service';
import { TimeEntryService } from './time-entry-service';
import { CaregiverService } from './caregiver-service';
import { EmployerService } from './employer-service';
import { YTDService } from './ytd-service';
import { TaxComputer, TaxRates } from '../core/tax-computer';
import { FederalWithholdingCalculator, W4Information, PayFrequency, FilingStatus } from '../core/federal-withholding-calculator';
import { TaxConfigurationService } from './tax-configuration-service';
import { SuiRateService } from './sui-rate-service';
import { ServiceAddressService } from './service-address-service';

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
    overtime_hours?: number;
    grossWages: number;
    regular_wages?: number;
    weekend_wages?: number;
    holiday_wages?: number;
    overtime_wages?: number;
    ssEmployee: number;
    medicareEmployee: number;
    federalWithholding: number;
    netPay: number;
    ssEmployer: number;
    medicareEmployer: number;
    futa: number;
    colorado_suta?: number;
    colorado_famli_employee?: number;
    colorado_famli_employer?: number;
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
    serviceAddressSnapshot?: string | null;
    createdAt: string;
}

export class PayrollService extends BaseRepository<PayrollRecord> {

    // Abstract implementation dummy
    create(data: Partial<PayrollRecord>): PayrollRecord { throw new Error('Use createPayrollRecord'); }
    update(id: number, data: Partial<PayrollRecord>): PayrollRecord { throw new Error('Method not implemented.'); }
    delete(id: number): void { throw new Error('Method not implemented.'); }
    getById(id: number): PayrollRecord | null { return this.getPayrollRecordById(id); }

    // Static Compatibility Layer
    static createPayrollRecord(result: EnhancedPayrollResult, payPeriodStart: string, payPeriodEnd: string): PayrollRecord {
        return new PayrollService(getDatabase()).createPayrollRecord(result, payPeriodStart, payPeriodEnd);
    }

    static getPayrollRecordById(id: number): PayrollRecord | null {
        return new PayrollService(getDatabase()).getPayrollRecordById(id);
    }

    static getYTDGrossWages(caregiverId: number, year: number): number {
        return YTDService.getYTDGrossWages(caregiverId, year);
    }

    static voidPayrollRecord(id: number, reason: string): void {
        new PayrollService(getDatabase()).voidPayrollRecord(id, reason);
    }

    static checkDuplicateCheckNumber(checkNumber: string, employerId: number, excludeRecordId?: number): boolean {
        return new PayrollService(getDatabase()).checkDuplicateCheckNumber(checkNumber, employerId, excludeRecordId);
    }

    static finalizePayroll(id: number, checkNumber: string, paymentDate: string, pdfData?: Uint8Array, isLatePayment: boolean = false, paymentMethod?: string, checkBankName?: string, checkAccountOwner?: string): void {
        new PayrollService(getDatabase()).finalizePayroll(id, checkNumber, paymentDate, pdfData, isLatePayment, paymentMethod, checkBankName, checkAccountOwner);
    }

    static getPaystubContext(recordId: number): { record: PayrollRecord, ytd: any } | null {
        return new PayrollService(getDatabase()).getPaystubContext(recordId);
    }

    static getYTDContext(caregiverId: number, year: number): any {
        return YTDService.getYTDContext(caregiverId, year);
    }

    static getPayrollHistory(): PayrollRecord[] {
        return new PayrollService(getDatabase()).getPayrollHistory();
    }

    static getLastFinalizedDate(caregiverId: number): string | null {
        return new PayrollService(getDatabase()).getLastFinalizedDate(caregiverId);
    }

    static checkOverlappingPayrolls(caregiverId: number, startDate: string, endDate: string): any[] {
        return new PayrollService(getDatabase()).checkOverlappingPayrolls(caregiverId, startDate, endDate);
    }

    static previewPayroll(result: EnhancedPayrollResult): EnhancedPayrollResult {
        return result;
    }

    static saveDraft(result: EnhancedPayrollResult, periodStart: string, periodEnd: string): PayrollRecord {
        return new PayrollService(getDatabase()).saveDraft(result, periodStart, periodEnd);
    }

    static approveDraft(draftId: number): PayrollRecord {
        return new PayrollService(getDatabase()).approveDraft(draftId);
    }

    static deleteDraft(draftId: number): void {
        new PayrollService(getDatabase()).deleteDraft(draftId);
    }

    static getDrafts(): PayrollRecord[] {
        return new PayrollService(getDatabase()).getDrafts();
    }

    // Instance Methods

    createPayrollRecord(result: EnhancedPayrollResult, payPeriodStart: string, payPeriodEnd: string): PayrollRecord {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No active employer profile found');

        const caregiver = CaregiverService.getCaregiverById(result.caregiverId);
        const i9Snapshot = caregiver?.i9Completed ? 1 : 0;

        // Snapshot the provisional SUI rate resolved for this pay period (matches the rate used
        // to compute result.taxes.coloradoSuta). Authoritative rate is reconciled at finalization.
        const provisionalSuiRate = SuiRateService.getRateForDate(employer.id, payPeriodEnd);

        const res = this.run(`
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
        `, [
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
            provisionalSuiRate.rate,
            result.taxes.coloradoSuta,
            result.calculationVersion,
            result.taxVersion,
            result.isMinimumWageCompliant ? 1 : 0,
            i9Snapshot
        ]);

        const record = this.getPayrollRecordById(res.lastInsertRowid as number)!;

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

    getPayrollRecordById(id: number): PayrollRecord | null {
        const employer = EmployerService.getEmployer();
        if (!employer) return null;

        const row = this.get<any>('SELECT * FROM payroll_records WHERE id = ? AND employer_id = ?', [id, employer.id]);

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
            serviceAddressSnapshot: row.service_address_snapshot,
            createdAt: row.created_at,
        };
    }

    voidPayrollRecord(id: number, reason: string): void {
        const employer = EmployerService.getEmployer();
        if (!employer) return;

        this.run(`
            UPDATE payroll_records
            SET is_voided = 1, void_reason = ?
            WHERE id = ? AND employer_id = ?
        `, [reason, id, employer.id]);

        AuditService.log({
            tableName: 'payroll_records',
            recordId: id,
            action: 'UPDATE',
            changesJson: JSON.stringify({ isVoided: true, voidReason: reason })
        });
    }

    checkDuplicateCheckNumber(checkNumber: string, employerId: number, excludeRecordId?: number): boolean {
        const query = excludeRecordId
            ? `SELECT id FROM payroll_records 
               WHERE check_number = ? AND employer_id = ? AND id != ?`
            : `SELECT id FROM payroll_records 
               WHERE check_number = ? AND employer_id = ?`;

        const params = excludeRecordId
            ? [checkNumber, employerId, excludeRecordId]
            : [checkNumber, employerId];

        const row = this.get<any>(query, params);
        return !!row;
    }

    finalizePayroll(id: number, checkNumber: string, paymentDate: string, pdfData?: Uint8Array, isLatePayment: boolean = false, paymentMethod?: string, checkBankName?: string, checkAccountOwner?: string): void {
        const record = this.getPayrollRecordById(id);
        if (!record) throw new Error('Payroll record not found');

        if (record.isFinalized) {
            throw new Error('Cannot modify finalized payroll record. Payroll has already been finalized and is immutable.');
        }

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

        // Authoritative Colorado SUI rate resolved by PAYMENT DATE (D1=B). The create-time
        // snapshot used the pay-period end as a provisional value; reconcile at finalization.
        const suiRate = SuiRateService.getRateForDate(employer.id, paymentDate);
        if (!suiRate.wageBaseConfirmed || !suiRate.wageBase) {
            throw new Error(
                `Colorado SUI wage base for ${new Date(paymentDate).getFullYear()} is not confirmed. ` +
                `Enter the official CDLE taxable wage base before finalizing payroll.`
            );
        }
        const payYear = new Date(paymentDate).getFullYear();
        const periodYear = new Date(record.payPeriodEnd).getFullYear();
        const suiNeedsRecompute = (suiRate.rate !== (record.employerSuiRate ?? 0)) || (payYear !== periodYear);

        // Resolve the service/work address effective at the start of this pay period for the
        // immutable snapshot (FR-07). Records that already carry a backfilled snapshot keep it.
        let serviceAddressSnapshot: string | null = record.serviceAddressSnapshot || null;
        if (!serviceAddressSnapshot) {
            const addr = ServiceAddressService.getAddressForDate(record.caregiverId, record.payPeriodStart);
            if (addr) {
                serviceAddressSnapshot = ServiceAddressService.formatAddress(addr);
            } else if (employer.serviceAddress) {
                serviceAddressSnapshot = employer.serviceAddress;
            } else {
                const structured = [
                    employer.addressLine1, employer.addressLine2,
                    [employer.city, employer.state].filter(Boolean).join(', '),
                    employer.zip
                ].filter(Boolean).join(' ').trim();
                serviceAddressSnapshot = structured || null;
            }
        }

        const db = getDatabase();
        const finalize = db.transaction(() => {
            if (pdfData) {
                this.run(`
                    UPDATE payroll_records
                    SET is_finalized = 1, check_number = ?, payment_date = ?, payment_method = ?, check_bank_name = ?, check_account_owner = ?, paystub_pdf = ?, is_late_payment = ?
                    WHERE id = ? AND employer_id = ?
                `, [checkNumber, paymentDate, paymentMethod, checkBankName, checkAccountOwner, Buffer.from(pdfData), isLatePayment ? 1 : 0, id, record.employerId || 0]);
            } else {
                this.run(`
                    UPDATE payroll_records
                    SET is_finalized = 1, check_number = ?, payment_date = ?, payment_method = ?, check_bank_name = ?, check_account_owner = ?, is_late_payment = ?
                    WHERE id = ? AND employer_id = ?
                `, [checkNumber, paymentDate, paymentMethod, checkBankName, checkAccountOwner, isLatePayment ? 1 : 0, id, record.employerId || 0]);
            }

            TimeEntryService.finalizeTimeEntries(record.caregiverId, record.payPeriodStart, record.payPeriodEnd);

            // Reconcile SUI to the authoritative rate/wage base for the payment date (D1=B).
            // SUI is an employer-paid expense, so net pay is unaffected; only employer tax columns change.
            if (suiNeedsRecompute) {
                const ytdRow = this.get<{ total: number }>(`
                    SELECT SUM(gross_wages) as total
                    FROM payroll_records
                    WHERE caregiver_id = ? AND employer_id = ?
                      AND is_finalized = 1 AND is_voided = 0
                      AND substr(payment_date,1,4) = ? AND payment_date < ?
                `, [record.caregiverId, record.employerId || employer.id, String(payYear), paymentDate]);
                const ytdSuiBefore = ytdRow?.total || 0;
                const remainingCap = Math.max(0, suiRate.wageBase - ytdSuiBefore);
                const taxableWages = Math.min(record.grossWages, remainingCap);
                const suiPaid = Math.round(taxableWages * suiRate.rate * 100) / 100;
                this.run(`
                    UPDATE payroll_records
                    SET colorado_suta = ?, employer_sui_rate = ?, employer_sui_paid = ?
                    WHERE id = ? AND employer_id = ?
                `, [suiPaid, suiRate.rate, suiPaid, id, record.employerId || employer.id]);
            }

            // Persist the immutable service-address snapshot (FR-07).
            if (serviceAddressSnapshot) {
                this.run(
                    'UPDATE payroll_records SET service_address_snapshot = ? WHERE id = ? AND employer_id = ?',
                    [serviceAddressSnapshot, id, record.employerId || employer.id]
                );
            }

            const accruedHours = record.totalHours / 30;
            const yearStart = `${record.payPeriodEnd.substring(0, 4)}-01-01`;
            const yearEnd = `${record.payPeriodEnd.substring(0, 4)}-12-31`;

            const row = this.get<{ total: number }>(`
                SELECT SUM(total_hours) / 30.0 as total 
                FROM payroll_records 
                WHERE caregiver_id = ? AND is_finalized = 1 AND is_voided = 0 
                AND pay_period_end BETWEEN ? AND ?
            `, [record.caregiverId, yearStart, yearEnd]);

            const currentYearAccrual = row?.total || 0;
            const HFWA_ANNUAL_CAP = 48;
            const remainingCap = Math.max(0, HFWA_ANNUAL_CAP - currentYearAccrual);
            const actualAccrual = Math.min(accruedHours, remainingCap);

            if (actualAccrual > 0) {
                this.run('UPDATE caregivers SET hfwa_balance = hfwa_balance + ? WHERE id = ?', [actualAccrual, record.caregiverId]);
            }

            AuditService.log({
                tableName: 'payroll_records',
                recordId: id,
                action: 'FINALIZED',
                changesJson: JSON.stringify({ checkNumber, checkBankName, checkAccountOwner, paymentDate, accruedHours, isLatePayment }),
                calculationVersion: record.calculationVersion
            });
        });

        finalize();
    }

    getPaystubContext(recordId: number): { record: PayrollRecord, ytd: any } | null {
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

    getPayrollHistory(): PayrollRecord[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const rows = this.all<any>(`
            SELECT pr.*, c.full_legal_name as caregiver_name 
            FROM payroll_records pr
            JOIN caregivers c ON pr.caregiver_id = c.id
            WHERE pr.employer_id = ? AND pr.is_finalized = 1 
            ORDER BY pr.payment_date DESC, pr.id DESC
        `, [employer.id]);

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

    getLastFinalizedDate(caregiverId: number): string | null {
        const employer = EmployerService.getEmployer();
        if (!employer) return null;

        const result = this.get<{ last_date: string }>(`
            SELECT MAX(pay_period_end) as last_date 
            FROM payroll_records 
            WHERE caregiver_id = ? AND employer_id = ? AND is_finalized = 1 AND is_voided = 0
        `, [caregiverId, employer.id]);

        return result?.last_date || null;
    }

    checkOverlappingPayrolls(caregiverId: number, startDate: string, endDate: string): any[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        return this.all<any>(`
            SELECT id, pay_period_start, pay_period_end, check_number, payment_date
            FROM payroll_records
            WHERE caregiver_id = ? 
              AND employer_id = ? 
              AND is_finalized = 1 
              AND is_voided = 0
              AND (
                (? BETWEEN pay_period_start AND pay_period_end)
                OR
                (? BETWEEN pay_period_start AND pay_period_end)
                OR
                (? <= pay_period_start AND ? >= pay_period_end)
              )
            ORDER BY pay_period_start
        `, [caregiverId, employer.id, startDate, endDate, startDate, endDate]);
    }

    saveDraft(result: EnhancedPayrollResult, periodStart: string, periodEnd: string): PayrollRecord {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer found');

        const caregiver = CaregiverService.getCaregiverById(result.caregiverId);
        if (!caregiver) throw new Error('Caregiver not found');

        const i9Snapshot = caregiver.i9CompletionDate ? 1 : 0;

        // Snapshot the provisional SUI rate resolved for this pay period (matches the rate used
        // to compute result.taxes.coloradoSuta). Authoritative rate is reconciled at finalization.
        const provisionalSuiRate = SuiRateService.getRateForDate(employer.id, periodEnd);

        const res = this.run(`
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
        `, [
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
            provisionalSuiRate.rate,
            result.taxes.coloradoSuta,
            result.calculationVersion,
            result.taxVersion,
            result.isMinimumWageCompliant ? 1 : 0,
            i9Snapshot
        ]);

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

    approveDraft(draftId: number): PayrollRecord {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer found');

        const draft = this.getPayrollRecordById(draftId);
        if (!draft) throw new Error('Draft payroll not found');

        const row = this.get<{ status: string }>('SELECT status FROM payroll_records WHERE id = ? AND employer_id = ?', [draftId, employer.id]);

        if (!row || row.status !== 'draft') {
            throw new Error('Payroll is not in draft status');
        }

        // Clean up any abandoned unfinalized drafts for this exact period to prevent blocking the user.
        // The frontend no longer supports resuming pending payrolls, so unfinalized approved records
        // for the same period are just abandoned sessions that should be overwritten.
        this.run(
            `DELETE FROM payroll_records WHERE caregiver_id = ? AND pay_period_start = ? AND pay_period_end = ? AND employer_id = ? AND is_finalized = 0 AND status = 'approved' AND id != ?`,
            [draft.caregiverId, draft.payPeriodStart, draft.payPeriodEnd, employer.id, draftId]
        );

        // We removed the hard throw here for finalized records. 
        // If a user is approving a draft for a period that already has a finalized record, 
        // it means they explicitly acknowledged the overlap warning in the UI to run a supplemental/correction payroll.

        this.run("UPDATE payroll_records SET status = 'approved' WHERE id = ? AND employer_id = ?", [draftId, employer.id]);


        AuditService.log({
            tableName: 'payroll_records',
            recordId: draftId,
            action: 'UPDATE',
            changesJson: JSON.stringify({ status: 'draft -> approved' }),
            calculationVersion: draft.calculationVersion
        });

        return this.getPayrollRecordById(draftId)!;
    }

    deleteDraft(draftId: number): void {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer found');

        const row = this.get<{ status: string }>('SELECT status FROM payroll_records WHERE id = ? AND employer_id = ?', [draftId, employer.id]);

        if (!row) throw new Error('Payroll not found');
        if (row.status !== 'draft') {
            throw new Error('Only draft payrolls can be deleted. Use void for approved payrolls.');
        }

        this.run('DELETE FROM payroll_records WHERE id = ? AND employer_id = ?', [draftId, employer.id]);

        AuditService.log({
            tableName: 'payroll_records',
            recordId: draftId,
            action: 'DELETE',
            changesJson: JSON.stringify({ status: 'draft', deleted: true }),
            calculationVersion: ''
        });
    }

    getDrafts(): PayrollRecord[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const rows = this.all<any>(`
            SELECT * FROM payroll_records 
            WHERE employer_id = ? AND status IN ('draft', 'approved') AND is_finalized = 0
            ORDER BY created_at DESC
        `, [employer.id]);

        const mapped = rows.map(row => ({
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
            status: row.status,
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

        // Deduplicate: if there's both draft and approved for the same period/caregiver,
        // only show the approved one
        const deduplicated: PayrollRecord[] = [];
        const seen = new Map<string, PayrollRecord>();

        for (const record of mapped) {
            const key = `${record.caregiverId}-${record.payPeriodStart}-${record.payPeriodEnd}`;
            const existing = seen.get(key);

            if (!existing) {
                seen.set(key, record);
                deduplicated.push(record);
            } else {
                // If we already have a record for this period, prefer approved over draft
                if (record.status === 'approved' && existing.status === 'draft') {
                    // Replace draft with approved
                    const index = deduplicated.indexOf(existing);
                    deduplicated[index] = record;
                    seen.set(key, record);
                }
                // Otherwise keep the existing one (either both are same status, or existing is already approved)
            }
        }

        return deduplicated;
    }

    /**
     * Calculate taxes for manual entry using full compliance engines
     */
    static async calculateManualTaxes(params: {
        caregiverId: number;
        employerId: number;
        grossAmount: number;
        payPeriodStart: string;
    }): Promise<any> {
        // Get tax year
        const year = new Date(params.payPeriodStart).getFullYear();

        // 1. Get YTD context
        const ytd = YTDService.getYTDContext(params.caregiverId, year);
        const ytdGross = ytd ? ytd.grossWages : 0;

        // 2. Get Tax Configuration and Employer Settings
        const configService = new TaxConfigurationService(getDatabase());
        const taxConfig = configService.getConfigForYear(year);

        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('Employer not found');

        // 3. Setup Tax Computer (FICA, FUTA, State)
        // Resolve Colorado SUI rate by the pay period start (provisional for preview). Manual entries
        // are finalized at creation, so the authoritative rate is resolved by payment date in
        // createManualPayroll (mirroring the finalize-time recompute).
        const manualSuiRate = SuiRateService.getRateForDate(employer.id, params.payPeriodStart);

        const taxRates: TaxRates = {
            ssRateEmployee: taxConfig.ssRateEmployee,
            ssRateEmployer: taxConfig.ssRateEmployer,
            ssWageBase: taxConfig.ssWageBase,
            medicareRateEmployee: taxConfig.medicareRateEmployee,
            medicareRateEmployer: taxConfig.medicareRateEmployer,
            futaRate: taxConfig.futaRate,
            futaWageBase: taxConfig.futaWageBase,
            coloradoSutaRate: manualSuiRate.rate,
            coloradoSutaCap: manualSuiRate.wageBase,
            coloradoFamliRate: employer.coloradoFamliRateEE,
            coloradoFamliRateER: employer.coloradoFamliRateER,
            coloradoStateIncomeTaxRate: 0.044
        };

        const taxComputer = new TaxComputer(taxRates, taxConfig.id.toString());
        const taxResult = taxComputer.calculateTaxes(params.grossAmount, ytdGross);

        // 4. Setup Federal Calculator
        const caregiver = CaregiverService.getCaregiverById(params.caregiverId);
        if (!caregiver) throw new Error('Caregiver not found');

        const w4Info: W4Information = {
            filingStatus: (caregiver.w4FilingStatus as FilingStatus) || 'single',
            multipleJobs: caregiver.w4MultipleJobs || false,
            dependentsAmount: caregiver.w4DependentsAmount || 0,
            otherIncome: caregiver.w4OtherIncome || 0,
            deductions: caregiver.w4Deductions || 0,
            extraWithholding: caregiver.w4ExtraWithholding || 0
        };

        // Default frequency to weekly for manual checks if unknown
        const frequency: PayFrequency = (employer.payFrequency as PayFrequency) || 'weekly';

        const fedResult = FederalWithholdingCalculator.calculateWithholding(
            params.grossAmount,
            frequency,
            w4Info,
            ytdGross
        );

        // 5. Net Pay
        // Net = Gross - (Employee Share of Taxes + Federal Withholding + State Tax)
        const netPay = params.grossAmount -
            taxResult.totalEmployeeWithholdings -
            fedResult.federalWithholding;

        return {
            grossWages: params.grossAmount,
            ssEmployee: taxResult.socialSecurityEmployee,
            medicareEmployee: taxResult.medicareEmployee,
            federalWithholding: fedResult.federalWithholding,
            coloradoFamliEmployee: taxResult.coloradoFamliEmployee,
            coloradoStateIncomeTax: taxResult.coloradoStateIncomeTax,
            netPay: Math.round(netPay * 100) / 100,

            // Employer Taxes
            ssEmployer: taxResult.socialSecurityEmployer,
            medicareEmployer: taxResult.medicareEmployer,
            futa: taxResult.futa,
            coloradoSuta: taxResult.coloradoSuta,
            coloradoFamliEmployer: taxResult.coloradoFamliEmployer,
        };
    }

    /**
     * Create manual payroll entry
     */
    static async createManualPayroll(params: {
        caregiverId: number;
        employerId: number;
        payPeriodStart: string;
        payPeriodEnd: string;
        description: string;
        grossAmount: number;
        paymentDate?: string;
        checkNumber?: string;
    }): Promise<PayrollRecord> {
        const db = getDatabase();

        // 1. Validator: Explicitly check all inputs
        if (params.grossAmount < 0) {
            throw new Error('Gross amount cannot be negative');
        }

        if (params.checkNumber) {
            const isDuplicate = new PayrollService(db).checkDuplicateCheckNumber(
                params.checkNumber,
                params.employerId
            );
            if (isDuplicate) {
                throw new Error(`Check number "${params.checkNumber}" is already in use`);
            }
        }

        // 2. Action: Calculate Taxes (Deterministic pure function)
        const taxes = await PayrollService.calculateManualTaxes({
            caregiverId: params.caregiverId,
            employerId: params.employerId,
            grossAmount: params.grossAmount,
            payPeriodStart: params.payPeriodStart,
        });

        // 2b. Authoritative Colorado SUI resolved by payment date (manual entries are finalized at
        // creation, so this mirrors the finalize-time recompute). SUI is employer-paid, so net pay is
        // unaffected. Snapshots the rate onto the record (FR-03) and the service address (FR-07).
        const manualPaymentDate = params.paymentDate || params.payPeriodEnd;
        const manualSuiRate = SuiRateService.getRateForDate(params.employerId, manualPaymentDate);
        if (!manualSuiRate.wageBaseConfirmed || !manualSuiRate.wageBase) {
            throw new Error(
                `Colorado SUI wage base for ${new Date(manualPaymentDate).getFullYear()} is not confirmed. ` +
                `Enter the official CDLE taxable wage base before creating manual payroll.`
            );
        }
        const manualYear = new Date(manualPaymentDate).getFullYear();
        const manualYtdRow = db.prepare(`
            SELECT SUM(gross_wages) as total
            FROM payroll_records
            WHERE caregiver_id = ? AND employer_id = ?
              AND is_finalized = 1 AND is_voided = 0
              AND substr(payment_date,1,4) = ? AND payment_date < ?
        `).get(params.caregiverId, params.employerId, String(manualYear), manualPaymentDate) as { total: number } | undefined;
        const manualYtdSuiBefore = manualYtdRow?.total || 0;
        const manualRemainingCap = Math.max(0, manualSuiRate.wageBase - manualYtdSuiBefore);
        const manualTaxableWages = Math.min(params.grossAmount, manualRemainingCap);
        const manualSuiPaid = Math.round(manualTaxableWages * manualSuiRate.rate * 100) / 100;

        // Resolve the service/work address snapshot (FR-07).
        const manualAddr = ServiceAddressService.getAddressForDate(params.caregiverId, params.payPeriodStart);
        const employerForAddr = EmployerService.getEmployer();
        let manualAddrSnapshot: string | null = null;
        if (manualAddr) {
            manualAddrSnapshot = ServiceAddressService.formatAddress(manualAddr);
        } else if (employerForAddr?.serviceAddress) {
            manualAddrSnapshot = employerForAddr.serviceAddress;
        } else if (employerForAddr) {
            manualAddrSnapshot = [
                employerForAddr.addressLine1, employerForAddr.addressLine2,
                [employerForAddr.city, employerForAddr.state].filter(Boolean).join(', '),
                employerForAddr.zip
            ].filter(Boolean).join(' ').trim() || null;
        }

        // 3. Transaction: Atomic DB State Change
        const createTransaction = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO payroll_records (
                    caregiver_id, employer_id, pay_period_start, pay_period_end,
                    total_hours, gross_wages, net_pay,
                    ss_employee, medicare_employee, federal_withholding,
                    ss_employer, medicare_employer, futa,
                    colorado_suta, colorado_famli_employee, colorado_famli_employer,
                    employer_sui_rate, employer_sui_paid, service_address_snapshot,
                    calculation_version, tax_version, is_finalized, status,
                    entry_type, manual_description, manual_gross_amount,
                    payment_date, created_at, check_number
                ) VALUES (
                    ?, ?, ?, ?,
                    0, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    'manual-1.0', 'CO-2024', 1, 'approved',
                    'manual', ?, ?,
                    ?, datetime('now'), ?
                )
            `).run(
                params.caregiverId,
                params.employerId,
                params.payPeriodStart,
                params.payPeriodEnd,
                params.grossAmount,
                taxes.netPay,
                taxes.ssEmployee,
                taxes.medicareEmployee,
                taxes.federalWithholding,
                taxes.ssEmployer,
                taxes.medicareEmployer,
                taxes.futa,
                manualSuiPaid,
                taxes.coloradoFamliEmployee,
                taxes.coloradoFamliEmployer,
                manualSuiRate.rate,
                manualSuiPaid,
                manualAddrSnapshot,
                params.description,
                params.grossAmount,
                params.paymentDate || params.payPeriodEnd,
                params.checkNumber || null
            );

            // Fetch and return created record
            const record = PayrollService.getPayrollRecordById(result.lastInsertRowid as number);
            if (!record) {
                throw new Error('Failed to create manual payroll record');
            }

            // Audit log
            AuditService.log({
                action: 'CREATE',
                tableName: 'payroll_records',
                recordId: record.id,
                changesJson: JSON.stringify({
                    type: 'manual',
                    description: params.description,
                    grossAmount: params.grossAmount,
                    caregiverId: params.caregiverId,
                    employerId: params.employerId,
                    checkNumber: params.checkNumber
                }),
            });

            return record;
        });

        return createTransaction();
    }
}

/**
 * Calculate taxes for manual payroll entry
 */
