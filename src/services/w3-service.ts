/**
 * W3Service — Generates IRS Form W-3 (Transmittal of Wage and Tax Statements)
 *
 * OFFICIAL FORM REFERENCE: irs.gov/pub/irs-pdf/fw3.pdf
 * DUE: January 31 of the following year (same as W-2)
 *
 * The W-3 is the employer-level cover sheet summing ALL W-2 values.
 * It is filed with Copy A of all W-2s submitted to the SSA.
 *
 * IMPORTANT: If filing W-2s electronically via BSO (ssa.gov/employer),
 * a paper Form W-3 is NOT required — BSO generates the equivalent automatically.
 * This PDF is for reference and paper filing only.
 *
 * Box b — Kind of Payer: "Hshld. emp." (household employer)
 *   This is checked because the household employer does NOT file Form 941.
 *   Instead, household employment taxes are reported on Schedule H (Form 1040).
 */
import PDFDocument from 'pdfkit';
import { getDatabase, decrypt } from '../database/db';
import { EmployerService } from './employer-service';
import { ReportingService, YTDSummary } from './reporting-service';

export interface W3Totals {
    taxYear: number;
    w2Count: number;                // Box c
    ein: string;                    // Box e
    employerName: string;           // Box f
    employerAddress: string;        // Box g

    // Box 1–6 (sums of all employee W-2 values)
    box1Wages: number;              // Sum of Box 1 — total wages
    box2FIT: number;                // Sum of Box 2 — federal income tax
    box3SSWages: number;            // Sum of Box 3 — SS wages (each capped at $168,600)
    box4SSTax: number;              // Sum of Box 4 — SS tax withheld
    box5MedWages: number;           // Sum of Box 5 — Medicare wages (no cap)
    box6MedTax: number;             // Sum of Box 6 — Medicare tax withheld

    // Box 7–11 (N/A for household)
    box7SSTips: number;             // 0
    box8AllocatedTips: number;      // 0
    box10DependentCare: number;     // 0
    box11NonqualPlans: number;      // 0

    // Box 14 (CO FAMLI totals)
    box14Other: number;             // Sum of CO FAMLI EE

    // Box 15–17 — State totals
    box15State: string;             // "CO"
    box15StateId: string;           // UI Account Number
    box16StateWages: number;        // Sum of state wages = sum of box1Wages
    box17StateTax: number;          // Sum of Box 17 — CO income tax withheld
}

const SS_WAGE_BASE_2024 = 168600;
const fmt = (n: number) => `$${n.toFixed(2)}`;

export class W3Service {

    /**
     * Compute all W-3 totals from YTD records for a given year.
     */
    static computeW3Totals(year: number): W3Totals {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer profile found');

        const ytd = ReportingService.getYTDSummary(year);

        // SS wage base — use 2024 default; can add TaxConfigurationService lookup later
        const ssWageBase = year >= 2025 ? 176100 : SS_WAGE_BASE_2024;

        const totals = ytd.reduce((acc, rec) => {
            acc.box1Wages     += rec.grossWages;
            acc.box2FIT       += rec.federalWithholding;
            acc.box3SSWages   += Math.min(rec.grossWages, ssWageBase);  // per-employee cap
            acc.box4SSTax     += rec.ssEmployee;                         // employee share only
            acc.box5MedWages  += rec.grossWages;                         // no cap
            acc.box6MedTax    += rec.medicareEmployee;                   // employee share only
            acc.box14Other    += rec.coloradoFamliEmployee;
            acc.box16StateWages += rec.grossWages;
            return acc;
        }, {
            box1Wages: 0, box2FIT: 0, box3SSWages: 0, box4SSTax: 0,
            box5MedWages: 0, box6MedTax: 0, box14Other: 0, box16StateWages: 0
        });

        // CO State Income Tax sum — from payroll_records directly
        const db = getDatabase();
        const sitRow = db.prepare(`
            SELECT COALESCE(SUM(colorado_state_income_tax), 0) as total
            FROM payroll_records
            WHERE employer_id = ?
              AND pay_period_end BETWEEN ? AND ?
              AND is_finalized = 1 AND is_voided = 0
        `).get(employer.id, `${year}-01-01`, `${year}-12-31`) as any;

        const box17StateTax = Number(sitRow?.total ?? 0);

        const earnAddr = [
            employer.addressLine1 || '',
            employer.addressLine2 || '',
            [employer.city, employer.state, employer.zip].filter(Boolean).join(', ')
        ].filter(s => s.trim()).join(', ');

        return {
            taxYear: year,
            w2Count: ytd.length,
            ein: decrypt(employer.ssnOrEin),
            employerName: employer.displayName,
            employerAddress: earnAddr,

            ...totals,
            box7SSTips: 0,
            box8AllocatedTips: 0,
            box10DependentCare: 0,
            box11NonqualPlans: 0,

            box17StateTax: Math.round(box17StateTax * 100) / 100,
            box15State: 'CO',
            box15StateId: employer.uiAccountNumber || '(see MyUI+)',
        };
    }

