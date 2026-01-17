/**
 * EnhancedPayrollCalculator Tests
 * 
 * Tests for payroll calculation including:
 * - Hours categorization (regular, weekend, holiday, overtime)
 * - Wage calculations with multipliers
 * - Tax integration
 * - Minimum wage compliance
 */

import { EnhancedPayrollCalculator } from '../enhanced-payroll-calculator';
import { TaxComputer, TaxRates } from '../tax-computer';
import { TAX_CONSTANTS_2024, expectCurrencyEqual } from '../../tests/test-utils';

describe('EnhancedPayrollCalculator', () => {
    let calculator: EnhancedPayrollCalculator;
    let taxComputer: TaxComputer;
    let taxRates: TaxRates;

    beforeEach(() => {
        // Set up tax rates for 2024
        taxRates = {
            ssRateEmployee: TAX_CONSTANTS_2024.socialSecurityRate,
            ssRateEmployer: TAX_CONSTANTS_2024.socialSecurityRate,
            ssWageBase: TAX_CONSTANTS_2024.socialSecurityWageBase,
            medicareRateEmployee: TAX_CONSTANTS_2024.medicareRate,
            medicareRateEmployer: TAX_CONSTANTS_2024.medicareRate,
            futaRate: TAX_CONSTANTS_2024.futaRate,
            futaWageBase: TAX_CONSTANTS_2024.futaWageBase,
            coloradoSutaRate: TAX_CONSTANTS_2024.coloradoSutaRate,
            coloradoSutaCap: TAX_CONSTANTS_2024.coloradoSutaWageBase,
            coloradoFamliRate: TAX_CONSTANTS_2024.coloradoFamliRateEE,
            coloradoFamliRateER: TAX_CONSTANTS_2024.coloradoFamliRateER,
        };
        taxComputer = new TaxComputer(taxRates, 'v1.0-test');
        calculator = new EnhancedPayrollCalculator(taxComputer);
    });

    describe('Hours Categorization', () => {
        it('should categorize regular weekday hours correctly', () => {
            const timeEntries = [
                { date: '2024-01-02', hours: 8 }, // Tuesday
                { date: '2024-01-03', hours: 8 }, // Wednesday
                { date: '2024-01-04', hours: 8 }, // Thursday
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            expect(result.hoursByType.regular).toBe(24);
            expect(result.hoursByType.weekend).toBe(0);
            expect(result.hoursByType.holiday).toBe(0);
            expect(result.hoursByType.overtime).toBe(0);
        });

        it('should categorize weekend hours correctly', () => {
            const timeEntries = [
                { date: '2024-01-06', hours: 8 }, // Saturday
                { date: '2024-01-07', hours: 8 }, // Sunday
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            expect(result.hoursByType.regular).toBe(0);
            expect(result.hoursByType.weekend).toBe(16);
            expect(result.hoursByType.holiday).toBe(0);
            expect(result.hoursByType.overtime).toBe(0);
        });

        it('should categorize holiday hours correctly', () => {
            const timeEntries = [
                { date: '2024-01-01', hours: 8, dayType: 'holiday' as const }, // New Year's Day
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            expect(result.hoursByType.regular).toBe(0);
            expect(result.hoursByType.weekend).toBe(0);
            expect(result.hoursByType.holiday).toBe(8);
            expect(result.hoursByType.overtime).toBe(0);
        });

        it('should handle mixed week with weekday, weekend, and holiday hours', () => {
            const timeEntries = [
                { date: '2024-01-01', hours: 8, dayType: 'holiday' as const }, // Monday (New Year's)
                { date: '2024-01-02', hours: 8 }, // Tuesday
                { date: '2024-01-03', hours: 8 }, // Wednesday
                { date: '2024-01-06', hours: 8 }, // Saturday
                { date: '2024-01-07', hours: 8 }, // Sunday
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            expect(result.hoursByType.regular).toBe(16); // Tue + Wed
            expect(result.hoursByType.weekend).toBe(16); // Sat + Sun
            expect(result.hoursByType.holiday).toBe(8); // New Year's
            expect(result.totalHours).toBe(40);
        });
    });

    describe('Overtime Calculation', () => {
        it.skip('should calculate overtime for hours over 40 regular hours per week', () => {
            const timeEntries = [
                { date: '2024-01-01', hours: 9 }, // Monday
                { date: '2024-01-02', hours: 9 }, // Tuesday
                { date: '2024-01-03', hours: 9 }, // Wednesday
                { date: '2024-01-04', hours: 9 }, // Thursday
                { date: '2024-01-05', hours: 9 }, // Friday (45 hours total)
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            // 45 regular hours total, 40 regular + 5 overtime
            expect(result.hoursByType.regular).toBe(40);
            expect(result.hoursByType.overtime).toBe(5);
            expect(result.totalHours).toBe(40); // totalHours excludes overtime
        });

        it.skip('should not calculate overtime when disabled', () => {
            const timeEntries = [
                { date: '2024-01-01', hours: 9 }, // Monday
                { date: '2024-01-02', hours: 9 }, // Tuesday
                { date: '2024-01-03', hours: 9 }, // Wednesday
                { date: '2024-01-04', hours: 9 }, // Thursday
                { date: '2024-01-05', hours: 9 }, // Friday
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
                disableOvertime: true,
            });

            expect(result.hoursByType.regular).toBe(45);
            expect(result.hoursByType.overtime).toBe(0);
            expect(result.totalHours).toBe(45);
        });

        it.skip('should not calculate overtime for exactly 40 regular hours', () => {
            const timeEntries = [
                { date: '2024-01-01', hours: 8 }, // Monday
                { date: '2024-01-02', hours: 8 }, // Tuesday
                { date: '2024-01-03', hours: 8 }, // Wednesday
                { date: '2024-01-04', hours: 8 }, // Thursday
                { date: '2024-01-05', hours: 8 }, // Friday
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            expect(result.hoursByType.regular).toBe(40);
            expect(result.hoursByType.overtime).toBe(0);
            expect(result.totalHours).toBe(40);
        });
    });

    describe('Wage Calculations', () => {
        it('should calculate regular wages correctly', () => {
            const timeEntries = [
                { date: '2024-01-02', hours: 8 }, // Tuesday
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            // 8 hours * $20/hr = $160
            expectCurrencyEqual(result.wagesByType.regular.subtotal, 160.00);
            expect(result.wagesByType.regular.hours).toBe(8);
            expect(result.wagesByType.regular.rate).toBe(20);
        });

        it('should calculate weekend wages with 1.5x multiplier', () => {
            const timeEntries = [
                { date: '2024-01-06', hours: 8 }, // Saturday
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            // 8 hours * $20/hr * 1.5 = $240
            expectCurrencyEqual(result.wagesByType.weekend.subtotal, 240.00);
            expect(result.wagesByType.weekend.hours).toBe(8);
            expect(result.wagesByType.weekend.rate).toBe(30); // 20 * 1.5
        });

        it('should calculate holiday wages with 2.0x multiplier', () => {
            const timeEntries = [
                { date: '2024-01-01', hours: 8, dayType: 'holiday' as const },
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            // 8 hours * $20/hr * 2.0 = $320
            expectCurrencyEqual(result.wagesByType.holiday.subtotal, 320.00);
            expect(result.wagesByType.holiday.hours).toBe(8);
            expect(result.wagesByType.holiday.rate).toBe(40); // 20 * 2.0
        });

        it.skip('should calculate overtime wages at 1.5x base rate', () => {
            const timeEntries = [
                { date: '2024-01-01', hours: 9 }, // Monday
                { date: '2024-01-02', hours: 9 }, // Tuesday
                { date: '2024-01-03', hours: 9 }, // Wednesday
                { date: '2024-01-04', hours: 9 }, // Thursday
                { date: '2024-01-05', hours: 9 }, // Friday (45 hours, 5 overtime)
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            // 5 hours * $20/hr * 1.5 = $150
            expectCurrencyEqual(result.wagesByType.overtime.subtotal, 150.00);
            expect(result.wagesByType.overtime.hours).toBe(5);
            expect(result.wagesByType.overtime.rate).toBe(30); // 20 * 1.5
        });

        it('should calculate gross wages as sum of all wage types', () => {
            const timeEntries = [
                { date: '2024-01-01', hours: 8, dayType: 'holiday' as const }, // Holiday: 8 * 20 * 2.0 = 320
                { date: '2024-01-02', hours: 8 }, // Regular: 8 * 20 = 160
                { date: '2024-01-06', hours: 8 }, // Weekend: 8 * 20 * 1.5 = 240
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            // Total: 320 + 160 + 240 = 720
            expectCurrencyEqual(result.grossWages, 720.00);
        });
    });

    describe('Tax Integration', () => {
        it('should calculate all taxes correctly', () => {
            const timeEntries = [
                { date: '2024-01-02', hours: 8 }, // Tuesday
                { date: '2024-01-03', hours: 8 }, // Wednesday
                { date: '2024-01-04', hours: 8 }, // Thursday
                { date: '2024-01-05', hours: 8 }, // Friday
                { date: '2024-01-06', hours: 8 }, // Saturday (weekend pay)
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
                ytdWagesBefore: 0,
            });

            // Gross: (32 regular * 20) + (8 weekend * 30) = 640 + 240 = 880
            expectCurrencyEqual(result.grossWages, 880.00);

            // Taxes should be calculated
            expect(result.taxes.socialSecurityEmployee).toBeGreaterThan(0);
            expect(result.taxes.medicareEmployee).toBeGreaterThan(0);
            expect(result.taxes.futa).toBeGreaterThan(0);
            expect(result.taxes.coloradoSuta).toBeGreaterThan(0);
        });

        it('should calculate net pay correctly', () => {
            const timeEntries = [
                { date: '2024-01-02', hours: 40 },
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
                federalWithholdingAmount: 50,
                ytdWagesBefore: 0,
            });

            // Net = Gross - Employee Taxes - Federal Withholding
            const expectedNet = result.grossWages -
                result.taxes.socialSecurityEmployee -
                result.taxes.medicareEmployee -
                result.taxes.coloradoFamliEmployee -
                result.taxes.coloradoStateIncomeTax -
                result.federalWithholding;


            expectCurrencyEqual(result.netPay, expectedNet);
        });

        it('should handle federal withholding', () => {
            const timeEntries = [
                { date: '2024-01-02', hours: 40 },
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
                federalWithholdingAmount: 100,
            });

            expectCurrencyEqual(result.federalWithholding, 100.00);
        });
    });

    describe('Minimum Wage Compliance', () => {
        it('should mark as compliant when wages meet minimum wage', () => {
            const timeEntries = [
                { date: '2024-01-02', hours: 40 },
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20, // Well above minimum wage
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            expect(result.isMinimumWageCompliant).toBe(true);
        });

        it.skip('should mark as non-compliant when effective rate below minimum wage', () => {
            const timeEntries = [
                { date: '2024-01-02', hours: 40 },
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 10, // Below Colorado minimum of $14.42
                holidayMultiplier: 1.0,
                weekendMultiplier: 1.0,
            });

            expect(result.isMinimumWageCompliant).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero hours', () => {
            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries: [],
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            expect(result.totalHours).toBe(0);
            expectCurrencyEqual(result.grossWages, 0);
            expectCurrencyEqual(result.netPay, 0);
        });

        it('should handle custom multipliers', () => {
            const timeEntries = [
                { date: '2024-01-06', hours: 8 }, // Saturday
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 3.0, // Triple pay for holidays
                weekendMultiplier: 2.0, // Double pay for weekends
            });

            // 8 hours * $20/hr * 2.0 = $320
            expectCurrencyEqual(result.wagesByType.weekend.subtotal, 320.00);
        });

        it('should return correct calculation version', () => {
            const timeEntries = [
                { date: '2024-01-02', hours: 8 },
            ];

            const result = calculator.calculatePayroll({
                caregiverId: 1,
                timeEntries,
                baseHourlyRate: 20,
                holidayMultiplier: 2.0,
                weekendMultiplier: 1.5,
            });

            expect(result.calculationVersion).toBeDefined();
            expect(result.taxVersion).toBe('v1.0-test');
        });
    });
});
