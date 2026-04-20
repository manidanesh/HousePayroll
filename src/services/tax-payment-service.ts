/**
 * TaxPaymentService — Tracks Colorado DOR withholding tax remittances
 *
 * Solves the DR 1093 Line 2 data gap:
 * Line 2 = total CO income tax actually remitted to CDOR during the year.
 * Each payment is logged here so the DR 1093 can compute an accurate balance.
 *
 * Colorado household employers typically remit quarterly (EFT via Revenue Online).
 * The app lets the user record each payment manually.
 */
import { getDatabase } from '../database/db';
import { EmployerService } from './employer-service';

export type PaymentMethod = 'EFT' | 'CHECK' | 'ONLINE' | 'OTHER';

export interface TaxPaymentEntry {
    id: number;
    employerId: number;
    taxYear: number;
    paymentDate: string;          // ISO date — "2024-04-15"
    amount: number;               // dollars + cents
    quarter: 1 | 2 | 3 | 4 | null; // which quarter this covers (null = annual)
    method: PaymentMethod;
    referenceNumber?: string;     // Colorado Revenue Online confirmation #
    notes?: string;
    createdAt: string;
}

export interface TaxPaymentSummary {
    taxYear: number;
    totalRemitted: number;        // Line 2 of DR 1093
    totalWithheld: number;        // Line 1 of DR 1093 (from payroll records)
    balance: number;              // Line 1 - Line 2 (+ = owe more; - = paid too much)
    payments: TaxPaymentEntry[];
}

export class TaxPaymentService {

    /** Ensure the table exists (safe to call multiple times) */
    static ensureTable(): void {
        const db = getDatabase();
        db.exec(`
            CREATE TABLE IF NOT EXISTS co_tax_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employer_id INTEGER NOT NULL,
                tax_year INTEGER NOT NULL,
                payment_date TEXT NOT NULL,
                amount REAL NOT NULL,
                quarter INTEGER,           -- 1-4 or NULL for annual/manual
                method TEXT NOT NULL DEFAULT 'EFT',
                reference_number TEXT,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_co_tax_payments_employer_year
                ON co_tax_payments(employer_id, tax_year);
        `);
    }

    /** Log a new CO DOR remittance payment */
    static addPayment(input: {
        taxYear: number;
        paymentDate: string;
        amount: number;
        quarter?: 1 | 2 | 3 | 4;
        method?: PaymentMethod;
        referenceNumber?: string;
        notes?: string;
    }): TaxPaymentEntry {
        TaxPaymentService.ensureTable();
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No employer profile found');

        const db = getDatabase();
        const result = db.prepare(`
            INSERT INTO co_tax_payments
                (employer_id, tax_year, payment_date, amount, quarter, method, reference_number, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            employer.id,
            input.taxYear,
            input.paymentDate,
            input.amount,
            input.quarter ?? null,
            input.method ?? 'EFT',
            input.referenceNumber ?? null,
            input.notes ?? null
        );

        return TaxPaymentService.getPaymentById(result.lastInsertRowid as number)!;
    }

    /** Delete a payment by ID */
    static deletePayment(id: number): void {
        TaxPaymentService.ensureTable();
        const db = getDatabase();
        db.prepare('DELETE FROM co_tax_payments WHERE id = ?').run(id);
    }

    /** Get a single payment by ID */
    static getPaymentById(id: number): TaxPaymentEntry | null {
        TaxPaymentService.ensureTable();
        const employer = EmployerService.getEmployer();
        if (!employer) return null;
        const db = getDatabase();
        const row = db.prepare(
            'SELECT * FROM co_tax_payments WHERE id = ? AND employer_id = ?'
        ).get(id, employer.id) as any;
        return row ? TaxPaymentService.mapRow(row) : null;
    }

    /** Get all payments for a given tax year */
    static getPayments(taxYear: number): TaxPaymentEntry[] {
        TaxPaymentService.ensureTable();
        const employer = EmployerService.getEmployer();
        if (!employer) return [];
        const db = getDatabase();
        const rows = db.prepare(`
            SELECT * FROM co_tax_payments
            WHERE employer_id = ? AND tax_year = ?
            ORDER BY payment_date ASC
        `).all(employer.id, taxYear) as any[];
        return rows.map(TaxPaymentService.mapRow);
    }

    /**
     * Get a full summary for the DR 1093:
     *   Line 1: total CO income tax withheld from payroll records
     *   Line 2: total CO income tax actually remitted (from this table)
     *   Balance: Line 1 - Line 2
     */
    static getSummary(taxYear: number): TaxPaymentSummary {
        TaxPaymentService.ensureTable();
        const employer = EmployerService.getEmployer();
        if (!employer) {
            return { taxYear, totalWithheld: 0, totalRemitted: 0, balance: 0, payments: [] };
        }

        const db = getDatabase();

        // Line 1 — from finalized payroll records
        const withheldRow = db.prepare(`
            SELECT COALESCE(SUM(colorado_state_income_tax), 0) as total
            FROM payroll_records
            WHERE employer_id = ?
              AND pay_period_end BETWEEN ? AND ?
              AND is_finalized = 1
              AND is_voided = 0
        `).get(employer.id, `${taxYear}-01-01`, `${taxYear}-12-31`) as any;

        const totalWithheld = Number(withheldRow?.total ?? 0);

        // Line 2 — from co_tax_payments table
        const remittedRow = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM co_tax_payments
            WHERE employer_id = ? AND tax_year = ?
        `).get(employer.id, taxYear) as any;

        const totalRemitted = Number(remittedRow?.total ?? 0);

        const payments = TaxPaymentService.getPayments(taxYear);

        return {
            taxYear,
            totalWithheld: Math.round(totalWithheld * 100) / 100,
            totalRemitted: Math.round(totalRemitted * 100) / 100,
            balance: Math.round((totalWithheld - totalRemitted) * 100) / 100,
            payments,
        };
    }

    private static mapRow(row: any): TaxPaymentEntry {
        return {
            id: row.id,
            employerId: row.employer_id,
            taxYear: row.tax_year,
            paymentDate: row.payment_date,
            amount: row.amount,
            quarter: row.quarter ?? null,
            method: row.method as PaymentMethod,
            referenceNumber: row.reference_number ?? undefined,
            notes: row.notes ?? undefined,
            createdAt: row.created_at,
        };
    }
}
