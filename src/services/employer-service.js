"use strict";
/**
 * EmployerService - Manages employer profile operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployerService = void 0;
const db_1 = require("../database/db");
class EmployerService {
    /**
     * Check if employer profile exists
     */
    static hasEmployerProfile() {
        const db = (0, db_1.getDatabase)();
        const result = db.prepare('SELECT COUNT(*) as count FROM employers').get();
        return result.count > 0;
    }
    /**
     * Create employer profile
     */
    static createEmployer(data) {
        const db = (0, db_1.getDatabase)();
        // Encrypt SSN/EIN
        const ssnOrEinEncrypted = (0, db_1.encrypt)(data.ssnOrEin);
        const result = db.prepare(`
      INSERT INTO employers (
        display_name, ssn_or_ein_encrypted, pay_frequency, 
        default_hourly_rate, federal_withholding_enabled, colorado_suta_rate
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.displayName, ssnOrEinEncrypted, data.payFrequency, data.defaultHourlyRate, data.federalWithholdingEnabled ? 1 : 0, data.coloradoSutaRate);
        return this.getEmployer();
    }
    /**
     * Get employer profile
     */
    static getEmployer() {
        const db = (0, db_1.getDatabase)();
        const row = db.prepare(`
      SELECT * FROM employers ORDER BY id DESC LIMIT 1
    `).get();
        if (!row)
            return null;
        return {
            id: row.id,
            displayName: row.display_name,
            ssnOrEin: (0, db_1.decrypt)(row.ssn_or_ein_encrypted),
            payFrequency: row.pay_frequency,
            defaultHourlyRate: row.default_hourly_rate,
            federalWithholdingEnabled: row.federal_withholding_enabled === 1,
            coloradoSutaRate: row.colorado_suta_rate,
            holidayPayMultiplier: row.holiday_pay_multiplier || 1.0,
            weekendPayMultiplier: row.weekend_pay_multiplier || 1.0,
            createdAt: row.created_at,
        };
    }
    /**
     * Update employer profile
     */
    static updateEmployer(data) {
        const db = (0, db_1.getDatabase)();
        const current = this.getEmployer();
        if (!current) {
            throw new Error('No employer profile found');
        }
        const updates = [];
        const values = [];
        if (data.displayName !== undefined) {
            updates.push('display_name = ?');
            values.push(data.displayName);
        }
        if (data.ssnOrEin !== undefined) {
            updates.push('ssn_or_ein_encrypted = ?');
            values.push((0, db_1.encrypt)(data.ssnOrEin));
        }
        if (data.payFrequency !== undefined) {
            updates.push('pay_frequency = ?');
            values.push(data.payFrequency);
        }
        if (data.defaultHourlyRate !== undefined) {
            updates.push('default_hourly_rate = ?');
            values.push(data.defaultHourlyRate);
        }
        if (data.federalWithholdingEnabled !== undefined) {
            updates.push('federal_withholding_enabled = ?');
            values.push(data.federalWithholdingEnabled ? 1 : 0);
        }
        if (data.coloradoSutaRate !== undefined) {
            updates.push('colorado_suta_rate = ?');
            values.push(data.coloradoSutaRate);
        }
        if (data.holidayPayMultiplier !== undefined) {
            updates.push('holiday_pay_multiplier = ?');
            values.push(data.holidayPayMultiplier);
        }
        if (data.weekendPayMultiplier !== undefined) {
            updates.push('weekend_pay_multiplier = ?');
            values.push(data.weekendPayMultiplier);
        }
        if (updates.length === 0) {
            return current;
        }
        values.push(current.id);
        db.prepare(`
      UPDATE employers SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);
        return this.getEmployer();
    }
}
exports.EmployerService = EmployerService;
