/**
 * TimeEntryService - Manages time entry operations
 */

import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { AuditService } from './audit-service';
import { EmployerService } from './employer-service';

export interface TimeEntry {
    id: number;
    caregiverId: number;
    workDate: string;
    hoursWorked: number;
    isFinalized: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TimeEntryWithCaregiver extends TimeEntry {
    caregiverName: string;
}

export class TimeEntryService extends BaseRepository<TimeEntry> {

    // Abstract implementation dummy
    create(data: Partial<TimeEntry>): TimeEntry { throw new Error('Use createTimeEntry'); }
    update(id: number, data: Partial<TimeEntry>): TimeEntry { throw new Error('Use updateTimeEntry'); }
    delete(id: number): void { throw new Error('Use deleteTimeEntry'); }
    getById(id: number): TimeEntry | null { return this.getTimeEntryById(id); }

    // Static Compatibility Layer
    static createTimeEntry(data: { caregiverId: number; workDate: string; hoursWorked: number; }): TimeEntry {
        return new TimeEntryService(getDatabase()).createTimeEntry(data);
    }

    static getTimeEntryById(id: number): TimeEntry | null {
        return new TimeEntryService(getDatabase()).getTimeEntryById(id);
    }

    static getTimeEntriesForDateRange(startDate: string, endDate: string): TimeEntryWithCaregiver[] {
        return new TimeEntryService(getDatabase()).getTimeEntriesForDateRange(startDate, endDate);
    }

    static getTimeEntriesForCaregiver(caregiverId: number, startDate?: string, endDate?: string): TimeEntry[] {
        return new TimeEntryService(getDatabase()).getTimeEntriesForCaregiver(caregiverId, startDate, endDate);
    }

    static getTimeEntriesForDate(date: string): TimeEntryWithCaregiver[] {
        return new TimeEntryService(getDatabase()).getTimeEntriesForDate(date);
    }

    static updateTimeEntry(id: number, hoursWorked: number): TimeEntry {
        return new TimeEntryService(getDatabase()).updateTimeEntry(id, hoursWorked);
    }

    static deleteTimeEntry(id: number): void {
        new TimeEntryService(getDatabase()).deleteTimeEntry(id);
    }

    static finalizeTimeEntries(caregiverId: number, startDate: string, endDate: string): void {
        new TimeEntryService(getDatabase()).finalizeTimeEntries(caregiverId, startDate, endDate);
    }

    static getTotalHours(caregiverId: number, startDate: string, endDate: string): number {
        return new TimeEntryService(getDatabase()).getTotalHours(caregiverId, startDate, endDate);
    }

    // Instance Methods

    /**
     * Create time entry
     */
    createTimeEntry(data: {
        caregiverId: number;
        workDate: string;
        hoursWorked: number;
    }): TimeEntry {
        const db = getDatabase();

        // 1. Validator: Explicitly check all inputs
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No active employer profile found');

        if (data.hoursWorked < 0) {
            throw new Error('Hours worked cannot be negative');
        }

        // 2. Transaction: Atomic State Change (Write + Audit)
        const createTransaction = db.transaction(() => {
            // Check if entry already exists for this caregiver and date
            const existing = this.get<{ id: number }>(`
                SELECT id FROM time_entries 
                WHERE caregiver_id = ? AND work_date = ? AND employer_id = ?
            `, [data.caregiverId, data.workDate, employer.id]);

            if (existing) {
                return this.updateTimeEntry(existing.id, data.hoursWorked);
            }

            const result = this.run(`
                INSERT INTO time_entries (caregiver_id, work_date, hours_worked, employer_id)
                VALUES (?, ?, ?, ?)
            `, [data.caregiverId, data.workDate, data.hoursWorked, employer.id]);

            const newEntry = this.getTimeEntryById(result.lastInsertRowid as number);
            if (!newEntry) throw new Error('Failed to create time entry');

            AuditService.log({
                tableName: 'time_entries',
                recordId: newEntry.id,
                action: 'CREATE',
                changesJson: JSON.stringify(data)
            });

            return newEntry;
        });

        return createTransaction();
    }

