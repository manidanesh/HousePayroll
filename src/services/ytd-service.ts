/**
 * YTDService - Year-to-Date calculations and tracking
 * 
 * Handles all YTD wage and tax calculations for payroll processing.
 * Separated from PayrollService for better organization and testability.
 */

import { getDatabase } from '../database/db';
import { EmployerService } from './employer-service';

export interface YTDContext {
    grossWages: number;
    regularHours: number;
    regularWages: number;
    weekendHours: number;
    weekendWages: number;
    holidayHours: number;
    holidayWages: number;
    overtimeHours: number;
    overtimeWages: number;
    ssEmployee: number;
    medicareEmployee: number;
    federalWithholding: number;
    coloradoFamliEmployee: number;
    netPay: number;
    ssEmployer: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta: number;
    coloradoFamliEmployer: number;
}

export class YTDService {
    /**
     * Get YTD Gross Wages for a caregiver
     * Returns the sum of gross wages for all finalized payroll records in the current year
     * 
     * @param caregiverId - ID of the caregiver
     * @param year - Tax year (e.g., 2024)
     * @returns Total gross wages YTD
     */
    static getYTDGrossWages(caregiverId: number, year: number): number {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return 0;

        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        const row = db.prepare(`
            SELECT SUM(gross_wages) as total 
            FROM payroll_records 
            WHERE caregiver_id = ? AND employer_id = ? AND pay_period_end BETWEEN ? AND ? AND is_finalized = 1 AND is_voided = 0
        `).get(caregiverId, employer.id, start, end) as { total: number };
        return row?.total || 0;
    }

    /**
     * Get YTD Context for data prior to current calculation (for UI preview)
     * 
     * @param caregiverId - ID of the caregiver
     * @param year - Tax year
     * @returns YTD totals for all categories
     */
    static getYTDContext(caregiverId: number, year: number): YTDContext | null {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return null;

        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;

        // Summing all finalized records for this caregiver/employer in this year
        const ytd = db.prepare(`
            SELECT 
                SUM(gross_wages) as grossWages,
                SUM(regular_hours) as regularHours,
                SUM(regular_wages) as regularWages,
                SUM(weekend_hours) as weekendHours,
                SUM(weekend_wages) as weekendWages,
                SUM(holiday_hours) as holidayHours,
                SUM(holiday_wages) as holidayWages,
                SUM(overtime_hours) as overtimeHours,
                SUM(overtime_wages) as overtimeWages,
                SUM(ss_employee) as ssEmployee,
                SUM(medicare_employee) as medicareEmployee,
                SUM(federal_withholding) as federalWithholding,
                SUM(colorado_famli_employee) as coloradoFamliEmployee,
                SUM(net_pay) as netPay,
                SUM(ss_employer) as ssEmployer,
                SUM(medicare_employer) as medicareEmployer,
                SUM(futa) as futa,
                SUM(colorado_suta) as coloradoSuta
            FROM payroll_records 
            WHERE caregiver_id = ? 
            AND employer_id = ? 
            AND pay_period_end BETWEEN ? AND ? 
            AND is_finalized = 1 
            AND is_voided = 0
        `).get(
            caregiverId,
            employer.id,
            yearStart,
            yearEnd
        ) as any;

        return {
            grossWages: ytd.grossWages || 0,
            regularHours: ytd.regularHours || 0,
            regularWages: ytd.regularWages || 0,
            weekendHours: ytd.weekendHours || 0,
            weekendWages: ytd.weekendWages || 0,
            holidayHours: ytd.holidayHours || 0,
            holidayWages: ytd.holidayWages || 0,
            overtimeHours: ytd.overtimeHours || 0,
            overtimeWages: ytd.overtimeWages || 0,
            ssEmployee: ytd.ssEmployee || 0,
            medicareEmployee: ytd.medicareEmployee || 0,
            federalWithholding: ytd.federalWithholding || 0,
            coloradoFamliEmployee: ytd.coloradoFamliEmployee || 0,
            netPay: ytd.netPay || 0,
            ssEmployer: ytd.ssEmployer || 0,
            medicareEmployer: ytd.medicareEmployer || 0,
            futa: ytd.futa || 0,
            coloradoSuta: ytd.coloradoSuta || 0,
            coloradoFamliEmployer: ytd.coloradoFamliEmployer || 0
        };
    }

    /**
     * Get comprehensive YTD data for a specific payroll record (for paystub generation)
     * Includes all YTD totals up to and including the specified record
     * 
     * @param caregiverId - ID of the caregiver
     * @param employerId - ID of the employer
     * @param recordId - ID of the payroll record
     * @param payPeriodEnd - End date of the pay period
     * @returns YTD totals including the current record
     */
    static getYTDForPaystub(
        caregiverId: number,
        employerId: number,
        recordId: number,
        payPeriodEnd: string
    ): YTDContext {
        const db = getDatabase();
        const yearStart = `${payPeriodEnd.substring(0, 4)}-01-01`;

        // Summing all finalized records for this caregiver/employer in this year up to this record's end date
        const ytd = db.prepare(`
            SELECT 
                SUM(gross_wages) as grossWages,
                SUM(regular_hours) as regularHours,
                SUM(regular_wages) as regularWages,
                SUM(weekend_hours) as weekendHours,
                SUM(weekend_wages) as weekendWages,
                SUM(holiday_hours) as holidayHours,
                SUM(holiday_wages) as holidayWages,
                SUM(overtime_hours) as overtimeHours,
                SUM(overtime_wages) as overtimeWages,
                SUM(ss_employee) as ssEmployee,
                SUM(medicare_employee) as medicareEmployee,
                SUM(federal_withholding) as federalWithholding,
                SUM(colorado_famli_employee) as coloradoFamliEmployee,
                SUM(net_pay) as netPay,
                SUM(ss_employer) as ssEmployer,
                SUM(medicare_employer) as medicareEmployer,
                SUM(futa) as futa,
                SUM(colorado_suta) as coloradoSuta,
                SUM(colorado_famli_employer) as coloradoFamliEmployer
            FROM payroll_records 
            WHERE caregiver_id = ? 
            AND employer_id = ? 
            AND pay_period_end BETWEEN ? AND ? 
            AND (is_finalized = 1 OR id = ?)
            AND is_voided = 0
        `).get(
            caregiverId,
            employerId,
            yearStart,
            payPeriodEnd,
            recordId
        ) as any;

        return {
            grossWages: ytd.grossWages || 0,
            regularHours: ytd.regularHours || 0,
            regularWages: ytd.regularWages || 0,
            weekendHours: ytd.weekendHours || 0,
            weekendWages: ytd.weekendWages || 0,
            holidayHours: ytd.holidayHours || 0,
            holidayWages: ytd.holidayWages || 0,
            overtimeHours: ytd.overtimeHours || 0,
            overtimeWages: ytd.overtimeWages || 0,
            ssEmployee: ytd.ssEmployee || 0,
            medicareEmployee: ytd.medicareEmployee || 0,
            federalWithholding: ytd.federalWithholding || 0,
            coloradoFamliEmployee: ytd.coloradoFamliEmployee || 0,
            netPay: ytd.netPay || 0,
            ssEmployer: ytd.ssEmployer || 0,
            medicareEmployer: ytd.medicareEmployer || 0,
            futa: ytd.futa || 0,
            coloradoSuta: ytd.coloradoSuta || 0,
            coloradoFamliEmployer: ytd.coloradoFamliEmployer || 0
        };
    }
}
