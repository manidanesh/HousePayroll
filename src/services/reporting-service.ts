/**
 * ReportingService - Aggregates data for YTD dashboards and tax exports
 * 
 * LEGAL CONSTRAINT: This application supports Household Employers only.
 * Household employers are exempt from quarterly federal filings (Form 941).
 * All federal reporting must be aggregated annually for Schedule H. 
 * DO NOT implement quarterly federal export logic.
 */
import { getDatabase, decrypt } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { EmployerService } from './employer-service';
import * as crypto from 'crypto';

export interface YTDSummary {
    caregiverId: number;
    caregiverName: string;
    grossWages: number;
    ssEmployee: number;
    medicareEmployee: number;
    federalWithholding: number;
    netPay: number;
    ssEmployer: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta: number;
    coloradoFamliEmployee: number;
    coloradoFamliEmployer: number;
    overtimeWages: number;
    totalEmployerTaxes: number;
}

export interface TaxCapStatus {
    caregiverId: number;
    caregiverName: string;
    futaWages: number;
    futaReached: boolean;
    sutaWages: number;
    sutaReached: boolean;
}

export class ReportingService extends BaseRepository<any> {

    // Abstract implementation dummy
    create(data: Partial<any>): any { throw new Error('Not implemented'); }
    update(id: number, data: Partial<any>): any { throw new Error('Not implemented'); }
    delete(id: number): void { throw new Error('Not implemented'); }
    getById(id: number): any | null { throw new Error('Not implemented'); }

    // Static Compatibility Layer
    static getYTDSummary(year: number, caregiverId?: number): YTDSummary[] {
        return new ReportingService(getDatabase()).getYTDSummary(year, caregiverId);
    }

    static getTaxCapStatus(year: number, caregiverId?: number): TaxCapStatus[] {
        return new ReportingService(getDatabase()).getTaxCapStatus(year, caregiverId);
    }

    static generateW2CSV(year: number): string {
        return new ReportingService(getDatabase()).generateW2CSV(year);
    }

    static generateFAMLI_CSV(year: number, quarter: number): string {
        return new ReportingService(getDatabase()).generateFAMLI_CSV(year, quarter);
    }

    static generateScheduleHSUM(year: number): string {
        return new ReportingService(getDatabase()).generateScheduleHSUM(year);
    }

    static getScheduleHData(year: number): any {
        return new ReportingService(getDatabase()).getScheduleHData(year);
    }

    static getMonthlyWageTrends(year: number, caregiverId?: number): any[] {
        return new ReportingService(getDatabase()).getMonthlyWageTrends(year, caregiverId);
    }

    static getRecentPayments(limit = 20): any[] {
        return new ReportingService(getDatabase()).getRecentPayments(limit);
    }

    static logExport(type: string, year: number, quarter: number | null, filename: string, content: string): void {
        new ReportingService(getDatabase()).logExport(type, year, quarter, filename, content);
    }

    // Instance Methods

    getYTDSummary(year: number, caregiverId?: number): YTDSummary[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        let query = `
            SELECT 
                c.id as caregiver_id,
                c.full_legal_name as caregiver_name,
                SUM(pr.gross_wages) as gross_wages,
                SUM(pr.ss_employee) as ss_employee,
                SUM(pr.medicare_employee) as medicare_employee,
                SUM(pr.federal_withholding) as federal_withholding,
                SUM(pr.net_pay) as net_pay,
                SUM(pr.ss_employer) as ss_employer,
                SUM(pr.medicare_employer) as medicare_employer,
                SUM(pr.futa) as futa,
                SUM(pr.colorado_suta) as colorado_suta,
                SUM(pr.colorado_famli_employee) as colorado_famli_employee,
                SUM(pr.colorado_famli_employer) as colorado_famli_employer,
                SUM(pr.overtime_wages) as overtime_wages
            FROM caregivers c
            LEFT JOIN payroll_records pr ON c.id = pr.caregiver_id
            WHERE pr.employer_id = ? AND pr.pay_period_end BETWEEN ? AND ? AND pr.is_finalized = 1 AND pr.is_voided = 0
        `;
        const params: any[] = [employer.id, startDate, endDate];

        if (caregiverId) {
            query += ` AND c.id = ?`;
            params.push(caregiverId);
        }

        query += ` GROUP BY c.id`;

        const rows = this.all<any>(query, params);

        return rows.map(row => ({
            caregiverId: row.caregiver_id,
            caregiverName: row.caregiver_name,
            grossWages: row.gross_wages || 0,
            ssEmployee: row.ss_employee || 0,
            medicareEmployee: row.medicare_employee || 0,
            federalWithholding: row.federal_withholding || 0,
            netPay: row.net_pay || 0,
            ssEmployer: row.ss_employer || 0,
            medicareEmployer: row.medicare_employer || 0,
            futa: row.futa || 0,
            coloradoSuta: row.colorado_suta || 0,
            coloradoFamliEmployee: row.colorado_famli_employee || 0,
            coloradoFamliEmployer: row.colorado_famli_employer || 0,
            overtimeWages: row.overtime_wages || 0,
            totalEmployerTaxes: (row.ss_employer || 0) + (row.medicare_employer || 0) + (row.futa || 0) + (row.colorado_suta || 0) + (row.colorado_famli_employer || 0)
        }));
    }

