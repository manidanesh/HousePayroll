import { jsPDF } from 'jspdf';
import { PayrollRecord } from '../services/payroll-service';
import { Employer } from '../services/employer-service';
import { Caregiver } from '../types';

export interface PaystubContext {
    record: PayrollRecord;
    ytd: {
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
    };
}

export class PaystubGenerator {
    /**
     * Generate a Professional PDF Paystub with YTD Columns
     */
    static generatePDF(context: PaystubContext, employer: Employer, caregiver: Caregiver): jsPDF {
        const doc = new jsPDF();
        const { record, ytd } = context;
        let y = 15;

        // --- CUSTOM HEADER SECTION ---
        // Centered Title
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        const customTitle = employer.paystubTitle || 'Caregiving Services';
        const title = employer.childName
            ? `${customTitle} for ${employer.childName}`
            : customTitle;
        doc.text(title, 105, y, { align: 'center' });
        y += 8;

        // Centered Subtitle
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(102, 102, 102); // #666666
        doc.text('Household Employee Paystub', 105, y, { align: 'center' });
        y += 16;

        // Reset text color
        doc.setTextColor(0, 0, 0);

        // --- TWO-COLUMN METADATA LAYOUT ---
        const leftColX = 15;
        const rightColX = 120;
        const metadataY = y;

        // Left Column - Employer and Employee Info
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Employer:', leftColX, metadataY);
        doc.setFont('helvetica', 'normal');
        doc.text(employer.displayName, leftColX, metadataY + 5);

        if (employer.serviceAddress) {
            // Use custom service address if provided
            const addrLines = doc.splitTextToSize(employer.serviceAddress, 100);
            doc.text(addrLines, leftColX, metadataY + 10);
        } else {
            // Fallback to household address
            if (employer.addressLine1) {
                doc.text(employer.addressLine1, leftColX, metadataY + 10);
            }
            const cityStateZip = `${employer.city || ''}, ${employer.state || ''} ${employer.zip || ''}`.trim();
            if (cityStateZip !== ', ') {
                doc.text(cityStateZip, leftColX, metadataY + 15);
            }
        }

        doc.setFont('helvetica', 'bold');
        doc.text('Employee:', leftColX, metadataY + 25);
        doc.setFont('helvetica', 'normal');
        doc.text(caregiver.fullLegalName, leftColX, metadataY + 30);
        if (caregiver.addressLine1) {
            doc.text(caregiver.addressLine1, leftColX, metadataY + 35);
        }
        const caregiverCityStateZip = `${caregiver.city || ''}, ${caregiver.state || ''} ${caregiver.zip || ''}`.trim();
        if (caregiverCityStateZip !== ', ') {
            doc.text(caregiverCityStateZip, leftColX, metadataY + 40);
        }

        // Right Column - Pay Info (Right-aligned)
        doc.setFont('helvetica', 'bold');
        doc.text('Pay Period:', rightColX, metadataY, { align: 'left' });
        doc.setFont('helvetica', 'normal');
        doc.text(`${record.payPeriodStart} – ${record.payPeriodEnd}`, 195, metadataY, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Pay Date:', rightColX, metadataY + 5, { align: 'left' });
        doc.setFont('helvetica', 'normal');
        doc.text(record.paymentDate || 'N/A', 195, metadataY + 5, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Document Number:', rightColX, metadataY + 10, { align: 'left' });
        doc.setFont('helvetica', 'normal');
        doc.text(`${record.id}`, 195, metadataY + 10, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Pay Schedule:', rightColX, metadataY + 15, { align: 'left' });
        doc.setFont('helvetica', 'normal');
        doc.text(employer.payFrequency || 'Weekly', 195, metadataY + 15, { align: 'right' });

        // Section Divider
        y = metadataY + 50;
        doc.setDrawColor(224, 224, 224); // #E0E0E0
        doc.setLineWidth(0.5);
        doc.line(15, y, 195, y);
        y += 16;

        // Reset for earnings section
        doc.setTextColor(0, 0, 0);

        // --- EARNINGS & DEDUCTIONS COLUMNS ---
        const earningsLeftX = 15;
        const earningsRightX = 110;
        const colWidth = 90;
        const rowHeight = 7;
        let leftY = y;
        let rightY = y;

        // Column Center Points (calculated to be centered within their "cells")
        // Left Column (Earnings) - Total 90
        // Label: 0-35 (Left-aligned + 2)
        // Rate: 35-48 (Center: 41.5)
        // Hrs: 48-58 (Center: 53)
        // Current: 58-74 (Center: 66)
        // YTD: 74-90 (Center: 82)
        const eCols = { label: 2, rate: 41.5, hrs: 53, current: 66, ytd: 82 };

        // Right Column (Deductions) - Total 90
        // Label: 0-55 (Left-aligned + 2)
        // Current: 55-73 (Center: 64)
        // YTD: 73-90 (Center: 81.5)
        const dCols = { label: 2, current: 64, ytd: 81.5 };

        // HEADERS
        doc.setFillColor(60, 60, 60);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);

        // Left Header (Earnings)
        doc.rect(earningsLeftX, leftY, colWidth, rowHeight, 'F');
        doc.text('Earnings', earningsLeftX + eCols.label, leftY + 5);
        doc.text('Rate', earningsLeftX + eCols.rate, leftY + 5, { align: 'center' });
        doc.text('Hrs', earningsLeftX + eCols.hrs, leftY + 5, { align: 'center' });
        doc.text('Current', earningsLeftX + eCols.current, leftY + 5, { align: 'center' });
        doc.text('YTD', earningsLeftX + eCols.ytd, leftY + 5, { align: 'center' });

        // Right Header (Taxes / Deductions)
        doc.rect(earningsRightX, rightY, colWidth, rowHeight, 'F');
        doc.text('Taxes / Deductions', earningsRightX + dCols.label, rightY + 5);
        doc.text('Current', earningsRightX + dCols.current, rightY + 5, { align: 'center' });
        doc.text('YTD', earningsRightX + dCols.ytd, rightY + 5, { align: 'center' });

        leftY += rowHeight;
        rightY += rowHeight;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        // --- EARNINGS DATA ---
        const drawEarningRow = (label: string, rate: number, hours: number, current: number, ytdVal: number, isMandatory?: boolean) => {
            if (!isMandatory && current === 0 && ytdVal === 0) return;

            // Draw content
            if (label.length > 20) doc.setFontSize(8);
            doc.text(label, earningsLeftX + eCols.label, leftY + 5);
            doc.setFontSize(10);

            doc.text(rate.toFixed(2), earningsLeftX + eCols.rate, leftY + 5, { align: 'center' });
            doc.text(hours.toFixed(1), earningsLeftX + eCols.hrs, leftY + 5, { align: 'center' });
            doc.text(current.toFixed(2), earningsLeftX + eCols.current, leftY + 5, { align: 'center' });
            doc.text(ytdVal.toFixed(2), earningsLeftX + eCols.ytd, leftY + 5, { align: 'center' });

            // Draw horizontal line
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.1);
            doc.line(earningsLeftX, leftY + rowHeight, earningsLeftX + colWidth, leftY + rowHeight);

            leftY += rowHeight;
        };

        // Calculate rate: if both hours and wages are zero, display 0.00; otherwise calculate rate
        const regularHours = record.regular_hours || 0;
        const regularWages = record.regular_wages || 0;
        const hourlyRate = (regularHours === 0 && regularWages === 0) ? 0 : regularWages / (regularHours || 1);

        drawEarningRow('Regular Earnings', hourlyRate, regularHours, regularWages, ytd.regularWages, true);
        
        const weekendHours = record.weekend_hours || 0;
        const weekendWages = record.weekend_wages || 0;
        const weekendRate = (weekendHours === 0 && weekendWages === 0) ? 0 : weekendWages / (weekendHours || 1);
        drawEarningRow('Weekend Premium', weekendRate, weekendHours, weekendWages, ytd.weekendWages, true);
        
        const holidayHours = record.holiday_hours || 0;
        const holidayWages = record.holiday_wages || 0;
        const holidayRate = (holidayHours === 0 && holidayWages === 0) ? 0 : holidayWages / (holidayHours || 1);
        drawEarningRow('Holiday Premium', holidayRate, holidayHours, holidayWages, ytd.holidayWages, true);
        
        if (record.overtime_hours || ytd.overtimeWages > 0) {
            const overtimeHours = record.overtime_hours || 0;
            const overtimeWages = record.overtime_wages || 0;
            const rate = (overtimeHours === 0 && overtimeWages === 0) ? 0 : overtimeWages / (overtimeHours || 1);
            drawEarningRow('Overtime', rate, overtimeHours, overtimeWages, ytd.overtimeWages);
        }

        // --- DEDUCTIONS DATA ---
        const drawDeductionRow = (label: string, current: number, ytdVal: number, isHeader = false) => {
            if (!isHeader && current === 0 && ytdVal === 0) return;

            if (isHeader) {
                doc.setFont('helvetica', 'bold');
                doc.text(label, earningsRightX + dCols.label, rightY + 5);
                doc.setFont('helvetica', 'normal');
            } else {
                doc.text(label, earningsRightX + dCols.label, rightY + 5);
                doc.text(current.toFixed(2), earningsRightX + dCols.current, rightY + 5, { align: 'center' });
                doc.text(ytdVal.toFixed(2), earningsRightX + dCols.ytd, rightY + 5, { align: 'center' });
            }

            // Draw horizontal line
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.1);
            doc.line(earningsRightX, rightY + rowHeight, earningsRightX + colWidth, rightY + rowHeight);

            rightY += rowHeight;
        };

        drawDeductionRow('Federal Withholding', record.federalWithholding, ytd.federalWithholding);
        drawDeductionRow('FICA - Social Security', record.ssEmployee, ytd.ssEmployee);
        drawDeductionRow('FICA - Medicare', record.medicareEmployee, ytd.medicareEmployee);
        drawDeductionRow('CO FAMLI (Employee)', record.colorado_famli_employee || 0, ytd.coloradoFamliEmployee);

        // --- EMPLOYER TAXES SEPARATOR ---
        rightY += 2;
        drawDeductionRow('Employer Taxes (Info)', 0, 0, true);

        drawDeductionRow('Employer SS', record.ssEmployer, ytd.ssEmployer);
        drawDeductionRow('Employer Medicare', record.medicareEmployer, ytd.medicareEmployer);
        drawDeductionRow('FUTA (Federal)', record.futa, ytd.futa);
        drawDeductionRow('CO SUI (Employer)', record.colorado_suta || 0, ytd.coloradoSuta);
        drawDeductionRow('CO FAMLI (Employer)', record.colorado_famli_employer || 0, ytd.coloradoFamliEmployer);

        // --- CURRENT PERIOD SUMMARY TABLE ---
        const summaryY = Math.max(leftY, rightY) + 10;

        // Calculate totals for current period
        const currentGross = record.grossWages;
        const currentEmployeeDeductions = record.ssEmployee + record.medicareEmployee + record.federalWithholding + (record.colorado_famli_employee || 0);
        const currentEmployerTaxes = record.ssEmployer + record.medicareEmployer + record.futa + (record.colorado_suta || 0) + (record.colorado_famli_employer || 0);
        const currentNet = record.netPay;

        // Draw summary table header
        doc.setFillColor(50, 50, 50);
        doc.rect(15, summaryY, 180, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);

        // Column headers with clear, non-overlapping labels
        doc.text('Gross Pay', 25, summaryY + 5, { align: 'center' });
        doc.text('Employee Deductions', 75, summaryY + 5, { align: 'center' });
        doc.text('Employer Taxes', 125, summaryY + 5, { align: 'center' });
        doc.text('Net Pay', 170, summaryY + 5, { align: 'center' });

        // Draw values row
        const valuesY = summaryY + 7;
        doc.setFillColor(245, 245, 245);
        doc.rect(15, valuesY, 180, 8, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);

        doc.text(`$${currentGross.toFixed(2)}`, 25, valuesY + 5.5, { align: 'center' });
        doc.text(`$${currentEmployeeDeductions.toFixed(2)}`, 75, valuesY + 5.5, { align: 'center' });
        doc.text(`$${currentEmployerTaxes.toFixed(2)}`, 125, valuesY + 5.5, { align: 'center' });
        doc.text(`$${currentNet.toFixed(2)}`, 170, valuesY + 5.5, { align: 'center' });

        // --- TOTALS FOOTER (YTD) ---
        // Align the bottom of both columns
        const footerY = summaryY + 25;

        // Black Bar Background
        doc.setFillColor(40, 40, 40);
        doc.rect(15, footerY, 180, 15, 'F');
        doc.setTextColor(255, 255, 255);

        // Columns in Footer
        // YTD Gross
        doc.setFontSize(8);
        doc.text('YTD Gross', 30, footerY + 5, { align: 'center' });
        doc.setFontSize(11);
        doc.text(`$${ytd.grossWages.toFixed(2)}`, 30, footerY + 11, { align: 'center' });

        // YTD Deductions
        const totalDeductionsYTD = ytd.ssEmployee + ytd.medicareEmployee + ytd.federalWithholding + ytd.coloradoFamliEmployee;
        doc.setFontSize(8);
        doc.text('YTD Deductions', 70, footerY + 5, { align: 'center' });
        doc.setFontSize(11);
        doc.text(`$${totalDeductionsYTD.toFixed(2)}`, 70, footerY + 11, { align: 'center' });

        // YTD Net Pay
        doc.setFontSize(8);
        doc.text('YTD Net Pay', 110, footerY + 5, { align: 'center' });
        doc.setFontSize(11);
        doc.text(`$${ytd.netPay.toFixed(2)}`, 110, footerY + 11, { align: 'center' });

        // CURRENT NET PAY (Highlighted)
        doc.setFontSize(10);
        doc.text('Current Net Pay', 165, footerY + 5, { align: 'center' });
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${record.netPay.toFixed(2)}`, 165, footerY + 12, { align: 'center' });


        // --- OPTIONAL: HFWA BALANCE (Bottom Left) ---
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Accrued Sick Leave Balance: ${caregiver.hfwaBalance?.toFixed(2) || '0.00'} hrs`, 15, footerY + 22);

        // Generated Footer
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 195, footerY + 22, { align: 'right' });

        return doc;
    }

    /**
     * Generate PDF as Uint8Array
     */
    static generatePDFBytes(context: PaystubContext, employer: Employer, caregiver: Caregiver): Uint8Array {
        const doc = this.generatePDF(context, employer, caregiver);
        const arrayBuffer = doc.output('arraybuffer');
        return new Uint8Array(arrayBuffer);
    }
}
