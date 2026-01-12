/**
 * EnhancedPayrollCalculator - Complete payroll calculation with differential pay
 * 
 * Handles comprehensive payroll processing including:
 * - Hours categorization (regular, weekend, holiday, overtime)
 * - Differential pay rates (weekend 1.5x, holiday 2.0x, overtime 1.5x)
 * - Colorado overtime rules (>12 hours/day, >40 hours/week)
 * - Tax calculations with YTD tracking
 * - Minimum wage compliance validation ($14.42/hr for Colorado 2024)
 * 
 * @example
 * ```typescript
 * const taxComputer = new TaxComputer(rates);
 * const calculator = new EnhancedPayrollCalculator(taxComputer);
 * 
 * const result = calculator.calculatePayroll({
 *   caregiverId: 1,
 *   timeEntries: [
 *     { date: '2024-01-15', hours: 8 },
 *     { date: '2024-01-20', hours: 8, dayType: 'weekend' },
 *   ],
 *   baseHourlyRate: 20,
 *   holidayMultiplier: 2.0,
 *   weekendMultiplier: 1.5,
 *   ytdWagesBefore: 5000,
 * });
 * ```
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
    overtime: number; // Added
}

export interface WagesByType {
    regular: { hours: number; rate: number; subtotal: number };
    weekend: { hours: number; rate: number; subtotal: number };
    holiday: { hours: number; rate: number; subtotal: number };
    overtime: { hours: number; rate: number; subtotal: number }; // Added
}

export interface EnhancedPayrollInput {
    caregiverId: number;
    timeEntries: TimeEntryForPayroll[];
    baseHourlyRate: number;
    holidayMultiplier: number;
    weekendMultiplier: number;
    federalWithholdingAmount?: number;
    ytdWagesBefore?: number; // Added for tax caps
    disableOvertime?: boolean; // Added on user request
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
    isMinimumWageCompliant: boolean; // Added for legal compliance
}

export class EnhancedPayrollCalculator {
    private taxComputer: TaxComputer;
    private version: string;
    private readonly COLORADO_MIN_WAGE = 14.42; // 2024 rate

    constructor(taxComputer: TaxComputer, version: string = 'v2.0-compliance') {
        this.taxComputer = taxComputer;
        this.version = version;
    }

    /**
     * Calculate complete payroll with differential pay and tax calculations
     * 
     * This is the main entry point for payroll processing. It handles:
     * 1. Hours categorization by day type
     * 2. Overtime calculation per Colorado rules
     * 3. Wage calculation with multipliers
     * 4. Tax calculation with YTD tracking
     * 5. Minimum wage compliance check
     * 
     * @param input - Payroll calculation input including time entries and rates
     * @returns Complete payroll result with hours, wages, taxes, and net pay
     * 
     * @example
     * ```typescript
     * const result = calculator.calculatePayroll({
     *   caregiverId: 1,
     *   timeEntries: [{ date: '2024-01-15', hours: 8 }],
     *   baseHourlyRate: 20,
     *   holidayMultiplier: 2.0,
     *   weekendMultiplier: 1.5,
     * });
     * console.log(`Net Pay: $${result.netPay}`);
     * ```
     */
    calculatePayroll(input: EnhancedPayrollInput): EnhancedPayrollResult {
        // Categorize hours by type
        const hoursByType = this.categorizeHours(input.timeEntries, input.disableOvertime);
        const totalHours = hoursByType.regular + hoursByType.weekend + hoursByType.holiday;

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
            wagesByType.holiday.subtotal +
            wagesByType.overtime.subtotal
        );

        // Check minimum wage compliance
        const effectiveRate = totalHours > 0 ? grossWages / totalHours : input.baseHourlyRate;
        const isMinimumWageCompliant = effectiveRate >= this.COLORADO_MIN_WAGE;

        // Calculate taxes using TaxComputer with YTD caps
        const taxes = this.taxComputer.calculateTaxes(grossWages, input.ytdWagesBefore || 0);

        // Federal withholding (optional)
        const federalWithholding = input.federalWithholdingAmount || 0;

        // Calculate net pay
        const totalWithholdings = taxes.totalEmployeeWithholdings + federalWithholding;
        const netPay = this.round(grossWages - totalWithholdings);

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
            isMinimumWageCompliant,
        };
    }

    /**
     * Categorize time entries by day type and calculate Colorado Overtime
     */
    private categorizeHours(timeEntries: TimeEntryForPayroll[], disableOvertime: boolean = false): HoursByType {
        const hours: HoursByType = {
            regular: 0,
            weekend: 0,
            holiday: 0,
            overtime: 0,
        };

        let weeklyNonOvertimeTotal = 0;

        // Colorado daily overtime: > 12h per day is 1.5x
        for (const entry of timeEntries) {
            const dayType = entry.dayType || HolidayCalendar.getDayType(entry.date);

            let dailyTotal = entry.hours;
            let dailyOvertime = 0;

            if (!disableOvertime && dailyTotal > 12) {
                dailyOvertime = dailyTotal - 12;
                dailyTotal = 12; // Cap regular hours for this day at 12
            }

            hours.overtime += dailyOvertime;

            // Distribute remaining daily hours to categories
            switch (dayType) {
                case 'holiday':
                    hours.holiday += dailyTotal;
                    break;
                case 'weekend':
                    hours.weekend += dailyTotal;
                    break;
                case 'regular':
                default:
                    hours.regular += dailyTotal;
                    weeklyNonOvertimeTotal += dailyTotal;
                    break;
            }
        }

        // Colorado weekly overtime: > 40 regular hours in a workweek
        if (!disableOvertime && weeklyNonOvertimeTotal > 40) {
            const extraOvertime = weeklyNonOvertimeTotal - 40;
            hours.overtime += extraOvertime;
            hours.regular -= extraOvertime;
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
        const overtimeRate = this.round(baseRate * 1.5); // CO standard is 1.5x

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
            overtime: {
                hours: hoursByType.overtime,
                rate: overtimeRate,
                subtotal: this.round(hoursByType.overtime * overtimeRate),
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
