/**
 * PayrollCalculator - Pure functions for payroll computation
 * No side effects, no database access
 */

import { TaxComputer, TaxCalculation } from './tax-computer';

export interface TaxAmounts {
    socialSecurityEmployee: number;
    medicareEmployee: number;
    socialSecurityEmployer: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta: number;
    coloradoFamliEmployee: number;
    coloradoFamliEmployer: number;
    coloradoStateIncomeTax: number;
    totalEmployeeWithholdings: number;
    totalEmployerTaxes: number;
}

export interface PayrollInput {
    caregiverId: number;
    hoursWorked: number;
    hourlyRate: number;
    federalWithholdingAmount?: number;
}

export interface PayrollResult {
    caregiverId: number;
    hoursWorked: number;
    grossWages: number;
    taxes: TaxCalculation;
    federalWithholding: number;
    netPay: number;
    calculationVersion: string;
    taxVersion: string;
}

export class PayrollCalculator {
    private taxComputer: TaxComputer;
    private version: string;

    constructor(taxComputer: TaxComputer, version: string = 'v1.0') {
        this.taxComputer = taxComputer;
        this.version = version;
    }

    /**
     * Calculate payroll for a single caregiver
     * Pure function - returns payroll object without persisting
     */
    calculatePayroll(input: PayrollInput): PayrollResult {
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
    calculateMultiCaregiverPayroll(inputs: PayrollInput[]): PayrollResult[] {
        return inputs.map(input => this.calculatePayroll(input));
    }

    // Helper: Round to 2 decimal places
    private round(amount: number): number {
        return Math.round(amount * 100) / 100;
    }
}
