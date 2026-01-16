/**
 * PayrollService Unit Tests
 */

import { PayrollService } from '../payroll-service';
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;
import { EmployerService } from '../employer-service';
import { CaregiverService } from '../caregiver-service';
import { EnhancedPayrollResult } from '../../core/enhanced-payroll-calculator';

jest.mock('../../database/db');
// Mock dependents
jest.mock('../audit-service');
// We are mocking db so actually we can use real services if they just query db.

describe('PayrollService', () => {
    let service: PayrollService;
    let caregiverId: number;

    beforeEach(() => {
        resetTestDatabase();
        service = new PayrollService(getDatabase());

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

    // Helper to create mock result object
    const createMockResult = (cgId: number): EnhancedPayrollResult => ({
        caregiverId: cgId,
        totalHours: 40,
        grossWages: 800,
        netPay: 700, // simplified
        federalWithholding: 50,
        taxes: {
            socialSecurityEmployee: 49.60,
            medicareEmployee: 11.60,
            socialSecurityEmployer: 49.60,
            medicareEmployer: 11.60,
            futa: 4.80,
            coloradoSuta: 13.60,
            coloradoFamliEmployee: 3.60,
            coloradoFamliEmployer: 3.60,
            coloradoStateIncomeTax: 35.00,
            totalEmployeeWithholdings: 64.80, // rough sum
            totalEmployerTaxes: 66.80 // rough sum
        },
        hoursByType: { regular: 40, weekend: 0, holiday: 0, overtime: 0 },
        wagesByType: {
            regular: { hours: 40, rate: 20, subtotal: 800 },
            weekend: { hours: 0, rate: 0, subtotal: 0 },
            holiday: { hours: 0, rate: 0, subtotal: 0 },
            overtime: { hours: 0, rate: 0, subtotal: 0 }
        },
        calculationVersion: 'v2',
        taxVersion: '2025.1',
        isMinimumWageCompliant: true
    });

    describe('createPayrollRecord', () => {
        it('should create a payroll record', () => {
            const result = createMockResult(caregiverId);
            const record = service.createPayrollRecord(result, '2025-01-01', '2025-01-07');

            expect(record.id).toBeDefined();
            expect(record.grossWages).toBe(800);
            expect(record.isFinalized).toBe(false);
        });
    });

    describe('saveDraft', () => {
        it('should save as draft', () => {
            const result = createMockResult(caregiverId);
            const record = service.saveDraft(result, '2025-01-01', '2025-01-07');

            expect(record.id).toBeDefined();
            // We need to check status, but interface might not expose it? 
            // The method logic sets 'draft'. We can verify by fetching drafts.
            const drafts = service.getDrafts();
            expect(drafts.length).toBe(1);
            expect(drafts[0].grossWages).toBe(800);
        });
    });

    describe('approveDraft', () => {
        it('should approve a draft and finalize', () => {
            const result = createMockResult(caregiverId);
            const draft = service.saveDraft(result, '2025-01-01', '2025-01-07');

            const approved = service.approveDraft(draft.id);
            expect(approved.id).toBe(draft.id);

            // Should be no drafts left
            const drafts = service.getDrafts();
            expect(drafts.length).toBe(0);
        });
    });
});
