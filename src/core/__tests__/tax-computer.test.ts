/**
 * TaxComputer Tests
 * 
 * Tests for all tax calculation methods including:
 * - Social Security (employee and employer)
 * - Medicare (employee and employer)
 * - FUTA
 * - Colorado SUTA
 * - Colorado FAMLI
 */

import { TaxComputer, TaxRates } from '../tax-computer';
import { TAX_CONSTANTS_2024, expectCurrencyEqual } from '../../tests/test-utils';

describe('TaxComputer', () => {
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
    });

    describe('Social Security Tax', () => {
        it('should calculate employee SS tax correctly for wages under cap', () => {
            const grossWages = 5000;
            const ytdWages = 0;
            const result = taxComputer.calculateSocialSecurityEmployee(grossWages, ytdWages);

            // 5000 * 0.062 = 310
            expectCurrencyEqual(result, 310.00);
        });

        it('should calculate employer SS tax correctly for wages under cap', () => {
            const grossWages = 5000;
            const ytdWages = 0;
            const result = taxComputer.calculateSocialSecurityEmployer(grossWages, ytdWages);

            // 5000 * 0.062 = 310
            expectCurrencyEqual(result, 310.00);
        });

        it('should respect wage base cap for employee', () => {
            const grossWages = 10000;
            const ytdWages = 172000; // Close to 2025 cap of $176,100
            const result = taxComputer.calculateSocialSecurityEmployee(grossWages, ytdWages);

            // Only $4,100 is taxable (176100 - 172000)
            // 4100 * 0.062 = 254.20
            expectCurrencyEqual(result, 254.20);
        });

        it('should return zero when YTD wages exceed cap', () => {
            const grossWages = 5000;
            const ytdWages = 180000; // Above 2025 cap of $176,100
            const result = taxComputer.calculateSocialSecurityEmployee(grossWages, ytdWages);

            expectCurrencyEqual(result, 0);
        });

        it('should handle exactly at wage base cap', () => {
            const grossWages = 5000;
            const ytdWages = 176100; // Exactly at 2025 cap
            const result = taxComputer.calculateSocialSecurityEmployee(grossWages, ytdWages);

            expectCurrencyEqual(result, 0);
        });
    });

    describe('Medicare Tax', () => {
        it('should calculate employee Medicare tax correctly', () => {
            const grossWages = 5000;
            const result = taxComputer.calculateMedicareEmployee(grossWages);

            // 5000 * 0.0145 = 72.50
            expectCurrencyEqual(result, 72.50);
        });

        it('should calculate employer Medicare tax correctly', () => {
            const grossWages = 5000;
            const result = taxComputer.calculateMedicareEmployer(grossWages);

            // 5000 * 0.0145 = 72.50
            expectCurrencyEqual(result, 72.50);
        });

        it('should have no wage cap (test with large wages)', () => {
            const grossWages = 250000; // Well above SS cap
            const result = taxComputer.calculateMedicareEmployee(grossWages);

            // 250000 * 0.0145 = 3625
            expectCurrencyEqual(result, 3625.00);
        });

        it('should handle zero wages', () => {
            const result = taxComputer.calculateMedicareEmployee(0);
            expectCurrencyEqual(result, 0);
        });
    });

    describe('FUTA Tax', () => {
        it('should calculate FUTA correctly for wages under cap', () => {
            const grossWages = 3000;
            const ytdWages = 0;
            const futa = taxComputer.calculateFUTA(grossWages, ytdWages);

            // 3000 * 0.006 = 18.00
            expectCurrencyEqual(futa, 18.00);
        });

        it('should respect FUTA wage base cap of $7,000', () => {
            const grossWages = 2000;
            const ytdWages = 6000; // $1,000 left before cap
            const futa = taxComputer.calculateFUTA(grossWages, ytdWages);

            // Only $1,000 is taxable (7000 - 6000)
            // 1000 * 0.006 = 6.00
            expectCurrencyEqual(futa, 6.00);
        });

        it('should return zero when YTD wages exceed cap', () => {
            const grossWages = 2000;
            const ytdWages = 8000; // Above cap
            const futa = taxComputer.calculateFUTA(grossWages, ytdWages);

            expectCurrencyEqual(futa, 0);
        });
    });

    describe('Colorado SUTA Tax', () => {
        it('should calculate SUTA correctly for wages under cap', () => {
            const grossWages = 5000;
            const ytdWages = 0;
            const suta = taxComputer.calculateColoradoSUTA(grossWages, ytdWages);

            // 5000 * 0.017 = 85.00
            expectCurrencyEqual(suta, 85.00);
        });

        it('should respect Colorado SUTA wage base cap', () => {
            const grossWages = 3000;
            const ytdWages = 14000; // $2,000 left before $16,000 cap
            const suta = taxComputer.calculateColoradoSUTA(grossWages, ytdWages);

            // Only $2,000 is taxable (16000 - 14000)
            // 2000 * 0.017 = 34.00
            expectCurrencyEqual(suta, 34.00);
        });

        it('should return zero when YTD wages exceed cap', () => {
            const grossWages = 3000;
            const ytdWages = 17000; // Above cap
            const suta = taxComputer.calculateColoradoSUTA(grossWages, ytdWages);

            expectCurrencyEqual(suta, 0);
        });
    });

    describe('Colorado FAMLI Tax', () => {
        it('should calculate employee FAMLI correctly', () => {
            const grossWages = 5000;
            const result = taxComputer.calculateColoradoFAMLIEmployee(grossWages);

            // 5000 * 0.0045 = 22.50
            expectCurrencyEqual(result, 22.50);
        });

        it('should calculate employer FAMLI correctly', () => {
            const grossWages = 5000;
            const result = taxComputer.calculateColoradoFAMLIEmployer(grossWages);

            // 5000 * 0.0045 = 22.50
            expectCurrencyEqual(result, 22.50);
        });

        it('should have no wage cap (test with large wages)', () => {
            const grossWages = 100000;
            const resultEE = taxComputer.calculateColoradoFAMLIEmployee(grossWages);
            const resultER = taxComputer.calculateColoradoFAMLIEmployer(grossWages);

            // 100000 * 0.0045 = 450.00
            expectCurrencyEqual(resultEE, 450.00);
            expectCurrencyEqual(resultER, 450.00);
        });
    });

    describe('Integration: Calculate All Taxes', () => {
        it('should calculate all taxes correctly for a typical payroll', () => {
            const grossWages = 2000;
            const ytdWages = 10000;

            const result = taxComputer.calculateTaxes(grossWages, ytdWages);

            // Social Security: 2000 * 0.062 = 124.00 (each)
            expectCurrencyEqual(result.socialSecurityEmployee, 124.00);
            expectCurrencyEqual(result.socialSecurityEmployer, 124.00);

            // Medicare: 2000 * 0.0145 = 29.00 (each)
            expectCurrencyEqual(result.medicareEmployee, 29.00);
            expectCurrencyEqual(result.medicareEmployer, 29.00);

            // FUTA: 0 (ytdWages 10000 > 7000 cap)
            expectCurrencyEqual(result.futa, 0);

            // Colorado SUTA: 2000 * 0.017 = 34.00
            expectCurrencyEqual(result.coloradoSuta, 34.00);

            // Colorado FAMLI: 2000 * 0.0045 = 9.00 (each)
            expectCurrencyEqual(result.coloradoFamliEmployee, 9.00);
            expectCurrencyEqual(result.coloradoFamliEmployer, 9.00);

            // Totals
            const expectedEmployeeTotal = 124 + 29 + 9; // 162.00
            const expectedEmployerTotal = 124 + 29 + 0 + 34 + 9; // 196.00
            expectCurrencyEqual(result.totalEmployeeWithholdings, expectedEmployeeTotal);
            expectCurrencyEqual(result.totalEmployerTaxes, expectedEmployerTotal);
        });

        it('should handle first payroll of the year', () => {
            const grossWages = 1500;
            const ytdWages = 0;

            const result = taxComputer.calculateTaxes(grossWages, ytdWages);

            // All taxes should be calculated on full amount
            expect(result.socialSecurityEmployee).toBeGreaterThan(0);
            expect(result.medicareEmployee).toBeGreaterThan(0);
            expect(result.futa).toBeGreaterThan(0);
            expect(result.coloradoSuta).toBeGreaterThan(0);
        });

        it('should handle wages at multiple cap thresholds', () => {
            const grossWages = 5000;
            const ytdWages = 6500; // Just past FUTA cap, well before SS cap

            const result = taxComputer.calculateTaxes(grossWages, ytdWages);

            // SS should still be calculated
            expect(result.socialSecurityEmployee).toBeGreaterThan(0);

            // FUTA should be calculated on $500 (7000 - 6500)
            // 500 * 0.006 = 3.00
            expectCurrencyEqual(result.futa, 3.00);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero gross wages', () => {
            const result = taxComputer.calculateTaxes(0, 0);

            expectCurrencyEqual(result.socialSecurityEmployee, 0);
            expectCurrencyEqual(result.medicareEmployee, 0);
            expectCurrencyEqual(result.futa, 0);
            expectCurrencyEqual(result.coloradoSuta, 0);
            expectCurrencyEqual(result.totalEmployeeWithholdings, 0);
            expectCurrencyEqual(result.totalEmployerTaxes, 0);
        });

        it('should handle very small wages (penny test)', () => {
            const result = taxComputer.calculateTaxes(0.01, 0);

            // Should round to 0 for most taxes
            expect(result.socialSecurityEmployee).toBeLessThan(0.01);
            expect(result.medicareEmployee).toBeLessThan(0.01);
        });

        it('should return correct version', () => {
            expect(taxComputer.getVersion()).toBe('v1.0-test');
        });

        it('should return copy of rates', () => {
            const rates = taxComputer.getRates();
            expect(rates.ssRateEmployee).toBe(TAX_CONSTANTS_2024.socialSecurityRate);
            expect(rates.futaRate).toBe(TAX_CONSTANTS_2024.futaRate);
        });
    });
});
