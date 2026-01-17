import { FederalWithholdingCalculator, W4Information } from '../federal-withholding-calculator';

describe('FederalWithholdingCalculator', () => {
    describe('calculateWithholding', () => {
        it('should calculate withholding for single filer, biweekly, $950 gross', () => {
            const w4: W4Information = {
                filingStatus: 'single',
                multipleJobs: false,
                dependentsAmount: 0,
                otherIncome: 0,
                deductions: 0,
                extraWithholding: 0
            };

            const result = FederalWithholdingCalculator.calculateWithholding(
                949.90,
                'biweekly',
                w4,
                0
            );

            // Expected calculations:
            // Annual wages: $949.90 × 26 = $24,697.40
            // Standard deduction: $15,000
            // Taxable income: $9,697.40
            // Tax (10% bracket): $969.74
            // Per paycheck: $969.74 ÷ 26 = $37.30

            expect(result.grossPay).toBe(949.90);
            expect(result.federalWithholding).toBeCloseTo(37.30, 1);
            expect(result.socialSecurityWithholding).toBeCloseTo(58.89, 2);
            expect(result.medicareWithholding).toBeCloseTo(13.77, 2);
            expect(result.totalFICA).toBeCloseTo(72.66, 2);
            expect(result.netPay).toBeCloseTo(839.94, 1);
        });

        it('should calculate withholding for married filer, biweekly, $950 gross', () => {
            const w4: W4Information = {
                filingStatus: 'married',
                multipleJobs: false,
                dependentsAmount: 0,
                otherIncome: 0,
                deductions: 0,
                extraWithholding: 0
            };

            const result = FederalWithholdingCalculator.calculateWithholding(
                949.90,
                'biweekly',
                w4,
                0
            );

            // Married standard deduction: $30,000
            // Annual wages: $24,697.40
            // Taxable income: $0 (below standard deduction)
            // Federal withholding: $0

            expect(result.federalWithholding).toBe(0);
            expect(result.netPay).toBeCloseTo(877.24, 2);
        });

        it('should handle extra withholding', () => {
            const w4: W4Information = {
                filingStatus: 'single',
                multipleJobs: false,
                dependentsAmount: 0,
                otherIncome: 0,
                deductions: 0,
                extraWithholding: 25.00
            };

            const result = FederalWithholdingCalculator.calculateWithholding(
                949.90,
                'biweekly',
                w4,
                0
            );

            // Base withholding ~$37.30 + $25 extra = ~$62.30
            expect(result.federalWithholding).toBeCloseTo(62.30, 1);
        });

        it('should handle dependents credit', () => {
            const w4: W4Information = {
                filingStatus: 'single',
                multipleJobs: false,
                dependentsAmount: 2000, // $2000 annual credit
                otherIncome: 0,
                deductions: 0,
                extraWithholding: 0
            };

            const result = FederalWithholdingCalculator.calculateWithholding(
                949.90,
                'biweekly',
                w4,
                0
            );

            // Adjusted annual wages: $24,697.40 - $2,000 = $22,697.40
            // Taxable: $22,697.40 - $15,000 = $7,697.40
            // Tax: $769.74
            // Per paycheck: $29.61
            expect(result.federalWithholding).toBeCloseTo(29.61, 1);
        });

        it('should respect Social Security wage base cap', () => {
            const w4: W4Information = FederalWithholdingCalculator.createDefaultW4();

            // Employee already earned $176,000 YTD (near cap of $176,100)
            const result = FederalWithholdingCalculator.calculateWithholding(
                949.90,
                'biweekly',
                w4,
                176000
            );

            // Only $100 remaining under cap
            // SS tax: $100 × 6.2% = $6.20
            expect(result.socialSecurityWithholding).toBeCloseTo(6.20, 2);

            // Medicare has no cap
            expect(result.medicareWithholding).toBeCloseTo(13.77, 2);
        });

        it('should handle income below taxable threshold', () => {
            const w4: W4Information = {
                filingStatus: 'single',
                multipleJobs: false,
                dependentsAmount: 0,
                otherIncome: 0,
                deductions: 0,
                extraWithholding: 0
            };

            // Low income: $200 biweekly = $5,200 annual (below standard deduction)
            const result = FederalWithholdingCalculator.calculateWithholding(
                200.00,
                'biweekly',
                w4,
                0
            );

            expect(result.federalWithholding).toBe(0);
            expect(result.socialSecurityWithholding).toBeCloseTo(12.40, 2);
            expect(result.medicareWithholding).toBeCloseTo(2.90, 2);
        });
    });

    describe('estimateAnnualTax', () => {
        it('should estimate annual tax for $25,000 salary', () => {
            const w4: W4Information = FederalWithholdingCalculator.createDefaultW4();

            const estimate = FederalWithholdingCalculator.estimateAnnualTax(25000, w4);

            expect(estimate.grossWages).toBe(25000);
            expect(estimate.standardDeduction).toBe(15000);
            expect(estimate.taxableIncome).toBe(10000);
            expect(estimate.federalIncomeTax).toBeCloseTo(1000, 0); // 10% bracket
            expect(estimate.socialSecurityTax).toBeCloseTo(1550, 0); // 6.2%
            expect(estimate.medicareTax).toBeCloseTo(362.50, 2); // 1.45%
        });
    });

    describe('createDefaultW4', () => {
        it('should create valid default W-4', () => {
            const w4 = FederalWithholdingCalculator.createDefaultW4();

            expect(w4.filingStatus).toBe('single');
            expect(w4.multipleJobs).toBe(false);
            expect(w4.dependentsAmount).toBe(0);
            expect(w4.otherIncome).toBe(0);
            expect(w4.deductions).toBe(0);
            expect(w4.extraWithholding).toBe(0);
        });
    });
});
