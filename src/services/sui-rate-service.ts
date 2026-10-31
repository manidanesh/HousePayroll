import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { EmployerService } from './employer-service';
import { AuditService } from './audit-service';

export interface SuiRate {
    /** UI premium rate (decimal, e.g. 0.0305) */
    rate: number;
    /** Annual taxable wage base for the resolved tax year */
    wageBase: number;
    /** Whether the wage base has been officially confirmed (FR-02) */
    wageBaseConfirmed: boolean;
    taxYear: number;
    effectiveDate: string;
}

export interface SuiRateRow {
    id: number;
    employerId: number;
    taxYear: number;
    effectiveDate: string;
    uiRate: number;
    annualWageBase: number | null;
    wageBaseConfirmed: boolean;
    source: string | null;
    jurisdiction: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Employer-specific, effective-dated Colorado SUI/UI rate resolution.
 *
 * The authoritative rate is resolved by the payroll *payment date* at
 * finalization (D1=B); previews resolve by pay-period end as a provisional
 * value. The wage base is the annual taxable wage base of the tax year whose
 * effective period covers that date. Falls back to the legacy single-value
 * employer fields if no `employer_sui_rates` rows exist.
 */
export class SuiRateService extends BaseRepository<SuiRateRow> {
    // BaseRepository abstract stubs — real operations are the named methods below.
    create(): SuiRateRow { throw new Error('Use upsertRate'); }
    update(): SuiRateRow { throw new Error('Use upsertRate'); }
    delete(): void { throw new Error('Use deleteForYear'); }
    getById(id: number): SuiRateRow | null {
        const row = this.get<any>('SELECT * FROM employer_sui_rates WHERE id = ?', [id]);
        return row ? this.mapRow(row) : null;
    }

    // Static compatibility layer
    static getRateForDate(employerId: number, date: string): SuiRate {
        return new SuiRateService(getDatabase()).getRateForDate(employerId, date);
    }
    static getRateForYear(employerId: number, year: number): SuiRate {
        return new SuiRateService(getDatabase()).getRateForYear(employerId, year);
    }
    static upsertRate(input: Partial<SuiRateRow> & { employerId: number; taxYear: number }): SuiRateRow {
        return new SuiRateService(getDatabase()).upsertRate(input);
    }
    static getAllRates(employerId: number): SuiRateRow[] {
        return new SuiRateService(getDatabase()).getAllRates(employerId);
    }

    /**
     * Resolve the SUI rate effective on or before the given date.
     * Used by the calculation/finalization paths with the payment date.
     */
    getRateForDate(employerId: number, date: string): SuiRate {
        let row = this.get<any>(`
            SELECT * FROM employer_sui_rates
            WHERE employer_id = ? AND effective_date <= ?
            ORDER BY effective_date DESC LIMIT 1
        `, [employerId, date]);

        if (!row) {
            // No rate effective on/before date; fall back to the earliest available row.
            row = this.get<any>(`
                SELECT * FROM employer_sui_rates WHERE employer_id = ?
                ORDER BY effective_date ASC LIMIT 1
            `, [employerId]);
        }

        if (row) return this.mapRowToRate(row);
        return this.legacyFallback(date);
    }

    /**
     * Resolve the SUI rate for a calendar year (used by quarterly CSV exports).
     */
    getRateForYear(employerId: number, year: number): SuiRate {
        let row = this.get<any>(
            'SELECT * FROM employer_sui_rates WHERE employer_id = ? AND tax_year = ? ORDER BY id DESC LIMIT 1',
            [employerId, year]
        );
        if (!row) {
            row = this.get<any>(
                'SELECT * FROM employer_sui_rates WHERE employer_id = ? AND tax_year <= ? ORDER BY tax_year DESC LIMIT 1',
                [employerId, year]
            );
        }
        if (!row) {
            row = this.get<any>(
                'SELECT * FROM employer_sui_rates WHERE employer_id = ? ORDER BY tax_year DESC LIMIT 1',
                [employerId]
            );
        }
        if (row) return this.mapRowToRate(row);
        return this.legacyFallback(`${year}-01-01`, year);
    }