    /**
     * Generate a W-3 PDF for a given tax year. Returns a Buffer.
     */
    static async generateW3Buffer(year: number): Promise<Buffer> {
        const totals = W3Service.computeW3Totals(year);

        return new Promise<Buffer>((resolve, reject) => {
            const doc = new PDFDocument({ size: 'LETTER', margin: 46 });
            const chunks: Buffer[] = [];
            doc.on('data', (d: Buffer) => chunks.push(d));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            W3Service.renderPDF(doc, totals, year);
            doc.end();
        });
    }

    private static renderPDF(doc: PDFKit.PDFDocument, t: W3Totals, year: number): void {
        const L = 46;          // left margin
        const W = 520;         // usable width
        const MID = L + W / 2;
        const COL2 = L + W / 2 + 4;
        const FW = W / 2 - 4;  // field width (half-page)

        let y = 44;

        // ── Title bar ────────────────────────────────────────────────────────
        doc.rect(L, y, W, 32).fillColor('#1a3a6c').fill();
        doc.fontSize(15).font('Helvetica-Bold').fillColor('#fff')
            .text('Form W-3', L + 10, y + 6, { width: 100 });
        doc.fontSize(10).font('Helvetica').fillColor('#dde')
            .text('Transmittal of Wage and Tax Statements', L + 110, y + 6)
            .text(`Tax Year ${year}  |  Due: January 31, ${year + 1}`, L + 110, y + 18);
        doc.fontSize(9).fillColor('#aad')
            .text(`${t.w2Count} Form${t.w2Count !== 1 ? 's' : ''} W-2 included`, L + W - 120, y + 12, { width: 110, align: 'right' });
        y += 40;

        // ── Legal note ────────────────────────────────────────────────────────
        doc.fontSize(7.5).font('Helvetica').fillColor('#555')
            .text(
                '⚖ REFERENCE COPY — This document summarises all W-2 forms for SSA transmittal. ' +
                'If filing electronically via SSA Business Services Online (BSO), a separate paper W-3 is NOT required.',
                L, y, { width: W, align: 'center' }
            );
        y += 16;

        // ── Helper: draw a labelled box ───────────────────────────────────────
        const field = (
            boxLabel: string,
            desc: string,
            value: string,
            fx: number, fy: number,
            fw: number, fh = 38,
            highlight = false
        ) => {
            doc.rect(fx, fy, fw, fh)
                .fillColor(highlight ? '#f0f4ff' : '#fafafa')
                .stroke('#c8cdd6');
            doc.fontSize(7).font('Helvetica').fillColor('#445')
                .text(`${boxLabel}  ${desc}`, fx + 5, fy + 5, { width: fw - 10 });
            doc.fontSize(11).font('Helvetica-Bold').fillColor(highlight ? '#1a3a6c' : '#000')
                .text(value, fx + 5, fy + 18, { width: fw - 10 });
        };

        // ── Box b — Kind of Payer (household employer check) ──────────────────
        doc.rect(L, y, W, 42).fillColor('#f8f9fb').stroke('#c8cdd6');
        doc.fontSize(7).font('Helvetica').fillColor('#445')
            .text('b  Kind of Payer (check box)', L + 5, y + 5);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a3a6c')
            .text('☑ Hshld. emp. (Household Employer)', L + 14, y + 18);
        doc.fontSize(8.5).font('Helvetica').fillColor('#555')
            .text('Kind of Employer: ☐ 501c non-govt  ☐ State/local  ☐ Federal  ☐ Other  |  Third-party sick pay: ☐',
                MID, y + 14, { width: FW });
        y += 46;

        // ── Employer identity (Box c, e, f, g) ───────────────────────────────
        field('c', 'Total number of Forms W-2', String(t.w2Count), L, y, FW);
        field('e', "Employer's identification number (EIN)", t.ein, COL2, y, FW);
        y += 42;

        field('f', "Employer's name", t.employerName, L, y, W, 36);
        y += 40;

        field('g', "Employer's address and ZIP code", t.employerAddress, L, y, W, 32);
        y += 36;

        doc.moveTo(L, y).lineTo(L + W, y).stroke('#bbb'); y += 10;

        // ── Numbered boxes 1–6 in 2-column grid ──────────────────────────────
        const numPairs: [string, string, string, boolean][] = [
            ['1', 'Wages, tips, other compensation',  fmt(t.box1Wages),   false],
            ['2', 'Federal income tax withheld',       fmt(t.box2FIT),     false],
            ['3', 'Social security wages',              fmt(t.box3SSWages), false],
            ['4', 'Social security tax withheld',      fmt(t.box4SSTax),   false],
            ['5', 'Medicare wages and tips',            fmt(t.box5MedWages), false],
            ['6', 'Medicare tax withheld',              fmt(t.box6MedTax),  false],
        ];

        for (let i = 0; i < numPairs.length; i += 2) {
            const [b1, d1, v1, h1] = numPairs[i];
            const [b2, d2, v2, h2] = numPairs[i + 1];
            field(b1, d1, v1, L, y, FW, 36, h1);
            field(b2, d2, v2, COL2, y, FW, 36, h2);
            y += 39;
        }

        // ── Box 7 & 8 — Tips (not applicable) ────────────────────────────────
        field('7',  'Social security tips',  '$0.00 (N/A)', L,    y, FW, 32);
        field('8',  'Allocated tips',         '$0.00 (N/A)', COL2, y, FW, 32);
        y += 35;

        // ── Box 10 & 11 ───────────────────────────────────────────────────────
        field('10', 'Dependent care benefits',  fmt(t.box10DependentCare), L,    y, FW, 32);
        field('11', 'Nonqualified plans',        fmt(t.box11NonqualPlans),  COL2, y, FW, 32);
        y += 35;

        // ── Box 12 & 13 ───────────────────────────────────────────────────────
        field('12a', 'Deferred compensation', '(see instructions)', L,    y, FW, 32);
        field('13',  'For 3rd-party sick pay use only', 'N/A',              COL2, y, FW, 32);
        y += 35;

        // ── Box 14 — CO FAMLI ─────────────────────────────────────────────────
        field('14', 'Other — CO FAMLI Employee Premiums', fmt(t.box14Other), L, y, W, 32);
        y += 36;

        doc.moveTo(L, y).lineTo(L + W, y).stroke('#bbb'); y += 10;

        // ── Boxes 15–17 — State totals in 3-column grid ───────────────────────
        const COL_STATE = Math.floor(W / 3);
        doc.rect(L, y, W, 36).fillColor('#eef2fb').stroke('#c8cdd6');
        doc.fontSize(7).font('Helvetica').fillColor('#445')
            .text('15  State / Employer state ID',     L + 4, y + 5, { width: COL_STATE - 8 })
            .text('16  State wages, tips, etc.',        L + COL_STATE + 4, y + 5, { width: COL_STATE - 8 })
            .text('17  State income tax',               L + COL_STATE * 2 + 4, y + 5, { width: COL_STATE - 8 });
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a3a6c')
            .text(`${t.box15State}  ${t.box15StateId}`, L + 4, y + 18, { width: COL_STATE - 8 })
            .text(fmt(t.box16StateWages),               L + COL_STATE + 4, y + 18, { width: COL_STATE - 8 })
            .text(fmt(t.box17StateTax),                 L + COL_STATE * 2 + 4, y + 18, { width: COL_STATE - 8 });
        y += 40;

        // ── Boxes 18–19 — Local (N/A) ─────────────────────────────────────────
        const localW = Math.floor(W / 2);
        field('18', 'Local wages, tips, etc.', 'N/A', L,           y, localW - 2, 30);
        field('19', 'Local income tax',          'N/A', L + localW + 2, y, localW - 2, 30);
        y += 36;

        // ── Summary box ───────────────────────────────────────────────────────
        doc.rect(L, y, W, 30).fillColor('#1a3a6c').fill();
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff')
            .text('Total Gross Wages  (Box 1)', L + 8, y + 8, { width: W / 2 - 8 });
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#fff')
            .text(fmt(t.box1Wages), L + W / 2, y + 6, { width: W / 2 - 8, align: 'right' });
        y += 38;

        // ── Contact / signature section ───────────────────────────────────────
        doc.rect(L, y, W, 40).fillColor('#f8f9fb').stroke('#c8cdd6');
        doc.fontSize(7).font('Helvetica').fillColor('#556')
            .text("Employer's contact name:", L + 6, y + 6)
            .text('Telephone:', L + 6, y + 21)
            .text('Fax:', L + 160, y + 21)
            .text('Email:', L + 260, y + 21);
        doc.moveTo(L + 120, y + 6).lineTo(L + W - 6, y + 6).stroke('#bbb');
        doc.moveTo(L + 80, y + 21).lineTo(L + 148, y + 21).stroke('#bbb');
        doc.moveTo(L + 180, y + 21).lineTo(L + 250, y + 21).stroke('#bbb');
        doc.moveTo(L + 296, y + 21).lineTo(L + W - 6, y + 21).stroke('#bbb');
        y += 46;

        doc.rect(L, y, W, 36).fillColor('#f8f9fb').stroke('#c8cdd6');
        doc.fontSize(7).font('Helvetica').fillColor('#556')
            .text('Under penalties of perjury, I declare that I have examined this return and accompanying documents, and to the best of my knowledge and belief, they are true, correct, and complete.',
                L + 6, y + 5, { width: W - 12 });
        doc.fontSize(7).fillColor('#445')
            .text('Signature:', L + 6, y + 24)
            .text('Title:', L + 225, y + 24)
            .text('Date:', L + 370, y + 24);
        doc.moveTo(L + 56, y + 28).lineTo(L + 215, y + 28).stroke('#bbb');
        doc.moveTo(L + 248, y + 28).lineTo(L + 360, y + 28).stroke('#bbb');
        doc.moveTo(L + 400, y + 28).lineTo(L + W - 6, y + 28).stroke('#bbb');
        y += 42;

        // ── Footer ────────────────────────────────────────────────────────────
        doc.fontSize(7).font('Helvetica').fillColor('#888')
            .text(
                `Generated by Household Payroll App · ${new Date().toLocaleDateString()} · Tax Year ${year} · ` +
                'Reference copy only. See irs.gov/w2 and ssa.gov/employer for official filing requirements.',
                L, y, { width: W, align: 'center' }
            );
    }
}
