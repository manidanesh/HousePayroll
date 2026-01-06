/**
 * HolidayCalendar - U.S. Federal Holiday Detection
 * Pure functions for identifying holidays and calculating pay multipliers
 */

export type DayType = 'regular' | 'weekend' | 'holiday';

export interface Holiday {
    name: string;
    date: string; // YYYY-MM-DD format
}

export class HolidayCalendar {
    /**
     * Get all U.S. federal holidays for a given year
     */
    static getHolidaysForYear(year: number): Holiday[] {
        return [
            { name: "New Year's Day", date: this.getNewYearsDay(year) },
            { name: "Martin Luther King Jr. Day", date: this.getMLKDay(year) },
            { name: "Presidents' Day", date: this.getPresidentsDay(year) },
            { name: "Memorial Day", date: this.getMemorialDay(year) },
            { name: "Independence Day", date: this.getIndependenceDay(year) },
            { name: "Labor Day", date: this.getLaborDay(year) },
            { name: "Columbus Day", date: this.getColumbusDay(year) },
            { name: "Veterans Day", date: this.getVeteransDay(year) },
            { name: "Thanksgiving Day", date: this.getThanksgivingDay(year) },
            { name: "Christmas Day", date: this.getChristmasDay(year) },
        ];
    }

    /**
     * Check if a date is a U.S. federal holiday
     */
    static isHoliday(dateString: string): boolean {
        const date = new Date(dateString + 'T00:00:00');
        const year = date.getFullYear();
        const holidays = this.getHolidaysForYear(year);
        return holidays.some(h => h.date === dateString);
    }

    /**
     * Check if a date is a weekend (Saturday or Sunday)
     */
    static isWeekend(dateString: string): boolean {
        const date = new Date(dateString + 'T00:00:00');
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
    }

    /**
     * Get the day type for a given date
     * Priority: Holiday > Weekend > Regular
     */
    static getDayType(dateString: string): DayType {
        if (this.isHoliday(dateString)) {
            return 'holiday';
        }
        if (this.isWeekend(dateString)) {
            return 'weekend';
        }
        return 'regular';
    }

    /**
     * Get holiday name for a date (if it's a holiday)
     */
    static getHolidayName(dateString: string): string | null {
        const date = new Date(dateString + 'T00:00:00');
        const year = date.getFullYear();
        const holidays = this.getHolidaysForYear(year);
        const holiday = holidays.find(h => h.date === dateString);
        return holiday ? holiday.name : null;
    }

    // Helper functions for calculating specific holidays

    private static getNewYearsDay(year: number): string {
        return `${year}-01-01`;
    }

    private static getMLKDay(year: number): string {
        // Third Monday in January
        return this.getNthWeekdayOfMonth(year, 0, 1, 3); // January (0), Monday (1), 3rd
    }

    private static getPresidentsDay(year: number): string {
        // Third Monday in February
        return this.getNthWeekdayOfMonth(year, 1, 1, 3); // February (1), Monday (1), 3rd
    }

    private static getMemorialDay(year: number): string {
        // Last Monday in May
        return this.getLastWeekdayOfMonth(year, 4, 1); // May (4), Monday (1)
    }

    private static getIndependenceDay(year: number): string {
        return `${year}-07-04`;
    }

    private static getLaborDay(year: number): string {
        // First Monday in September
        return this.getNthWeekdayOfMonth(year, 8, 1, 1); // September (8), Monday (1), 1st
    }

    private static getColumbusDay(year: number): string {
        // Second Monday in October
        return this.getNthWeekdayOfMonth(year, 9, 1, 2); // October (9), Monday (1), 2nd
    }

    private static getVeteransDay(year: number): string {
        return `${year}-11-11`;
    }

    private static getThanksgivingDay(year: number): string {
        // Fourth Thursday in November
        return this.getNthWeekdayOfMonth(year, 10, 4, 4); // November (10), Thursday (4), 4th
    }

    private static getChristmasDay(year: number): string {
        return `${year}-12-25`;
    }

    /**
     * Get the Nth occurrence of a weekday in a month
     * @param year Year
     * @param month Month (0-11)
     * @param weekday Day of week (0=Sunday, 1=Monday, etc.)
     * @param n Which occurrence (1=first, 2=second, etc.)
     */
    private static getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
        const firstDay = new Date(year, month, 1);
        const firstWeekday = firstDay.getDay();

        // Calculate days until first occurrence of the target weekday
        let daysUntilWeekday = (weekday - firstWeekday + 7) % 7;

        // Calculate the date of the Nth occurrence
        const targetDate = 1 + daysUntilWeekday + (n - 1) * 7;

        const date = new Date(year, month, targetDate);
        return this.formatDate(date);
    }

    /**
     * Get the last occurrence of a weekday in a month
     */
    private static getLastWeekdayOfMonth(year: number, month: number, weekday: number): string {
        // Start with the last day of the month
        const lastDay = new Date(year, month + 1, 0);
        const lastWeekday = lastDay.getDay();

        // Calculate days to go back to reach the target weekday
        let daysBack = (lastWeekday - weekday + 7) % 7;

        const targetDate = lastDay.getDate() - daysBack;
        const date = new Date(year, month, targetDate);
        return this.formatDate(date);
    }

    /**
     * Format date as YYYY-MM-DD
     */
    private static formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
