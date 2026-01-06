"use strict";
/**
 * TimeEntryService - Manages time entry operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeEntryService = void 0;
const db_1 = require("../database/db");
class TimeEntryService {
    /**
     * Create time entry
     */
    static createTimeEntry(data) {
        const db = (0, db_1.getDatabase)();
        // Validate hours
        if (data.hoursWorked < 0) {
            throw new Error('Hours worked cannot be negative');
        }
        // Check if entry already exists for this caregiver and date
        const existing = db.prepare(`
      SELECT id FROM time_entries 
      WHERE caregiver_id = ? AND work_date = ?
    `).get(data.caregiverId, data.workDate);
        if (existing) {
            throw new Error('Time entry already exists for this caregiver and date');
        }
        const result = db.prepare(`
      INSERT INTO time_entries (caregiver_id, work_date, hours_worked)
      VALUES (?, ?, ?)
    `).run(data.caregiverId, data.workDate, data.hoursWorked);
        return this.getTimeEntryById(result.lastInsertRowid);
    }
    /**
     * Get time entry by ID
     */
    static getTimeEntryById(id) {
        const db = (0, db_1.getDatabase)();
        const row = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
        if (!row)
            return null;
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
    static getTimeEntriesForDateRange(startDate, endDate) {
        const db = (0, db_1.getDatabase)();
        const rows = db.prepare(`
      SELECT te.*, c.full_legal_name as caregiver_name
      FROM time_entries te
      JOIN caregivers c ON te.caregiver_id = c.id
      WHERE te.work_date BETWEEN ? AND ?
      ORDER BY te.work_date DESC, c.full_legal_name
    `).all(startDate, endDate);
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
    static getTimeEntriesForCaregiver(caregiverId, startDate, endDate) {
        const db = (0, db_1.getDatabase)();
        let query = 'SELECT * FROM time_entries WHERE caregiver_id = ?';
        const params = [caregiverId];
        if (startDate && endDate) {
            query += ' AND work_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        query += ' ORDER BY work_date DESC';
        const rows = db.prepare(query).all(...params);
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
    static getTimeEntriesForDate(date) {
        const db = (0, db_1.getDatabase)();
        const rows = db.prepare(`
      SELECT te.*, c.full_legal_name as caregiver_name
      FROM time_entries te
      JOIN caregivers c ON te.caregiver_id = c.id
      WHERE te.work_date = ?
      ORDER BY c.full_legal_name
    `).all(date);
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
    static updateTimeEntry(id, hoursWorked) {
        const db = (0, db_1.getDatabase)();
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
        return this.getTimeEntryById(id);
    }
    /**
     * Delete time entry
     */
    static deleteTimeEntry(id) {
        const db = (0, db_1.getDatabase)();
        // Check if entry is finalized
        const entry = this.getTimeEntryById(id);
        if (!entry) {
            throw new Error('Time entry not found');
        }
        if (entry.isFinalized) {
            throw new Error('Cannot delete finalized time entry');
        }
        db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
    }
    /**
     * Finalize time entries for date range (used when processing payroll)
     */
    static finalizeTimeEntries(caregiverId, startDate, endDate) {
        const db = (0, db_1.getDatabase)();
        db.prepare(`
      UPDATE time_entries 
      SET is_finalized = 1 
      WHERE caregiver_id = ? AND work_date BETWEEN ? AND ?
    `).run(caregiverId, startDate, endDate);
    }
    /**
     * Get total hours for caregiver in date range
     */
    static getTotalHours(caregiverId, startDate, endDate) {
        const db = (0, db_1.getDatabase)();
        const result = db.prepare(`
      SELECT COALESCE(SUM(hours_worked), 0) as total
      FROM time_entries
      WHERE caregiver_id = ? AND work_date BETWEEN ? AND ?
    `).get(caregiverId, startDate, endDate);
        return result.total;
    }
}
exports.TimeEntryService = TimeEntryService;
