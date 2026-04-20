/**
 * W2Service — Generates IRS Form W-2 (Wage and Tax Statement) PDFs
 *
 * LEGAL NOTE: This generates a data-equivalent W-2 reference document.
 * Employers must submit Copy A to the SSA via Business Services Online (BSO)
 * or an authorized payroll processor. This PDF serves as the employee copy.
 *
 * Fixed bugs from gap analysis:
 * - Box 3: SS wages now capped at annual SS wage base
 * - Box 14: CO FAMLI moved here (was incorrectly in Box 19)
 * - Box 15: Uses real employer UI Account Number (was hardcoded)
 * - Box 17: Colorado State Income Tax withheld now included
 * - Box e: Employee name split into First / MI / Last
 * - Box 19: REMOVED (local income tax — not applicable in CO for household)
 */
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import { Caregiver } from '../types';
import { Employer } from './employer-service';
import { ReportingService, YTDSummary } from './reporting-service';
import { TaxConfigurationService } from './tax-configuration-service';

/** Splits "First M Last" or "First Last" into parts */
function splitName(fullName: string): { first: string; mi: string; last: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], mi: '', last: '' };
    if (parts.length === 2) return { first: parts[0], mi: '', last: parts[1] };
    // 3+ parts: first middle(s) last
    return {
        first: parts[0],
        mi: parts[1][0] + '.',
        last: parts.slice(2).join(' ')
    };
}

function fmt(n: number): string {
    return `$${n.toFixed(2)}`;
}

