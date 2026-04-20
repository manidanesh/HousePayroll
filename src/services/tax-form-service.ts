/**
 * TaxFormService — Central orchestrator for tax form PDF generation
 *
 * Generates legally correct W-2, Schedule H, and DR 1093 PDFs
 * using data from the payroll database.
 */
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { getDatabase, decrypt } from '../database/db';
import { EmployerService } from './employer-service';
import { CaregiverService } from './caregiver-service';
import { ReportingService } from './reporting-service';
import { W2Service } from './w2-service';
import { TaxPaymentService } from './tax-payment-service';
import { Caregiver } from '../types';

export type FormType = 'W2' | 'SCHEDULE_H' | 'DR_1093';

export interface TaxFormLogEntry {
    id: number;
    formType: FormType;
    taxYear: number;
    caregiverId?: number;
    caregiverName?: string;
    generatedAt: string;
    filePath?: string;
}

function fmt(n: number): string { return `$${n.toFixed(2)}`; }

export class TaxFormService {

    // ── W-2 ────────────────────────────────────────────────────────────────

    /** Generate a single caregiver W-2 as a Buffer */
    static async generateW2Buffer(year: number, caregiverId: number): Promise<Buffer> {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('Employer not found');

        const caregiver = CaregiverService.getCaregiverById(caregiverId);
        if (!caregiver) throw new Error('Caregiver not found');

        // Decrypt sensitive fields
        const decryptedCaregiver: Caregiver = {
            ...caregiver,
            ssn: decrypt(caregiver.ssn),
        };
        const decryptedEmployer = {
            ...employer,
            ssnOrEin: decrypt(employer.ssnOrEin),
        };

        return W2Service.generateW2Buffer(year, decryptedCaregiver, decryptedEmployer as any);
    }

    /** Generate W-2 PDFs for ALL active caregivers, returns array of { name, buffer } */
    static async generateAllW2Buffers(year: number): Promise<Array<{ caregiverName: string; buffer: Buffer }>> {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('Employer not found');

        const caregivers = CaregiverService.getAllCaregivers();
        const decryptedEmployer = {
            ...employer,
            ssnOrEin: decrypt(employer.ssnOrEin),
        };

        const results: Array<{ caregiverName: string; buffer: Buffer }> = [];
        for (const cg of caregivers) {
            try {
                const decryptedCg: Caregiver = { ...cg, ssn: decrypt(cg.ssn) };
                const buffer = await W2Service.generateW2Buffer(year, decryptedCg, decryptedEmployer as any);
                results.push({ caregiverName: cg.fullLegalName, buffer });
                TaxFormService.logGeneration('W2', year, cg.id, cg.fullLegalName);
            } catch (err) {
                console.warn(`[TaxFormService] Skipping W-2 for ${cg.fullLegalName}: ${err}`);
            }
        }
        return results;
    }

    // ── Schedule H ─────────────────────────────────────────────────────────

