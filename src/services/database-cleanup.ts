import { getDatabase } from '../database/db';

/**
 * Database Cleanup Utility
 * Safely removes all caregiver-related data while preserving employer settings
 */
export class DatabaseCleanup {
    /**
     * Delete all caregiver-related records
     * Preserves: Employer settings, tax configurations, audit logs
     * Deletes: Caregivers, time entries, payroll records, payments
     */
    static cleanupCaregiverData(): { success: boolean; message: string; deletedCounts: any } {
        const db = getDatabase();

        try {
            db.exec('BEGIN TRANSACTION');

            // Count records before deletion
            const counts = {
                caregivers: db.prepare('SELECT COUNT(*) as count FROM caregivers').get() as { count: number },
                timeEntries: db.prepare('SELECT COUNT(*) as count FROM time_entries').get() as { count: number },
                payrollRecords: db.prepare('SELECT COUNT(*) as count FROM payroll_records').get() as { count: number },
                payments: db.prepare('SELECT COUNT(*) as count FROM payments').get() as { count: number },
            };

            // Delete in correct order (respecting foreign keys)
            // 1. Payments (references payroll_records)
            db.prepare('DELETE FROM payments').run();

            // 2. Payroll records (references caregivers, time_entries)
            db.prepare('DELETE FROM payroll_records').run();

            // 3. Time entries (references caregivers)
            db.prepare('DELETE FROM time_entries').run();

            // 4. Caregivers (base table)
            db.prepare('DELETE FROM caregivers').run();

            // Optional: Clean up audit logs related to caregivers
            // Uncomment if you want to remove audit trail
            // db.prepare("DELETE FROM audit_log WHERE table_name IN ('caregivers', 'time_entries', 'payroll_records', 'payments')").run();

            db.exec('COMMIT');

            return {
                success: true,
                message: 'Successfully cleaned up all caregiver-related data',
                deletedCounts: {
                    caregivers: counts.caregivers.count,
                    timeEntries: counts.timeEntries.count,
                    payrollRecords: counts.payrollRecords.count,
                    payments: counts.payments.count,
                }
            };
        } catch (error: any) {
            db.exec('ROLLBACK');
            return {
                success: false,
                message: `Cleanup failed: ${error.message}`,
                deletedCounts: null
            };
        }
    }

    /**
     * Get current database statistics
     */
    static getDatabaseStats() {
        const db = getDatabase();

        return {
            caregivers: db.prepare('SELECT COUNT(*) as count FROM caregivers').get() as { count: number },
            timeEntries: db.prepare('SELECT COUNT(*) as count FROM time_entries').get() as { count: number },
            payrollRecords: db.prepare('SELECT COUNT(*) as count FROM payroll_records').get() as { count: number },
            payments: db.prepare('SELECT COUNT(*) as count FROM payments').get() as { count: number },
            employers: db.prepare('SELECT COUNT(*) as count FROM employers').get() as { count: number },
            taxConfigs: db.prepare('SELECT COUNT(*) as count FROM tax_configurations').get() as { count: number },
        };
    }
}
