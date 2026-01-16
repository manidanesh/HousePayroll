import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
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

export class PaymentService extends BaseRepository<PaymentRecord> {

    // Abstract implementation dummy
    create(data: Partial<PaymentRecord>): PaymentRecord { throw new Error('Use createRecord'); }
    update(id: number, data: Partial<PaymentRecord>): PaymentRecord { throw new Error('Method not implemented.'); }
    delete(id: number): void { throw new Error('Method not implemented.'); }
    getById(id: number): PaymentRecord | null { return this.getPaymentById(id); }

    // Static Compatibility Layer
    static createRecord(data: { caregiverId: number, payrollRecordId?: number, amount: number, stripeId?: string, status: 'pending' | 'paid' | 'failed' }): PaymentRecord {
        return new PaymentService(getDatabase()).createRecord(data);
    }

    static logTransaction(payment: PaymentRecord): void {
        new PaymentService(getDatabase()).logTransaction(payment);
    }

    static getById(id: number): PaymentRecord | null {
        return new PaymentService(getDatabase()).getPaymentById(id);
    }

    static updateStatus(id: number, status: 'pending' | 'paid' | 'failed', errorMessage?: string): void {
        new PaymentService(getDatabase()).updateStatus(id, status, errorMessage);
    }

    static getHistory(limit = 50, caregiverId?: number): PaymentRecord[] {
        return new PaymentService(getDatabase()).getHistory(limit, caregiverId);
    }

    static getTransactionHistory(limit = 100, caregiverId?: number): any[] {
        return new PaymentService(getDatabase()).getTransactionHistory(limit, caregiverId);
    }

    // Instance Methods

    createRecord(data: {
        caregiverId: number,
        payrollRecordId?: number,
        amount: number,
        stripeId?: string,
        status: 'pending' | 'paid' | 'failed'
    }): PaymentRecord {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No active employer profile found');

        const result = this.run(`
            INSERT INTO payments (
                employer_id, caregiver_id, payroll_record_id, amount, stripe_id, status
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            employer.id,
            data.caregiverId,
            data.payrollRecordId || null,
            data.amount,
            data.stripeId || null,
            data.status
        ]);

        const record = this.getPaymentById(result.lastInsertRowid as number)!;

        // Log to immutable ledger
        this.logTransaction(record);

        return record;
    }

    logTransaction(payment: PaymentRecord): void {
        const employer = EmployerService.getEmployer();
        const caregiver = new CaregiverService(this.db).getById(payment.caregiverId);

        if (!employer || !caregiver) return;

        this.run(`
            INSERT INTO payment_transactions (
                id, payroll_record_id, employer_id, caregiver_id, amount_cents,
                status, stripe_tx_id, source_masked, dest_masked,
                idempotency_key, tax_logic_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            randomUUID(),
            payment.payrollRecordId || null,
            employer.id,
            caregiver.id,
            Math.round(payment.amount * 100),
            payment.status,
            payment.stripeId || null,
            employer.maskedFundingAccount || 'Unknown Employer Account',
            caregiver.maskedDestinationAccount || 'Unknown Caregiver Account',
            `pay_${payment.id}_${payment.status}`, // Simple idempotency
            '1.0.0' // Placeholder for tax logic version
        ]);
    }

    getPaymentById(id: number): PaymentRecord | null {
        const row = this.get<any>('SELECT * FROM payments WHERE id = ?', [id]);
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

    updateStatus(id: number, status: 'pending' | 'paid' | 'failed', errorMessage?: string): void {
        this.run(`
            UPDATE payments 
            SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [status, errorMessage || null, id]);
    }

    getHistory(limit = 50, caregiverId?: number): PaymentRecord[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        let query = `
            SELECT * FROM payments 
            WHERE employer_id = ? 
        `;
        const params: any[] = [employer.id];

        if (caregiverId) {
            query += ` AND caregiver_id = ?`;
            params.push(caregiverId);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        const rows = this.all<any>(query, params);

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

    getTransactionHistory(limit = 100, caregiverId?: number): Array<{
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
        const employer = EmployerService.getEmployer();
        if (!employer) return [];

        let query = `
            SELECT pt.*, c.full_legal_name as caregiver_name
            FROM payment_transactions pt
            JOIN caregivers c ON pt.caregiver_id = c.id
            WHERE pt.employer_id = ?
        `;
        const params: any[] = [employer.id];

        if (caregiverId) {
            query += ` AND pt.caregiver_id = ?`;
            params.push(caregiverId);
        }

        query += ` ORDER BY pt.created_at DESC LIMIT ?`;
        params.push(limit);

        return this.all<any>(query, params);
    }
}
