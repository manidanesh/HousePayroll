/**
 * TimeEntryService - Manages time entry operations
 */

import { getDatabase } from '../database/db';
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

export class TimeEntryService {
    /**
     * Create time entry
     */
    static createTimeEntry(data: {
        caregiverId: number;
        workDate: string;
        hoursWorked: number;
    }): TimeEntry {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No active employer profile found');

        // Validate hours
        if (data.hoursWorked < 0) {
            throw new Error('Hours worked cannot be negative');
        }

        // Check if entry already exists for this caregiver and date
        const existing = db.prepare(`
      SELECT id FROM time_entries 
      WHERE caregiver_id = ? AND work_date = ? AND employer_id = ?
    `).get(data.caregiverId, data.workDate, employer.id) as { id: number } | undefined;

        if (existing) {
            return this.updateTimeEntry(existing.id, data.hoursWorked);
        }

        const result = db.prepare(`
      INSERT INTO time_entries (caregiver_id, work_date, hours_worked, employer_id)
      VALUES (?, ?, ?, ?)
    `).run(data.caregiverId, data.workDate, data.hoursWorked, employer.id);

        const entry = this.getTimeEntryById(result.lastInsertRowid as number)!;

        // Log audit
        AuditService.log({
            tableName: 'time_entries',
            recordId: entry.id,
            action: 'CREATE',
            changesJson: JSON.stringify(data)
        });

        return entry;
    }

    /**
     * Get time entry by ID
     */
    static getTimeEntryById(id: number): TimeEntry | null {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return null;

        const row = db.prepare('SELECT * FROM time_entries WHERE id = ? AND employer_id = ?').get(id, employer.id) as any;

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
    static getTimeEntriesForDateRange(startDate: string, endDate: string): TimeEntryWithCaregiver[] {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const rows = db.prepare(`
      SELECT te.*, c.full_legal_name as caregiver_name
      FROM time_entries te
      JOIN caregivers c ON te.caregiver_id = c.id
      WHERE te.work_date BETWEEN ? AND ? AND te.employer_id = ?
      ORDER BY te.work_date DESC, c.full_legal_name
    `).all(startDate, endDate, employer.id) as any[];

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
    static getTimeEntriesForCaregiver(caregiverId: number, startDate?: string, endDate?: string): TimeEntry[] {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        let query = 'SELECT * FROM time_entries WHERE caregiver_id = ? AND employer_id = ?';
        const params: any[] = [caregiverId, employer.id];

        if (startDate && endDate) {
            query += ' AND work_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        query += ' ORDER BY work_date DESC';

        const rows = db.prepare(query).all(...params) as any[];

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
    static getTimeEntriesForDate(date: string): TimeEntryWithCaregiver[] {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        const rows = db.prepare(`
      SELECT te.*, c.full_legal_name as caregiver_name
      FROM time_entries te
      JOIN caregivers c ON te.caregiver_id = c.id
      WHERE te.work_date = ? AND te.employer_id = ?
      ORDER BY c.full_legal_name
    `).all(date, employer.id) as any[];

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
    static updateTimeEntry(id: number, hoursWorked: number): TimeEntry {
        const db = getDatabase();

        // Check if entry is finalized
        const entry = this.getTimeEntryById(id);
        if (!entry) {
            throw new Error('Time entry not found');
        }

        if (entry.isFinalized) {
            throw new Error('Cannot update finalized time entry');
        }

        if (hoursWorked < 0) {
            throw new Error('Hours worked cannot be negative');
        }

        db.prepare(`
      UPDATE time_entries 
      SET hours_worked = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(hoursWorked, id);

        const updatedEntry = this.getTimeEntryById(id)!;

        // Log audit
        AuditService.log({
            tableName: 'time_entries',
            recordId: id,
            action: 'UPDATE',
            changesJson: JSON.stringify({ hoursWorked })
        });

        return updatedEntry;
    }

    /**
     * Delete time entry
     */
    static deleteTimeEntry(id: number): void {
        const db = getDatabase();

        // Check if entry is finalized
        const entry = this.getTimeEntryById(id);
        if (!entry) {
            throw new Error('Time entry not found');
        }

        if (entry.isFinalized) {
            throw new Error('Cannot delete finalized time entry');
        }

        db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);

        // Log audit
        AuditService.log({
            tableName: 'time_entries',
            recordId: id,
            action: 'DELETE',
            changesJson: JSON.stringify(entry)
        });
    }

    /**
     * Finalize time entries for date range (used when processing payroll)
     */
    static finalizeTimeEntries(caregiverId: number, startDate: string, endDate: string): void {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return;

        db.prepare(`
      UPDATE time_entries 
      SET is_finalized = 1 
      WHERE caregiver_id = ? AND employer_id = ? AND work_date BETWEEN ? AND ?
    `).run(caregiverId, employer.id, startDate, endDate);
    }

    /**
     * Get total hours for caregiver in date range
     */
    static getTotalHours(caregiverId: number, startDate: string, endDate: string): number {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return 0;

        const result = db.prepare(`
      SELECT COALESCE(SUM(hours_worked), 0) as total
      FROM time_entries
      WHERE caregiver_id = ? AND employer_id = ? AND work_date BETWEEN ? AND ?
    `).get(caregiverId, employer.id, startDate, endDate) as { total: number };

        return result.total;
    }
}