    /**
     * Get time entry by ID
     */
    getTimeEntryById(id: number): TimeEntry | null {
        // Technically dependent on Employer context for safety? 
        // Original code enforced employer_id check.
        const employer = EmployerService.getEmployer();
        if (!employer) return null;

        const row = this.get<any>('SELECT * FROM time_entries WHERE id = ? AND employer_id = ?', [id, employer.id]);

        if (!row) return null;

        return {
            id: row.id,
            caregiverId: row.caregiver_id,
            workDate: row.work_date,
            hoursWorked: row.hours_worked,
            isFinalized: row.is_finalized === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Get time entries for a date range
     */
    getTimeEntriesForDateRange(startDate: string, endDate: string): TimeEntryWithCaregiver[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const rows = this.all<any>(`
            SELECT te.*, c.full_legal_name as caregiver_name
            FROM time_entries te
            JOIN caregivers c ON te.caregiver_id = c.id
            WHERE te.work_date BETWEEN ? AND ? AND te.employer_id = ?
            ORDER BY te.work_date DESC, c.full_legal_name
        `, [startDate, endDate, employer.id]);

        return rows.map(row => ({
            id: row.id,
            caregiverId: row.caregiver_id,
            workDate: row.work_date,
            hoursWorked: row.hours_worked,
            isFinalized: row.is_finalized === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            caregiverName: row.caregiver_name,
        }));
    }

    /**
     * Get time entries for a specific caregiver
     */
    getTimeEntriesForCaregiver(caregiverId: number, startDate?: string, endDate?: string): TimeEntry[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        let query = 'SELECT * FROM time_entries WHERE caregiver_id = ? AND employer_id = ?';
        const params: any[] = [caregiverId, employer.id];

        if (startDate && endDate) {
            query += ' AND work_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        query += ' ORDER BY work_date DESC';

        const rows = this.all<any>(query, params);

        return rows.map(row => ({
            id: row.id,
            caregiverId: row.caregiver_id,
            workDate: row.work_date,
            hoursWorked: row.hours_worked,
            isFinalized: row.is_finalized === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }

    /**
     * Get time entries for a specific date
     */
    getTimeEntriesForDate(date: string): TimeEntryWithCaregiver[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const rows = this.all<any>(`
            SELECT te.*, c.full_legal_name as caregiver_name
            FROM time_entries te
            JOIN caregivers c ON te.caregiver_id = c.id
            WHERE te.work_date = ? AND te.employer_id = ?
            ORDER BY c.full_legal_name
        `, [date, employer.id]);

        return rows.map(row => ({
            id: row.id,
            caregiverId: row.caregiver_id,
            workDate: row.work_date,
            hoursWorked: row.hours_worked,
            isFinalized: row.is_finalized === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            caregiverName: row.caregiver_name,
        }));
    }

    /**
     * Update time entry
     */
    updateTimeEntry(id: number, hoursWorked: number): TimeEntry {
        const db = getDatabase();

        // 1. Validator: Explicitly check all inputs and state
        if (hoursWorked < 0) {
            throw new Error('Hours worked cannot be negative');
        }

        const entry = this.getTimeEntryById(id);
        if (!entry) {
            throw new Error('Time entry not found');
        }

        if (entry.isFinalized) {
            throw new Error('Cannot update finalized time entry');
        }

        // 2. Transaction: Atomic State Change (Write + Audit)
        const updateTransaction = db.transaction(() => {
            this.run(`
                UPDATE time_entries
                SET hours_worked = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [hoursWorked, id]);

            const updatedEntry = this.getTimeEntryById(id)!;

            AuditService.log({
                tableName: 'time_entries',
                recordId: id,
                action: 'UPDATE',
                changesJson: JSON.stringify({ hoursWorked })
            });

            return updatedEntry;
        });

        return updateTransaction();
    }

    /**
     * Delete time entry
     */
    deleteTimeEntry(id: number): void {
        const db = getDatabase();

        // 1. Validator: Explicitly check state
        const entry = this.getTimeEntryById(id);
        if (!entry) {
            throw new Error('Time entry not found');
        }

        if (entry.isFinalized) {
            throw new Error('Cannot delete finalized time entry');
        }

        // 2. Transaction: Atomic State Change (Write + Audit)
        const deleteTransaction = db.transaction(() => {
            this.run('DELETE FROM time_entries WHERE id = ?', [id]);

            AuditService.log({
                tableName: 'time_entries',
                recordId: id,
                action: 'DELETE',
                changesJson: JSON.stringify(entry)
            });
        });

        deleteTransaction();
    }

    /**
     * Finalize time entries for date range (used when processing payroll)
     */
    finalizeTimeEntries(caregiverId: number, startDate: string, endDate: string): void {
        const employer = EmployerService.getEmployer();
        if (!employer) return;

        this.run(`
            UPDATE time_entries 
            SET is_finalized = 1 
            WHERE caregiver_id = ? AND employer_id = ? AND work_date BETWEEN ? AND ?
        `, [caregiverId, employer.id, startDate, endDate]);
    }

    /**
     * Get total hours for caregiver in date range
     */
    getTotalHours(caregiverId: number, startDate: string, endDate: string): number {
        const employer = EmployerService.getEmployer();
        if (!employer) return 0;

        const result = this.get<{ total: number }>(`
            SELECT COALESCE(SUM(hours_worked), 0) as total
            FROM time_entries
            WHERE caregiver_id = ? AND employer_id = ? AND work_date BETWEEN ? AND ?
        `, [caregiverId, employer.id, startDate, endDate]);

        return result?.total || 0;
    }
}
