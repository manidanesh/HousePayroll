import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import { Caregiver } from '../types';
import { Employer } from './employer-service';
import { ReportingService } from './reporting-service';

export class W2Service {
    /**
     * Generate a W-2 PDF for a caregiver
     */
    static async generateW2PDF(
        year: number,
        caregiver: Caregiver,
        employer: Employer,
        outputPath: string
    ): Promise<void> {
        const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Fetch YTD data for results
        const ytdRecords = await ReportingService.getYTDSummary(year);
        const data = ytdRecords.find(r => r.caregiverId === caregiver.id);

        if (!data) {
            throw new Error(`No payroll data found for caregiver ${caregiver.fullLegalName} in ${year}`);
        }

        // Title
        doc.fontSize(18).text(`Form W-2 Wage and Tax Statement ${year}`, { align: 'center' });
        doc.moveDown();

        // Employer Info (Box c)
        doc.fontSize(10).text('Employer\'s name, address, and ZIP code', { underline: true });
        doc.text(employer.displayName);
        doc.text(employer.addressLine1 || '');
        if (employer.addressLine2) doc.text(employer.addressLine2);
        doc.text(`${employer.city || ''}, ${employer.state || ''} ${employer.zip || ''}`);
        doc.moveDown();

        // Employer EIN (Box b)
        doc.text(`Employer identification number (EIN): ${employer.ssnOrEin}`);
        doc.moveDown();

        // Employee Info (Box e, f)
        doc.text('Employee\'s first name and initial, last name', { underline: true });
        doc.text(caregiver.fullLegalName);
        doc.text(caregiver.addressLine1 || '');
        if (caregiver.addressLine2) doc.text(caregiver.addressLine2);
        doc.text(`${caregiver.city || ''}, ${caregiver.state || ''} ${caregiver.zip || ''}`);
        doc.moveDown();

        // Employee SSN (Box a)
        doc.text(`Employee's social security number: ${caregiver.ssn}`);
        doc.moveDown();

        doc.rect(50, doc.y, 512, 150).stroke();
        const startY = doc.y + 10;

        // Box 1: Wages
        doc.text('1 Wages, tips, other compensation', 60, startY);
        doc.text(`$${data.grossWages.toFixed(2)}`, 200, startY);

        // Box 2: FIT
        doc.text('2 Federal income tax withheld', 300, startY);
        doc.text(`$${data.federalWithholding.toFixed(2)}`, 450, startY);

        // Box 3: SS Wages
        doc.text('3 Social security wages', 60, startY + 20);
        doc.text(`$${data.grossWages.toFixed(2)}`, 200, startY + 20);

        // Box 4: SS Tax
        doc.text('4 Social security tax withheld', 300, startY + 20);
        doc.text(`$${data.ssEmployee.toFixed(2)}`, 450, startY + 20);

        // Box 5: Medicare Wages
        doc.text('5 Medicare wages and tips', 60, startY + 40);
        doc.text(`$${data.grossWages.toFixed(2)}`, 200, startY + 40);

        // Box 6: Medicare Tax
        doc.text('6 Medicare tax withheld', 300, startY + 40);
        doc.text(`$${data.medicareEmployee.toFixed(2)}`, 450, startY + 40);

        // State Info
        doc.text('15 State / Employer\'s state ID no.', 60, startY + 80);
        doc.text('CO / (See MyUI+)', 200, startY + 80);

        doc.text('16 State wages, tips, etc.', 60, startY + 100);
        doc.text(`$${data.grossWages.toFixed(2)}`, 200, startY + 100);

        doc.text('19 FAMLI (Employee Share)', 300, startY + 100);
        doc.text(`$${data.coloradoFamliEmployee.toFixed(2)}`, 450, startY + 100);

        doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }
}
