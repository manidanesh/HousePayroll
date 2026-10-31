/**
 * AuditService - Centrally manages system audit logging
 */

import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { EmployerService } from './employer-service';

export interface AuditEntry {
    tableName: string;
    recordId: number;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'FINALIZED' | 'SERVICE_ADDRESS_CHANGED' | 'RATE_CHANGED';
    changesJson?: string;
    calculationVersion?: string;
    /** Single-user app: 'employer' or 'system'. Omitted keeps legacy behavior. */
    actor?: string;
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

    /**
     * Strict variant: throws on failure instead of swallowing. Use inside a db.transaction
     * so an audit failure aborts the surrounding business change (FR-08 atomicity).
     */
    static logStrict(entry: AuditEntry): void {
        new AuditService(getDatabase()).logStrict(entry);
    }

    static getAllLogs(): any[] {
        return new AuditService(getDatabase()).getAllLogs();
    }

    // Instance Methods
    log(entry: AuditEntry): void {
        try {
            this.writeAudit(entry);
        } catch (err) {
            // Legacy behavior: never abort the caller on audit failure.
            console.error('Failed to write audit log:', err);
        }
    }

    /**
     * Throws on failure. For transactional callers that require the audit to commit
     * atomically with the business change (e.g. ServiceAddressService.changeAddress).
     */
    logStrict(entry: AuditEntry): void {
        this.writeAudit(entry);
    }

    private writeAudit(entry: AuditEntry): void {
        const employer = EmployerService.getEmployer();
        this.run(`
            INSERT INTO audit_log (table_name, record_id, employer_id, action, changes_json, calculation_version, actor)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            entry.tableName,
            entry.recordId,
            employer?.id || null,
            entry.action,
            entry.changesJson || null,
            entry.calculationVersion || null,
            entry.actor || null
        ]);
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
