/**
 * CaregiverService Unit Tests
 */

import { CaregiverService } from '../caregiver-service';
// Import from the mocked path, but cast to any to access mock-only exports
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;
import { EmployerService } from '../employer-service';

// Mock the database module
jest.mock('../../database/db');

describe('CaregiverService', () => {
    let service: CaregiverService;

    beforeEach(() => {
        resetTestDatabase();
        service = new CaregiverService(getDatabase());

        // We need an employer to link the caregiver to
        // EmployerService also uses the mocked DB
        // Using static helper for setup convenience
        EmployerService.createEmployer({
            displayName: 'Test Family',
            payFrequency: 'weekly',
            defaultHourlyRate: 20,
            ssnOrEin: '12-3456789',
            federalWithholdingEnabled: true,
            coloradoSutaRate: 0.017
        });
    });

    describe('create', () => {
        it('should create a caregiver successfully', () => {
            const result = service.create({
                fullLegalName: 'Mary Poppins',
                ssn: '123-00-1234',
                hourlyRate: 25.50,
                addressLine1: '1 Cherry Tree Lane',
                city: 'London',
                state: 'CO',
                zip: '80202'
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.fullLegalName).toBe('Mary Poppins');
            expect(result.hourlyRate).toBe(25.50);

            // Verify encryption (mock puts 'enc:' prefix)
            const db = getDatabase();
            const row = db.prepare('SELECT ssn_encrypted FROM caregivers WHERE id = ?').get(result.id) as any;
            expect(row.ssn_encrypted).toBe('enc:123-00-1234');
        });

        it('should throw error if name is missing', () => {
            expect(() => {
                service.create({
                    fullLegalName: '',
                    ssn: '123',
                    hourlyRate: 20
                } as any);
            }).toThrow('Full legal name is required');
        });
    });

    describe('getAll', () => {
        it('should return all caregivers', () => {
            service.create({
                fullLegalName: 'Nanny McPhee',
                ssn: '999-00-9999',
                hourlyRate: 30.00
            });

            const caregivers = service.getAll();
            expect(caregivers.length).toBe(1);
            expect(caregivers[0].fullLegalName).toBe('Nanny McPhee');
        });

        it('should filter inactive caregivers', () => {
            const active = service.create({
                fullLegalName: 'Active Nanny',
                ssn: '111',
                hourlyRate: 20
            });

            const inactive = service.create({
                fullLegalName: 'Inactive Nanny',
                ssn: '222',
                hourlyRate: 20
            });

            service.deactivate(inactive.id);

            const all = service.getAll(true);
            const activeOnly = service.getAll(false);

            expect(all.length).toBe(2);
            expect(activeOnly.length).toBe(1);
            expect(activeOnly[0].id).toBe(active.id);
        });
    });
});
