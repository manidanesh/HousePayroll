import { getDatabase } from '../database/db';
import { StripeService } from './stripe-service';
import { EmployerService } from './employer-service';
import { CaregiverService } from './caregiver-service';
import { randomUUID } from 'crypto';

export interface PaymentRecord {
    id: number;
    employerId: number;
    caregiverId: number;
    payrollRecordId?: number;
    amount: number;
    currency: string;
    stripeId?: string;
    status: 'pending' | 'paid' | 'failed';
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
}

export class PaymentService {
    /**
     * Create a new payment record
     */
    static createRecord(data: {
        caregiverId: number,
        payrollRecordId?: number,
        amount: number,
        stripeId?: string,
        status: 'pending' | 'paid' | 'failed'
    }): PaymentRecord {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No active employer profile found');

        const result = db.prepare(`
            INSERT INTO payments (
                employer_id, caregiver_id, payroll_record_id, amount, stripe_id, status
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            employer.id,
            data.caregiverId,
            data.payrollRecordId || null,
            data.amount,
            data.stripeId || null,
            data.status
        );

        const record = this.getById(result.lastInsertRowid as number)!;

        // Log to immutable ledger
        this.logTransaction(record);

        return record;
    }

    /**
     * Log to immutable payment_transactions ledger
     */
    static logTransaction(payment: PaymentRecord): void {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        const caregiver = CaregiverService.getCaregiverById(payment.caregiverId);

        if (!employer || !caregiver) return;

        db.prepare(`
            INSERT INTO payment_transactions (
                id, payroll_record_id, employer_id, caregiver_id, amount_cents,
                status, stripe_tx_id, source_masked, dest_masked,
                idempotency_key, tax_logic_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            randomUUID(),
            payment.payrollRecordId || 0,
            employer.id,
            caregiver.id,
            Math.round(payment.amount * 100),
            payment.status,
            payment.stripeId || null,
            employer.maskedFundingAccount || 'Unknown Employer Account',
            caregiver.maskedDestinationAccount || 'Unknown Caregiver Account',
            `pay_${payment.id}_${payment.status}`, // Simple idempotency
            '1.0.0' // Placeholder for tax logic version
        );
    }

    /**
     * Get payment record by ID
     */
    static getById(id: number): PaymentRecord | null {
        const db = getDatabase();
        const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
        if (!row) return null;

        return {
            id: row.id,
            employerId: row.employer_id,
            caregiverId: row.caregiver_id,
            payrollRecordId: row.payroll_record_id,
            amount: row.amount,
            currency: row.currency,
            stripeId: row.stripe_id,
            status: row.status as any,
            errorMessage: row.error_message,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Update payment status
     */
    static updateStatus(id: number, status: 'pending' | 'paid' | 'failed', errorMessage?: string): void {
        const db = getDatabase();
        db.prepare(`
            UPDATE payments 
            SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(status, errorMessage || null, id);
    }

    /**
     * Get payment history for the active employer
     */
    static getHistory(limit = 50, caregiverId?: number): PaymentRecord[] {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        let query = `
            SELECT * FROM payments 
            WHERE employer_id = ? 
        `;
        const params = [employer.id];

        if (caregiverId) {
            query += ` AND caregiver_id = ?`;
            params.push(caregiverId);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        const rows = db.prepare(query).all(...params) as any[];

        return rows.map(row => ({
            id: row.id,
            employerId: row.employer_id,
            caregiverId: row.caregiver_id,
            payrollRecordId: row.payroll_record_id,
            amount: row.amount,
            currency: row.currency,
            stripeId: row.stripe_id,
            status: row.status as any,
            errorMessage: row.error_message,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }

    /**
     * Get immutable transaction ledger
     */
    static getTransactionHistory(limit = 100, caregiverId?: number): Array<{
        id: string;
        payroll_record_id: number;
        employer_id: number;
        caregiver_id: number;
        amount_cents: number;
        status: string;
        stripe_tx_id: string | null;
        source_masked: string;
        dest_masked: string;
        idempotency_key: string;
        tax_logic_version: string;
        created_at: string;
        caregiver_name: string;
    }> {
        const db = getDatabase();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        let query = `
            SELECT pt.*, c.full_legal_name as caregiver_name
            FROM payment_transactions pt
            JOIN caregivers c ON pt.caregiver_id = c.id
            WHERE pt.employer_id = ?
        `;
        const params = [employer.id];

        if (caregiverId) {
            query += ` AND pt.caregiver_id = ?`;
            params.push(caregiverId);
        }

        query += ` ORDER BY pt.created_at DESC LIMIT ?`;
        params.push(limit);

        return db.prepare(query).all(...params) as any;
    }
}
