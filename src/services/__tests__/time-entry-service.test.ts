/**
 * TimeEntryService Unit Tests
 */

import { TimeEntryService } from '../time-entry-service';
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;
import { EmployerService } from '../employer-service';
import { CaregiverService } from '../caregiver-service';

jest.mock('../../database/db');

describe('TimeEntryService', () => {
    let service: TimeEntryService;
    let caregiverId: number;

    beforeEach(() => {
        resetTestDatabase();
        service = new TimeEntryService(getDatabase());

        // Setup Employer
        EmployerService.createEmployer({
            displayName: 'Test Family',
            payFrequency: 'weekly',
            defaultHourlyRate: 20,
            ssnOrEin: '12-3456789',
            federalWithholdingEnabled: true,
            coloradoSutaRate: 0.017
        });

        // Setup Caregiver
        const cg = CaregiverService.createCaregiver({
            fullLegalName: 'Nanny Test',
            ssn: '123-44-5555',
            hourlyRate: 20
        });
        caregiverId = cg.id;
    });

    describe('createTimeEntry', () => {
        it('should create a time entry', () => {
            const entry = service.createTimeEntry({
                caregiverId,
                workDate: '2025-01-01',
                hoursWorked: 8
            });

            expect(entry.id).toBeDefined();
            expect(entry.hoursWorked).toBe(8);
            expect(entry.caregiverId).toBe(caregiverId);
        });

        it('should update existing entry if same date/caregiver', () => {
            service.createTimeEntry({
                caregiverId,
                workDate: '2025-01-01',
                hoursWorked: 8
            });

            // Updating to 10 hours
            const updated = service.createTimeEntry({
                caregiverId,
                workDate: '2025-01-01',
                hoursWorked: 10
            });

            expect(updated.hoursWorked).toBe(10);

            // Verify count is 1
            const entries = service.getTimeEntriesForCaregiver(caregiverId);
            expect(entries.length).toBe(1);
        });
    });

    describe('getTotalHours', () => {
        it('should sum hours correctly within range', () => {
            service.createTimeEntry({ caregiverId, workDate: '2025-01-01', hoursWorked: 8 });
            service.createTimeEntry({ caregiverId, workDate: '2025-01-02', hoursWorked: 4 });
            service.createTimeEntry({ caregiverId, workDate: '2025-01-03', hoursWorked: 0 }); // Day off

            const total = service.getTotalHours(caregiverId, '2025-01-01', '2025-01-07');
            expect(total).toBe(12);
        });
    });
});
