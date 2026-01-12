import { getDatabase } from '../database/db';

export interface TaxConfiguration {
    id: number;
    taxYear: number;
    ssRateEmployee: number;
    ssRateEmployer: number;
    ssWageBase: number;
    medicareRateEmployee: number;
    medicareRateEmployer: number;
    medicareWageBase: number | null;
    futaRate: number;
    futaWageBase: number;
    effectiveDate: string;
    version: string;
    isDefault: boolean;
    notes?: string;
}

export class TaxConfigurationService {
    /**
     * Get tax configuration for a specific year
     * Falls back to most recent year if not found
     */
    static getConfigForYear(year: number): TaxConfiguration {
        const db = getDatabase();

        // Try exact year match
        let config = db.prepare(`
            SELECT * FROM tax_configurations 
            WHERE tax_year = ? 
            ORDER BY id DESC LIMIT 1
        `).get(year) as any;

        // Fallback to most recent year <= requested year
        if (!config) {
            config = db.prepare(`
                SELECT * FROM tax_configurations 
                WHERE tax_year <= ? 
                ORDER BY tax_year DESC LIMIT 1
            `).get(year) as any;
        }

        // Last resort: use any config (most recent)
        if (!config) {
            config = db.prepare(`
                SELECT * FROM tax_configurations 
                ORDER BY tax_year DESC LIMIT 1
            `).get() as any;
        }

        if (!config) {
            throw new Error('No tax configuration found in database');
        }

        return this.mapRowToConfig(config);
    }

    /**
     * Get all tax configurations (for admin UI)
     */
    static getAllConfigurations(): TaxConfiguration[] {
        const db = getDatabase();
        const rows = db.prepare(`
            SELECT * FROM tax_configurations 
            ORDER BY tax_year DESC
        `).all() as any[];

        return rows.map(row => this.mapRowToConfig(row));
    }

    /**
     * Create or update tax configuration for a year
     */
    static upsertConfiguration(config: Partial<TaxConfiguration> & { taxYear: number }): TaxConfiguration {
        const db = getDatabase();

        const existing = db.prepare(`
            SELECT id FROM tax_configurations WHERE tax_year = ?
        `).get(config.taxYear) as any;

        if (existing) {
            // Update existing
            db.prepare(`
                UPDATE tax_configurations SET
                    ss_rate_employee = ?,
                    ss_rate_employer = ?,
                    ss_wage_base = ?,
                    medicare_rate_employee = ?,
                    medicare_rate_employer = ?,
                    medicare_wage_base = ?,
                    futa_rate = ?,
                    futa_wage_base = ?,
                    effective_date = ?,
                    version = ?,
                    is_default = ?,
                    notes = ?
                WHERE tax_year = ?
            `).run(
                config.ssRateEmployee,
                config.ssRateEmployer,
                config.ssWageBase,
                config.medicareRateEmployee,
                config.medicareRateEmployer,
                config.medicareWageBase,
                config.futaRate,
                config.futaWageBase,
                config.effectiveDate,
                config.version,
                config.isDefault ? 1 : 0,
                config.notes || null,
                config.taxYear
            );
        } else {
            // Insert new
            db.prepare(`
                INSERT INTO tax_configurations (
                    tax_year, ss_rate_employee, ss_rate_employer, ss_wage_base,
                    medicare_rate_employee, medicare_rate_employer, medicare_wage_base,
                    futa_rate, futa_wage_base, effective_date, version, is_default, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                config.taxYear,
                config.ssRateEmployee,
                config.ssRateEmployer,
                config.ssWageBase,
                config.medicareRateEmployee,
                config.medicareRateEmployer,
                config.medicareWageBase,
                config.futaRate,
                config.futaWageBase,
                config.effectiveDate,
                config.version,
                config.isDefault ? 1 : 0,
                config.notes || null
            );
        }

        return this.getConfigForYear(config.taxYear);
    }

    /**
     * Delete a tax configuration for a specific year
     * (Only allow deletion of non-default configs)
     */
    static deleteConfiguration(year: number): boolean {
        const db = getDatabase();

        const config = db.prepare(`
            SELECT is_default FROM tax_configurations WHERE tax_year = ?
        `).get(year) as any;

        if (!config) {
            return false;
        }

        if (config.is_default) {
            throw new Error('Cannot delete default tax configuration');
        }

        db.prepare(`DELETE FROM tax_configurations WHERE tax_year = ?`).run(year);
        return true;
    }

    private static mapRowToConfig(row: any): TaxConfiguration {
        return {
            id: row.id,
            taxYear: row.tax_year,
            ssRateEmployee: row.ss_rate_employee,
            ssRateEmployer: row.ss_rate_employer,
            ssWageBase: row.ss_wage_base,
            medicareRateEmployee: row.medicare_rate_employee,
            medicareRateEmployer: row.medicare_rate_employer,
            medicareWageBase: row.medicare_wage_base,
            futaRate: row.futa_rate,
            futaWageBase: row.futa_wage_base,
            effectiveDate: row.effective_date,
            version: row.version,
            isDefault: !!row.is_default,
            notes: row.notes
        };
    }
}
