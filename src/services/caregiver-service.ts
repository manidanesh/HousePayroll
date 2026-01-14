/**
 * CaregiverService - Manages caregiver profile operations
 */

import { getDatabase, encrypt, decrypt } from '../database/db';
import { Caregiver, CreateCaregiverInput, UpdateCaregiverInput, RendererSafeCaregiver } from '../types';
import { AuditService } from './audit-service';
import { EmployerService } from './employer-service';

export class CaregiverService {
    /**
     * Create caregiver profile
     */
    static createCaregiver(data: {
        fullLegalName: string;
        ssn: string;
        hourlyRate: number;
        relationshipNote?: string;
    }): Caregiver {
        const db = getDatabase();

        // Validate required fields
        if (!data.fullLegalName || data.fullLegalName.trim().length === 0) {
            throw new Error('Full legal name is required and cannot be empty');
        }
        if (!data.ssn || data.ssn.trim().length === 0) {
            throw new Error('SSN is required and cannot be empty');
        }
        if (data.hourlyRate === undefined || data.hourlyRate === null || data.hourlyRate <= 0) {
            throw new Error('Hourly rate is required and must be greater than 0');
        }

        // Encrypt SSN
        const ssnEncrypted = encrypt(data.ssn);

        const result = db.prepare(`
      INSERT INTO caregivers (
        full_legal_name, ssn_encrypted, hourly_rate, relationship_note
      ) VALUES (?, ?, ?, ?)
    `).run(
            data.fullLegalName,
            ssnEncrypted,
            data.hourlyRate,
            data.relationshipNote || null
        );

        return this.getCaregiverById(result.lastInsertRowid as number)!;
    }

