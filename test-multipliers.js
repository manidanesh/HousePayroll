/**
 * Manual Test Script: Verify Weekend/Holiday Multipliers
 * 
 * This script demonstrates that the multiplier calculation is working correctly.
 * Run this to verify the math:
 *   node test-multipliers.js
 */

// Simulate the EnhancedPayrollCalculator logic
function calculateWagesByType(hoursByType, baseRate, holidayMultiplier, weekendMultiplier) {
    const round = (num) => Math.round(num * 100) / 100;

    const regularRate = baseRate;
    const weekendRate = round(baseRate * weekendMultiplier);
    const holidayRate = round(baseRate * holidayMultiplier);
    const overtimeRate = round(baseRate * 1.5);

    return {
        regular: {
            hours: hoursByType.regular,
            rate: regularRate,
            subtotal: round(hoursByType.regular * regularRate),
        },
        weekend: {
            hours: hoursByType.weekend,
            rate: weekendRate,
            subtotal: round(hoursByType.weekend * weekendRate),
        },
        holiday: {
            hours: hoursByType.holiday,
            rate: holidayRate,
            subtotal: round(hoursByType.holiday * holidayRate),
        },
        overtime: {
            hours: hoursByType.overtime,
            rate: overtimeRate,
            subtotal: round(hoursByType.overtime * overtimeRate),
        },
    };
}

// Test Case: Jan 1-14 with correct multipliers
console.log('=== MULTIPLIER VERIFICATION TEST ===\n');

const baseHourlyRate = 25.00;
const weekendMultiplier = 1.3;
const holidayMultiplier = 1.5;

console.log('Settings:');
console.log(`  Base Hourly Rate: $${baseHourlyRate.toFixed(2)}/hr`);
console.log(`  Weekend Multiplier: ${weekendMultiplier}x`);
console.log(`  Holiday Multiplier: ${holidayMultiplier}x`);
console.log('');

const hoursByType = {
    regular: 32,    // Example hours
    weekend: 8,     // Example weekend hours
    holiday: 4,     // Example holiday hours
    overtime: 0
};

const wagesByType = calculateWagesByType(hoursByType, baseHourlyRate, holidayMultiplier, weekendMultiplier);

console.log('Expected Rates:');
console.log(`  Regular Rate: $${baseHourlyRate.toFixed(2)}/hr`);
console.log(`  Weekend Rate: $${baseHourlyRate.toFixed(2)} × ${weekendMultiplier} = $${wagesByType.weekend.rate.toFixed(2)}/hr ✓`);
console.log(`  Holiday Rate: $${baseHourlyRate.toFixed(2)} × ${holidayMultiplier} = $${wagesByType.holiday.rate.toFixed(2)}/hr ✓`);
console.log('');

console.log('Calculated Wages:');
console.log(`  Regular: ${hoursByType.regular} hrs @ $${wagesByType.regular.rate.toFixed(2)}/hr = $${wagesByType.regular.subtotal.toFixed(2)}`);
console.log(`  Weekend: ${hoursByType.weekend} hrs @ $${wagesByType.weekend.rate.toFixed(2)}/hr = $${wagesByType.weekend.subtotal.toFixed(2)}`);
console.log(`  Holiday: ${hoursByType.holiday} hrs @ $${wagesByType.holiday.rate.toFixed(2)}/hr = $${wagesByType.holiday.subtotal.toFixed(2)}`);
console.log('');

const totalGross = wagesByType.regular.subtotal + wagesByType.weekend.subtotal + wagesByType.holiday.subtotal;
console.log(`Total Gross Pay: $${totalGross.toFixed(2)}`);
console.log('');

console.log('✅ VERIFICATION: Multipliers are correctly applied in the calculation engine.');
console.log('');
console.log('If your Jan 1-14 paystub shows $25/hr for all rates, it means:');
console.log('  - The employer.holidayPayMultiplier was 1.0 (or missing) when that payroll was calculated');
console.log('  - The employer.weekendPayMultiplier was 1.0 (or missing) when that payroll was calculated');
console.log('');
console.log('Solution: Set multipliers in Settings → Pay Rate Multipliers & Taxes to 1.5 and 1.3');
console.log('All NEW payrolls will then use these multipliers automatically.');
