/**
 * Federal Income Tax Withholding Calculator
 * 
 * Implements IRS Publication 15-T (2026) federal income tax withholding
 * based on Form W-4 (2020 or later version).
 * 
 * This calculator uses the percentage method for computing federal withholding
 * and automatically applies the appropriate standard deduction based on filing status.
 * 
 * @see https://www.irs.gov/pub/irs-pdf/p15t.pdf
 */

/**
 * Pay frequency options for payroll calculations
 */
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

/**
 * Filing status from Form W-4
 * Note: "Married Filing Separately" uses same rates as "Single"
 */
export type FilingStatus = 'single' | 'married' | 'head_of_household';

/**
 * W-4 Form Information (2020 or later version)
 */
export interface W4Information {
    /** Filing status from Step 1(c) */
    filingStatus: FilingStatus;

    /** Multiple jobs or spouse works (Step 2 checkbox) */
    multipleJobs: boolean;

    /** Claim dependents amount from Step 3 (annual amount) */
    dependentsAmount: number;

    /** Other income from Step 4(a) (annual amount) */
    otherIncome: number;

    /** Deductions from Step 4(b) (annual amount) */
    deductions: number;

    /** Extra withholding from Step 4(c) (per paycheck amount) */
    extraWithholding: number;
}

/**
 * Federal withholding calculation result
 */
export interface FederalWithholdingResult {
    /** Gross pay for this paycheck */
    grossPay: number;

    /** Federal income tax withheld */
    federalWithholding: number;

    /** Social Security tax (6.2%) */
    socialSecurityWithholding: number;

    /** Medicare tax (1.45%) */
    medicareWithholding: number;

    /** Total FICA taxes (SS + Medicare) */
    totalFICA: number;

    /** Total deductions (Federal + FICA) */
    totalDeductions: number;

    /** Net pay (gross - total deductions) */
    netPay: number;

    /** Calculation breakdown for transparency */
    breakdown: {
        annualizedWages: number;
        adjustedAnnualWages: number;
        standardDeduction: number;
        taxableIncome: number;
        annualTax: number;
        perPaycheckTax: number;
    };
}

/**
 * 2026 Federal Tax Brackets (estimated based on inflation adjustments)
 * These are the marginal tax rates applied to taxable income
 */