    upsertRate(input: Partial<SuiRateRow> & { employerId: number; taxYear: number }): SuiRateRow {
        const confirmed = input.wageBaseConfirmed === undefined ? 1 : (input.wageBaseConfirmed ? 1 : 0);
        const effectiveDate = input.effectiveDate ?? `${input.taxYear}-01-01`;

        // FR-04: commit the rate write and the audit event atomically so a change is always logged.
        const db = getDatabase();
        let resultId: number;
        const tx = db.transaction(() => {
            const existing = this.get<{ id: number }>(
                'SELECT id FROM employer_sui_rates WHERE employer_id = ? AND tax_year = ?',
                [input.employerId, input.taxYear]
            );
            const before = existing ? this.getById(existing.id) : null;

            if (existing) {
                this.run(`
                    UPDATE employer_sui_rates SET
                        effective_date = ?, ui_rate = ?, annual_wage_base = ?,
                        wage_base_confirmed = ?, source = ?, jurisdiction = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    effectiveDate,
                    input.uiRate ?? 0,
                    input.annualWageBase ?? null,
                    confirmed,
                    input.source ?? null,
                    input.jurisdiction ?? 'CO',
                    existing.id
                ]);
                resultId = existing.id;
            } else {
                const res = this.run(`
                    INSERT INTO employer_sui_rates
                        (employer_id, tax_year, effective_date, ui_rate, annual_wage_base, wage_base_confirmed, source, jurisdiction)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    input.employerId,
                    input.taxYear,
                    effectiveDate,
                    input.uiRate ?? 0,
                    input.annualWageBase ?? null,
                    confirmed,
                    input.source ?? null,
                    input.jurisdiction ?? 'CO'
                ]);
                resultId = res.lastInsertRowid as number;
            }

            const after = this.getById(resultId!)!;
            AuditService.log({
                tableName: 'employer_sui_rates',
                recordId: resultId!,
                action: 'RATE_CHANGED',
                changesJson: JSON.stringify({ before, after }),
                actor: 'employer',
            });
        });

        tx();
        return this.getById(resultId!)!;
    }

    getAllRates(employerId: number): SuiRateRow[] {
        const rows = this.all<any>(
            'SELECT * FROM employer_sui_rates WHERE employer_id = ? ORDER BY tax_year ASC',
            [employerId]
        );
        return rows.map(r => this.mapRow(r));
    }

    private mapRowToRate(row: any): SuiRate {
        return {
            rate: row.ui_rate ?? 0,
            wageBase: row.annual_wage_base ?? 0,
            wageBaseConfirmed: row.wage_base_confirmed === 1,
            taxYear: row.tax_year,
            effectiveDate: row.effective_date,
        };
    }

    private mapRow(row: any): SuiRateRow {
        return {
            id: row.id,
            employerId: row.employer_id,
            taxYear: row.tax_year,
            effectiveDate: row.effective_date,
            uiRate: row.ui_rate,
            annualWageBase: row.annual_wage_base,
            wageBaseConfirmed: row.wage_base_confirmed === 1,
            source: row.source,
            jurisdiction: row.jurisdiction || 'CO',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /** Legacy fallback to the single-value employer fields (pre-v13 behavior). */
    private legacyFallback(date: string, year?: number): SuiRate {
        const emp = EmployerService.getEmployer();
        const y = year ?? new Date(date).getFullYear();
        return {
            rate: emp?.coloradoSutaRate ?? 0,
            wageBase: emp?.suiWageBase ?? 16000,
            wageBaseConfirmed: true,
            taxYear: y,
            effectiveDate: emp?.suiEffectiveDate || `${y}-01-01`,
        };
    }
}
