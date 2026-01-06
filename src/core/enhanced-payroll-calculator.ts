/**
 * Enhanced PayrollCalculator with Holiday/Weekend Pay Support
 * Applies multipliers based on day type (regular/weekend/holiday)
 */

import { TaxComputer, TaxCalculation } from './tax-computer';
import { HolidayCalendar, DayType } from '../utils/holiday-calendar';

export interface TimeEntryForPayroll {
    date: string; // YYYY-MM-DD
    hours: number;
    dayType?: DayType; // Optional: can be auto-detected if not provided
}

export interface HoursByType {
    regular: number;
    weekend: number;
    holiday: number;
}

export interface WagesByType {
    regular: { hours: number; rate: number; subtotal: number };
    weekend: { hours: number; rate: number; subtotal: number };
    holiday: { hours: number; rate: number; subtotal: number };
}

export interface EnhancedPayrollInput {
    caregiverId: number;
    timeEntries: TimeEntryForPayroll[];
    baseHourlyRate: number;
    holidayMultiplier: number;
    weekendMultiplier: number;
    federalWithholdingAmount?: number;
}

export interface EnhancedPayrollResult {
    caregiverId: number;
    totalHours: number;
    hoursByType: HoursByType;
    wagesByType: WagesByType;
    grossWages: number;
    taxes: TaxCalculation;
    federalWithholding: number;
    netPay: number;
    calculationVersion: string;
    taxVersion: string;
}

export class EnhancedPayrollCalculator {
    private taxComputer: TaxComputer;
    private version: string;

    constructor(taxComputer: TaxComputer, version: string = 'v2.0-differential-pay') {
        this.taxComputer = taxComputer;
        this.version = version;
    }

    /**
     * Calculate payroll with differential pay for holidays and weekends
     */
    calculatePayroll(input: EnhancedPayrollInput): EnhancedPayrollResult {
        // Categorize hours by type
        const hoursByType = this.categorizeHours(input.timeEntries);

        // Calculate wages by type with appropriate multipliers
        const wagesByType = this.calculateWagesByType(
            hoursByType,
            input.baseHourlyRate,
            input.holidayMultiplier,
            input.weekendMultiplier
        );

        // Calculate total gross wages
        const grossWages = this.round(
            wagesByType.regular.subtotal +
            wagesByType.weekend.subtotal +
            wagesByType.holiday.subtotal
        );

        // Calculate taxes using TaxComputer
        const taxes = this.taxComputer.calculateTaxes(grossWages);

        // Federal withholding (optional)
        const federalWithholding = input.federalWithholdingAmount || 0;

        // Calculate net pay
        const totalWithholdings = taxes.totalEmployeeWithholdings + federalWithholding;
        const netPay = this.round(grossWages - totalWithholdings);

        // Calculate total hours
        const totalHours = hoursByType.regular + hoursByType.weekend + hoursByType.holiday;

        return {
            caregiverId: input.caregiverId,
            totalHours,
            hoursByType,
            wagesByType,
            grossWages,
            taxes,
            federalWithholding,
            netPay,
            calculationVersion: this.version,
            taxVersion: this.taxComputer.getVersion(),
        };
    }

    /**
     * Categorize time entries by day type
     */
    private categorizeHours(timeEntries: TimeEntryForPayroll[]): HoursByType {
        const hours: HoursByType = {
            regular: 0,
            weekend: 0,
            holiday: 0,
        };

        for (const entry of timeEntries) {
            const dayType = entry.dayType || HolidayCalendar.getDayType(entry.date);

            switch (dayType) {
                case 'holiday':
                    hours.holiday += entry.hours;
                    break;
                case 'weekend':
                    hours.weekend += entry.hours;
                    break;
                case 'regular':
                default:
                    hours.regular += entry.hours;
                    break;
            }
        }

        return hours;
    }

    /**
     * Calculate wages for each hour type
     */
    private calculateWagesByType(
        hoursByType: HoursByType,
        baseRate: number,
        holidayMultiplier: number,
        weekendMultiplier: number
    ): WagesByType {
        const regularRate = baseRate;
        const weekendRate = this.round(baseRate * weekendMultiplier);
        const holidayRate = this.round(baseRate * holidayMultiplier);

        return {
            regular: {
                hours: hoursByType.regular,
                rate: regularRate,
                subtotal: this.round(hoursByType.regular * regularRate),
            },
            weekend: {
                hours: hoursByType.weekend,
                rate: weekendRate,
                subtotal: this.round(hoursByType.weekend * weekendRate),
            },
            holiday: {
                hours: hoursByType.holiday,
                rate: holidayRate,
                subtotal: this.round(hoursByType.holiday * holidayRate),
            },
        };
    }

    /**
     * Calculate payroll for multiple caregivers in batch
     */
    calculateMultiCaregiverPayroll(inputs: EnhancedPayrollInput[]): EnhancedPayrollResult[] {
        return inputs.map(input => this.calculatePayroll(input));
    }

    // Helper: Round to 2 decimal places
    private round(amount: number): number {
        return Math.round(amount * 100) / 100;
    }
}
