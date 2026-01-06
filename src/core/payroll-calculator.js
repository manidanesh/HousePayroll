"use strict";
/**
 * PayrollCalculator - Pure functions for payroll computation
 * No side effects, no database access
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollCalculator = void 0;
class PayrollCalculator {
    constructor(taxComputer, version = 'v1.0') {
        this.taxComputer = taxComputer;
        this.version = version;
    }
    /**
     * Calculate payroll for a single caregiver
     * Pure function - returns payroll object without persisting
     */
    calculatePayroll(input) {
        // Calculate gross wages
        const grossWages = this.round(input.hoursWorked * input.hourlyRate);
        // Calculate taxes using TaxComputer
        const taxes = this.taxComputer.calculateTaxes(grossWages);
        // Federal withholding (optional)
        const federalWithholding = input.federalWithholdingAmount || 0;
        // Calculate net pay
        const totalWithholdings = taxes.totalEmployeeWithholdings + federalWithholding;
        const netPay = this.round(grossWages - totalWithholdings);
        return {
            caregiverId: input.caregiverId,
            hoursWorked: input.hoursWorked,
            grossWages,
            taxes,
            federalWithholding,
            netPay,
            calculationVersion: this.version,
            taxVersion: this.taxComputer.getVersion(),
        };
    }
    /**
     * Calculate payroll for multiple caregivers in batch
     */
    calculateMultiCaregiverPayroll(inputs) {
        return inputs.map(input => this.calculatePayroll(input));
    }
    // Helper: Round to 2 decimal places
    round(amount) {
        return Math.round(amount * 100) / 100;
    }
}
exports.PayrollCalculator = PayrollCalculator;
