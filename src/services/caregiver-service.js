"use strict";
/**
 * CaregiverService - Manages caregiver profile operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaregiverService = void 0;
const db_1 = require("../database/db");
class CaregiverService {
    /**
     * Create caregiver profile
     */
    static createCaregiver(data) {
        const db = (0, db_1.getDatabase)();
        // Encrypt SSN
        const ssnEncrypted = (0, db_1.encrypt)(data.ssn);
        const result = db.prepare(`
      INSERT INTO caregivers (
        full_legal_name, ssn_encrypted, hourly_rate, relationship_note
      ) VALUES (?, ?, ?, ?)
    `).run(data.fullLegalName, ssnEncrypted, data.hourlyRate, data.relationshipNote || null);
        return this.getCaregiverById(result.lastInsertRowid);
    }
    /**
     * Get all active caregivers
     */
    static getAllCaregivers(includeInactive = false) {
        const db = (0, db_1.getDatabase)();
        const query = includeInactive
            ? 'SELECT * FROM caregivers ORDER BY full_legal_name'
            : 'SELECT * FROM caregivers WHERE is_active = 1 ORDER BY full_legal_name';
        const rows = db.prepare(query).all();
        return rows.map(row => ({
            id: row.id,
            fullLegalName: row.full_legal_name,
            ssn: (0, db_1.decrypt)(row.ssn_encrypted),
            hourlyRate: row.hourly_rate,
            relationshipNote: row.relationship_note,
            isActive: row.is_active === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }
    /**
     * Get caregiver by ID
     */
    static getCaregiverById(id) {
        const db = (0, db_1.getDatabase)();
        const row = db.prepare('SELECT * FROM caregivers WHERE id = ?').get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            fullLegalName: row.full_legal_name,
            ssn: (0, db_1.decrypt)(row.ssn_encrypted),
            hourlyRate: row.hourly_rate,
            relationshipNote: row.relationship_note,
            isActive: row.is_active === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Update caregiver profile
     */
    static updateCaregiver(id, data) {
        const db = (0, db_1.getDatabase)();
        const updates = [];
        const values = [];
        if (data.fullLegalName !== undefined) {
            updates.push('full_legal_name = ?');
            values.push(data.fullLegalName);
        }
        if (data.ssn !== undefined) {
            updates.push('ssn_encrypted = ?');
            values.push((0, db_1.encrypt)(data.ssn));
        }
        if (data.hourlyRate !== undefined) {
            updates.push('hourly_rate = ?');
            values.push(data.hourlyRate);
        }
        if (data.relationshipNote !== undefined) {
            updates.push('relationship_note = ?');
            values.push(data.relationshipNote || null);
        }
        if (updates.length === 0) {
            return this.getCaregiverById(id);
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        db.prepare(`
      UPDATE caregivers SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);
        return this.getCaregiverById(id);
    }
    /**
     * Deactivate caregiver
     */
    static deactivateCaregiver(id) {
        const db = (0, db_1.getDatabase)();
        db.prepare(`
      UPDATE caregivers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);
    }
    /**
     * Reactivate caregiver
     */
    static reactivateCaregiver(id) {
        const db = (0, db_1.getDatabase)();
        db.prepare(`
      UPDATE caregivers SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);
    }
    /**
     * Delete caregiver (only if no payroll records exist)
     */
    static deleteCaregiver(id) {
        const db = (0, db_1.getDatabase)();
        // Check if caregiver has payroll records
        const payrollCount = db.prepare('SELECT COUNT(*) as count FROM payroll_records WHERE caregiver_id = ?').get(id);
        if (payrollCount.count > 0) {
            throw new Error('Cannot delete caregiver with existing payroll records. Deactivate instead.');
        }
        // Check if caregiver has time entries
        const timeCount = db.prepare('SELECT COUNT(*) as count FROM time_entries WHERE caregiver_id = ?').get(id);
        if (timeCount.count > 0) {
            throw new Error('Cannot delete caregiver with existing time entries. Deactivate instead.');
        }
        db.prepare('DELETE FROM caregivers WHERE id = ?').run(id);
    }
}
exports.CaregiverService = CaregiverService;
