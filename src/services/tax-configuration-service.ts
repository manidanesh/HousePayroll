import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';

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

export class TaxConfigurationService extends BaseRepository<TaxConfiguration> {

    // Abstract implementation dummy
    create(data: Partial<TaxConfiguration>): TaxConfiguration { throw new Error('Use upsert'); }
    update(id: number, data: Partial<TaxConfiguration>): TaxConfiguration { throw new Error('Use upsert'); }
    delete(id: number): void { throw new Error('Use deleteForYear'); }
    getById(id: number): TaxConfiguration | null { throw new Error('Use getConfigForYear'); }

    // Static Compatibility Layer
    static getConfigForYear(year: number): TaxConfiguration {
        return new TaxConfigurationService(getDatabase()).getConfigForYear(year);
    }

    static getAllConfigurations(): TaxConfiguration[] {
        return new TaxConfigurationService(getDatabase()).getAllConfigurations();
    }

    static upsertConfiguration(config: Partial<TaxConfiguration> & { taxYear: number }): TaxConfiguration {
        return new TaxConfigurationService(getDatabase()).upsertConfiguration(config);
    }

    static deleteConfiguration(year: number): boolean {
        return new TaxConfigurationService(getDatabase()).deleteConfiguration(year);
    }

    // Instance Methods

    /**
     * Get tax configuration for a specific year
     * Falls back to most recent year if not found
     */
    getConfigForYear(year: number): TaxConfiguration {
        // Try exact year match
        let config = this.get<any>(`
            SELECT * FROM tax_configurations 
            WHERE tax_year = ? 
            ORDER BY id DESC LIMIT 1
        `, [year]);

        // Fallback to most recent year <= requested year
        if (!config) {
            config = this.get<any>(`
                SELECT * FROM tax_configurations 
                WHERE tax_year <= ? 
                ORDER BY tax_year DESC LIMIT 1
            `, [year]);
        }

        // Last resort: use any config (most recent)
        if (!config) {
            config = this.get<any>(`
                SELECT * FROM tax_configurations 
                ORDER BY tax_year DESC LIMIT 1
            `);
        }

        if (!config) {
            throw new Error('No tax configuration found in database');
        }

        return this.mapRowToConfig(config);
    }

    /**
     * Get all tax configurations (for admin UI)
     */
    getAllConfigurations(): TaxConfiguration[] {
        const rows = this.all<any>(`
            SELECT * FROM tax_configurations 
            ORDER BY tax_year DESC
        `);

        return rows.map(row => this.mapRowToConfig(row));
    }

    /**
     * Create or update tax configuration for a year
     */
    upsertConfiguration(config: Partial<TaxConfiguration> & { taxYear: number }): TaxConfiguration {
        const existing = this.get<{ id: number }>(`
            SELECT id FROM tax_configurations WHERE tax_year = ?
        `, [config.taxYear]);

        if (existing) {
            // Get full existing object to merge
            const current = this.getConfigForYear(config.taxYear);

            // Update existing
            this.run(`
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
            `, [
                config.ssRateEmployee ?? current.ssRateEmployee,
                config.ssRateEmployer ?? current.ssRateEmployer,
                config.ssWageBase ?? current.ssWageBase,
                config.medicareRateEmployee ?? current.medicareRateEmployee,
                config.medicareRateEmployer ?? current.medicareRateEmployer,
                config.medicareWageBase ?? current.medicareWageBase,
                config.futaRate ?? current.futaRate,
                config.futaWageBase ?? current.futaWageBase,
                config.effectiveDate ?? current.effectiveDate,
                config.version ?? current.version,
                config.isDefault !== undefined ? (config.isDefault ? 1 : 0) : (current.isDefault ? 1 : 0),
                config.notes !== undefined ? config.notes : current.notes,
                config.taxYear
            ]);
        } else {
            // Insert new
            this.run(`
                INSERT INTO tax_configurations (
                    tax_year, ss_rate_employee, ss_rate_employer, ss_wage_base,
                    medicare_rate_employee, medicare_rate_employer, medicare_wage_base,
                    futa_rate, futa_wage_base, effective_date, version, is_default, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
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
            ]);
        }

        return this.getConfigForYear(config.taxYear);
    }

    /**
     * Delete a tax configuration for a specific year
     * (Only allow deletion of non-default configs)
     */
    deleteConfiguration(year: number): boolean {
        const config = this.get<{ is_default: number }>(`
            SELECT is_default FROM tax_configurations WHERE tax_year = ?
        `, [year]);

        if (!config) {
            return false;
        }

        if (config.is_default) {
            throw new Error('Cannot delete default tax configuration');
        }

        this.run(`DELETE FROM tax_configurations WHERE tax_year = ?`, [year]);
        return true;
    }

    private mapRowToConfig(row: any): TaxConfiguration {
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
