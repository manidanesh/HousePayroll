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
 * 
 * IMPORTANT: When adding a new migration:
 * 1. Use the next sequential version number
 * 2. Give it a descriptive name
 * 3. Make the migration idempotent if possible (use IF NOT EXISTS, etc.)
 * 4. Never modify existing migrations once they're in production
 * 5. Test on a copy of production data before deploying
 */
export const migrations: Migration[] = [
    // Migration 1-12 will go here
    // For now, we'll leave them in db.ts until we extract them
];

/**
 * Run all pending migrations
 * 
 * @param database - SQLite database instance
 * @param currentVersion - Current schema version from schema_meta table
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
            // Run migration
            migration.up(database);

            // Update version on success
            setSchemaVersion(database, migration.version, migration.name);

            logger.info(`Successfully applied migration ${migration.version}`);
        } catch (err) {
            logger.error(`Migration ${migration.version} (${migration.name}) FAILED`, err);
            throw new Error(
                `Database migration ${migration.version} failed: ${migration.name}\n` +
                `Database is at version ${migration.version - 1}.\n` +
                `Error: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    const finalVersion = pendingMigrations[pendingMigrations.length - 1].version;
    logger.info(`All migrations completed successfully. Database is now at version ${finalVersion}`);
}

/**
 * Detect current database version by examining schema
 * This is used for existing databases that don't have schema_meta yet
 * 
 * @param database - SQLite database instance
 * @returns Detected version number
 */
export function detectSchemaVersion(database: Database): number {
    try {
        // Check for various schema markers to determine version
        const tables = database.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as { name: string }[];

        const tableNames = tables.map(t => t.name);

        // If no tables exist, it's a brand new database
        if (tableNames.length === 0) {
            return 0;
        }

        // Check for schema_meta table
        if (tableNames.includes('schema_meta')) {
            // Already has versioning
            const result = database.prepare('SELECT version FROM schema_meta WHERE id = 1')
                .get() as { version: number } | undefined;
            return result?.version || 0;
        }

        // Check for various columns to determine version
        // This helps migrate existing databases to the versioning system

        const payrollColumns = database.prepare(`
      SELECT name FROM pragma_table_info('payroll_records')
    `).all() as { name: string }[];

        const payrollColumnNames = payrollColumns.map(c => c.name);

        // Check for latest features to determine version
        if (payrollColumnNames.includes('check_bank_name')) {
            return 12; // Latest version before versioning system
        } else if (payrollColumnNames.includes('status')) {
            return 11;
        } else if (payrollColumnNames.includes('employer_id')) {
            return 10;
        } else if (payrollColumnNames.includes('employer_sui_rate')) {
            return 8;
        } else if (payrollColumnNames.includes('overtime_hours')) {
            return 3;
        } else if (payrollColumnNames.includes('regular_hours')) {
            return 2;
        } else if (tableNames.includes('payroll_records')) {
            return 1;
        }

        return 0;
    } catch (err) {
        logger.error('Failed to detect schema version', err);
        return 0;
    }
}
