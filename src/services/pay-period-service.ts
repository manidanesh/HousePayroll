/**
 * PayPeriodService - Manages pay period generation and status tracking
 */

import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { EmployerService } from './employer-service';

export interface PayPeriod {
    startDate: string;
    endDate: string;
    status: 'generated' | 'pending' | 'partially-paid' | 'no-hours';
    payrollId?: number;
    checkNumber?: string;
    totalHours?: number;
    finalizedHours?: number;
    unfinalizedHours?: number;
    startDay?: string; // e.g., "Sat"
    endDay?: string;   // e.g., "Fri"
}

export class PayPeriodService extends BaseRepository<any> { // T is implicit/not strict for utility services

    // Abstract implementation dummy
    create(data: Partial<any>): any { throw new Error('Not implemented'); }
    update(id: number, data: Partial<any>): any { throw new Error('Not implemented'); }
    delete(id: number): void { throw new Error('Not implemented'); }
    getById(id: number): any | null { throw new Error('Not implemented'); }

    // Static Compatibility Layer
    static generatePeriodsForYear(year: number): PayPeriod[] {
        return new PayPeriodService(getDatabase()).generatePeriodsForYear(year);
    }

    static getPeriodsWithStatus(caregiverId: number, year: number): PayPeriod[] {
        return new PayPeriodService(getDatabase()).getPeriodsWithStatus(caregiverId, year);
    }

    // Instance Methods

    /**
     * Generate bi-weekly pay periods for a given year
     * Starts from January 1st and generates periods throughout the year
     */
    generatePeriodsForYear(year: number): PayPeriod[] {
        const periods: PayPeriod[] = [];
        const startOfYear = new Date(year, 0, 1); // January 1st

        // Find the first Saturday of the year (or use Jan 1 if it's a Saturday)
        let currentStart = new Date(startOfYear);
        const dayOfWeek = currentStart.getDay();

        // Adjust to the nearest Saturday (6 = Saturday)
        if (dayOfWeek !== 6) {
            const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
            currentStart.setDate(currentStart.getDate() + daysUntilSaturday);
        }

        // Generate periods for the entire year plus a bit into next year
        const endOfYear = new Date(year + 1, 0, 31); // End of January next year

        while (currentStart < endOfYear) {
            const periodStart = new Date(currentStart);
            const periodEnd = new Date(currentStart);
            periodEnd.setDate(periodEnd.getDate() + 13); // 14 days total (0-13)

            periods.push({
                startDate: this.formatDate(periodStart),
                endDate: this.formatDate(periodEnd),
                status: 'no-hours',
                startDay: this.getDayName(periodStart),
                endDay: this.getDayName(periodEnd),
            });

            // Move to next period (14 days later)
            currentStart.setDate(currentStart.getDate() + 14);
        }

        return periods;
    }

    /**
     * Get pay periods with their current status for a specific caregiver
     */
    getPeriodsWithStatus(caregiverId: number, year: number): PayPeriod[] {
        // We use the static EmployerService for now, can be injected later
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const periods = this.generatePeriodsForYear(year);

        // For each period, check status based on time entries
        periods.forEach(period => {
            // Get stats on time entries for this period
            const stats = this.get<any>(`
                SELECT 
                    COUNT(*) as total_entries,
                    SUM(hours_worked) as total_hours,
                    SUM(CASE WHEN is_finalized = 1 THEN hours_worked ELSE 0 END) as finalized_hours,
                    SUM(CASE WHEN is_finalized = 0 THEN hours_worked ELSE 0 END) as unfinalized_hours
                FROM time_entries
                WHERE caregiver_id = ?
                  AND employer_id = ?
                  AND work_date BETWEEN ? AND ?
            `, [caregiverId, employer.id, period.startDate, period.endDate]);

            if (!stats || stats.total_entries === 0 || (stats.total_hours || 0) === 0) {
                period.status = 'no-hours';
            } else {
                period.totalHours = stats.total_hours || 0;
                period.finalizedHours = stats.finalized_hours || 0;
                period.unfinalizedHours = stats.unfinalized_hours || 0;

                if (period.unfinalizedHours === 0) {
                    // All hours in this range are finalized!
                    period.status = 'generated';
                } else if (period.finalizedHours === 0) {
                    // All hours in this range are pending!
                    period.status = 'pending';
                } else {
                    // Mixed status
                    period.status = 'partially-paid';
                }

                // Try to find a check number from an overlapping finalized payroll 
                // Only if there are SOME finalized hours
                if ((period.finalizedHours || 0) > 0) {
                    const payroll = this.get<any>(`
                        SELECT id, check_number
                        FROM payroll_records
                        WHERE caregiver_id = ?
                          AND employer_id = ?
                          AND is_finalized = 1
                          AND is_voided = 0
                          AND (
                            (pay_period_start <= ? AND pay_period_end >= ?) -- Exact or contains
                            OR (pay_period_start BETWEEN ? AND ?)
                            OR (pay_period_end BETWEEN ? AND ?)
                            OR (pay_period_start <= ? AND pay_period_end >= ?)
                          )
                        ORDER BY payment_date DESC, id DESC
                        LIMIT 1
                    `, [
                        caregiverId, employer.id,
                        period.startDate, period.endDate,
                        period.startDate, period.endDate,
                        period.startDate, period.endDate,
                        period.startDate, period.endDate
                    ]);

                    if (payroll) {
                        period.payrollId = payroll.id;
                        period.checkNumber = payroll.check_number;
                    }
                }
            }
        });

        return periods;
    }

    /**
     * Format date as YYYY-MM-DD
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get short day name (e.g., "Mon", "Tue")
     */
    private getDayName(date: Date): string {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
    }
}
