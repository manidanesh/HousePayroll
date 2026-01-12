/**
 * AuditService - Centrally manages system audit logging
 */

import { getDatabase } from '../database/db';
import { EmployerService } from './employer-service';

export interface AuditEntry {
    tableName: string;
    recordId: number;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'FINALIZED';
    changesJson?: string;
    calculationVersion?: string;
}

export class AuditService {
    /**
     * Log a mutation to the audit_log table
     */
    static log(entry: AuditEntry): void {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();

        try {
            db.prepare(`
                INSERT INTO audit_log (table_name, record_id, employer_id, action, changes_json, calculation_version)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                entry.tableName,
                entry.recordId,
                employer?.id || null,
                entry.action,
                entry.changesJson || null,
                entry.calculationVersion || null
            );
        } catch (err) {
            console.error('Failed to write audit log:', err);
            // We don't throw here to avoid failing the main operation if audit logging fails
            // but in a strictly compliant system, we might want to.
        }
    }

    /**
     * Get all audit logs
     */
    static getAllLogs(): Array<{
        id: number;
        table_name: string;
        record_id: number;
        action: string;
        changes_json: string | null;
        calculation_version: string | null;
        timestamp: string;
    }> {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        return db.prepare('SELECT * FROM audit_log WHERE employer_id = ? ORDER BY timestamp DESC').all(employer.id) as any;
    }
}
