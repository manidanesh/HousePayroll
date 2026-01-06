"use strict";
/**
 * Enhanced PayrollCalculator with Holiday/Weekend Pay Support
 * Applies multipliers based on day type (regular/weekend/holiday)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedPayrollCalculator = void 0;
const holiday_calendar_1 = require("../utils/holiday-calendar");
class EnhancedPayrollCalculator {
    constructor(taxComputer, version = 'v2.0-differential-pay') {
        this.taxComputer = taxComputer;
        this.version = version;
    }
    /**
     * Calculate payroll with differential pay for holidays and weekends
     */
    calculatePayroll(input) {
        // Categorize hours by type
        const hoursByType = this.categorizeHours(input.timeEntries);
        // Calculate wages by type with appropriate multipliers
        const wagesByType = this.calculateWagesByType(hoursByType, input.baseHourlyRate, input.holidayMultiplier, input.weekendMultiplier);
        // Calculate total gross wages
        const grossWages = this.round(wagesByType.regular.subtotal +
            wagesByType.weekend.subtotal +
            wagesByType.holiday.subtotal);
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
    categorizeHours(timeEntries) {
        const hours = {
            regular: 0,
            weekend: 0,
            holiday: 0,
        };
        for (const entry of timeEntries) {
            const dayType = entry.dayType || holiday_calendar_1.HolidayCalendar.getDayType(entry.date);
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
    calculateWagesByType(hoursByType, baseRate, holidayMultiplier, weekendMultiplier) {
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
    calculateMultiCaregiverPayroll(inputs) {
        return inputs.map(input => this.calculatePayroll(input));
    }
    // Helper: Round to 2 decimal places
    round(amount) {
        return Math.round(amount * 100) / 100;
    }
}
exports.EnhancedPayrollCalculator = EnhancedPayrollCalculator;
