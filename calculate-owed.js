/**
 * Calculate Correct Amount Owed to Caregiver
 * With Weekend Multiplier 1.3x Applied
 */

console.log('=== AMOUNT OWED TO CAREGIVER ===\n');

// Hours worked
const regularHours = 37.0;
const weekendHours = 12.0;
const baseRate = 25.00;
const weekendMultiplier = 1.3;

// Correct Earnings
const regularEarnings = regularHours * baseRate;
const weekendRate = baseRate * weekendMultiplier;
const weekendEarnings = weekendHours * weekendRate;
const grossWages = regularEarnings + weekendEarnings;

console.log('CORRECT EARNINGS (with 1.3x weekend multiplier):');
console.log(`  Regular: ${regularHours} hrs @ $${baseRate.toFixed(2)}/hr = $${regularEarnings.toFixed(2)}`);
console.log(`  Weekend: ${weekendHours} hrs @ $${weekendRate.toFixed(2)}/hr = $${weekendEarnings.toFixed(2)}`);
console.log(`  Gross Wages: $${grossWages.toFixed(2)}\n`);

// Employee Deductions
const federalWithholding = 68.85;
const ssEmployee = grossWages * 0.062;
const medicareEmployee = grossWages * 0.0145;
const famliEmployee = grossWages * 0.0044;

const totalDeductions = federalWithholding + ssEmployee + medicareEmployee + famliEmployee;

console.log('EMPLOYEE DEDUCTIONS:');
console.log(`  Federal Withholding: $${federalWithholding.toFixed(2)}`);
console.log(`  FICA Social Security (6.2%): $${ssEmployee.toFixed(2)}`);
console.log(`  FICA Medicare (1.45%): $${medicareEmployee.toFixed(2)}`);
console.log(`  CO FAMLI Employee (0.44%): $${famliEmployee.toFixed(2)}`);
console.log(`  Total Deductions: $${totalDeductions.toFixed(2)}\n`);

// Net Pay (what caregiver receives)
const netPay = grossWages - totalDeductions;

console.log('═══════════════════════════════════════');
console.log('  NET PAY (Amount to Pay Caregiver)');
console.log(`  $${netPay.toFixed(2)}`);
console.log('═══════════════════════════════════════\n');

// Employer costs
const ssEmployer = grossWages * 0.062;
const medicareEmployer = grossWages * 0.0145;
const futa = grossWages * 0.006;
const sui = grossWages * 0.017;
const famliEmployer = grossWages * 0.0044;

const totalEmployerTaxes = ssEmployer + medicareEmployer + futa + sui + famliEmployer;

console.log('YOUR EMPLOYER COSTS (additional):');
console.log(`  Employer SS (6.2%): $${ssEmployer.toFixed(2)}`);
console.log(`  Employer Medicare (1.45%): $${medicareEmployer.toFixed(2)}`);
console.log(`  FUTA (0.6%): $${futa.toFixed(2)}`);
console.log(`  CO SUI (1.7%): $${sui.toFixed(2)}`);
console.log(`  CO FAMLI Employer (0.44%): $${famliEmployer.toFixed(2)}`);
console.log(`  Total Employer Taxes: $${totalEmployerTaxes.toFixed(2)}\n`);

console.log('TOTAL COST TO YOU:');
console.log(`  Caregiver Net Pay: $${netPay.toFixed(2)}`);
console.log(`  Employer Taxes: $${totalEmployerTaxes.toFixed(2)}`);
console.log(`  ────────────────────────────`);
console.log(`  Total: $${(netPay + totalEmployerTaxes).toFixed(2)}\n`);

// Compare to what was calculated wrong
console.log('COMPARISON TO INCORRECT CALCULATION:');
const wrongGross = 1225.00;
const wrongNetPay = 1225.00 - (68.85 + 75.95 + 17.76 + 5.39);
console.log(`  Incorrect Gross: $${wrongGross.toFixed(2)}`);
console.log(`  Incorrect Net Pay: $${wrongNetPay.toFixed(2)}`);
console.log(`  Correct Net Pay: $${netPay.toFixed(2)}`);
console.log(`  Difference: $${(netPay - wrongNetPay).toFixed(2)} more owed to caregiver`);
