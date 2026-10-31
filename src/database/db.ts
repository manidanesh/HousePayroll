import Database from 'better-sqlite3';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { runMigrations, detectSchemaVersion } from './migrations';

let db: Database.Database | null = null;

// Use Electron's userData directory (platform-independent)
// macOS: ~/Library/Application Support/household-payroll/
// Windows: %APPDATA%/household-payroll/
// Linux: ~/.config/household-payroll/
// NOTE: evaluated lazily inside functions so app.setPath() in main.ts takes effect first.
const getDataDir = () => app.getPath('userData');
const getKeyPath = () => path.join(getDataDir(), '.key');
const getKeyPathEnc = () => path.join(getDataDir(), '.key.enc');
let ENCRYPTION_KEY: string | null = null;

/**
 * Sentinel value returned by decrypt() when a value can no longer be decrypted
 * (e.g. after the encryption key is regenerated). Services use this to avoid
 * persisting the sentinel back over existing ciphertext on update.
 */
export const DECRYPTION_FAILED_SENTINEL = '*** DECRYPTION FAILED ***';

/**
 * Generates a fresh 256-bit encryption key, persists it via OS-native secure
 * storage, and returns the plaintext key.
 */
function generateAndStoreKey(keyPathEnc: string): string {
  const plain = crypto.randomBytes(32).toString('hex');
  const encrypted = safeStorage.encryptString(plain);
  fs.writeFileSync(keyPathEnc, encrypted, { mode: 0o600 });
  return plain;
}

/**
 * Loads the database encryption key using OS-native secure storage.
 *
 * SECURITY: No fallback to weak keys.
 *
 * Recovery: if the stored key can no longer be decrypted by safeStorage (which
 * happens on macOS when the Keychain entry used by safeStorage is regenerated —
 * keychain reset, app re-signed with a different identity, OS keychain sync
 * issue, or the keychain item was deleted and recreated), we regenerate a fresh
 * key instead of crashing. Previously-encrypted DB columns become unreadable
 * and must be re-entered, but the app remains usable.
 *
 * For any OTHER failure (e.g. secure storage unavailable, keychain locked), we
 * still fail fast so the user can retry rather than silently losing data.
 */
function loadEncryptionKey(): string {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY;

  const keyPathEnc = getKeyPathEnc();
  const keyPath = getKeyPath();

  // Require OS-native secure storage
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Cannot initialize database encryption. ' +
      'Secure storage is not available on this system, so the encryption key cannot be safely stored. ' +
      'Please ensure your operating system supports secure credential storage.'
    );
  }

  if (fs.existsSync(keyPathEnc)) {
    try {
      const encrypted = fs.readFileSync(keyPathEnc);
      const plain = safeStorage.decryptString(encrypted);

      // Validate key strength
      if (plain.length < 64) {
        throw new Error('Encryption key is too short (minimum 64 characters required)');
      }

      ENCRYPTION_KEY = plain;
    } catch (err: any) {
      // Only the safeStorage key-mismatch case is recoverable. Detect it by the
      // distinctive error message Electron throws from decryptString.
      const isKeyMismatch = /decrypting the ciphertext/i.test(err?.message ?? '');

      if (!isKeyMismatch) {
        // Genuine safeStorage failure (e.g. keychain locked) — do NOT silently
        // regenerate and discard a potentially-recoverable key. Fail fast.
        logger.error('CRITICAL: Failed to load encryption key', err);
        throw new Error(
          'Cannot initialize database encryption. ' +
          'This is a critical security error. ' +
          'Please contact support. Error: ' + err.message
        );
      }

      logger.warn(
        'Encryption key could no longer be decrypted by safeStorage (key mismatch). ' +
        'Regenerating a new key. Previously-encrypted fields must be re-entered.',
        { error: err.message }
      );

      // Preserve the unrecoverable key file for forensic / audit purposes.
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(keyPathEnc, `${keyPathEnc}.corrupt.${ts}`);
        logger.info(`Backed up unrecoverable key file to .key.enc.corrupt.${ts}`);
      } catch (backupErr) {
        logger.error('Failed to back up corrupt key file', backupErr);
      }

      ENCRYPTION_KEY = generateAndStoreKey(keyPathEnc);
      logger.warn(
        'Encryption key regenerated. Encrypted DB columns (SSN/EIN, FEIN, UI account #, ' +
        'WC carrier/policy, Stripe keys, caregiver SSN) are now unreadable and must be ' +
        're-entered in Settings.'
      );
    }
  } else {
    // First run: generate a new strong key.
    ENCRYPTION_KEY = generateAndStoreKey(keyPathEnc);
  }

  // Remove legacy plain text key if it exists (security migration)
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath);
    logger.info('Removed legacy plain text encryption key');
  }

  return ENCRYPTION_KEY;
}

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(getDataDir(), 'payroll.db');
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

  // Detect and initialize version
  let currentVersion = 0;
  const versionRow = database.prepare('SELECT version FROM schema_meta WHERE id = 1').get();

  if (!versionRow) {
    // Logic for existing database without schema_meta
    currentVersion = detectSchemaVersion(database);

    // Initialize meta table
    database.prepare('INSERT INTO schema_meta (id, version, last_migration) VALUES (1, ?, ?)').run(currentVersion, 'Initial Version Detection');
    logger.info(`Database initialized with detected version ${currentVersion}`);
  } else {
    currentVersion = (versionRow as { version: number }).version;
  }

  // ============================================================================
  // RUN MIGRATIONS
  // ============================================================================
  runMigrations(database, currentVersion);

  // ============================================================================
  // MIGRATION 13: Manual Payroll Entry Support
  // ============================================================================
  try {
    database.exec(`ALTER TABLE payroll_records ADD COLUMN entry_type TEXT DEFAULT 'time-based'`);
    logger.info('Added entry_type column to payroll_records');
  } catch (err) { }

  try {
    database.exec(`ALTER TABLE payroll_records ADD COLUMN manual_description TEXT`);
    logger.info('Added manual_description column to payroll_records');
  } catch (err) { }

  try {
    database.exec(`ALTER TABLE payroll_records ADD COLUMN manual_gross_amount REAL`);
    logger.info('Added manual_gross_amount column to payroll_records');
  } catch (err) { }

  try {
    database.exec(`CREATE INDEX IF NOT EXISTS idx_payroll_entry_type ON payroll_records(entry_type)`);
    logger.info('Created index on entry_type');
  } catch (err) { }

  // ============================================================================
  // Tax Form Generation Tables
  // ============================================================================
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tax_form_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employer_id INTEGER NOT NULL,
        form_type TEXT NOT NULL,
        tax_year INTEGER NOT NULL,
        caregiver_id INTEGER,
        caregiver_name TEXT,
        generated_at TEXT NOT NULL DEFAULT (datetime('now')),
        file_path TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tax_form_log_employer_year ON tax_form_log(employer_id, tax_year);
    `);
    logger.info('Tax form log table ensured');
  } catch (err) { }

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tax_notification_dismissals (
        id TEXT PRIMARY KEY,
        dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    logger.info('Tax notification dismissals table ensured');
  } catch (err) { }

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS co_tax_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employer_id INTEGER NOT NULL,
        tax_year INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        amount REAL NOT NULL,
        quarter INTEGER,
        method TEXT NOT NULL DEFAULT 'EFT',
        reference_number TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_co_tax_payments_employer_year
        ON co_tax_payments(employer_id, tax_year);
    `);
    logger.info('CO tax payments table ensured');
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
    return DECRYPTION_FAILED_SENTINEL;
  }
}
