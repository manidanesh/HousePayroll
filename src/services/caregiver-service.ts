/**
 * CaregiverService - Manages caregiver profile operations
 */

import { getDatabase, encrypt, decrypt } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { Caregiver, CreateCaregiverInput, UpdateCaregiverInput, RendererSafeCaregiver } from '../types';
import { AuditService } from './audit-service';
import { sanitizeData } from '../utils/sanitizer';

export class CaregiverService extends BaseRepository<Caregiver> {

    // Static Compatibility Layer
    static createCaregiver(data: CreateCaregiverInput): Caregiver {
        return new CaregiverService(getDatabase()).create(data);
    }

    static getAllCaregivers(includeInactive = false): Caregiver[] {
        return new CaregiverService(getDatabase()).getAll(includeInactive);
    }

    static getAllCaregiversForRenderer(includeInactive = false): RendererSafeCaregiver[] {
        return new CaregiverService(getDatabase()).getAllForRenderer(includeInactive);
    }

    static getCaregiverById(id: number): Caregiver | null {
        return new CaregiverService(getDatabase()).getById(id);
    }

    static getCaregiverByIdForRenderer(id: number): RendererSafeCaregiver | null {
        return new CaregiverService(getDatabase()).getByIdForRenderer(id);
    }

    static updateCaregiver(id: number, data: UpdateCaregiverInput): Caregiver {
        return new CaregiverService(getDatabase()).update(id, data);
    }

    static deactivateCaregiver(id: number): void {
        new CaregiverService(getDatabase()).deactivate(id);
    }

    static reactivateCaregiver(id: number): void {
        new CaregiverService(getDatabase()).reactivate(id);
    }

    static deleteCaregiver(id: number): void {
        new CaregiverService(getDatabase()).delete(id);
    }

    // Instance Methods

