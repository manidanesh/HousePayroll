import Database from 'better-sqlite3';
import { SCHEMA } from '../../database/schema';

// Singleton in-memory database for testing
let testDb: Database.Database | null = null;

export function getDatabase(): Database.Database {
    if (!testDb) {
        testDb = new Database(':memory:');

        // Initialize schema
        Object.values(SCHEMA).forEach(sql => testDb!.exec(sql));

        // Initialize tax configurations
        const taxInsert = `
            INSERT INTO tax_configurations (
                tax_year, ss_rate_employee, ss_rate_employer, ss_wage_base,
                medicare_rate_employee, medicare_rate_employer, medicare_wage_base,
                futa_rate, futa_wage_base, effective_date, version, is_default, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        testDb.prepare(taxInsert).run(
            2024, 0.062, 0.062, 160200, 0.0145, 0.0145, null, 0.006, 7000,
            '2024-01-01', '2024.1', 1, 'Test 2024 rates'
        );
    }
    return testDb;
}

export function closeDatabase(): void {
    if (testDb) {
        testDb.close();
        testDb = null;
    }
}

// Reset database state between tests
export function resetTestDatabase(): void {
    if (testDb) {
        // Disable foreign keys to allow cleanup
        testDb.pragma('foreign_keys = OFF');

        const tables = [
            'caregivers', 'employers', 'time_entries', 'payroll_records',
            'payments', 'payment_transactions', 'audit_log', 'export_logs'
        ];

        tables.forEach(table => {
            try {
                testDb!.exec(`DELETE FROM ${table}`);
                testDb!.exec(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
            } catch (e) {
                // Table might not exist
            }
        });

        testDb.pragma('foreign_keys = ON');
    }
}

// Mock other exports from db.ts
export const initializeDatabase = jest.fn();
export const encrypt = jest.fn(str => `enc:${str}`);
export const decrypt = jest.fn(str => str.replace('enc:', ''));