const TAX_BRACKETS_2026 = {
    single: [
        { limit: 11600, rate: 0.10 },
        { limit: 47150, rate: 0.12 },
        { limit: 100525, rate: 0.22 },
        { limit: 191950, rate: 0.24 },
        { limit: 243725, rate: 0.32 },
        { limit: 609350, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
    ],
    married: [
        { limit: 23200, rate: 0.10 },
        { limit: 94300, rate: 0.12 },
        { limit: 201050, rate: 0.22 },
        { limit: 383900, rate: 0.24 },
        { limit: 487450, rate: 0.32 },
        { limit: 731200, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
    ],
    head_of_household: [
        { limit: 16550, rate: 0.10 },
        { limit: 63100, rate: 0.12 },
        { limit: 100500, rate: 0.22 },
        { limit: 191950, rate: 0.24 },
        { limit: 243700, rate: 0.32 },
        { limit: 609350, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
    ]
};

/**
 * 2026 Standard Deductions (estimated)
 */
const STANDARD_DEDUCTIONS_2026 = {
    single: 15000,
    married: 30000,
    head_of_household: 22500
};

/**
 * Number of pay periods per year for each frequency
 */
const PAY_PERIODS_PER_YEAR: Record<PayFrequency, number> = {
    weekly: 52,
    biweekly: 26,
    semimonthly: 24,
    monthly: 12
};

/**
 * FICA Tax Rates (2026)
 */
const FICA_RATES = {
    socialSecurity: 0.062,  // 6.2%
    medicare: 0.0145,       // 1.45%
    socialSecurityWageBase: 176100  // 2025 value, 2026 TBD
};

/**
 * Federal Income Tax Withholding Calculator
 * 
 * Calculates federal income tax withholding based on IRS Publication 15-T
 * using the percentage method.
 */
export class FederalWithholdingCalculator {
    /**
     * Calculate federal withholding for a single paycheck
     * 
     * @param grossPay - Gross wages for this pay period
     * @param payFrequency - How often employee is paid
     * @param w4Info - Employee's W-4 form information
     * @param ytdGrossWages - Year-to-date gross wages (for Social Security cap)
     * @returns Complete withholding calculation with breakdown
     */
    static calculateWithholding(
        grossPay: number,
        payFrequency: PayFrequency,
        w4Info: W4Information,
        ytdGrossWages: number = 0
    ): FederalWithholdingResult {
        // Step 1: Calculate FICA taxes (Social Security + Medicare)
        const ficaTaxes = this.calculateFICA(grossPay, ytdGrossWages);

        // Step 2: Calculate federal income tax withholding
        const federalWithholding = this.calculateFederalIncomeTax(
            grossPay,
            payFrequency,
            w4Info
        );

        // Step 3: Calculate totals
        const totalDeductions = federalWithholding.perPaycheckTax + ficaTaxes.total;
        const netPay = grossPay - totalDeductions;

        return {
            grossPay,
            federalWithholding: federalWithholding.perPaycheckTax,
            socialSecurityWithholding: ficaTaxes.socialSecurity,
            medicareWithholding: ficaTaxes.medicare,
            totalFICA: ficaTaxes.total,
            totalDeductions,
            netPay,
            breakdown: {
                annualizedWages: federalWithholding.annualizedWages,
                adjustedAnnualWages: federalWithholding.adjustedAnnualWages,
                standardDeduction: federalWithholding.standardDeduction,
                taxableIncome: federalWithholding.taxableIncome,
                annualTax: federalWithholding.annualTax,
                perPaycheckTax: federalWithholding.perPaycheckTax
            }
        };
    }

    /**
     * Calculate FICA taxes (Social Security + Medicare)
     * 
     * @param grossPay - Gross wages for this pay period
     * @param ytdGrossWages - Year-to-date gross wages before this paycheck
     * @returns FICA tax breakdown
     */
    private static calculateFICA(
        grossPay: number,
        ytdGrossWages: number
    ): { socialSecurity: number; medicare: number; total: number } {
        // Social Security: 6.2% up to wage base ($176,100 for 2025)
        const wageBase = FICA_RATES.socialSecurityWageBase;
        const remainingWageBase = Math.max(0, wageBase - ytdGrossWages);
        const taxableForSS = Math.min(grossPay, remainingWageBase);
        const socialSecurity = this.round(taxableForSS * FICA_RATES.socialSecurity);

        // Medicare: 1.45% on all wages (no cap)
        const medicare = this.round(grossPay * FICA_RATES.medicare);

        return {
            socialSecurity,
            medicare,
            total: socialSecurity + medicare
        };
    }

    /**
     * Calculate federal income tax withholding using percentage method
     * 
     * This implements the IRS Publication 15-T percentage method:
     * 1. Annualize the wages
     * 2. Apply W-4 adjustments (dependents, deductions, other income)
     * 3. Subtract standard deduction
     * 4. Calculate tax using brackets
     * 5. Convert back to per-paycheck amount
     * 6. Add extra withholding
     * 
     * @param grossPay - Gross wages for this pay period
     * @param payFrequency - How often employee is paid
     * @param w4Info - Employee's W-4 information
     * @returns Federal tax calculation breakdown
     */
    private static calculateFederalIncomeTax(
        grossPay: number,
        payFrequency: PayFrequency,
        w4Info: W4Information
    ): {
        annualizedWages: number;
        adjustedAnnualWages: number;
        standardDeduction: number;
        taxableIncome: number;
        annualTax: number;
        perPaycheckTax: number;
    } {
        const payPeriodsPerYear = PAY_PERIODS_PER_YEAR[payFrequency];

        // Step 1: Annualize the wages
        const annualizedWages = grossPay * payPeriodsPerYear;

        // Step 2: Adjust for W-4 entries
        // Add other income, subtract dependents credit and deductions
        const adjustedAnnualWages = annualizedWages
            + w4Info.otherIncome
            - w4Info.dependentsAmount
            - w4Info.deductions;

        // Step 3: Apply standard deduction
        const standardDeduction = STANDARD_DEDUCTIONS_2026[w4Info.filingStatus];
        const taxableIncome = Math.max(0, adjustedAnnualWages - standardDeduction);

        // Step 4: Calculate annual tax using tax brackets
        const annualTax = this.calculateTaxFromBrackets(
            taxableIncome,
            w4Info.filingStatus
        );

        // Step 5: Adjust for multiple jobs if applicable
        let adjustedAnnualTax = annualTax;
        if (w4Info.multipleJobs) {
            // When multiple jobs checkbox is checked, withhold at higher single rate
            // This prevents under-withholding when combined income pushes into higher brackets
            adjustedAnnualTax = this.calculateTaxFromBrackets(taxableIncome, 'single');
        }

        // Step 6: Convert to per-paycheck amount
        let perPaycheckTax = adjustedAnnualTax / payPeriodsPerYear;

        // Step 7: Add extra withholding from Step 4(c)
        perPaycheckTax += w4Info.extraWithholding;

        // Step 8: Round to cents and ensure non-negative
        perPaycheckTax = Math.max(0, this.round(perPaycheckTax));

        return {
            annualizedWages,
            adjustedAnnualWages,
            standardDeduction,
            taxableIncome,
            annualTax: adjustedAnnualTax,
            perPaycheckTax
        };
    }

    /**
     * Calculate tax using progressive tax brackets
     * 
     * @param taxableIncome - Annual taxable income
     * @param filingStatus - Filing status from W-4
     * @returns Annual tax amount
     */
    private static calculateTaxFromBrackets(
        taxableIncome: number,
        filingStatus: FilingStatus
    ): number {
        const brackets = TAX_BRACKETS_2026[filingStatus];
        let tax = 0;
        let previousLimit = 0;

        for (const bracket of brackets) {
            if (taxableIncome <= previousLimit) {
                break;
            }

            // Calculate income in this bracket
            const incomeInBracket = Math.min(
                taxableIncome - previousLimit,
                bracket.limit - previousLimit
            );

            // Apply marginal rate
            tax += incomeInBracket * bracket.rate;

            previousLimit = bracket.limit;
        }

        return tax;
    }

    /**
     * Round to 2 decimal places (cents)
     */
    private static round(amount: number): number {
        return Math.round(amount * 100) / 100;
    }

    /**
     * Create a default W-4 (single filer, no adjustments)
     * Useful for employees who haven't submitted a W-4 yet
     */
    static createDefaultW4(): W4Information {
        return {
            filingStatus: 'single',
            multipleJobs: false,
            dependentsAmount: 0,
            otherIncome: 0,
            deductions: 0,
            extraWithholding: 0
        };
    }

    /**
     * Estimate annual tax liability (for informational purposes)
     * 
     * @param annualGrossWages - Expected annual gross wages
     * @param w4Info - Employee's W-4 information
     * @returns Estimated annual tax breakdown
     */
    static estimateAnnualTax(
        annualGrossWages: number,
        w4Info: W4Information
    ): {
        grossWages: number;
        standardDeduction: number;
        taxableIncome: number;
        federalIncomeTax: number;
        socialSecurityTax: number;
        medicareTax: number;
        totalTax: number;
        effectiveTaxRate: number;
    } {
        // Calculate federal income tax
        const adjustedWages = annualGrossWages
            + w4Info.otherIncome
            - w4Info.dependentsAmount
            - w4Info.deductions;

        const standardDeduction = STANDARD_DEDUCTIONS_2026[w4Info.filingStatus];
        const taxableIncome = Math.max(0, adjustedWages - standardDeduction);
        const federalIncomeTax = this.calculateTaxFromBrackets(taxableIncome, w4Info.filingStatus);

        // Calculate FICA taxes
        const socialSecurityTax = Math.min(
            annualGrossWages,
            FICA_RATES.socialSecurityWageBase
        ) * FICA_RATES.socialSecurity;

        const medicareTax = annualGrossWages * FICA_RATES.medicare;

        const totalTax = federalIncomeTax + socialSecurityTax + medicareTax;
        const effectiveTaxRate = annualGrossWages > 0 ? totalTax / annualGrossWages : 0;

        return {
            grossWages: annualGrossWages,
            standardDeduction,
            taxableIncome,
            federalIncomeTax: this.round(federalIncomeTax),
            socialSecurityTax: this.round(socialSecurityTax),
            medicareTax: this.round(medicareTax),
            totalTax: this.round(totalTax),
            effectiveTaxRate: this.round(effectiveTaxRate * 100) / 100
        };
    }
}
