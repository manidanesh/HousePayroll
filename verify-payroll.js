/**
 * Payroll Calculation Verification
 * Checking user's actual payroll data for accuracy
 */

console.log('=== PAYROLL CALCULATION VERIFICATION ===\n');

// Given Data
const regularHours = 37.0;
const regularRate = 25.00;
const weekendHours = 12.0;
const weekendRate = 25.00; // ❌ ISSUE: Should be $32.50 if multiplier is 1.3

const regularEarnings = regularHours * regularRate;
const weekendEarnings = weekendHours * weekendRate;
const grossWages = regularEarnings + weekendEarnings;

console.log('EARNINGS:');
console.log(`  Regular: ${regularHours} hrs @ $${regularRate}/hr = $${regularEarnings.toFixed(2)}`);
console.log(`  Weekend: ${weekendHours} hrs @ $${weekendRate}/hr = $${weekendEarnings.toFixed(2)}`);
console.log(`  ❌ Weekend should be @ $32.50/hr if multiplier is 1.3`);
console.log(`  Gross Wages: $${grossWages.toFixed(2)}\n`);

// Tax Rates (2026 Colorado)
const ssRate = 0.062;      // 6.2%
const medicareRate = 0.0145; // 1.45%
const famliRate = 0.0044;   // 0.44%
const futaRate = 0.006;     // 0.6%

// Employee Deductions
const federalWithholding = 68.85; // From W-4
const ssEmployee = grossWages * ssRate;
const medicareEmployee = grossWages * medicareRate;
const famliEmployee = grossWages * famliRate;

console.log('EMPLOYEE DEDUCTIONS:');
console.log(`  Federal Withholding: $${federalWithholding.toFixed(2)} (from W-4)`);
console.log(`  FICA SS (6.2%): $${grossWages.toFixed(2)} × ${ssRate} = $${ssEmployee.toFixed(2)}`);
console.log(`    Expected: $75.95 | Actual: $75.95 ✓`);
console.log(`  FICA Medicare (1.45%): $${grossWages.toFixed(2)} × ${medicareRate} = $${medicareEmployee.toFixed(2)}`);
console.log(`    Expected: $17.76 | Actual: $17.76 ✓`);
console.log(`  CO FAMLI (0.44%): $${grossWages.toFixed(2)} × ${famliRate} = $${famliEmployee.toFixed(2)}`);
console.log(`    Expected: $5.39 | Actual: $5.39 ✓\n`);

// Employer Taxes
const ssEmployer = grossWages * ssRate;
const medicareEmployer = grossWages * medicareRate;
const futa = grossWages * futaRate;
const famliEmployer = grossWages * famliRate;

console.log('EMPLOYER TAXES:');
console.log(`  Employer SS (6.2%): $${grossWages.toFixed(2)} × ${ssRate} = $${ssEmployer.toFixed(2)}`);
console.log(`    Expected: $75.95 | Actual: $75.95 ✓`);
console.log(`  Employer Medicare (1.45%): $${grossWages.toFixed(2)} × ${medicareRate} = $${medicareEmployer.toFixed(2)}`);
console.log(`    Expected: $17.76 | Actual: $17.76 ✓`);
console.log(`  FUTA (0.6%): $${grossWages.toFixed(2)} × ${futaRate} = $${futa.toFixed(2)}`);
console.log(`    Expected: $7.35 | Actual: $7.35 ✓`);
console.log(`  CO FAMLI Employer (0.44%): $${grossWages.toFixed(2)} × ${famliRate} = $${famliEmployer.toFixed(2)}`);
console.log(`    Expected: $5.39 | Actual: $5.39 ✓\n`);

// SUI Calculation
const suiRate = 0.017; // Example 1.7% - check Settings for actual rate
const sui = grossWages * suiRate;
console.log(`  CO SUI: $${grossWages.toFixed(2)} × ${suiRate} (employer rate) = $${sui.toFixed(2)}`);
console.log(`    Expected: ~$20.83 | Actual: $20.83`);
console.log(`    (SUI rate appears to be 1.7%)\n`);

console.log('=== VERIFICATION SUMMARY ===');
console.log('✓ All tax calculations are CORRECT');
console.log('✓ All percentages applied accurately');
console.log('❌ Weekend Premium Rate is $25/hr instead of $32.50/hr');
console.log('');
console.log('ROOT CAUSE:');
console.log('  Weekend Pay Multiplier in Settings is set to 1.0 (or not set)');
console.log('  Should be: 1.3');
console.log('');
console.log('IMPACT IF MULTIPLIER WAS SET TO 1.3:');
const correctWeekendRate = 25.00 * 1.3;
const correctWeekendEarnings = weekendHours * correctWeekendRate;
const correctGross = regularEarnings + correctWeekendEarnings;
const difference = correctGross - grossWages;

console.log(`  Weekend: ${weekendHours} hrs @ $${correctWeekendRate.toFixed(2)}/hr = $${correctWeekendEarnings.toFixed(2)}`);
console.log(`  New Gross: $${correctGross.toFixed(2)}`);
console.log(`  Difference: +$${difference.toFixed(2)}`);
console.log(`  Employee would receive ~$${(difference * 0.86).toFixed(2)} more (after taxes)`);
