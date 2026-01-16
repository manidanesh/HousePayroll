/**
 * TaxConfigurationService Unit Tests
 */

import { TaxConfigurationService } from '../tax-configuration-service';
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;

jest.mock('../../database/db');

describe('TaxConfigurationService', () => {
    let service: TaxConfigurationService;

    beforeEach(() => {
        resetTestDatabase();
        service = new TaxConfigurationService(getDatabase());

        // Initial setup for default 2024 is done in db mock creation
        // We typically re-run it in real app, but for mock db it's empty after reset
        // except schema. So we need to re-seed or rely on test logic

        // Actually, db mock resets ALL tables including tax_configurations.
        // But the getDatabase function in mock re-inserts 2024 if empty? 
        // Let's check mock logic.
        // It initializes tax configs ONLY on first creation. Reset deletes it. 
        // We should manually re-seed for robust tests.

        service.upsertConfiguration({
            taxYear: 2024,
            ssRateEmployee: 0.062,
            ssRateEmployer: 0.062,
            ssWageBase: 160200,
            medicareRateEmployee: 0.0145,
            medicareRateEmployer: 0.0145,
            medicareWageBase: null,
            futaRate: 0.006,
            futaWageBase: 7000,
            effectiveDate: '2024-01-01',
            version: '2024.1',
            isDefault: true,
            notes: 'Test 2024 rates'
        });
    });

    describe('getConfigForYear', () => {
        it('should return configuration for specific year', () => {
            const config = service.getConfigForYear(2024);
            expect(config.taxYear).toBe(2024);
            expect(config.ssRateEmployee).toBe(0.062);
        });

        it('should fallback to most recent previous year', () => {
            const config = service.getConfigForYear(2025); // Should get 2024
            expect(config.taxYear).toBe(2024);
        });
    });

    describe('upsertConfiguration', () => {
        it('should update existing configuration', () => {
            const updated = service.upsertConfiguration({
                taxYear: 2024,
                ssRateEmployee: 0.07 // Changed
            });
            expect(updated.ssRateEmployee).toBe(0.07);

            const fetched = service.getConfigForYear(2024);
            expect(fetched.ssRateEmployee).toBe(0.07);
        });

        it('should insert new configuration', () => {
            const newConfig = service.upsertConfiguration({
                taxYear: 2025,
                ssRateEmployee: 0.062,
                ssRateEmployer: 0.062,
                ssWageBase: 170000,
                medicareRateEmployee: 0.0145,
                medicareRateEmployer: 0.0145,
                medicareWageBase: null,
                futaRate: 0.006,
                futaWageBase: 7000,
                effectiveDate: '2025-01-01',
                version: '2025.1',
                isDefault: true
            });

            expect(newConfig.taxYear).toBe(2025);

            // Now 2025 request should return 2025
            const fetched = service.getConfigForYear(2025);
            expect(fetched.taxYear).toBe(2025);
        });
    });
});
