import { SuiRateService } from '../sui-rate-service';
import * as DBCode from '../../database/db';

const { getDatabase, resetTestDatabase } = DBCode as any;

jest.mock('../../database/db');

describe('SuiRateService', () => {
    let employerId: number;

    beforeEach(() => {
        resetTestDatabase();
        const db = getDatabase();
        // Active employer with the legacy single-value fields (1.7% / $16,000 wage base).
        const res = db.prepare(
            `INSERT INTO employers
                (display_name, ssn_or_ein_encrypted, pay_frequency, default_hourly_rate,
                 colorado_suta_rate, sui_wage_base, is_active)
             VALUES ('Test HH', 'enc:12-3456789', 'weekly', 20, 0.017, 16000, 1)`
        ).run();
        employerId = res.lastInsertRowid as number;
    });

    it('resolves the 2026 rate before the 2027 effective date and the 2027 rate after (D2/D3)', () => {
        SuiRateService.upsertRate({ employerId, taxYear: 2026, effectiveDate: '2026-01-01', uiRate: 0.017, annualWageBase: 30600, wageBaseConfirmed: true, source: 'CDLE' });
        SuiRateService.upsertRate({ employerId, taxYear: 2027, effectiveDate: '2027-01-01', uiRate: 0.0317, annualWageBase: 32100, wageBaseConfirmed: true, source: 'CDLE/CESA' });

        const dec2026 = SuiRateService.getRateForDate(employerId, '2026-12-20');
        expect(dec2026.rate).toBe(0.017);
        expect(dec2026.wageBase).toBe(30600);
        expect(dec2026.taxYear).toBe(2026);

        const jan2027 = SuiRateService.getRateForDate(employerId, '2027-01-15');
        expect(jan2027.rate).toBe(0.0317);
        expect(jan2027.wageBase).toBe(32100);
        expect(jan2027.taxYear).toBe(2027);
    });

    it('resolves by year for quarterly CSV exports', () => {
        SuiRateService.upsertRate({ employerId, taxYear: 2026, effectiveDate: '2026-01-01', uiRate: 0.017, annualWageBase: 30600, wageBaseConfirmed: true });
        SuiRateService.upsertRate({ employerId, taxYear: 2027, effectiveDate: '2027-01-01', uiRate: 0.0317, annualWageBase: 32100, wageBaseConfirmed: true });

        expect(SuiRateService.getRateForYear(employerId, 2026).rate).toBe(0.017);
        expect(SuiRateService.getRateForYear(employerId, 2027).rate).toBe(0.0317);
    });

    it('falls back to the legacy employer scalar when no rate rows exist', () => {
        const r = SuiRateService.getRateForDate(employerId, '2026-06-01');
        expect(r.rate).toBe(0.017);
        expect(r.wageBase).toBe(16000);
        expect(r.wageBaseConfirmed).toBe(true);
    });

    it('audit-logs each rate change as RATE_CHANGED (FR-04)', () => {
        SuiRateService.upsertRate({ employerId, taxYear: 2027, effectiveDate: '2027-01-01', uiRate: 0.0317, annualWageBase: 32100, wageBaseConfirmed: true });
        const db = getDatabase();
        const rows = db.prepare("SELECT action FROM audit_log WHERE table_name = 'employer_sui_rates'").all() as { action: string }[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.some(r => r.action === 'RATE_CHANGED')).toBe(true);
    });

    it('upserts a year row in place (no duplicate rows)', () => {
        SuiRateService.upsertRate({ employerId, taxYear: 2027, effectiveDate: '2027-01-01', uiRate: 0.0317, annualWageBase: 32100, wageBaseConfirmed: true });
        SuiRateService.upsertRate({ employerId, taxYear: 2027, effectiveDate: '2027-01-01', uiRate: 0.04, annualWageBase: 32100, wageBaseConfirmed: true });
        expect(SuiRateService.getRateForYear(employerId, 2027).rate).toBe(0.04);
        expect(SuiRateService.getAllRates(employerId).filter(r => r.taxYear === 2027).length).toBe(1);
    });

    it('persists the wage-base-confirmed flag', () => {
        SuiRateService.upsertRate({ employerId, taxYear: 2028, effectiveDate: '2028-01-01', uiRate: 0.032, annualWageBase: null, wageBaseConfirmed: false });
        const r = SuiRateService.getRateForYear(employerId, 2028);
        expect(r.wageBaseConfirmed).toBe(false);
        expect(r.wageBase).toBe(0); // null wage base -> 0 in the resolved SuiRate
    });
});
