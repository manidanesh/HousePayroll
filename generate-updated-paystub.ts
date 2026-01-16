/**
 * One-time script to regenerate paystub PDF with updated template
 * For Jan 1-14 payroll
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { PaystubGenerator } from './src/utils/paystub-generator';

const dbPath = path.join(process.env.HOME!, 'Library/Application Support/Household Payroll/payroll.db');
const db = new Database(dbPath, { readonly: true });

console.log('Reading payroll data for Jan 1-14...');

// Get the Jan 1-14 payroll record
const payroll = db.prepare(`
  SELECT * FROM payroll_records 
  WHERE pay_period_start = '2026-01-01' AND pay_period_end = '2026-01-14'
`).get() as any;

if (!payroll) {
    console.error('Payroll not found for Jan 1-14');
    process.exit(1);
}

console.log('Found payroll:', payroll.id);

// Get employer
const employer = db.prepare('SELECT * FROM employers WHERE id = ?').get(payroll.employer_id) as any;

// Get caregiver
const caregiver = db.prepare('SELECT * FROM caregivers WHERE id = ?').get(payroll.caregiver_id) as any;

// Prepare YTD data (all zeros for first payroll)
const ytd = {
    grossWages: payroll.gross_wages,
    regularWages: payroll.regular_wages || 0,
    weekendWages: payroll.weekend_wages || 0,
    holidayWages: payroll.holiday_wages || 0,
    overtimeWages: payroll.overtime_wages || 0,
    ssEmployee: payroll.ss_employee,
    medicareEmployee: payroll.medicare_employee,
    federalWithholding: payroll.federal_withholding,
    ssEmployer: payroll.ss_employer,
    medicareEmployer: payroll.medicare_employer,
    futa: payroll.futa,
    coloradoSuta: payroll.colorado_suta || 0,
    coloradoFamliEmployee: payroll.colorado_famli_employee || 0,
    coloradoFamliEmployer: payroll.colorado_famli_employer || 0,
};

// Map payroll record to expected format
const payrollRecord = {
    id: payroll.id,
    caregiverId: payroll.caregiver_id,
    payPeriodStart: payroll.pay_period_start,
    payPeriodEnd: payroll.pay_period_end,
    totalHours: payroll.total_hours,
    regularHours: payroll.regular_hours || 0,
    weekendHours: payroll.weekend_hours || 0,
    holidayHours: payroll.holiday_hours || 0,
    overtimeHours: payroll.overtime_hours || 0,
    grossWages: payroll.gross_wages,
    regularWages: payroll.regular_wages || 0,
    weekendWages: payroll.weekend_wages || 0,
    holidayWages: payroll.holiday_wages || 0,
    overtimeWages: payroll.overtime_wages || 0,
    ssEmployee: payroll.ss_employee,
    medicareEmployee: payroll.medicare_employee,
    federalWithholding: payroll.federal_withholding,
    ssEmployer: payroll.ss_employer,
    medicareEmployer: payroll.medicare_employer,
    futa: payroll.futa,
    coloradoSuta: payroll.colorado_suta || 0,
    coloradoFamliEmployee: payroll.colorado_famli_employee || 0,
    coloradoFamliEmployer: payroll.colorado_famli_employer || 0,
    netPay: payroll.net_pay,
    checkNumber: payroll.check_number,
    checkDate: payroll.check_date,
    status: payroll.status,
};

console.log('Generating updated paystub PDF...');

const outputPath = path.join(process.cwd(), `Paystub_Jan1-14_Updated.pdf`);
const generator = new PaystubGenerator();

generator.generatePDF(
    payrollRecord as any,
    employer,
    caregiver,
    ytd,
    outputPath
);

console.log(`✅ Paystub generated: ${outputPath}`);

db.close();
