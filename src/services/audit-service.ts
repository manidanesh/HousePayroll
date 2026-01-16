/**
 * AuditService - Centrally manages system audit logging
 */

import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { EmployerService } from './employer-service';

export interface AuditEntry {
    tableName: string;
    recordId: number;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'FINALIZED';
    changesJson?: string;
    calculationVersion?: string;
}

export class AuditService extends BaseRepository<any> {

    // Abstract implementation dummy
    create(data: Partial<any>): any { throw new Error('Use log'); }
    update(id: number, data: Partial<any>): any { throw new Error('Method not implemented.'); }
    delete(id: number): void { throw new Error('Method not implemented.'); }
    getById(id: number): any | null { throw new Error('Method not implemented.'); }

    // Static Compatibility Layer
    static log(entry: AuditEntry): void {
        new AuditService(getDatabase()).log(entry);
    }

    static getAllLogs(): any[] {
        return new AuditService(getDatabase()).getAllLogs();
    }

    // Instance Methods
    log(entry: AuditEntry): void {
        const employer = EmployerService.getEmployer();

        try {
            this.run(`
                INSERT INTO audit_log (table_name, record_id, employer_id, action, changes_json, calculation_version)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                entry.tableName,
                entry.recordId,
                employer?.id || null,
                entry.action,
                entry.changesJson || null,
                entry.calculationVersion || null
            ]);
        } catch (err) {
            console.error('Failed to write audit log:', err);
        }
    }

    getAllLogs(): Array<{
        id: number;
        table_name: string;
        record_id: number;
        action: string;
        changes_json: string | null;
        calculation_version: string | null;
        timestamp: string;
    }> {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        return this.all<any>('SELECT * FROM audit_log WHERE employer_id = ? ORDER BY timestamp DESC, id DESC', [employer.id]);
    }
}
