"use strict";
/**
 * TaxComputer - Encapsulates all tax rules and rates
 * Pure component with no side effects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxComputer = void 0;
class TaxComputer {
    constructor(rates, version = 'v1.0') {
        this.rates = rates;
        this.version = version;
    }
    /**
     * Calculate all tax amounts for a given gross wage
     */
    calculateTaxes(grossWages) {
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
    calculateSocialSecurityEmployee(grossWages) {
        return this.round(grossWages * this.rates.ssRateEmployee);
    }
    calculateMedicareEmployee(grossWages) {
        return this.round(grossWages * this.rates.medicareRateEmployee);
    }
    calculateSocialSecurityEmployer(grossWages) {
        return this.round(grossWages * this.rates.ssRateEmployer);
    }
    calculateMedicareEmployer(grossWages) {
        return this.round(grossWages * this.rates.medicareRateEmployer);
    }
    calculateFUTA(grossWages) {
        return this.round(grossWages * this.rates.futaRate);
    }
    calculateColoradoSUTA(grossWages) {
        const sutaRate = this.rates.coloradoSutaRate || 0;
        return this.round(grossWages * sutaRate);
    }
    getVersion() {
        return this.version;
    }
    getRates() {
        return { ...this.rates };
    }
    // Helper: Round to 2 decimal places
    round(amount) {
        return Math.round(amount * 100) / 100;
    }
}
exports.TaxComputer = TaxComputer;