export class W2Service {
    /**
     * Generate a W-2 PDF for a single caregiver.
     * @param year  Tax year (e.g. 2024)
     * @param caregiver  Full caregiver object (SSN decrypted)
     * @param employer   Full employer object (EIN decrypted)
     * @param outputPath Where to write the PDF file
     */
    static async generateW2PDF(
        year: number,
        caregiver: Caregiver,
        employer: Employer,
        outputPath: string
    ): Promise<void> {
        // 1. Fetch YTD totals for this caregiver
        const ytdRecords = ReportingService.getYTDSummary(year, caregiver.id);
        const data: YTDSummary | undefined = ytdRecords.find(r => r.caregiverId === caregiver.id);

        if (!data) {
            throw new Error(
                `No finalized payroll data found for ${caregiver.fullLegalName} in ${year}.`
            );
        }

        // 2. Get SS wage base for this tax year
        let ssWageBase = 168600; // IRS 2024 default
        try {
            const taxConfig = TaxConfigurationService.getConfigForYear(year);
            if (taxConfig?.ssWageBase) ssWageBase = taxConfig.ssWageBase;
        } catch { /* use default */ }

        // 3. Derived W-2 field values
        const box1  = data.grossWages;                                     // Wages, tips, other comp
        const box2  = data.federalWithholding;                             // Federal income tax withheld
        const box3  = Math.min(data.grossWages, ssWageBase);               // SS wages (capped)
        const box4  = data.ssEmployee;                                     // SS tax withheld
        const box5  = data.grossWages;                                     // Medicare wages (no cap)
        const box6  = data.medicareEmployee;                               // Medicare tax withheld
        const box14 = data.coloradoFamliEmployee;                          // Other: CO FAMLI (EE)
        const box15state = 'CO';
        const box15id    = employer.uiAccountNumber || '(See MyUI+)';     // Real UI Account Number
        const box16 = data.grossWages;                                     // State wages
        const box17 = (data as any).coloradoStateIncomeTax ?? 0;          // CO state income tax withheld

        const name = splitName(caregiver.fullLegalName);

        // 4. Build PDF
        const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const PAGE_W = 612 - 80; // usable width
        const COL1 = 40;
        const COL2 = 340;

        // ── HEADER ────────────────────────────────────────────────────────────
        doc.fontSize(14).font('Helvetica-Bold')
            .text(`Form W-2  Wage and Tax Statement  ${year}`, COL1, 40, { align: 'center', width: PAGE_W });

        doc.fontSize(9).font('Helvetica').fillColor('#555')
            .text(
                '⚠ REFERENCE COPY — Employee copy for records. ' +
                'Submit Copy A to SSA via Business Services Online (BSO) or authorized payroll processor.',
                COL1, 60, { align: 'center', width: PAGE_W }
            );

        doc.moveTo(COL1, 78).lineTo(COL1 + PAGE_W, 78).stroke('#ccc');

        let y = 88;

        // ── Helper: draw a labeled field ─────────────────────────────────────
        const field = (
            label: string,
            value: string,
            x: number,
            fy: number,
            w: number = 240,
            h: number = 36
        ) => {
            doc.rect(x, fy, w, h).stroke('#bbb');
            doc.fontSize(7).font('Helvetica').fillColor('#666')
                .text(label, x + 4, fy + 4, { width: w - 8 });
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000')
                .text(value, x + 4, fy + 14, { width: w - 8 });
        };

        // ── Box a — Employee SSN ──────────────────────────────────────────────
        field('a  Employee\'s social security number', caregiver.ssn, COL1, y, 240, 32);

        // ── Box b — Employer EIN ─────────────────────────────────────────────
        field('b  Employer identification number (EIN)', employer.ssnOrEin, COL2, y, 232, 32);

        y += 38;

        // ── Box c — Employer name/address ─────────────────────────────────────
        const employerAddr = [
            employer.displayName,
            employer.addressLine1 || '',
            employer.addressLine2 || '',
            `${employer.city || ''}, ${employer.state || ''} ${employer.zip || ''}`
        ].filter(Boolean).join('\n');

        doc.rect(COL1, y, PAGE_W, 54).stroke('#bbb');
        doc.fontSize(7).font('Helvetica').fillColor('#666').text('c  Employer\'s name, address, and ZIP code', COL1 + 4, y + 4);
        doc.fontSize(9).font('Helvetica').fillColor('#000').text(employerAddr, COL1 + 4, y + 14, { width: PAGE_W - 8 });
        y += 58;

        // ── Box d — Control number (optional, blank) ──────────────────────────
        field('d  Control number', '', COL1, y, PAGE_W, 28);
        y += 32;

        // ── Box e — Employee name (first, MI, last) ───────────────────────────
        field('e  Employee\'s first name and initial', `${name.first}  ${name.mi}`, COL1, y, 240, 32);
        field('Last name', name.last, COL2, y, 232, 32);
        y += 36;

        // ── Box f — Employee address ──────────────────────────────────────────
        const empAddr = [
            caregiver.addressLine1 || '',
            caregiver.addressLine2 || '',
            `${caregiver.city || ''}, ${caregiver.state || ''} ${caregiver.zip || ''}`
        ].filter(s => s.trim()).join(', ');

        field('f  Employee\'s address and ZIP code', empAddr, COL1, y, PAGE_W, 28);
        y += 36;

        doc.moveTo(COL1, y).lineTo(COL1 + PAGE_W, y).stroke('#aaa');
        y += 8;

        // ── Numbered Boxes 1–6 in a 2-column grid ────────────────────────────
        const numBoxH = 34;
        const numBoxW = 240;

        const numPairs: [string, string][] = [
            ['1  Wages, tips, other compensation',  fmt(box1)],
            ['2  Federal income tax withheld',      fmt(box2)],
            ['3  Social security wages',             fmt(box3)],
            ['4  Social security tax withheld',     fmt(box4)],
            ['5  Medicare wages and tips',           fmt(box5)],
            ['6  Medicare tax withheld',             fmt(box6)],
        ];

        for (let i = 0; i < numPairs.length; i += 2) {
            const [label1, val1] = numPairs[i];
            const [label2, val2] = numPairs[i + 1];
            field(label1, val1, COL1, y, numBoxW, numBoxH);
            field(label2, val2, COL2, y, 232, numBoxH);
            y += numBoxH + 2;
        }

        // ── Box 7 & 8 — Tips (not applicable for household, leave blank) ──────
        field('7  Social security tips', 'N/A', COL1, y, numBoxW, numBoxH);
        field('8  Allocated tips',        'N/A', COL2, y, 232, numBoxH);
        y += numBoxH + 2;

        // ── Box 10 & 11 — Dependent care / Nonqualified plans ─────────────────
        field('10  Dependent care benefits', fmt(0), COL1, y, numBoxW, numBoxH);
        field('11  Nonqualified plans',      fmt(0), COL2, y, 232, numBoxH);
        y += numBoxH + 2;

        // ── Box 12 — Deferred compensation (blank for household) ──────────────
        field('12a  (See instructions)', '', COL1, y, numBoxW, numBoxH);
        field('12b',                    '', COL2, y, 232, numBoxH);
        y += numBoxH + 2;

        // ── Box 13 — Checkboxes ───────────────────────────────────────────────
        doc.rect(COL1, y, PAGE_W, numBoxH).stroke('#bbb');
        doc.fontSize(7).fillColor('#666').text('13  Checkboxes', COL1 + 4, y + 4);
        doc.fontSize(9).fillColor('#000')
            .text('☐ Statutory employee    ☐ Retirement plan    ☐ Third-party sick pay', COL1 + 4, y + 14);
        y += numBoxH + 2;

        // ── Box 14 — Other: CO FAMLI ──────────────────────────────────────────
        if (box14 > 0) {
            field(`14  Other: CO FAMLI (EE)`, fmt(box14), COL1, y, PAGE_W, numBoxH);
        } else {
            field('14  Other', '', COL1, y, PAGE_W, numBoxH);
        }
        y += numBoxH + 8;

        doc.moveTo(COL1, y).lineTo(COL1 + PAGE_W, y).stroke('#aaa');
        y += 8;

        // ── Boxes 15–17 — State tax section ──────────────────────────────────
        const stateBoxW = Math.floor(PAGE_W / 3);
        field('15  State    Employer\'s state ID no.', `${box15state}  ${box15id}`, COL1, y, stateBoxW, numBoxH);
        field('16  State wages, tips, etc.',           fmt(box16), COL1 + stateBoxW + 2, y, stateBoxW, numBoxH);
        field('17  State income tax',                  fmt(box17), COL1 + (stateBoxW + 2) * 2, y, stateBoxW - 2, numBoxH);
        y += numBoxH + 4;

        // ── Boxes 18–20 — Local (not applicable) ─────────────────────────────
        const localBoxW = Math.floor(PAGE_W / 3);
        field('18  Local wages, tips, etc.', 'N/A', COL1, y, localBoxW, numBoxH);
        field('19  Local income tax',        'N/A', COL1 + localBoxW + 2, y, localBoxW, numBoxH);
        field('20  Locality name',           'N/A', COL1 + (localBoxW + 2) * 2, y, localBoxW - 2, numBoxH);
        y += numBoxH + 16;

        // ── Disclaimer footer ─────────────────────────────────────────────────
        doc.moveTo(COL1, y).lineTo(COL1 + PAGE_W, y).stroke('#ccc');
        y += 8;
        doc.fontSize(7.5).font('Helvetica').fillColor('#888')
            .text(
                `Generated by Household Payroll App on ${new Date().toLocaleDateString()} | Tax Year ${year} | ` +
                'This document is for employee reference only. ' +
                'Employer must file Copy A with the SSA and Copy 1 with the Colorado DOR.',
                COL1, y, { width: PAGE_W, align: 'center' }
            );

        doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }

    /**
     * Generate W-2 PDFs for ALL caregivers for a given year.
     * Returns an array of { caregiverName, buffer } for in-memory use.
     */
    static async generateAllW2Buffers(
        year: number,
        caregivers: Caregiver[],
        employer: Employer
    ): Promise<Array<{ caregiverName: string; buffer: Buffer }>> {
        const results: Array<{ caregiverName: string; buffer: Buffer }> = [];

        for (const caregiver of caregivers) {
            try {
                const buffer = await W2Service.generateW2Buffer(year, caregiver, employer);
                results.push({ caregiverName: caregiver.fullLegalName, buffer });
            } catch (err) {
                // Skip caregivers with no payroll data
                console.warn(`[W2Service] Skipped ${caregiver.fullLegalName}: no data for ${year}`);
            }
        }

        return results;
    }

    /** Generate W-2 into a Buffer (no file write) */
    static async generateW2Buffer(
        year: number,
        caregiver: Caregiver,
        employer: Employer
    ): Promise<Buffer> {
        const tmpPath = require('path').join(require('os').tmpdir(), `w2_tmp_${caregiver.id}_${year}_${Date.now()}.pdf`);
        await W2Service.generateW2PDF(year, caregiver, employer, tmpPath);
        const buf = require('fs').readFileSync(tmpPath);
        require('fs').unlinkSync(tmpPath);
        return buf;
    }
}
