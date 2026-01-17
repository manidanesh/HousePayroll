import Database from 'better-sqlite3';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { runMigrations, detectSchemaVersion } from './migrations';

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