    /** Generate IRS Schedule H (Form 1040) pre-fill PDF as a Buffer */
    static async generateScheduleHBuffer(year: number): Promise<Buffer> {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('Employer not found');

        const data = ReportingService.getScheduleHData(year);
        const empName = employer.displayName;
        const ein = decrypt(employer.ssnOrEin);

        return new Promise<Buffer>((resolve, reject) => {
            const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
            const buffers: Buffer[] = [];
            doc.on('data', (d: Buffer) => buffers.push(d));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const COL1 = 50;
            const PAGE_W = 512;
            const HALF = PAGE_W / 2;

            // Header
            doc.fontSize(15).font('Helvetica-Bold')
                .text('Schedule H (Form 1040)', COL1, 50, { align: 'center', width: PAGE_W });
            doc.fontSize(11).font('Helvetica')
                .text('Household Employment Taxes', COL1, 70, { align: 'center', width: PAGE_W });
            doc.fontSize(10).fillColor('#555')
                .text(`Tax Year: ${year}`, COL1, 90, { align: 'center', width: PAGE_W });

            doc.moveTo(COL1, 108).lineTo(COL1 + PAGE_W, 108).stroke('#aaa');

            // Employer info
            let y = 116;
            doc.fontSize(9).fillColor('#666').text('Employer Name', COL1, y);
            doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text(empName, COL1, y + 10);
            doc.fontSize(9).fillColor('#666').text('EIN', COL1 + HALF, y);
            doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text(ein, COL1 + HALF, y + 10);
            y += 34;

            doc.moveTo(COL1, y).lineTo(COL1 + PAGE_W, y).stroke('#ccc');
            y += 10;

            // Pre-screening
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#234').text('Pre-Screening Checklist', COL1, y);
            y += 16;
            const qa = data.questionA ? '✅' : '☐';
            const qb = data.questionB ? '✅' : '☐';
            const qc = data.questionC ? '✅' : '☐';
            doc.fontSize(9).font('Helvetica').fillColor('#000')
                .text(`${qa} Question A: Any employee paid ≥ FICA threshold?`, COL1, y)
                .text(`${qb} Question B: Federal income tax withheld?`, COL1, y + 14)
                .text(`${qc} Question C: Total wages ≥ $1,000 in any calendar quarter?`, COL1, y + 28);
            y += 48;

            doc.moveTo(COL1, y).lineTo(COL1 + PAGE_W, y).stroke('#ccc');
            y += 10;

            // Part I
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#234').text('Part I — Social Security, Medicare, and Federal Income Taxes', COL1, y);
            y += 18;

            const rows: [string, string, string][] = [
                ['Line 1', 'Total cash wages subject to Social Security tax', fmt(data.line1)],
                ['Line 2', 'Social Security taxes (Line 1 × 12.4%)', fmt(data.line2)],
                ['Line 3', 'Total cash wages subject to Medicare tax', fmt(data.line3)],
                ['Line 4', 'Medicare taxes (Line 3 × 2.9%)', fmt(data.line4)],
                ['Line 5', 'Wages subject to Additional Medicare Tax (> $200k)', fmt(data.line5)],
                ['Line 6', 'Additional Medicare Tax withheld (Line 5 × 0.9%)', fmt(data.line6)],
                ['Line 7', 'Federal income tax withheld', fmt(data.line7)],
                ['Line 8', 'TOTAL — Lines 2 + 4 + 6 + 7', fmt(data.line8)],
            ];

            for (const [lineNum, desc, val] of rows) {
                const isTotal = lineNum === 'Line 8';
                if (isTotal) {
                    doc.rect(COL1, y - 2, PAGE_W, 20).fillColor('#f0f4ff').stroke('#aac');
                    doc.fillColor('#000');
                }
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#336')
                    .text(lineNum, COL1 + 4, y, { width: 50 });
                doc.fontSize(9).font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000')
                    .text(desc, COL1 + 58, y, { width: PAGE_W - 160 });
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
                    .text(val, COL1 + PAGE_W - 80, y, { width: 80, align: 'right' });
                y += 18;
            }

            y += 10;
            doc.moveTo(COL1, y).lineTo(COL1 + PAGE_W, y).stroke('#ccc');
            y += 10;

            // Part II
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#234').text('Part II — Federal Unemployment (FUTA) Tax', COL1, y);
            y += 18;

            const futaRows: [string, string, string][] = [
                ['Line 15', 'Total cash wages subject to FUTA (capped at $7,000/employee)', fmt(data.line15)],
                ['Line 16', 'FUTA Tax (Line 15 × 0.6%)', fmt(data.line16)],
            ];
            for (const [lineNum, desc, val] of futaRows) {
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#336')
                    .text(lineNum, COL1 + 4, y, { width: 50 });
                doc.fontSize(9).font('Helvetica').fillColor('#000')
                    .text(desc, COL1 + 58, y, { width: PAGE_W - 160 });
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
                    .text(val, COL1 + PAGE_W - 80, y, { width: 80, align: 'right' });
                y += 18;
            }

            y += 10;
            doc.moveTo(COL1, y).lineTo(COL1 + PAGE_W, y).stroke('#ccc');
            y += 10;

            // Part III — Total
            doc.rect(COL1, y - 2, PAGE_W, 22).fillColor('#1a3a6c').stroke('#1a3a6c');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff')
                .text('Line 26 — Total Household Employment Taxes Due', COL1 + 8, y + 2, { width: PAGE_W - 120 });
            doc.fontSize(13).font('Helvetica-Bold').fillColor('#fff')
                .text(fmt(data.line26), COL1 + PAGE_W - 100, y + 2, { width: 96, align: 'right' });
            y += 30;

            // Disclaimer
            doc.fontSize(7.5).font('Helvetica').fillColor('#888')
                .text(
                    `Generated by Household Payroll App — ${new Date().toLocaleDateString()} | Tax Year ${year} | ` +
                    'Enter these values on IRS Schedule H (Form 1040). ' +
                    'File Schedule H with your personal Form 1040 by April 15.',
                    COL1, y + 14, { width: PAGE_W }
                );

            doc.end();
        });
    }

