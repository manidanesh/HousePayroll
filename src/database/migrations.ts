/**
 * Database Migration Framework
 * 
 * This module provides a structured approach to database schema evolution.
 * Each migration represents a specific version of the database schema.
 * 
 * Rules:
 * 1. Migrations run sequentially in version order
 * 2. Each migration runs exactly once
 * 3. Failed migrations prevent app startup
 * 4. Migrations are forward-only (no rollback in production)
 * 5. All migrations must be idempotent where possible
 */

import { Database } from 'better-sqlite3';
import { logger } from '../utils/logger';
import { setSchemaVersion } from './db';

export interface Migration {
    version: number;
    name: string;
    up: (db: Database) => void;
}

/**
 * All database migrations in order
 */
export const migrations: Migration[] = [
    {
        version: 1,
        name: 'Initial Schema',
        up: (db: Database) => {
            // Core tables
            db.exec(`
                CREATE TABLE IF NOT EXISTS employers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    display_name TEXT NOT NULL,
                    child_name TEXT,
                    ssn_or_ein_encrypted TEXT NOT NULL,
                    pay_frequency TEXT NOT NULL CHECK(pay_frequency IN ('weekly', 'bi-weekly', 'monthly')),
                    default_hourly_rate REAL NOT NULL,
                    federal_withholding_enabled INTEGER DEFAULT 0,
                    colorado_suta_rate REAL DEFAULT 0.0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS caregivers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_legal_name TEXT NOT NULL,
                    ssn_encrypted TEXT NOT NULL,
                    hourly_rate REAL NOT NULL,
                    employer_id INTEGER,
                    relationship_note TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (employer_id) REFERENCES employers(id)
                );

                CREATE TABLE IF NOT EXISTS time_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    caregiver_id INTEGER NOT NULL,
                    work_date DATE NOT NULL,
                    hours_worked REAL NOT NULL CHECK(hours_worked >= 0),
                    is_finalized INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
                );

                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    employer_id INTEGER NOT NULL,
                    caregiver_id INTEGER NOT NULL,
                    payroll_record_id INTEGER,
                    amount REAL NOT NULL,
                    currency TEXT DEFAULT 'usd',
                    stripe_id TEXT,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
                    FOREIGN KEY (payroll_record_id) REFERENCES payroll_records(id)
                );

                CREATE TABLE IF NOT EXISTS payment_transactions (
                    id TEXT PRIMARY KEY,
                    payroll_record_id INTEGER NOT NULL,
                    employer_id INTEGER NOT NULL,
                    caregiver_id INTEGER NOT NULL,
                    amount_cents INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    stripe_tx_id TEXT,
                    source_masked TEXT,
                    dest_masked TEXT,
                    initiated_by TEXT DEFAULT 'employer',
                    idempotency_key TEXT UNIQUE,
                    tax_logic_version TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (payroll_record_id) REFERENCES payroll_records(id),
                    FOREIGN KEY (employer_id) REFERENCES employers(id),
                    FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
                );

                CREATE TABLE IF NOT EXISTS payroll_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    caregiver_id INTEGER NOT NULL,
                    pay_period_start DATE NOT NULL,
                    pay_period_end DATE NOT NULL,
                    total_hours REAL NOT NULL,
                    gross_wages REAL NOT NULL,
                    ss_employee REAL NOT NULL,
                    medicare_employee REAL NOT NULL,
                    federal_withholding REAL DEFAULT 0,
                    net_pay REAL NOT NULL,
                    ss_employer REAL NOT NULL,
                    medicare_employer REAL NOT NULL,
                    futa REAL NOT NULL,
                    calculation_version TEXT NOT NULL,
                    tax_version TEXT NOT NULL,
                    is_finalized INTEGER DEFAULT 0,
                    check_number TEXT,
                    payment_date DATE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
                );

                CREATE TABLE IF NOT EXISTS tax_configurations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tax_year INTEGER,
                    ss_rate_employee REAL NOT NULL,
                    ss_rate_employer REAL NOT NULL,
                    ss_wage_base REAL DEFAULT 176100,
                    medicare_rate_employee REAL NOT NULL,
                    medicare_rate_employer REAL NOT NULL,
                    medicare_wage_base REAL,
                    futa_rate REAL NOT NULL,
                    futa_wage_base REAL DEFAULT 7000,
                    effective_date DATE NOT NULL,
                    version TEXT NOT NULL,
                    is_default INTEGER DEFAULT 1,
                    notes TEXT
                );

                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    table_name TEXT NOT NULL,
                    record_id INTEGER NOT NULL,
                    employer_id INTEGER,
                    action TEXT NOT NULL,
                    changes_json TEXT,
                    calculation_version TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (employer_id) REFERENCES employers(id)
                );

                CREATE TABLE IF NOT EXISTS export_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    employer_id INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    quarter INTEGER,
                    filename TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (employer_id) REFERENCES employers(id)
                );
            `);
        }
    },
    {
        version: 2,
        name: 'Tax Config & Auth Updates',
        up: (db: Database) => {
            // Add columns to tax_configurations if they were missing in v1
            const taxColumns = ['tax_year', 'ss_wage_base', 'medicare_wage_base', 'futa_wage_base', 'is_default', 'notes'];
            for (const col of taxColumns) {
                try { db.exec(`ALTER TABLE tax_configurations ADD COLUMN ${col} REAL`); } catch { }
                // Note: types vary, but SQLite is flexible. Real proper typing is done in v1 CREATE.
                // This step replicates the "ensure columns exist" logic.
            }

            // Seed Data
            db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_year ON tax_configurations(tax_year)`);

            // Auth Table
            db.exec(`
                CREATE TABLE IF NOT EXISTS auth (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pin_hash TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
             `);
        }
    },
    {
        version: 3,
        name: 'Payroll Extended Metrics',
        up: (db: Database) => {
            const cols = [
                { name: 'regular_hours', type: 'REAL DEFAULT 0' },
                { name: 'weekend_hours', type: 'REAL DEFAULT 0' },
                { name: 'holiday_hours', type: 'REAL DEFAULT 0' },
                { name: 'regular_wages', type: 'REAL DEFAULT 0' },
                { name: 'weekend_wages', type: 'REAL DEFAULT 0' },
                { name: 'holiday_wages', type: 'REAL DEFAULT 0' },
                { name: 'colorado_suta', type: 'REAL DEFAULT 0' },
                { name: 'is_minimum_wage_compliant', type: 'INTEGER DEFAULT 1' },
                { name: 'overtime_hours', type: 'REAL DEFAULT 0' },
                { name: 'overtime_wages', type: 'REAL DEFAULT 0' },
                { name: 'colorado_famli_employee', type: 'REAL DEFAULT 0' },
                { name: 'colorado_famli_employer', type: 'REAL DEFAULT 0' },
                { name: 'colorado_state_income_tax', type: 'REAL DEFAULT 0' },
                { name: 'is_voided', type: 'INTEGER DEFAULT 0' },
                { name: 'void_reason', type: 'TEXT' },
                { name: 'is_late_payment', type: 'INTEGER DEFAULT 0' },
                { name: 'i9_snapshot', type: 'INTEGER DEFAULT 0' },
                { name: 'paystub_pdf', type: 'BLOB' }
            ];
            for (const col of cols) {
                try { db.exec(`ALTER TABLE payroll_records ADD COLUMN ${col.name} ${col.type}`); } catch { }
            }
        }
    },
    {
        version: 4,
        name: 'Employer Extended Info',
        up: (db: Database) => {
            const updates = [
                `ALTER TABLE employers ADD COLUMN holiday_pay_multiplier REAL DEFAULT 1.0`,
                `ALTER TABLE employers ADD COLUMN weekend_pay_multiplier REAL DEFAULT 1.0`,
                `ALTER TABLE employers ADD COLUMN paystub_title TEXT`,
                `ALTER TABLE employers ADD COLUMN service_address TEXT`,
                `ALTER TABLE employers ADD COLUMN address_line1 TEXT`,
                `ALTER TABLE employers ADD COLUMN address_line2 TEXT`,
                `ALTER TABLE employers ADD COLUMN city TEXT`,
                `ALTER TABLE employers ADD COLUMN state TEXT`,
                `ALTER TABLE employers ADD COLUMN zip TEXT`
            ];
            for (const sql of updates) {
                try { db.exec(sql); } catch { }
            }
        }
    },
    {
        version: 5,
        name: 'Caregiver Details',
        up: (db: Database) => {
            try { db.exec('ALTER TABLE caregivers ADD COLUMN hfwa_balance REAL DEFAULT 0'); } catch { }
            const addrCols = ['address_line1', 'address_line2', 'city', 'state', 'zip'];
            for (const col of addrCols) {
                try { db.exec(`ALTER TABLE caregivers ADD COLUMN ${col} TEXT`); } catch { }
            }
        }
    },
    {
        version: 6,
        name: 'W4 Information',
        up: (db: Database) => {
            const w4Cols = [
                'w4_filing_status TEXT DEFAULT "single"',
                'w4_multiple_jobs INTEGER DEFAULT 0',
                'w4_dependents_amount REAL DEFAULT 0',
                'w4_other_income REAL DEFAULT 0',
                'w4_deductions REAL DEFAULT 0',
                'w4_extra_withholding REAL DEFAULT 0',
                'w4_last_updated TEXT',
                'w4_effective_date TEXT'
            ];
            for (const col of w4Cols) {
                try { db.exec(`ALTER TABLE caregivers ADD COLUMN ${col}`); } catch { }
            }
        }
    },
    {
        version: 7,
        name: 'Stripe Integration',
        up: (db: Database) => {
            try { db.exec('ALTER TABLE employers ADD COLUMN stripe_publishable_key_enc TEXT'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN stripe_secret_key_enc TEXT'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN stripe_account_id_enc TEXT'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN payment_verification_status TEXT DEFAULT "none"'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN masked_funding_account TEXT'); } catch { }

            const cgCols = ['stripe_customer_id', 'stripe_bank_account_id', 'payout_method', 'masked_destination_account', 'stripe_payout_id_enc'];
            for (const col of cgCols) {
                try { db.exec(`ALTER TABLE caregivers ADD COLUMN ${col} TEXT`); } catch { }
            }
        }
    },
    {
        version: 8,
        name: 'I-9 and Payment Methods',
        up: (db: Database) => {
            try { db.exec('ALTER TABLE payroll_records ADD COLUMN payment_method TEXT'); } catch { }
            try { db.exec('ALTER TABLE caregivers ADD COLUMN i9_completed INTEGER DEFAULT 0'); } catch { }
            try { db.exec('ALTER TABLE caregivers ADD COLUMN i9_completion_date TEXT'); } catch { }
            try { db.exec('ALTER TABLE caregivers ADD COLUMN i9_notes TEXT'); } catch { }
        }
    },
    {
        version: 9,
        name: 'Colorado SUI & Rates',
        up: (db: Database) => {
            try { db.exec('ALTER TABLE employers ADD COLUMN fein_enc TEXT'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN ui_account_number_enc TEXT'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN sui_wage_base REAL DEFAULT 16000.0'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN sui_effective_date TEXT'); } catch { }

            try { db.exec('ALTER TABLE payroll_records ADD COLUMN employer_sui_rate REAL'); } catch { }
            try { db.exec('ALTER TABLE payroll_records ADD COLUMN employer_sui_paid REAL'); } catch { }
        }
    },
    {
        version: 10,
        name: 'Workers Compensation & FAMLI',
        up: (db: Database) => {
            try { db.exec('ALTER TABLE employers ADD COLUMN wc_acknowledged INTEGER DEFAULT 0'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN wc_carrier_enc TEXT'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN wc_policy_number_enc TEXT'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN wc_acknowledgment_date TEXT'); } catch { }

            try { db.exec('ALTER TABLE employers ADD COLUMN colorado_famli_rate_ee REAL DEFAULT 0.0045'); } catch { }
            try { db.exec('ALTER TABLE employers ADD COLUMN colorado_famli_rate_er REAL DEFAULT 0.0045'); } catch { }
        }
    },
    {
        version: 11,
        name: 'Multi-Household',
        up: (db: Database) => {
            try { db.exec('ALTER TABLE employers ADD COLUMN is_active INTEGER DEFAULT 0'); } catch { }

            try { db.exec('ALTER TABLE caregivers ADD COLUMN employer_id INTEGER REFERENCES employers(id)'); } catch { }
            try { db.exec('ALTER TABLE time_entries ADD COLUMN employer_id INTEGER REFERENCES employers(id)'); } catch { }
            try { db.exec('ALTER TABLE payroll_records ADD COLUMN employer_id INTEGER REFERENCES employers(id)'); } catch { }
            try { db.exec('ALTER TABLE audit_log ADD COLUMN employer_id INTEGER REFERENCES employers(id)'); } catch { }

            // Seed first employer if exists
            const firstEmployer = db.prepare('SELECT id FROM employers ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
            if (firstEmployer) {
                db.prepare('UPDATE employers SET is_active = 1 WHERE id = ?').run(firstEmployer.id);
                db.prepare('UPDATE caregivers SET employer_id = ? WHERE employer_id IS NULL').run(firstEmployer.id);
                db.prepare('UPDATE time_entries SET employer_id = ? WHERE employer_id IS NULL').run(firstEmployer.id);
                db.prepare('UPDATE payroll_records SET employer_id = ? WHERE employer_id IS NULL').run(firstEmployer.id);
                try { db.prepare('UPDATE audit_log SET employer_id = ? WHERE employer_id IS NULL').run(firstEmployer.id); } catch { }
            }
        }
    },
    {
        version: 12,
        name: 'Banking Info & Status',
        up: (db: Database) => {
            try { db.exec("ALTER TABLE payroll_records ADD COLUMN status TEXT DEFAULT 'approved'"); } catch { }
            try { db.exec("UPDATE payroll_records SET status = 'approved' WHERE status IS NULL"); } catch { }

            try { db.exec('ALTER TABLE payroll_records ADD COLUMN check_bank_name TEXT'); } catch { }
            try { db.exec('ALTER TABLE payroll_records ADD COLUMN check_account_owner TEXT'); } catch { }
        }
    }
];

/**
 * Run all pending migrations
 */
export function runMigrations(database: Database, currentVersion: number): void {
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
        logger.info(`Database schema is up to date at version ${currentVersion}`);
        return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s) to apply`);

    for (const migration of pendingMigrations) {
        logger.info(`Applying migration ${migration.version}: ${migration.name}`);

        try {
            migration.up(database);
            setSchemaVersion(database, migration.version, migration.name);
            logger.info(`Successfully applied migration ${migration.version}`);
        } catch (err) {
            logger.error(`Migration ${migration.version} (${migration.name}) FAILED`, err);
            throw new Error(`Database migration ${migration.version} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const finalVersion = pendingMigrations[pendingMigrations.length - 1].version;
    logger.info(`All migrations completed successfully. Database is now at version ${finalVersion}`);
}

/**
 * Detect current database version
 */
export function detectSchemaVersion(database: Database): number {
    try {
        const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[];
        const tableNames = tables.map(t => t.name);

        if (tableNames.length === 0) return 0;

        if (tableNames.includes('schema_meta')) {
            const result = database.prepare('SELECT version FROM schema_meta WHERE id = 1').get() as { version: number } | undefined;
            return result?.version || 0;
        }

        // Feature detection for Legacy DBs
        const payrollColumns = database.prepare(`SELECT name FROM pragma_table_info('payroll_records')`).all() as { name: string }[];
        const cols = payrollColumns.map(c => c.name);

        if (cols.includes('check_bank_name')) return 12;
        if (cols.includes('status')) return 12; // v12 has both
        if (tableNames.includes('auth')) return 11; // Closest approximation

        // Return 12 for all existing databases to skip re-running migrations blindly
        // This is safe because "CREATE IF NOT EXISTS" / "ADD COLUMN" try-catch blocks
        // in migrations make them idempotent, but if we detect *any* complexity,
        // it's safer to assume it's fully patched if it has the latest columns.

        return 12;
    } catch (err) {
        logger.error('Failed to detect schema version', err);
        return 0;
    }
}
