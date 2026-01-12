/**
 * YearEndService - Coordinates annual tax package generation
 * 
 * LEGAL CONSTRAINT: This application is for Household Employers.
 * Federal taxes are reported ANNUALLY on IRS Schedule H (Form 1040).
 * Quarterly federal filings (Form 941) are NOT required and must not be generated.
 */
import AdminZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { ReportingService } from './reporting-service';
import { getDatabase } from '../database/db';
import { EmployerService } from './employer-service';
import PDFDocument from 'pdfkit';

export class YearEndService {
    /**
     * Generates a consolidated ZIP package for a given year
     */
    static async generateExportPackage(year: number, destPath: string): Promise<void> {
        const zip = new AdminZip();

        // 1. Generate YTD Summary CSV
        const ytdCsv = ReportingService.generateW2CSV(year);
        zip.addFile('YTD_Summary_W2_Data.csv', Buffer.from(ytdCsv, 'utf8'));

        // 2. Generate Schedule H Summary CSV
        const schHCsv = ReportingService.generateScheduleHSUM(year);
        zip.addFile('Schedule_H_Summary.csv', Buffer.from(schHCsv, 'utf8'));

        // 2b. Add Compliance Audit Info (Workers' Comp)
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (employer) {
            const auditInfo = [
                'HOUSEHOLD PAYROLL COMPLIANCE AUDIT INFO',
                '=======================================',
                `Year: ${year}`,
                `Employer: ${employer.displayName}`,
                `Export Date: ${new Date().toISOString()}`,
                '',
                'COLORADO WORKERS\' COMPENSATION STATUS',
                '---------------------------------------',
                `Acknowledged: ${employer.wcAcknowledged ? 'YES' : 'NO'}`,
                `Carrier: ${employer.wcCarrier || 'N/A'}`,
                `Policy #: ${employer.wcPolicyNumber || 'N/A'}`,
                `Acknowledged Date: ${employer.wcAcknowledgmentDate ? new Date(employer.wcAcknowledgmentDate).toLocaleDateString() : 'N/A'}`,
                '',
                'COLORADO SUI CONFIGURATION',
                '---------------------------------------',
                `SUI Account: ${employer.uiAccountNumber ? '••••' + employer.uiAccountNumber.slice(-4) : 'Not Set'}`,
                `SUI Rate: ${(employer.coloradoSutaRate * 100).toFixed(3)}%`,
                `Effective Date: ${employer.suiEffectiveDate || 'N/A'}`,
                '',
                'FEDERAL I-9 COMPLIANCE RECORDS',
                '---------------------------------------',
            ];

            const caregivers = db.prepare('SELECT full_legal_name, i9_completed, i9_completion_date, i9_notes FROM caregivers WHERE employer_id = ?').all(employer.id) as any[];
            caregivers.forEach(c => {
                auditInfo.push(`Caregiver: ${c.full_legal_name}`);
                auditInfo.push(`  - I-9 Completed: ${c.i9_completed ? 'YES' : 'NO'}`);
                auditInfo.push(`  - Completion Date: ${c.i9_completion_date || 'N/A'}`);
                if (c.i9_notes) auditInfo.push(`  - Notes: ${c.i9_notes}`);
                auditInfo.push('');
            });

            zip.addFile('Compliance_Audit_Summary.txt', Buffer.from(auditInfo.join('\n'), 'utf8'));
        }

        // 3. Generate individual Paystub PDFs
        if (!employer) return;

        const records = db.prepare(`
            SELECT pr.*, c.full_legal_name, c.ssn_encrypted 
            FROM payroll_records pr
            JOIN caregivers c ON pr.caregiver_id = c.id
            WHERE pr.employer_id = ? AND pr.pay_period_end BETWEEN ? AND ? AND pr.is_finalized = 1 AND pr.is_voided = 0
        `).all(employer.id, `${year}-01-01`, `${year}-12-31`) as any[];

        const paystubsFolder = 'Paystubs/';

        for (const record of records) {
            const pdfBuffer = await this.generatePaystubPDF(record);
            const fileName = `${record.full_legal_name.replace(/ /g, '_')}_Paystub_${record.pay_period_end}.pdf`;
            zip.addFile(path.join(paystubsFolder, fileName), pdfBuffer);
        }

        // 4. Write the ZIP file
        zip.writeZip(destPath);
    }

    /**
     * Simple PDF generation using pdfkit
     */
    private static async generatePaystubPDF(record: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50 });
            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Header
            doc.fontSize(20).text('VOICE/HOUSEHOLD WAGE STATEMENT', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Employee: ${record.full_legal_name}`);
            doc.text(`Period: ${record.pay_period_start} to ${record.pay_period_end}`);
            if (record.check_number) doc.text(`Check/Ref #: ${record.check_number}`);
            doc.moveDown();

            // Earnings
            doc.fontSize(14).text('EARNINGS', { underline: true });
            doc.fontSize(12);
            doc.text(`Gross Wages: $${record.gross_wages.toFixed(2)}`);
            if (record.overtime_wages > 0) doc.text(`  - Incl. Overtime: $${record.overtime_wages.toFixed(2)} (${record.overtime_hours} hrs)`);
            doc.moveDown();

            // Deductions
            doc.fontSize(14).text('DEDUCTIONS', { underline: true });
            doc.fontSize(12);
            doc.text(`Social Security: -$${record.ss_employee.toFixed(2)}`);
            doc.text(`Medicare: -$${record.medicare_employee.toFixed(2)}`);
            if (record.federal_withholding > 0) doc.text(`Fed Withholding: -$${record.federal_withholding.toFixed(2)}`);
            if (record.colorado_famli_employee > 0) doc.text(`CO FAMLI (EE): -$${record.colorado_famli_employee.toFixed(2)}`);
            doc.moveDown();

            // Net Pay
            doc.fontSize(16).text(`NET PAY: $${record.net_pay.toFixed(2)}`, { align: 'right' });

            doc.end();
        });
    }
}