    // ── DR 1093 ────────────────────────────────────────────────────────────

    /** Generate Colorado DR 1093 (Annual W-2 Transmittal) pre-fill PDF as a Buffer */
    static async generateDR1093Buffer(year: number): Promise<Buffer> {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('Employer not found');

        const db = getDatabase();
        const caregivers = CaregiverService.getAllCaregivers();

        // Sum of colorado_state_income_tax from all finalized records for the year
        const row = db.prepare<[number, string, string]>(`
            SELECT 
                COUNT(DISTINCT caregiver_id) as w2_count,
                COALESCE(SUM(colorado_state_income_tax), 0) as total_co_sit
            FROM payroll_records
            WHERE employer_id = ?
              AND pay_period_end BETWEEN ? AND ?
              AND is_finalized = 1
              AND is_voided = 0
        `).get(employer.id, `${year}-01-01`, `${year}-12-31`) as any;

        const w2Count = row?.w2_count ?? 0;
        const line1 = row?.total_co_sit ?? 0;

        // Line 2: use real payment data from TaxPaymentService
        const paymentSummary = TaxPaymentService.getSummary(year);
        const line2 = paymentSummary.totalRemitted;
        const hasRealLine2 = line2 > 0;

        const diff = Math.round((line1 - line2) * 100) / 100;

        const empName = employer.displayName;
        const ein = decrypt(employer.ssnOrEin);
        const uiAcct = employer.uiAccountNumber || 'Not Set';

        return new Promise<Buffer>((resolve, reject) => {
            const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
            const buffers: Buffer[] = [];
            doc.on('data', (d: Buffer) => buffers.push(d));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const COL1 = 50;
            const PAGE_W = 512;
            const HALF = PAGE_W / 2;

            // Header
            doc.fontSize(15).font('Helvetica-Bold').fillColor('#000')
                .text('Colorado Form DR 1093', COL1, 50, { align: 'center', width: PAGE_W });
            doc.fontSize(11).font('Helvetica')
                .text('Annual Transmittal of State W-2 Forms', COL1, 68, { align: 'center', width: PAGE_W });
            doc.fontSize(10).fillColor('#555')
                .text(`Tax Year: ${year}  |  Due: January 31, ${year + 1}`, COL1, 86, { align: 'center', width: PAGE_W });

            doc.moveTo(COL1, 104).lineTo(COL1 + PAGE_W, 104).stroke('#aaa');

            // Employer header fields
            let y = 112;
            doc.fontSize(9).fillColor('#666').text('Employer Name', COL1, y);
            doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text(empName, COL1, y + 10);
            doc.fontSize(9).fillColor('#666').text('Federal EIN', COL1 + HALF, y);
            doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text(ein, COL1 + HALF, y + 10);
            y += 32;

            doc.fontSize(9).fillColor('#666').text('Colorado UI Account Number', COL1, y);
            doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text(uiAcct, COL1, y + 10);
            doc.fontSize(9).fillColor('#666').text('Number of W-2 Forms Included', COL1 + HALF, y);
            doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text(String(w2Count), COL1 + HALF, y + 10);
            y += 36;

            doc.moveTo(COL1, y).lineTo(COL1 + PAGE_W, y).stroke('#ccc');
            y += 14;

            // Warning box
            doc.rect(COL1, y, PAGE_W, 40).fillColor(hasRealLine2 ? '#f0fdf4' : '#fff8e1').stroke(hasRealLine2 ? '#86efac' : '#f59e0b');
            doc.fontSize(8.5).fillColor(hasRealLine2 ? '#166534' : '#92400e').font('Helvetica')
                .text(
                    hasRealLine2
                        ? `✅ Line 2 verified from CDOR Payment Tracker (${paymentSummary.payments.length} payment(s) on record).`
                        : '⚠ IMPORTANT: Line 2 has been pre-filled as $0.00 — no CDOR payments have been recorded. ' +
                          'Add your remittance payments in the Tax Season Center before filing.',
                    COL1 + 8, y + 8, { width: PAGE_W - 16 }
                );
            y += 52;

            // Fields
            const fieldRow = (label: string, value: string, fy: number, highlight = false) => {
                if (highlight) {
                    doc.rect(COL1, fy - 2, PAGE_W, 26).fillColor('#1a3a6c').stroke('#1a3a6c');
                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff')
                        .text(label, COL1 + 8, fy + 6, { width: PAGE_W - 120 });
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff')
                        .text(value, COL1 + PAGE_W - 100, fy + 4, { width: 96, align: 'right' });
                } else {
                    doc.rect(COL1, fy, PAGE_W, 30).stroke('#bbb');
                    doc.fontSize(8).font('Helvetica').fillColor('#666')
                        .text(label, COL1 + 6, fy + 5, { width: PAGE_W - 120 });
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
                        .text(value, COL1 + PAGE_W - 100, fy + 8, { width: 96, align: 'right' });
                }
            };

            fieldRow('Line 1  Total Colorado income taxes withheld per W-2 forms', fmt(line1), y);
            y += 34;
            fieldRow('Line 2  Total Colorado income taxes remitted during the year ⚠ VERIFY', fmt(line2), y);
            y += 34;

            if (diff === 0) {
                doc.fontSize(9).fillColor('#166534').font('Helvetica-Bold')
                    .text('Line 3  Lines 1 and 2 are equal — No additional tax due or overpayment.', COL1, y + 8);
            } else if (diff > 0) {
                doc.rect(COL1, y, PAGE_W, 30).fillColor('#fee2e2').stroke('#f87171');
                doc.fontSize(9).fillColor('#991b1b').font('Helvetica-Bold')
                    .text(`Line 3A  Additional Tax Due: ${fmt(diff)}`, COL1 + 6, y + 10);
            } else {
                doc.rect(COL1, y, PAGE_W, 30).fillColor('#dcfce7').stroke('#86efac');
                doc.fontSize(9).fillColor('#166534').font('Helvetica-Bold')
                    .text(`Line 3B  Overpayment: ${fmt(Math.abs(diff))}`, COL1 + 6, y + 10);
            }
            y += 36;

            fieldRow('Line 4  Penalty (if filing late — complete if applicable)', '$0.00', y);
            y += 34;
            fieldRow('Line 5  Interest (if filing late — complete if applicable)', '$0.00', y);
            y += 34;
            fieldRow('Line 6  TOTAL AMOUNT DUE (Lines 3A + 4 + 5)', fmt(Math.max(0, diff)), y, true);
            y += 40;

            // Disclaimer
            doc.fontSize(7.5).font('Helvetica').fillColor('#888')
                .text(
                    `Generated by Household Payroll App — ${new Date().toLocaleDateString()} | Tax Year ${year} | ` +
                    'File this form with the Colorado Department of Revenue by January 31. ' +
                    'If filing W-2s electronically with no balance due, DR 1093 may not be required. ' +
                    'Verify with tax.colorado.gov.',
                    COL1, y, { width: PAGE_W }
                );

            doc.end();
        });
    }

    // ── Logging ────────────────────────────────────────────────────────────

    static logGeneration(formType: FormType, year: number, caregiverId?: number, caregiverName?: string, filePath?: string): void {
        const employer = EmployerService.getEmployer();
        if (!employer) return;
        const db = getDatabase();
        try {
            db.prepare(`
                INSERT INTO tax_form_log (employer_id, form_type, tax_year, caregiver_id, caregiver_name, generated_at, file_path)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(employer.id, formType, year, caregiverId ?? null, caregiverName ?? null, new Date().toISOString(), filePath ?? null);
        } catch { /* non-fatal */ }
    }

    static getFormLog(year: number): TaxFormLogEntry[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];
        const db = getDatabase();
        try {
            return db.prepare<[number, number]>(`
                SELECT id, form_type, tax_year, caregiver_id, caregiver_name, generated_at, file_path
                FROM tax_form_log
                WHERE employer_id = ? AND tax_year = ?
                ORDER BY generated_at DESC
            `).all(employer.id, year) as TaxFormLogEntry[];
        } catch { return []; }
    }
}
