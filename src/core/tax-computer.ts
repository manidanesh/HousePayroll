/**
 * TaxComputer - Calculates federal and state taxes for household employees
 * 
 * Handles all payroll tax calculations including:
 * - FICA: Social Security (6.2% employee + 6.2% employer, capped at wage base)
 * - FICA: Medicare (1.45% employee + 1.45% employer, no cap)
 * - FUTA: Federal Unemployment Tax (0.6% employer only, capped at $7,000)
 * - Colorado SUTA: State Unemployment Tax (1.7% default, capped at $16,000)
 * - Colorado FAMLI: Family Medical Leave Insurance (0.45% employee + 0.45% employer)
 * 
 * All calculations respect wage base caps and YTD tracking to prevent over-taxation.
 * 
 * @example
 * ```typescript
 * const rates: TaxRates = {
 *   ssRateEmployee: 0.062,
 *   ssRateEmployer: 0.062,
 *   ssWageBase: 176100,
 *   medicareRateEmployee: 0.0145,
 *   medicareRateEmployer: 0.0145,
 *   futaRate: 0.006,
 *   futaWageBase: 7000,
 *   coloradoSutaRate: 0.017,
 *   coloradoSutaCap: 16000,
 *   coloradoFamliRate: 0.0045,
 *   coloradoFamliRateER: 0.0045,
 * };
 * 
 * const taxComputer = new TaxComputer(rates, 'v1.0-2024');
 * const taxes = taxComputer.calculateTaxes(5000, 10000);
 * ```
 */

export interface TaxRates {
    ssRateEmployee: number;
    ssRateEmployer: number;
    ssWageBase: number;  // Social Security wage base cap
    medicareRateEmployee: number;
    medicareRateEmployer: number;
    medicareWageBase?: number;  // Medicare wage base (null = unlimited)
    futaRate: number;
    futaWageBase: number;  // FUTA wage base cap
    coloradoSutaRate?: number;
    coloradoSutaCap?: number;
    coloradoFamliRate?: number; // Added for FAMLI (EE)
    coloradoFamliRateER?: number; // Added for FAMLI (ER)
    coloradoStateIncomeTaxRate?: number; // Colorado flat income tax (4.40% for 2026)
}

export interface TaxCalculation {
    socialSecurityEmployee: number;
    medicareEmployee: number;
    socialSecurityEmployer: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta: number;
    coloradoFamliEmployee: number; // Added
    coloradoFamliEmployer: number; // Added
    coloradoStateIncomeTax: number; // Colorado 4.40% flat income tax
    totalEmployeeWithholdings: number;
    totalEmployerTaxes: number;
}

export class TaxComputer {
    private rates: TaxRates;
    private version: string;

    /**
     * Create a new TaxComputer instance
     * 
     * @param rates - Tax rates configuration for the tax year
     * @param version - Version identifier for tax calculation logic (e.g., 'v1.0-2024')
     */
    constructor(rates: TaxRates, version: string = 'v1.0') {
        this.rates = rates;
        this.version = version;
    }

