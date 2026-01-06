/**
 * TaxComputer - Encapsulates all tax rules and rates
 * Pure component with no side effects
 */

export interface TaxRates {
    ssRateEmployee: number;
    ssRateEmployer: number;
    medicareRateEmployee: number;
    medicareRateEmployer: number;
    futaRate: number;
    coloradoSutaRate?: number;
}

export interface TaxCalculation {
    socialSecurityEmployee: number;
    medicareEmployee: number;
    socialSecurityEmployer: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta: number;
    totalEmployeeWithholdings: number;
    totalEmployerTaxes: number;
}

export class TaxComputer {
    private rates: TaxRates;
    private version: string;

    constructor(rates: TaxRates, version: string = 'v1.0') {
        this.rates = rates;
        this.version = version;
    }

    /**
     * Calculate all tax amounts for a given gross wage
     */
    calculateTaxes(grossWages: number): TaxCalculation {
        const socialSecurityEmployee = this.calculateSocialSecurityEmployee(grossWages);
        const medicareEmployee = this.calculateMedicareEmployee(grossWages);
        const socialSecurityEmployer = this.calculateSocialSecurityEmployer(grossWages);
        const medicareEmployer = this.calculateMedicareEmployer(grossWages);
        const futa = this.calculateFUTA(grossWages);
        const coloradoSuta = this.calculateColoradoSUTA(grossWages);

        return {
            socialSecurityEmployee,
            medicareEmployee,
            socialSecurityEmployer,
            medicareEmployer,
            futa,
            coloradoSuta,
            totalEmployeeWithholdings: socialSecurityEmployee + medicareEmployee,
            totalEmployerTaxes: socialSecurityEmployer + medicareEmployer + futa + coloradoSuta,
        };
    }

    // Pure calculation functions
    calculateSocialSecurityEmployee(grossWages: number): number {
        return this.round(grossWages * this.rates.ssRateEmployee);
    }

    calculateMedicareEmployee(grossWages: number): number {
        return this.round(grossWages * this.rates.medicareRateEmployee);
    }

    calculateSocialSecurityEmployer(grossWages: number): number {
        return this.round(grossWages * this.rates.ssRateEmployer);
    }

    calculateMedicareEmployer(grossWages: number): number {
        return this.round(grossWages * this.rates.medicareRateEmployer);
    }

    calculateFUTA(grossWages: number): number {
        return this.round(grossWages * this.rates.futaRate);
    }

    calculateColoradoSUTA(grossWages: number): number {
        const sutaRate = this.rates.coloradoSutaRate || 0;
        return this.round(grossWages * sutaRate);
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
