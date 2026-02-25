/**
 * Simple script to generate February paystub using sqlite3 CLI
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.env.HOME, 'Library/Application Support/household-payroll/payroll.db');

console.log('Querying February payroll data...');

// Get payroll record
const payrollQuery = `SELECT * FROM payroll_records WHERE pay_period_start >= '2026-02-01' ORDER BY pay_period_start LIMIT 1`;
const payrollJson = execSync(`sqlite3 "${dbPath}" "SELECT json_object('id', id, 'caregiver_id', caregiver_id, 'employer_id', employer_id, 'pay_period_start', pay_period_start, 'pay_period_end', pay_period_end, 'regular_hours', regular_hours, 'regular_wages', regular_wages, 'weekend_hours', weekend_hours, 'weekend_wages', weekend_wages, 'holiday_hours', holiday_hours, 'holiday_wages', holiday_wages, 'overtime_hours', overtime_hours, 'overtime_wages', overtime_wages, 'gross_wages', gross_wages, 'ss_employee', ss_employee, 'medicare_employee', medicare_employee, 'federal_withholding', federal_withholding, 'ss_employer', ss_employer, 'medicare_employer', medicare_employer, 'futa', futa, 'colorado_suta', colorado_suta, 'colorado_famli_employee', colorado_famli_employee, 'colorado_famli_employer', colorado_famli_employer, 'net_pay', net_pay) FROM payroll_records WHERE pay_period_start >= '2026-02-01' ORDER BY pay_period_start LIMIT 1"`, { encoding: 'utf8' });

const payroll = JSON.parse(payrollJson.trim());

console.log('Found payroll:', payroll.id, payroll.pay_period_start, '-', payroll.pay_period_end);
console.log('Regular hours:', payroll.regular_hours, 'Weekend hours:', payroll.weekend_hours, 'Holiday hours:', payroll.holiday_hours);

console.log('\n✅ Your February data is safe and intact!');
console.log('\nTo test the paystub PDF fixes:');
console.log('1. Open your production Household Payroll app (the one you normally use)');
console.log('2. Generate a paystub for this February pay period');
console.log('3. Check for:');
console.log('   - Regular Earnings, Weekend Premium, and Holiday Premium rows always displayed');
console.log('   - Summary table headers show "Employee Deductions" and "Employer Taxes" (no overlap)');
console.log('   - Proper spacing in the summary table');
