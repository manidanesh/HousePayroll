import { getDatabase } from '../database/db';
import { ReportingService } from './reporting-service';
import { EmployerService } from './employer-service';

export interface ColoradoQuarterlyData {
    caregiverId: number;
    caregiverName: string;
    ssn: string;
    totalWages: number;
    priorYtdWages: number;
    hoursWorked: number;
    eeContribution: number;
    erContribution: number;
    references: string;
}

export class ColoradoTaxService {
    /**
     * Get aggregated data for a specific quarter
     * @param year Year (e.g., 2025)
     * @param quarter 1-4
     */
    static getQuarterlyData(year: number, quarter: number): ColoradoQuarterlyData[] {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const startMonth = (quarter - 1) * 3 + 1;
        const endMonth = quarter * 3;

        const startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`;
        const endDate = `${year}-${endMonth.toString().padStart(2, '0')}-31`;

        const cleanRows = db.prepare(`
            SELECT 
                c.id,
                c.full_legal_name,
                c.ssn_encrypted,
                SUM(CASE WHEN pr.pay_period_end >= ? THEN pr.gross_wages ELSE 0 END) as total_wages,
                SUM(CASE WHEN pr.pay_period_end < ? THEN pr.gross_wages ELSE 0 END) as prior_ytd_wages,
                SUM(CASE WHEN pr.pay_period_end >= ? THEN pr.total_hours ELSE 0 END) as total_hours,
                SUM(CASE WHEN pr.pay_period_end >= ? THEN pr.colorado_famli_employee ELSE 0 END) as ee_contribution,
                SUM(CASE WHEN pr.pay_period_end >= ? THEN pr.colorado_famli_employer ELSE 0 END) as er_contribution,
                GROUP_CONCAT(COALESCE(pr.check_number, 'N/A'), '; ') as all_references
            FROM caregivers c
            JOIN payroll_records pr ON c.id = pr.caregiver_id
            WHERE pr.employer_id = ? 
              AND pr.pay_period_end BETWEEN ? AND ? 
              AND pr.is_finalized = 1 
              AND pr.is_voided = 0
            GROUP BY c.id
        `).all(startDate, startDate, startDate, startDate, startDate, employer.id, `${year}-01-01`, endDate) as any[];

        return cleanRows.map(row => ({
            caregiverId: row.id,
            caregiverName: row.full_legal_name,
            ssn: row.ssn_encrypted,
            totalWages: row.total_wages || 0,
            priorYtdWages: row.prior_ytd_wages || 0,
            hoursWorked: row.total_hours || 0,
            eeContribution: row.ee_contribution || 0,
            erContribution: row.er_contribution || 0,
            references: row.all_references || 'N/A'
        }));
    }

    /**
     * Generate CSV for Colorado MyUI+ (SUI)
     * Format: FEIN, EAN, Quarter, Year, SSN, Last Name, First Name, Middle Initial, Total Wages, Excess Wages, Taxable Wages, SUI Tax Due, Reference
     */
    static generateSUI_CSV(ean: string, fein: string, quarter: number, year: number, data: ColoradoQuarterlyData[]): string {
        const employer = EmployerService.getEmployer();
        const wageBase = employer?.suiWageBase || 16000;
        const suiRate = employer?.coloradoSutaRate || 0.0;

        const headers = ['FEIN', 'EAN', 'Quarter', 'Year', 'SSN', 'Last Name', 'First Name', 'Middle Initial', 'Total Wages', 'Excess Wages', 'Taxable Wages', 'SUI Tax Due', 'Reference'];
        const rows = data.map(item => {
            const names = item.caregiverName.split(' ');
            const firstName = names[0] || '';
            const lastName = names[names.length - 1] || '';
            const middleInitial = names.length > 2 ? names[1][0] : '';

            const totalWages = item.totalWages;
            const priorWages = item.priorYtdWages;

            const taxableBefore = Math.min(priorWages, wageBase);
            const taxableAfter = Math.min(priorWages + totalWages, wageBase);
            const taxableThisQuarter = Math.max(0, taxableAfter - taxableBefore);
            const excessThisQuarter = Math.max(0, totalWages - taxableThisQuarter);
            const suiTaxDue = taxableThisQuarter * suiRate;

            return [
                fein,
                ean,
                `Q${quarter}`,
                year.toString(),
                item.ssn,
                lastName,
                firstName,
                middleInitial,
                totalWages.toFixed(2),
                excessThisQuarter.toFixed(2),
                taxableThisQuarter.toFixed(2),
                suiTaxDue.toFixed(2),
                item.references
            ];
        });

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    /**
     * Generate CSV for Colorado My FAMLI+
     * Format: SSN, First Name, Middle Name, Last Name, Wages, Hours Worked
     */
    static generateFAMLI_CSV(data: ColoradoQuarterlyData[]): string {
        const headers = ['Employee Name', 'SSN', 'Gross Wages', 'EE Contribution', 'Employer Contribution'];
        const rows = data.map(item => {
            return [
                item.caregiverName,
                item.ssn, // SSN should be decrypted by caller
                item.totalWages.toFixed(2),
                item.eeContribution.toFixed(2),
                item.erContribution.toFixed(2)
            ];
        });

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
}