    /**
     * Get all active caregivers
     */
    static getAllCaregivers(includeInactive = false): Caregiver[] {
        const db = getDatabase();
        const query = includeInactive
            ? 'SELECT * FROM caregivers ORDER BY full_legal_name'
            : 'SELECT * FROM caregivers WHERE is_active = 1 ORDER BY full_legal_name';

        const rows = db.prepare(query).all() as any[];

        return rows.map((row: any) => {
            const fullSsn = decrypt(row.ssn_encrypted);
            const maskedSsn = fullSsn.includes('-')
                ? `XXX-XX-${fullSsn.split('-')[2]}`
                : `XXX-XX-${fullSsn.slice(-4)}`;

            return {
                id: row.id,
                fullLegalName: row.full_legal_name,
                ssn: fullSsn,
                maskedSsn,
                hourlyRate: row.hourly_rate,
                relationshipNote: row.relationship_note,
                addressLine1: row.address_line1,
                addressLine2: row.address_line2,
                city: row.city,
                state: row.state,
                zip: row.zip,
                employerId: row.employer_id,
                isActive: row.is_active === 1,
                hfwaBalance: row.hfwa_balance || 0,
                stripeCustomerId: row.stripe_customer_id,
                stripeBankAccountId: row.stripe_bank_account_id,
                payoutMethod: row.payout_method || 'check',
                maskedDestinationAccount: row.masked_destination_account,
                stripePayoutId: row.stripe_payout_id_enc ? decrypt(row.stripe_payout_id_enc) : undefined,
                i9Completed: row.i9_completed === 1,
                i9CompletionDate: row.i9_completion_date,
                i9Notes: row.i9_notes,
                w4FilingStatus: row.w4_filing_status || 'single',
                w4MultipleJobs: row.w4_multiple_jobs === 1,
                w4DependentsAmount: row.w4_dependents_amount || 0,
                w4OtherIncome: row.w4_other_income || 0,
                w4Deductions: row.w4_deductions || 0,
                w4ExtraWithholding: row.w4_extra_withholding || 0,
                w4LastUpdated: row.w4_last_updated,
                w4EffectiveDate: row.w4_effective_date,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        }) as Caregiver[];
    }

    /**
     * Get all active caregivers (renderer-safe, excludes SSN)
     * Use this method when sending data to the renderer process
     */
    static getAllCaregiversForRenderer(includeInactive = false): RendererSafeCaregiver[] {
        const caregivers = this.getAllCaregivers(includeInactive);
        // Strip SSN field from each caregiver
        return caregivers.map(({ ssn, ...safeCaregiver }) => safeCaregiver);
    }

    /**
     * Get caregiver by ID
     */
    static getCaregiverById(id: number): Caregiver | null {
        const db = getDatabase();
        const row = db.prepare('SELECT * FROM caregivers WHERE id = ?').get(id) as any;

        if (!row) return null;

        const fullSsn = decrypt(row.ssn_encrypted);
        const maskedSsn = fullSsn.includes('-')
            ? `XXX-XX-${fullSsn.split('-')[2]}`
            : `XXX-XX-${fullSsn.slice(-4)}`;

        const result = {
            id: row.id,
            fullLegalName: row.full_legal_name,
            ssn: fullSsn,
            maskedSsn,
            hourlyRate: row.hourly_rate,
            relationshipNote: row.relationship_note,
            addressLine1: row.address_line1,
            addressLine2: row.address_line2,
            city: row.city,
            state: row.state,
            zip: row.zip,
            employerId: row.employer_id,
            isActive: row.is_active === 1,
            hfwaBalance: row.hfwa_balance || 0,
            stripeCustomerId: row.stripe_customer_id,
            stripeBankAccountId: row.stripe_bank_account_id,
            payoutMethod: row.payout_method || 'check',
            maskedDestinationAccount: row.masked_destination_account,
            stripePayoutId: row.stripe_payout_id_enc ? decrypt(row.stripe_payout_id_enc) : undefined,
            i9Completed: row.i9_completed === 1,
            i9CompletionDate: row.i9_completion_date,
            i9Notes: row.i9_notes,
            // W-4 Federal Withholding
            w4FilingStatus: row.w4_filing_status || 'single',
            w4MultipleJobs: row.w4_multiple_jobs === 1,
            w4DependentsAmount: row.w4_dependents_amount || 0,
            w4OtherIncome: row.w4_other_income || 0,
            w4Deductions: row.w4_deductions || 0,
            w4ExtraWithholding: row.w4_extra_withholding || 0,
            w4LastUpdated: row.w4_last_updated,
            w4EffectiveDate: row.w4_effective_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        } as Caregiver;

        return result;
    }

    /**
     * Get caregiver by ID (renderer-safe, excludes SSN)
     * Use this method when sending data to the renderer process
     */
    static getCaregiverByIdForRenderer(id: number): RendererSafeCaregiver | null {
        const caregiver = this.getCaregiverById(id);
        if (!caregiver) return null;

        // Strip SSN field
        const { ssn, ...safeCaregiver } = caregiver;
        return safeCaregiver;
    }

    /**
     * Update caregiver profile
     */
    static updateCaregiver(id: number, data: UpdateCaregiverInput): Caregiver {
        const db = getDatabase();

        const updates: string[] = [];
        const values: any[] = [];

        if (data.fullLegalName !== undefined) {
            updates.push('full_legal_name = ?');
            values.push(data.fullLegalName);
        }
        if (data.ssn !== undefined) {
            updates.push('ssn_encrypted = ?');
            values.push(encrypt(data.ssn));
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
            return this.getCaregiverById(id)!;
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        db.prepare(`
      UPDATE caregivers SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

        const caregiver = this.getCaregiverById(id)!;

        // Detect W-4 changes
        const w4Changed =
            (data.w4FilingStatus && data.w4FilingStatus !== caregiver.w4FilingStatus) ||
            (data.w4MultipleJobs !== undefined && data.w4MultipleJobs !== caregiver.w4MultipleJobs) ||
            (data.w4DependentsAmount !== undefined && data.w4DependentsAmount !== caregiver.w4DependentsAmount) ||
            (data.w4OtherIncome !== undefined && data.w4OtherIncome !== caregiver.w4OtherIncome) ||
            (data.w4Deductions !== undefined && data.w4Deductions !== caregiver.w4Deductions) ||
            (data.w4ExtraWithholding !== undefined && data.w4ExtraWithholding !== caregiver.w4ExtraWithholding);

        if (w4Changed) {
            const today = new Date().toISOString().split('T')[0];
            const effectiveDate = data.w4EffectiveDate || today;

            // Update W-4 tracking fields
            db.prepare(`
                UPDATE caregivers
                SET w4_last_updated = ?, w4_effective_date = ?
                WHERE id = ?
            `).run(today, effectiveDate, id);

            // Enhanced audit logging for W-4 changes
            AuditService.log({
                tableName: 'caregivers',
                recordId: id,
                action: 'UPDATE',
                changesJson: JSON.stringify({
                    w4_change: {
                        old: {
                            filingStatus: caregiver.w4FilingStatus,
                            multipleJobs: caregiver.w4MultipleJobs,
                            dependentsAmount: caregiver.w4DependentsAmount,
                            otherIncome: caregiver.w4OtherIncome,
                            deductions: caregiver.w4Deductions,
                            extraWithholding: caregiver.w4ExtraWithholding
                        },
                        new: {
                            filingStatus: data.w4FilingStatus || caregiver.w4FilingStatus,
                            multipleJobs: data.w4MultipleJobs !== undefined ? data.w4MultipleJobs : caregiver.w4MultipleJobs,
                            dependentsAmount: data.w4DependentsAmount !== undefined ? data.w4DependentsAmount : caregiver.w4DependentsAmount,
                            otherIncome: data.w4OtherIncome !== undefined ? data.w4OtherIncome : caregiver.w4OtherIncome,
                            deductions: data.w4Deductions !== undefined ? data.w4Deductions : caregiver.w4Deductions,
                            extraWithholding: data.w4ExtraWithholding !== undefined ? data.w4ExtraWithholding : caregiver.w4ExtraWithholding
                        },
                        effective_date: effectiveDate,
                        last_updated: today
                    }
                })
            });
        } else {
            // Regular audit log for non-W-4 changes
            // Sanitize SSN from audit log
            const { ssn, ...sanitizedData } = data;
            AuditService.log({
                tableName: 'caregivers',
                recordId: id,
                action: 'UPDATE',
                changesJson: JSON.stringify(sanitizedData)
            });
        }

        return caregiver;
    }

    /**
     * Deactivate caregiver
     */
    static deactivateCaregiver(id: number): void {
        const db = getDatabase();
        db.prepare(`
      UPDATE caregivers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);
    }

    /**
     * Reactivate caregiver
     */
    static reactivateCaregiver(id: number): void {
        const db = getDatabase();
        db.prepare(`
      UPDATE caregivers SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);
    }

    /**
     * Delete caregiver (only if no payroll records exist)
     */
    static deleteCaregiver(id: number): void {
        const db = getDatabase();

        // Check if caregiver has payroll records
        const payrollCount = db.prepare(
            'SELECT COUNT(*) as count FROM payroll_records WHERE caregiver_id = ?'
        ).get(id) as { count: number };

        if (payrollCount.count > 0) {
            throw new Error('Cannot delete caregiver with existing payroll records. Deactivate instead.');
        }

        // Check if caregiver has time entries
        const timeCount = db.prepare(
            'SELECT COUNT(*) as count FROM time_entries WHERE caregiver_id = ?'
        ).get(id) as { count: number };

        if (timeCount.count > 0) {
            throw new Error('Cannot delete caregiver with existing time entries. Deactivate instead.');
        }

        db.prepare('DELETE FROM caregivers WHERE id = ?').run(id);
    }
}