    getTaxCapStatus(year: number, caregiverId?: number): TaxCapStatus[] {
        const ytd = this.getYTDSummary(year, caregiverId);

        return ytd.map(item => ({
            caregiverId: item.caregiverId,
            caregiverName: item.caregiverName,
            futaWages: Math.min(item.grossWages, 7000),
            futaReached: item.grossWages >= 7000,
            sutaWages: Math.min(item.grossWages, 16000),
            sutaReached: item.grossWages >= 16000
        }));
    }

    generateW2CSV(year: number): string {
        const data = this.getYTDSummary(year);
        const headers = ['Employee Name', 'Gross Wages', 'Social Security Tax', 'Medicare Tax', 'Federal Income Tax', 'CO FAMLI (EE)'];

        const rows = data.map(item => [
            item.caregiverName,
            item.grossWages.toFixed(2),
            item.ssEmployee.toFixed(2),
            item.medicareEmployee.toFixed(2),
            item.federalWithholding.toFixed(2),
            item.coloradoFamliEmployee.toFixed(2)
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    generateFAMLI_CSV(year: number, quarter: number): string {
        const employer = EmployerService.getEmployer();
        if (!employer) return '';

        const quarterDates = [
            { start: `${year}-01-01`, end: `${year}-03-31` },
            { start: `${year}-04-01`, end: `${year}-06-30` },
            { start: `${year}-07-01`, end: `${year}-09-30` },
            { start: `${year}-10-01`, end: `${year}-12-31` }
        ];

        const { start, end } = quarterDates[quarter - 1];

        const rows = this.all<any>(`
            SELECT 
                c.full_legal_name,
                c.ssn_encrypted,
                SUM(pr.gross_wages) as gross_wages,
                SUM(pr.colorado_famli_employee) as ee_share,
                SUM(pr.colorado_famli_employer) as er_share
            FROM caregivers c
            JOIN payroll_records pr ON c.id = pr.caregiver_id
            WHERE pr.employer_id = ? AND pr.pay_period_end BETWEEN ? AND ? AND pr.is_finalized = 1 AND pr.is_voided = 0
            GROUP BY c.id
        `, [employer.id, start, end]);

        const headers = ['Employee Name', 'SSN', 'Gross Wages', 'EE Contribution', 'Employer Contribution'];
        const csvRows = rows.map(row => {
            return [
                row.full_legal_name,
                decrypt(row.ssn_encrypted),
                (row.gross_wages || 0).toFixed(2),
                (row.ee_share || 0).toFixed(2),
                (row.er_share || 0).toFixed(2)
            ];
        });

        return [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    }

    generateScheduleHSUM(year: number): string {
        const data = this.getYTDSummary(year);
        const totals = data.reduce((acc, curr) => ({
            gross: acc.gross + curr.grossWages,
            ss: acc.ss + curr.ssEmployee + curr.ssEmployer,
            med: acc.med + curr.medicareEmployee + curr.medicareEmployer,
            futa: acc.futa + curr.futa
        }), { gross: 0, ss: 0, med: 0, futa: 0 });

        const headers = ['Total Gross Wages', 'Total Social Security (Emp+Empr)', 'Total Medicare (Emp+Empr)', 'Total FUTA'];
        const row = [
            totals.gross.toFixed(2),
            totals.ss.toFixed(2),
            totals.med.toFixed(2),
            totals.futa.toFixed(2)
        ];

        return [headers.join(','), row.join(',')].join('\n');
    }

    getScheduleHData(year: number): {
        line1: number;
        line2: number;
        line3: number;
        line4: number;
        line6: number;
        line8: number;
        line9: number;
        line10: number;
        line11: number;
        line12: number;
        line13: number;
        line26: number;
    } {
        const ytd = this.getYTDSummary(year);

        // thresholds for 2024
        const ssThreshold = 2700;

        const totals = ytd.reduce((acc, curr) => {
            if (curr.grossWages >= ssThreshold) {
                acc.ssWages += curr.grossWages;
                acc.ssTax += (curr.ssEmployee + curr.ssEmployer);
            }
            acc.medWages += curr.grossWages;
            acc.medTax += (curr.medicareEmployee + curr.medicareEmployer);
            acc.fit += curr.federalWithholding;
            acc.futaWages += Math.min(curr.grossWages, 7000);
            acc.futaTax += curr.futa;
            return acc;
        }, { ssWages: 0, ssTax: 0, medWages: 0, medTax: 0, fit: 0, futaWages: 0, futaTax: 0 });

        return {
            line1: totals.ssWages,
            line2: totals.ssTax,
            line3: totals.medWages,
            line4: totals.medTax,
            line6: totals.fit,
            line8: totals.ssTax + totals.medTax + totals.fit,
            line9: totals.ssTax + totals.medTax + totals.fit,
            line10: totals.futaWages,
            line11: totals.futaWages * 0.06,
            line12: (totals.futaWages * 0.06) - totals.futaTax, // Estimated Credit
            line13: totals.futaTax, // Final FUTA Tax
            line26: totals.ssTax + totals.medTax + totals.fit + totals.futaTax
        };
    }

    getMonthlyWageTrends(year: number, caregiverId?: number): Array<{
        month: string;
        grossWages: number;
        netPay: number;
        hours: number;
    }> {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        const data: any[] = [];

        for (let i = 1; i <= 12; i++) {
            const monthStr = i.toString().padStart(2, '0');
            const start = `${year}-${monthStr}-01`;
            const end = `${year}-${monthStr}-31`;

            let query = `
                SELECT SUM(gross_wages) as total 
                FROM payroll_records 
                WHERE employer_id = ? AND pay_period_end BETWEEN ? AND ? AND is_finalized = 1 AND is_voided = 0
            `;
            const params: any[] = [employer.id, start, end];

            if (caregiverId) {
                query += ` AND caregiver_id = ?`;
                params.push(caregiverId);
            }

            const row = this.get<any>(query, params);

            data.push({
                name: months[i - 1],
                wages: row?.total || 0,
            });
        }
        return data;
    }

    getRecentPayments(limit = 20): Array<{
        id: number;
        caregiverId: number;
        caregiverName: string;
        amount: number;
        status: string;
        createdAt: string;
    }> {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        return this.all<any>(`
            SELECT pr.*, c.full_legal_name as caregiver_name
            FROM payroll_records pr
            JOIN caregivers c ON pr.caregiver_id = c.id
            WHERE pr.employer_id = ?
            ORDER BY pr.pay_period_end DESC
            LIMIT ?
        `, [employer.id, limit]);
    }

    logExport(type: string, year: number, quarter: number | null, filename: string, content: string): void {
        const employer = EmployerService.getEmployer();
        if (!employer) return;

        const contentHash = crypto.createHash('sha256').update(content).digest('hex');

        this.run(`
            INSERT INTO export_logs (employer_id, type, year, quarter, filename, content_hash)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [employer.id, type, year, quarter, filename, contentHash]);

        console.log(`[Audit] Logged ${type} export for ${year} Q${quarter || 'N/A'}: ${filename}`);
    }
}
