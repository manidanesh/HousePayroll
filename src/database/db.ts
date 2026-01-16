import Database from 'better-sqlite3';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { logger } from '../utils/logger';

let db: Database.Database | null = null;

// Use Electron's userData directory (platform-independent)
// macOS: ~/Library/Application Support/Household Payroll/
// Windows: %APPDATA%/Household Payroll/
// Linux: ~/.config/Household Payroll/
const DATA_DIR = app.getPath('userData');
const keyPath = path.join(DATA_DIR, '.key');
const keyPathEnc = path.join(DATA_DIR, '.key.enc');
let ENCRYPTION_KEY: string | null = null;

/**
 * Loads the database encryption key using OS-native secure storage.
 * SECURITY: No fallback to weak keys - fails fast if secure storage unavailable.
 */
function loadEncryptionKey(): string {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY;

  try {
    // Require OS-native secure storage
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'Secure storage is not available on this system. ' +
        'Cannot safely store encryption key. ' +
        'Please ensure your operating system supports secure credential storage.'
      );
    }

    // Load from encrypted storage
    if (fs.existsSync(keyPathEnc)) {
      const encrypted = fs.readFileSync(keyPathEnc);
      ENCRYPTION_KEY = safeStorage.decryptString(encrypted);
    } else {
      // Generate new strong key
      const plain = crypto.randomBytes(32).toString('hex');
      const encrypted = safeStorage.encryptString(plain);
      fs.writeFileSync(keyPathEnc, encrypted, { mode: 0o600 });
      ENCRYPTION_KEY = plain;
    }

    // Remove legacy plain text key if it exists (security migration)
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath);
      logger.info('Removed legacy plain text encryption key');
    }

    // Validate key strength
    if (ENCRYPTION_KEY.length < 64) {
      throw new Error('Encryption key is too short (minimum 64 characters required)');
    }

    return ENCRYPTION_KEY;
  } catch (err: any) {
    // SECURITY: Fail fast - do not use weak fallback keys
    logger.error('CRITICAL: Failed to load encryption key', err);
    throw new Error(
      'Cannot initialize database encryption. ' +
      'This is a critical security error. ' +
      'Please contact support. Error: ' + err.message
    );
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(DATA_DIR, 'payroll.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get current schema version from database
 * Returns 0 if schema_meta table doesn't exist or is uninitialized
 */
export function getSchemaVersion(database: Database.Database): number {
  try {
    const result = database.prepare('SELECT version FROM schema_meta WHERE id = 1')
      .get() as { version: number } | undefined;
    return result?.version || 0;
  } catch (err) {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Update schema version after successful migration
 */
export function setSchemaVersion(database: Database.Database, version: number, migrationName: string): void {
  database.prepare(`
    UPDATE schema_meta 
    SET version = ?, applied_at = datetime('now'), last_migration = ?
    WHERE id = 1
  `).run(version, migrationName);
  logger.info(`Schema upgraded to version ${version}: ${migrationName}`);
}

export function initializeDatabase() {
  const database = getDatabase();

  // ============================================================================
  // SCHEMA VERSIONING SYSTEM
  // ============================================================================
  // Create schema versioning table (must be first)
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL DEFAULT 0,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_migration TEXT
    )
  `);

  // Initialize schema version if needed
  const versionRow = database.prepare('SELECT version FROM schema_meta WHERE id = 1').get();
  if (!versionRow) {
    // Check if this is an existing database by looking for existing tables
    const tables = database.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as { name: string }[];

    // If we have tables beyond just schema_meta, this is an existing database
    const existingTableNames = tables.filter(t => t.name !== 'schema_meta').map(t => t.name);
    const hasExistingDatabase = existingTableNames.length > 0;

    if (hasExistingDatabase) {
      // Existing database being migrated to versioning system
      // Mark as version 12 (all migrations through check_bank_name column)
      database.prepare('INSERT INTO schema_meta (id, version, last_migration) VALUES (1, 12, ?)').run('Migrated to versioning system');
      logger.info('Existing database detected - marked as schema version 12 (pre-versioning baseline)');
    } else {
      // Brand new database - start at version 0
      database.prepare('INSERT INTO schema_meta (id, version, last_migration) VALUES (1, 0, ?)').run('Initial');
      logger.info('New database created - schema versioning initialized at version 0');
    }
  } else {
    const currentVersion = (versionRow as { version: number }).version;
    logger.info(`Database schema version: ${currentVersion}`);
  }

  // ============================================================================
  // LEGACY MIGRATION SYSTEM (to be replaced with runMigrations)
  // ============================================================================
  // TODO: Extract these into versioned migrations in src/database/migrations.ts

  // Create employers table
  database.exec(`
    CREATE TABLE IF NOT EXISTS employers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      child_name TEXT,
      ssn_or_ein_encrypted TEXT NOT NULL,
      pay_frequency TEXT NOT NULL CHECK(pay_frequency IN ('weekly', 'bi-weekly', 'monthly')),
      default_hourly_rate REAL NOT NULL,
      federal_withholding_enabled INTEGER DEFAULT 0,
      colorado_suta_rate REAL DEFAULT 0.0,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      paystub_title TEXT,
      service_address TEXT,
      stripe_publishable_key_enc TEXT,
      stripe_secret_key_enc TEXT,
      stripe_account_id_enc TEXT,
      payment_verification_status TEXT DEFAULT 'none',
      masked_funding_account TEXT,
      fein_enc TEXT,
      ui_account_number_enc TEXT,
      sui_wage_base REAL DEFAULT 16000.0,
      sui_effective_date TEXT,
      wc_acknowledged INTEGER DEFAULT 0,
      wc_carrier_enc TEXT,
      wc_policy_number_enc TEXT,
      wc_acknowledgment_date TEXT,
      colorado_famli_rate_ee REAL DEFAULT 0.0045,
      colorado_famli_rate_er REAL DEFAULT 0.0045,
      is_active INTEGER DEFAULT 0, -- Track currently selected household
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create caregivers table
  database.exec(`
    CREATE TABLE IF NOT EXISTS caregivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_legal_name TEXT NOT NULL,
      ssn_encrypted TEXT NOT NULL,
      hourly_rate REAL NOT NULL,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      employer_id INTEGER, -- Foreign Key
      relationship_note TEXT,
      is_active INTEGER DEFAULT 1,
      hfwa_balance REAL DEFAULT 0,
      stripe_customer_id TEXT,
      stripe_bank_account_id TEXT,
      payout_method TEXT DEFAULT 'check',
      masked_destination_account TEXT,
      stripe_payout_id_enc TEXT,
      w4_filing_status TEXT DEFAULT 'single',
      w4_multiple_jobs INTEGER DEFAULT 0,
      w4_dependents_amount REAL DEFAULT 0,
      w4_other_income REAL DEFAULT 0,
      w4_deductions REAL DEFAULT 0,
      w4_extra_withholding REAL DEFAULT 0,
      w4_last_updated TEXT,
      w4_effective_date TEXT,
      i9_completion_date TEXT,
      i9_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `);

  // Create time_entries table
  database.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caregiver_id INTEGER NOT NULL,
      employer_id INTEGER, -- Added for isolation
      work_date DATE NOT NULL,
      hours_worked REAL NOT NULL CHECK(hours_worked >= 0),
      is_finalized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `);

  // Create payments table
  database.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employer_id INTEGER NOT NULL,
      caregiver_id INTEGER NOT NULL,
      payroll_record_id INTEGER,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'usd',
      stripe_id TEXT,
      status TEXT NOT NULL, -- 'pending', 'paid', 'failed'
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (payroll_record_id) REFERENCES payroll_records(id)
    )
  `);

  // Create payment_transactions table (Immutable Ledger)
  database.exec(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY, -- UUID
      payroll_record_id INTEGER NOT NULL,
      employer_id INTEGER NOT NULL,
      caregiver_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'pending', 'paid', 'failed', 'reversed'
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
    )
  `);

  // Create payroll_records table
  database.exec(`
    CREATE TABLE IF NOT EXISTS payroll_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caregiver_id INTEGER NOT NULL,
      employer_id INTEGER, -- Added for isolation
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      total_hours REAL NOT NULL,
      regular_hours REAL DEFAULT 0,
      weekend_hours REAL DEFAULT 0,
      holiday_hours REAL DEFAULT 0,
      gross_wages REAL NOT NULL,
      regular_wages REAL DEFAULT 0,
      weekend_wages REAL DEFAULT 0,
      holiday_wages REAL DEFAULT 0,
      ss_employee REAL NOT NULL,
      medicare_employee REAL NOT NULL,
      federal_withholding REAL DEFAULT 0,
      net_pay REAL NOT NULL,
      ss_employer REAL NOT NULL,
      medicare_employer REAL NOT NULL,
      futa REAL NOT NULL,
      colorado_suta REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      overtime_wages REAL DEFAULT 0,
      colorado_famli_employee REAL DEFAULT 0,
      colorado_famli_employer REAL DEFAULT 0,
      employer_sui_rate REAL,
      employer_sui_paid REAL,
      calculation_version TEXT NOT NULL,
      tax_version TEXT NOT NULL,
      is_finalized INTEGER DEFAULT 0,
      is_minimum_wage_compliant INTEGER DEFAULT 1,
      check_number TEXT,
      payment_date DATE,
      payment_method TEXT,
      is_voided INTEGER DEFAULT 0,
      void_reason TEXT,
      is_late_payment INTEGER DEFAULT 0,
      i9_snapshot INTEGER DEFAULT 0,
      paystub_pdf BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `);

  // Create tax_configurations table
  database.exec(`
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
    )
  `);

  // Create audit_log table
  database.exec(`
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
    )
  `);

  // Create export_logs table
  database.exec(`
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
    )
  `);

  // Migration: Add new columns to tax_configurations if they don't exist
  const taxConfigColumns = [
    { name: 'tax_year', type: 'INTEGER' },
    { name: 'ss_wage_base', type: 'REAL DEFAULT 176100' },
    { name: 'medicare_wage_base', type: 'REAL' },
    { name: 'futa_wage_base', type: 'REAL DEFAULT 7000' },
    { name: 'is_default', type: 'INTEGER DEFAULT 1' },
    { name: 'notes', type: 'TEXT' }
  ];

  for (const col of taxConfigColumns) {
    try {
      database.exec(`ALTER TABLE tax_configurations ADD COLUMN ${col.name} ${col.type}`);
      logger.info(`Added ${col.name} column to tax_configurations table`);
    } catch (err) {
      // Column already exists
    }
  }

  // Update existing config to 2024 if tax_year is null
  database.exec(`
    UPDATE tax_configurations 
    SET tax_year = 2024,
        ss_wage_base = 160200,
        futa_wage_base = 7000,
        is_default = 1
    WHERE tax_year IS NULL
  `);

  // Initial tax configurations for multiple years
  const configCount = database.prepare('SELECT COUNT(*) as count FROM tax_configurations').get() as { count: number };

  if (configCount.count === 0) {
    // Add 2024 configuration
    database.prepare(`
      INSERT INTO tax_configurations (
        tax_year, ss_rate_employee, ss_rate_employer, ss_wage_base,
        medicare_rate_employee, medicare_rate_employer, medicare_wage_base,
        futa_rate, futa_wage_base, effective_date, version, is_default, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(2024, 0.062, 0.062, 160200, 0.0145, 0.0145, null, 0.006, 7000, '2024-01-01', '2024.1', 1, 'IRS 2024 rates');
  }

  // Add 2025 configuration if not exists
  const config2025 = database.prepare('SELECT COUNT(*) as count FROM tax_configurations WHERE tax_year = 2025').get() as { count: number };
  if (config2025.count === 0) {
    database.prepare(`
      INSERT INTO tax_configurations (
        tax_year, ss_rate_employee, ss_rate_employer, ss_wage_base,
        medicare_rate_employee, medicare_rate_employer, medicare_wage_base,
        futa_rate, futa_wage_base, effective_date, version, is_default, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(2025, 0.062, 0.062, 176100, 0.0145, 0.0145, null, 0.006, 7000, '2025-01-01', '2025.1', 1, 'IRS 2025 rates');
  }

  // Add 2026 configuration if not exists
  const config2026 = database.prepare('SELECT COUNT(*) as count FROM tax_configurations WHERE tax_year = 2026').get() as { count: number };
  if (config2026.count === 0) {
    database.prepare(`
      INSERT INTO tax_configurations (
        tax_year, ss_rate_employee, ss_rate_employer, ss_wage_base,
        medicare_rate_employee, medicare_rate_employer, medicare_wage_base,
        futa_rate, futa_wage_base, effective_date, version, is_default, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(2026, 0.062, 0.062, 176100, 0.0145, 0.0145, null, 0.006, 7000, '2026-01-01', '2026.1', 1, 'IRS 2026 rates - SS wage base TBD, using 2025 value');
  }

  // Create unique index on tax_year
  try {
    database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_year ON tax_configurations(tax_year)`);
  } catch (err) {
    // Index might already exist
  }

  // Create performance indexes for common queries
  try {
    // Payroll queries by caregiver (for history, YTD calculations)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_payroll_caregiver_id ON payroll_records(caregiver_id)`);

    // Payroll queries by date range (for YTD, reports)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_payroll_pay_period_end ON payroll_records(pay_period_end)`);

    // Payroll queries by employer (for multi-employer support)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_payroll_employer_id ON payroll_records(employer_id)`);

    // Composite index for finalized payroll queries (most common)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_payroll_finalized ON payroll_records(caregiver_id, is_finalized, pay_period_end)`);

    // Time entries by caregiver and date (for payroll calculation)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_time_entries_caregiver_date ON time_entries(caregiver_id, work_date)`);

    // Time entries by finalized status (for UI filtering)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_time_entries_finalized ON time_entries(is_finalized)`);

    // Payments by payroll (for payment tracking)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_payments_payroll_id ON payments(payroll_record_id)`);

    // Audit logs by timestamp (for recent activity, chronological queries)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC)`);

    // Audit logs by table and record (for record history)
    database.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(table_name, record_id)`);

    logger.info('Performance indexes created successfully');
  } catch (err) {
    logger.warn('Some indexes may already exist', err as Error);
  }

  // Update FAMLI defaults to 2026 rates (0.44%)
  database.exec(`
    UPDATE employers 
    SET colorado_famli_rate_ee = 0.0044,
        colorado_famli_rate_er = 0.0044
    WHERE (colorado_famli_rate_ee = 0.0045 OR colorado_famli_rate_ee IS NULL)
       OR (colorado_famli_rate_er = 0.0045 OR colorado_famli_rate_er IS NULL)
  `);

  // Create auth table
  database.exec(`
    CREATE TABLE IF NOT EXISTS auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin_hash TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add new columns to payroll_records if they don't exist
  const payrollColumns = [
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

  for (const col of payrollColumns) {
    try {
      database.exec(`ALTER TABLE payroll_records ADD COLUMN ${col.name} ${col.type}`);
      logger.info(`Added ${col.name} column to payroll_records table`);
    } catch (err) {
      // Column already exists
    }
  }

  // Migration: Add multiplier columns to employers table if they don't exist
  try {
    database.exec(`
      ALTER TABLE employers ADD COLUMN holiday_pay_multiplier REAL DEFAULT 1.0
    `);
    logger.info('Added holiday_pay_multiplier column to employers table');
  } catch (err) {
    // Column already exists, ignore error
  }

  try {
    database.exec(`
      ALTER TABLE employers ADD COLUMN weekend_pay_multiplier REAL DEFAULT 1.0
    `);
    logger.info('Added weekend_pay_multiplier column to employers table');
  } catch (err) {
    // Column already exists, ignore error
  }

  try {
    database.exec(`ALTER TABLE employers ADD COLUMN paystub_title TEXT`);
    database.exec(`ALTER TABLE employers ADD COLUMN service_address TEXT`);
    logger.info('Added paystub header columns to employers table');
  } catch (err) {
    // Columns may already exist
  }

  // Migration: Add child_name column to employers table if not exists
  try {
    database.exec('ALTER TABLE employers ADD COLUMN child_name TEXT');
    logger.info('Added child_name column to employers table');
  } catch (err) {
    // Column might already exist
  }

  // Migration: Add hfwa_balance to caregivers
  try {
    database.exec('ALTER TABLE caregivers ADD COLUMN hfwa_balance REAL DEFAULT 0');
    logger.info('Added hfwa_balance column to caregivers table');
  } catch (err) {
    // Column already exists
  }

  try {
    database.exec('ALTER TABLE employers ADD COLUMN address_line1 TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN address_line2 TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN city TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN state TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN zip TEXT');
    logger.info('Added address columns to employers table');
  } catch (err) {
    // Columns might exist
  }

  try {
    database.exec('ALTER TABLE caregivers ADD COLUMN address_line1 TEXT');
    database.exec('ALTER TABLE caregivers ADD COLUMN address_line2 TEXT');
    database.exec('ALTER TABLE caregivers ADD COLUMN city TEXT');
    database.exec('ALTER TABLE caregivers ADD COLUMN state TEXT');
    database.exec('ALTER TABLE caregivers ADD COLUMN zip TEXT');
    logger.info('Added address columns to caregivers table');
  } catch (err) {
    // Columns might exist
  }

  // Migration: Add W-4 columns to caregivers table
  try {
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

    for (const colDef of w4Cols) {
      try {
        const colName = colDef.split(' ')[0];
        database.exec(`ALTER TABLE caregivers ADD COLUMN ${colDef}`);
        logger.info(`Added ${colName} to caregivers table`);
      } catch (e) {
        // Column likely exists
      }
    }
  } catch (err) {
    logger.error('Failed to run W-4 migration', err);
  }

  try {
    database.exec('ALTER TABLE employers ADD COLUMN stripe_publishable_key_enc TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN stripe_secret_key_enc TEXT');
    logger.info('Added Stripe key columns to employers table');
  } catch (err) { }

  // Add Stripe and payout columns to caregivers table
  const caregiverCols = database.pragma('table_info(caregivers)') as any[];
  if (!caregiverCols.some(col => col.name === 'stripe_customer_id')) {
    database.exec('ALTER TABLE caregivers ADD COLUMN stripe_customer_id TEXT');
  }
  if (!caregiverCols.some(col => col.name === 'stripe_bank_account_id')) {
    database.exec('ALTER TABLE caregivers ADD COLUMN stripe_bank_account_id TEXT');
  }
  if (!caregiverCols.some(col => col.name === 'payout_method')) {
    database.exec('ALTER TABLE caregivers ADD COLUMN payout_method TEXT DEFAULT "check"');
  }
  if (!caregiverCols.some(col => col.name === 'masked_destination_account')) {
    database.exec('ALTER TABLE caregivers ADD COLUMN masked_destination_account TEXT');
  }
  if (!caregiverCols.some(col => col.name === 'stripe_payout_id_enc')) {
    database.exec('ALTER TABLE caregivers ADD COLUMN stripe_payout_id_enc TEXT');
  }

  try {
    database.exec('ALTER TABLE employers ADD COLUMN stripe_account_id_enc TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN payment_verification_status TEXT DEFAULT "none"');
    database.exec('ALTER TABLE employers ADD COLUMN masked_funding_account TEXT');
  } catch (err) { }

  // Migration: Add missing wage columns to payroll_records check (fix for broken create table)
  try {
    const wageCols = [
      'gross_wages REAL DEFAULT 0',
      'regular_wages REAL DEFAULT 0',
      'weekend_wages REAL DEFAULT 0',
      'holiday_wages REAL DEFAULT 0'
    ];
    for (const col of wageCols) {
      try {
        database.exec(`ALTER TABLE payroll_records ADD COLUMN ${col}`);
        logger.info(`Added ${col.split(' ')[0]} to payroll_records`);
      } catch (e) {
        // Column exists
      }
    }
  } catch (err) { }

  try {
    database.exec('ALTER TABLE payroll_records ADD COLUMN payment_method TEXT');
  } catch (err) { }

  try {
    database.exec('ALTER TABLE caregivers ADD COLUMN i9_completed INTEGER DEFAULT 0');
    database.exec('ALTER TABLE caregivers ADD COLUMN i9_completion_date TEXT');
    database.exec('ALTER TABLE caregivers ADD COLUMN i9_notes TEXT');
    logger.info('Added I-9 tracking columns to caregivers table');
  } catch (err) { }

  // Colorado SUI Migration
  try {
    database.exec('ALTER TABLE employers ADD COLUMN fein_enc TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN ui_account_number_enc TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN sui_wage_base REAL DEFAULT 16000.0');
    database.exec('ALTER TABLE employers ADD COLUMN sui_effective_date TEXT');
    logger.info('Added Colorado SUI columns to employers table');
  } catch (err) { }

  try {
    database.exec('ALTER TABLE payroll_records ADD COLUMN employer_sui_rate REAL');
    database.exec('ALTER TABLE payroll_records ADD COLUMN employer_sui_paid REAL');
    logger.info('Added SUI tracking columns to payroll_records table');
  } catch (err) { }

  // Workers' Compensation Migration
  try {
    database.exec('ALTER TABLE employers ADD COLUMN wc_acknowledged INTEGER DEFAULT 0');
    database.exec('ALTER TABLE employers ADD COLUMN wc_carrier_enc TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN wc_policy_number_enc TEXT');
    database.exec('ALTER TABLE employers ADD COLUMN wc_acknowledgment_date TEXT');
    logger.info('Added Workers Compensation columns to employers table');
  } catch (err) { }

  try {
    database.exec('ALTER TABLE employers ADD COLUMN colorado_famli_rate_ee REAL DEFAULT 0.0045');
    database.exec('ALTER TABLE employers ADD COLUMN colorado_famli_rate_er REAL DEFAULT 0.0045');
    logger.info('Added Colorado FAMLI rate columns to employers table');
  } catch (err) { }

  // Multi-Household Migration
  try {
    database.exec('ALTER TABLE employers ADD COLUMN is_active INTEGER DEFAULT 0');
  } catch (err) { }

  try {
    database.exec('ALTER TABLE caregivers ADD COLUMN employer_id INTEGER REFERENCES employers(id)');
    database.exec('ALTER TABLE time_entries ADD COLUMN employer_id INTEGER REFERENCES employers(id)');
    database.exec('ALTER TABLE payroll_records ADD COLUMN employer_id INTEGER REFERENCES employers(id)');

    // Link existing data to the first employer
    const firstEmployer = database.prepare('SELECT id FROM employers ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
    if (firstEmployer) {
      database.prepare('UPDATE employers SET is_active = 1 WHERE id = ?').run(firstEmployer.id);
      database.prepare('UPDATE caregivers SET employer_id = ? WHERE employer_id IS NULL').run(firstEmployer.id);
      database.prepare('UPDATE time_entries SET employer_id = ? WHERE employer_id IS NULL').run(firstEmployer.id);
      database.prepare('UPDATE payroll_records SET employer_id = ? WHERE employer_id IS NULL').run(firstEmployer.id);

      try {
        database.exec('ALTER TABLE audit_log ADD COLUMN employer_id INTEGER REFERENCES employers(id)');
        database.prepare('UPDATE audit_log SET employer_id = ? WHERE employer_id IS NULL').run(firstEmployer.id);
      } catch (e) { }

      logger.info(`Migrated existing records to employer ID: ${firstEmployer.id}`);
    }
  } catch (err) {
    // Migration already ran or columns exist
  }

  // Migration: Add status column to payroll_records for review workflow
  try {
    const statusColumnExists = database.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('payroll_records') WHERE name='status'
    `).get() as { count: number };

    if (statusColumnExists.count === 0) {
      database.exec('ALTER TABLE payroll_records ADD COLUMN status TEXT DEFAULT \'approved\' CHECK(status IN (\'draft\', \'approved\'))');
      // Mark all existing records as approved
      database.exec('UPDATE payroll_records SET status = \'approved\' WHERE status IS NULL');
      logger.info('Added status column to payroll_records table for review workflow');
    }
  } catch (err) {
    logger.error('Failed to add status column', err);
  }

  // Migration: Add check_bank_name and check_account_owner columns to payroll_records
  try {
    const checkBankNameExists = database.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('payroll_records') WHERE name='check_bank_name'
    `).get() as { count: number };

    if (checkBankNameExists.count === 0) {
      database.exec('ALTER TABLE payroll_records ADD COLUMN check_bank_name TEXT');
      logger.info('Added check_bank_name column to payroll_records table');
    }

    const checkAccountOwnerExists = database.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('payroll_records') WHERE name='check_account_owner'
    `).get() as { count: number };

    if (checkAccountOwnerExists.count === 0) {
      database.exec('ALTER TABLE payroll_records ADD COLUMN check_account_owner TEXT');
      logger.info('Added check_account_owner column to payroll_records table');
    }
  } catch (err) {
    logger.error('Failed to add check banking info columns', err);
  }

  // Ensure export_logs exists (for older installs)
  try {
    database.exec(`
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
      )
    `);
  } catch (err) { }

  // Perform Health Checks
  try {
    const health = database.pragma('integrity_check');
    logger.info('Database integrity check', { result: health as any });

    // Optimize database
    database.pragma('auto_vacuum = INCREMENTAL');
    database.pragma('incremental_vacuum(100)'); // Vacuum up to 100 pages
    database.exec('ANALYZE'); // Update statistics for query planner
  } catch (err) {
    logger.error('Database health check failed', err as Error);
  }

  logger.info('Database initialized successfully');
}

// Encryption utilities
export function encrypt(text: string): string {
  const keyStr = loadEncryptionKey();
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(keyStr.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  try {
    const keyStr = loadEncryptionKey();
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(keyStr.slice(0, 64), 'hex');
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText; // Not encrypted or wrong format

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    logger.error('Decryption failed - encryption key may have changed', err);
    return '*** DECRYPTION FAILED ***';
  }
}
