/**
 * Script to generate February paystub PDF to verify fixes
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { PaystubGenerator } from './src/utils/paystub-generator';

const dbPath = path.join(process.env.HOME!, 'Library/Application Support/household-payroll/payroll.db');
const db = new Database(dbPath, { readonly: true });

console.log('Reading February payroll data...');

// Get the first February payroll record
const payroll = db.prepare(`
  SELECT * FROM payroll_records 
  WHERE pay_period_start >= '2026-02-01'
  ORDER BY pay_period_start
  LIMIT 1
`).get() as any;

if (!payroll) {
    console.error('No February payroll found');
    process.exit(1);
}

console.log('Found payroll:', payroll.id, payroll.pay_period_start, '-', payroll.pay_period_end);

// Get employer
const employer = db.prepare('SELECT * FROM employers WHERE id = ?').get(payroll.employer_id) as any;

// Get caregiver
const caregiver = db.prepare('SELECT * FROM caregivers WHERE id = ?').get(payroll.caregiver_id) as any;

// Get YTD data
const ytdData = db.prepare(`
  SELECT 
    COALESCE(SUM(gross_wages), 0) as grossWages,
    COALESCE(SUM(regular_wages), 0) as regularWages,
    COALESCE(SUM(weekend_wages), 0) as weekendWages,
    COALESCE(SUM(holiday_wages), 0) as holidayWages,
    COALESCE(SUM(overtime_wages), 0) as overtimeWages,
    COALESCE(SUM(ss_employee), 0) as ssEmployee,
    COALESCE(SUM(medicare_employee), 0) as medicareEmployee,
    COALESCE(SUM(federal_withholding), 0) as federalWithholding,
    COALESCE(SUM(ss_employer), 0) as ssEmployer,
    COALESCE(SUM(medicare_employer), 0) as medicareEmployer,
    COALESCE(SUM(futa), 0) as futa,
    COALESCE(SUM(colorado_suta), 0) as coloradoSuta,
    COALESCE(SUM(colorado_famli_employee), 0) as coloradoFamliEmployee,
    COALESCE(SUM(colorado_famli_employer), 0) as coloradoFamliEmployer,
    COALESCE(SUM(net_pay), 0) as netPay
  FROM payroll_records
  WHERE caregiver_id = ? AND employer_id = ?
    AND strftime('%Y', pay_period_start) = strftime('%Y', ?)
    AND pay_period_start <= ?
`).get(payroll.caregiver_id, payroll.employer_id, payroll.pay_period_start, payroll.pay_period_end) as any;

const ytd = {
    grossWages: ytdData.grossWages,
    regularWages: ytdData.regularWages,
    weekendWages: ytdData.weekendWages,
    holidayWages: ytdData.holidayWages,
    overtimeWages: ytdData.overtimeWages,
    ssEmployee: ytdData.ssEmployee,
    medicareEmployee: ytdData.medicareEmployee,
    federalWithholding: ytdData.federalWithholding,
    ssEmployer: ytdData.ssEmployer,
    medicareEmployer: ytdData.medicareEmployer,
    futa: ytdData.futa,
    coloradoSuta: ytdData.coloradoSuta,
    coloradoFamliEmployee: ytdData.coloradoFamliEmployee,
    coloradoFamliEmployer: ytdData.coloradoFamliEmployer,
    netPay: ytdData.netPay
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

console.log('Generating paystub PDF...');

const outputPath = path.join(process.cwd(), `Paystub_Feb_Test.pdf`);

const context = {
    record: payrollRecord,
    ytd
};

const doc = PaystubGenerator.generatePDF(context as any, employer, caregiver);
const fs = require('fs');
fs.writeFileSync(outputPath, Buffer.from(doc.output('arraybuffer')));

console.log(`✅ Paystub generated: ${outputPath}`);
console.log('\nCheck the PDF for:');
console.log('1. Regular Earnings, Weekend Premium, and Holiday Premium rows always displayed');
console.log('2. Summary table headers: "Employee Deductions" and "Employer Taxes" (no overlap)');
console.log('3. Proper spacing in the summary table');

db.close();