    /**
     * Calculate all taxes for a given gross wage amount
     * 
     * This is the main entry point for tax calculations. It computes all federal and state
     * taxes while respecting wage base caps and YTD tracking.
     * 
     * @param grossWages - Gross wages for the current pay period
     * @param ytdWagesBefore - Year-to-date wages before this pay period (for cap calculations)
     * @returns Complete tax calculation including employee and employer portions
     * 
     * @example
     * ```typescript
     * // First payroll of the year
     * const taxes = taxComputer.calculateTaxes(5000, 0);
     * 
     * // Later payroll with YTD tracking
     * const taxes = taxComputer.calculateTaxes(5000, 150000);
     * // Social Security will be capped if ytdWagesBefore + grossWages > ssWageBase
     * ```
     */
    calculateTaxes(grossWages: number, ytdWagesBefore: number = 0): TaxCalculation {
        const socialSecurityEmployee = this.calculateSocialSecurityEmployee(grossWages, ytdWagesBefore);
        const medicareEmployee = this.calculateMedicareEmployee(grossWages);
        const socialSecurityEmployer = this.calculateSocialSecurityEmployer(grossWages, ytdWagesBefore);
        const medicareEmployer = this.calculateMedicareEmployer(grossWages);
        const futa = this.calculateFUTA(grossWages, ytdWagesBefore);
        const coloradoSuta = this.calculateColoradoSUTA(grossWages, ytdWagesBefore);
        const coloradoFamliEmployee = this.calculateColoradoFAMLIEmployee(grossWages);
        const coloradoFamliEmployer = this.calculateColoradoFAMLIEmployer(grossWages);
        const coloradoStateIncomeTax = this.calculateColoradoStateIncomeTax(grossWages);

        return {
            socialSecurityEmployee,
            medicareEmployee,
            socialSecurityEmployer,
            medicareEmployer,
            futa,
            coloradoSuta,
            coloradoFamliEmployee,
            coloradoFamliEmployer,
            coloradoStateIncomeTax,
            totalEmployeeWithholdings: this.round(socialSecurityEmployee + medicareEmployee + coloradoFamliEmployee + coloradoStateIncomeTax),
            totalEmployerTaxes: this.round(socialSecurityEmployer + medicareEmployer + futa + coloradoSuta + coloradoFamliEmployer),
        };
    }

    // Pure calculation functions
    calculateSocialSecurityEmployee(grossWages: number, ytdWagesBefore: number = 0): number {
        const cap = this.rates.ssWageBase;
        const remainingCap = Math.max(0, cap - ytdWagesBefore);
        const taxableWages = Math.min(grossWages, remainingCap);
        return this.round(taxableWages * this.rates.ssRateEmployee);
    }

    calculateMedicareEmployee(grossWages: number): number {
        return this.round(grossWages * this.rates.medicareRateEmployee);
    }

    calculateSocialSecurityEmployer(grossWages: number, ytdWagesBefore: number = 0): number {
        const cap = this.rates.ssWageBase;
        const remainingCap = Math.max(0, cap - ytdWagesBefore);
        const taxableWages = Math.min(grossWages, remainingCap);
        return this.round(taxableWages * this.rates.ssRateEmployer);
    }

    calculateMedicareEmployer(grossWages: number): number {
        return this.round(grossWages * this.rates.medicareRateEmployer);
    }

    calculateFUTA(grossWages: number, ytdWagesBefore: number): number {
        const cap = this.rates.futaWageBase;
        const remainingCap = Math.max(0, cap - ytdWagesBefore);
        const taxableWages = Math.min(grossWages, remainingCap);
        return this.round(taxableWages * this.rates.futaRate);
    }

    calculateColoradoSUTA(grossWages: number, ytdWagesBefore: number): number {
        const SUTA_CAP = this.rates.coloradoSutaCap || 16000;
        const sutaRate = this.rates.coloradoSutaRate || 0;
        const remainingCap = Math.max(0, SUTA_CAP - ytdWagesBefore);
        const taxableWages = Math.min(grossWages, remainingCap);
        return this.round(taxableWages * sutaRate);
    }

    calculateColoradoFAMLIEmployee(grossWages: number): number {
        const famliRate = this.rates.coloradoFamliRate || 0.0045;
        return this.round(grossWages * famliRate);
    }

    calculateColoradoFAMLIEmployer(grossWages: number): number {
        // Use the configured employer share (defaulting to 0.45% per user request)
        // Rate is actually passed in via TaxRates (added in interface update below)
        const famliRateER = (this.rates as any).coloradoFamliRateER || 0.0045;
        return this.round(grossWages * famliRateER);
    }

    calculateColoradoStateIncomeTax(grossWages: number): number {
        // Colorado has a flat 4.40% state income tax (as of 2026)
        const stateRate = this.rates.coloradoStateIncomeTaxRate || 0.044;
        return this.round(grossWages * stateRate);
    }

    getVersion(): string {
        return this.version;
    }

    getRates(): TaxRates {
        return { ...this.rates };
    }

    // Helper: Round to 2 decimal places
    private round(amount: number): number {
        return Math.round(amount * 100) / 100;
    }
}
