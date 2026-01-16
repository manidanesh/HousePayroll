/**
 * PayPeriodService Unit Tests
 */

import { PayPeriodService } from '../pay-period-service';
// Import from the mocked path
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;
import { EmployerService } from '../employer-service';

// Mock DB
jest.mock('../../database/db');

describe('PayPeriodService', () => {
    let service: PayPeriodService;

    beforeEach(() => {
        resetTestDatabase();
        service = new PayPeriodService(getDatabase());

        // Setup Employer
        EmployerService.createEmployer({
            displayName: 'Test Family',
            payFrequency: 'bi-weekly',
            defaultHourlyRate: 20,
            ssnOrEin: '12-3456789',
            federalWithholdingEnabled: true,
            coloradoSutaRate: 0.017
        });
    });

    describe('generatePeriodsForYear', () => {
        it('should generate periods for a given year', () => {
            const periods = service.generatePeriodsForYear(2025);
            expect(periods.length).toBeGreaterThan(20); // Basic sanity check

            // Check first period structure
            const first = periods[0];
            expect(first.startDate).toBeDefined();
            expect(first.endDate).toBeDefined();
            expect(first.status).toBe('no-hours');

            // Verify duration (14 days)
            const start = new Date(first.startDate);
            const end = new Date(first.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(13); // 13 days difference implies 14 days total span inclusive
        });
    });

    // We can add integration tests with TimeEntryService and PayrollService later
    // For now confirming basic logic works
});
