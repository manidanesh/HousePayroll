import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { PaystubGenerator } from './src/utils/paystub-generator';

const dbPath = path.join(os.homedir(), 'Library/Application Support/household-payroll/payroll.db');
const db = new Database(dbPath, { readonly: true });

console.log('Reading February payroll data...');

// Get one of the February payroll records
const record: any = db.prepare(`
  SELECT * FROM payroll_records 
  WHERE pay_period_start >= '2026-02-01' 
  ORDER BY pay_period_start 
  LIMIT 1
`).get();

if (!record) {
  console.log('No February payroll records found');
  process.exit(1);
}

console.log('Found record:', record);

// Get employer info
const employer: any = db.prepare('SELECT * FROM employers WHERE id = ?').get(record.employer_id);
console.log('Employer:', employer);

// Get caregiver info
const caregiver: any = db.prepare('SELECT * FROM caregivers WHERE id = ?').get(record.caregiver_id);
console.log('Caregiver:', caregiver);

// Get YTD data
const ytd: any = db.prepare(`
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
`).get(record.caregiver_id, record.employer_id, record.pay_period_start, record.pay_period_end);

console.log('YTD data:', ytd);

// Create PaystubContext
const context = {
  record: {
    id: record.id,
    payPeriodStart: record.pay_period_start,
    payPeriodEnd: record.pay_period_end,
    paymentDate: record.payment_date,
    regular_hours: record.regular_hours,
    regular_wages: record.regular_wages,
    weekend_hours: record.weekend_hours,
    weekend_wages: record.weekend_wages,
    holiday_hours: record.holiday_hours,
    holiday_wages: record.holiday_wages,
    overtime_hours: record.overtime_hours,
    overtime_wages: record.overtime_wages,
    grossWages: record.gross_wages,
    ssEmployee: record.ss_employee,
    medicareEmployee: record.medicare_employee,
    federalWithholding: record.federal_withholding,
    ssEmployer: record.ss_employer,
    medicareEmployer: record.medicare_employer,
    futa: record.futa,
    colorado_suta: record.colorado_suta,
    colorado_famli_employee: record.colorado_famli_employee,
    colorado_famli_employer: record.colorado_famli_employer,
    netPay: record.net_pay
  },
  ytd
};

// Generate the paystub
console.log('\nGenerating paystub...');

const doc = PaystubGenerator.generatePDF(context, employer, caregiver);
const pdfBytes = doc.output('arraybuffer');
fs.writeFileSync('./test-paystub-feb.pdf', Buffer.from(pdfBytes));

console.log(`\nPaystub generated successfully: ./test-paystub-feb.pdf`);
console.log('\nCheck the PDF for:');
console.log('1. Regular Earnings, Weekend Premium, and Holiday Premium rows always displayed');
console.log('2. Summary table headers: "Employee Deductions" and "Employer Taxes" (no overlap)');
console.log('3. Proper spacing in the summary table');

db.close();
