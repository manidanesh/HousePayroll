/**
 * EmployerService Unit Tests
 */

import { EmployerService } from '../employer-service';
// Import from the mocked path, but cast to any to access mock-only exports
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;

// Mock the database module
jest.mock('../../database/db');

describe('EmployerService', () => {
    let service: EmployerService;

    beforeEach(() => {
        resetTestDatabase();
        service = new EmployerService(getDatabase());
    });

    describe('create', () => {
        it('should create an employer successfully', () => {
            const data = {
                displayName: 'Test Household',
                ssnOrEin: '12-3456789',
                payFrequency: 'weekly' as const,
                defaultHourlyRate: 25.00,
                federalWithholdingEnabled: true,
                coloradoSutaRate: 0.017,
                addressLine1: '123 Main St',
                city: 'Denver'
            };

            const result = service.create(data);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.displayName).toBe(data.displayName);
            expect(result.defaultHourlyRate).toBe(data.defaultHourlyRate);
        });
    });

    describe('getCurrentEmployer', () => {
        it('should return null when no employers exist', () => {
            const result = service.getCurrentEmployer();
            expect(result).toBeNull();
        });

        it('should return active employer', () => {
            service.create({
                displayName: 'Active Household',
                ssnOrEin: '11-1111111',
                payFrequency: 'weekly',
                defaultHourlyRate: 20,
                federalWithholdingEnabled: true,
                coloradoSutaRate: 0.01
            });

            // First created is automatically verified as active by logic or manually set
            // In the create logic, is_active is 0 by default, but getCurrentEmployer falls back to first if none active
            const result = service.getCurrentEmployer();
            expect(result).toBeDefined();
            expect(result!.displayName).toBe('Active Household');
            expect(result!.isActive).toBe(true);
        });
    });

    describe('update', () => {
        it('should update employer details', () => {
            const created = service.create({
                displayName: 'Original Name',
                ssnOrEin: '11-1111111',
                payFrequency: 'weekly',
                defaultHourlyRate: 20,
                federalWithholdingEnabled: true,
                coloradoSutaRate: 0.01
            });

            const updated = service.update(created.id, {
                displayName: 'Updated Name',
                defaultHourlyRate: 30
            });

            expect(updated.displayName).toBe('Updated Name');
            expect(updated.defaultHourlyRate).toBe(30);

            // confirm persistence
            const fetched = service.getById(created.id);
            expect(fetched!.displayName).toBe('Updated Name');
        });
    });
});