    create(data: CreateCaregiverInput): Caregiver {
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

        // Prepare W-4/I-9 values
        const i9Completed = data.i9Completed ? 1 : 0;
        const w4MultipleJobs = data.w4MultipleJobs ? 1 : 0;
        const today = new Date().toISOString().split('T')[0];
        const w4EffectiveDate = data.w4EffectiveDate || today;

        const result = this.run(`
      INSERT INTO caregivers (
        full_legal_name, ssn_encrypted, hourly_rate, relationship_note,
        address_line1, address_line2, city, state, zip,
        i9_completed, i9_completion_date, i9_notes,
        payout_method, masked_destination_account, stripe_payout_id_enc,
        w4_filing_status, w4_multiple_jobs, w4_dependents_amount,
        w4_other_income, w4_deductions, w4_extra_withholding,
        w4_last_updated, w4_effective_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            data.fullLegalName,
            ssnEncrypted,
            data.hourlyRate,
            data.relationshipNote || null,
            data.addressLine1 || null,
            data.addressLine2 || null,
            data.city || null,
            data.state || null,
            data.zip || null,
            i9Completed,
            data.i9CompletionDate || null,
            data.i9Notes || null,
            data.payoutMethod || 'check',
            data.maskedDestinationAccount || null,
            data.stripePayoutId ? encrypt(data.stripePayoutId) : null,
            data.w4FilingStatus || 'single',
            w4MultipleJobs,
            data.w4DependentsAmount || 0,
            data.w4OtherIncome || 0,
            data.w4Deductions || 0,
            data.w4ExtraWithholding || 0,
            today,
            w4EffectiveDate
        ]);

        const newId = result.lastInsertRowid as number;

        // Log audit event
        AuditService.log({
            tableName: 'caregivers',
            recordId: newId,
            action: 'CREATE',
            changesJson: JSON.stringify(sanitizeData(data))
        });

        return this.getById(newId)!;
    }

    getAll(includeInactive = false): Caregiver[] {
        const query = includeInactive
            ? 'SELECT * FROM caregivers ORDER BY full_legal_name'
            : 'SELECT * FROM caregivers WHERE is_active = 1 ORDER BY full_legal_name';

        const rows = this.all<any>(query);
        return rows.map(row => this.mapRowToCaregiver(row));
    }

    getAllForRenderer(includeInactive = false): RendererSafeCaregiver[] {
        const caregivers = this.getAll(includeInactive);
        return caregivers.map(({ ssn, ...safeCaregiver }) => safeCaregiver);
    }

    getById(id: number): Caregiver | null {
        const row = this.get<any>('SELECT * FROM caregivers WHERE id = ?', [id]);
        return row ? this.mapRowToCaregiver(row) : null;
    }

    getByIdForRenderer(id: number): RendererSafeCaregiver | null {
        const caregiver = this.getById(id);
        if (!caregiver) return null;
        const { ssn, ...safeCaregiver } = caregiver;
        return safeCaregiver;
    }

    update(id: number, data: UpdateCaregiverInput): Caregiver {
        const current = this.getById(id);
        if (!current) throw new Error(`Caregiver not found: ${id}`);

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

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);
            this.run(`UPDATE caregivers SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        // Handle W4 Logic, returning updated caregiver
        const updatedCaregiver = this.getById(id)!;

        // Detect W-4 changes
        const w4Changed =
            (data.w4FilingStatus && data.w4FilingStatus !== current.w4FilingStatus) ||
            (data.w4MultipleJobs !== undefined && data.w4MultipleJobs !== current.w4MultipleJobs) ||
            (data.w4DependentsAmount !== undefined && data.w4DependentsAmount !== current.w4DependentsAmount) ||
            (data.w4OtherIncome !== undefined && data.w4OtherIncome !== current.w4OtherIncome) ||
            (data.w4Deductions !== undefined && data.w4Deductions !== current.w4Deductions) ||
            (data.w4ExtraWithholding !== undefined && data.w4ExtraWithholding !== current.w4ExtraWithholding);

        if (w4Changed) {
            const today = new Date().toISOString().split('T')[0];
            const effectiveDate = data.w4EffectiveDate || today;

            this.run(`
                UPDATE caregivers
                SET w4_last_updated = ?, w4_effective_date = ?
                WHERE id = ?
            `, [today, effectiveDate, id]);

            AuditService.log({
                tableName: 'caregivers',
                recordId: id,
                action: 'UPDATE',
                changesJson: JSON.stringify({
                    w4_change: {
                        old: {
                            filingStatus: current.w4FilingStatus,
                            multipleJobs: current.w4MultipleJobs,
                            dependentsAmount: current.w4DependentsAmount,
                            otherIncome: current.w4OtherIncome,
                            deductions: current.w4Deductions,
                            extraWithholding: current.w4ExtraWithholding
                        },
                        new: {
                            filingStatus: data.w4FilingStatus || current.w4FilingStatus,
                            multipleJobs: data.w4MultipleJobs !== undefined ? data.w4MultipleJobs : current.w4MultipleJobs,
                            dependentsAmount: data.w4DependentsAmount !== undefined ? data.w4DependentsAmount : current.w4DependentsAmount,
                            otherIncome: data.w4OtherIncome !== undefined ? data.w4OtherIncome : current.w4OtherIncome,
                            deductions: data.w4Deductions !== undefined ? data.w4Deductions : current.w4Deductions,
                            extraWithholding: data.w4ExtraWithholding !== undefined ? data.w4ExtraWithholding : current.w4ExtraWithholding
                        },
                        effective_date: effectiveDate,
                        last_updated: today
                    }
                })
            });
        } else if (updates.length > 0) {
            AuditService.log({
                tableName: 'caregivers',
                recordId: id,
                action: 'UPDATE',
                changesJson: JSON.stringify(sanitizeData(data))
            });
        }

        return this.getById(id)!;
    }

    deactivate(id: number): void {
        this.run('UPDATE caregivers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    }

    reactivate(id: number): void {
        this.run('UPDATE caregivers SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    }

    delete(id: number): void {
        const payrollCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM payroll_records WHERE caregiver_id = ?', [id]);
        if ((payrollCount?.count || 0) > 0) {
            throw new Error('Cannot delete caregiver with existing payroll records. Deactivate instead.');
        }

        const timeCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM time_entries WHERE caregiver_id = ?', [id]);
        if ((timeCount?.count || 0) > 0) {
            throw new Error('Cannot delete caregiver with existing time entries. Deactivate instead.');
        }

        this.run('DELETE FROM caregivers WHERE id = ?', [id]);
    }

    private mapRowToCaregiver(row: any): Caregiver {
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
    }
}
