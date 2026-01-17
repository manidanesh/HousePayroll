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

            // Should still be in drafts (as approved), but not finalized
            const drafts = service.getDrafts();
            expect(drafts.length).toBe(1);
            expect(drafts[0].status).toBe('approved');
        });
    });

    describe('calculateManualTaxes', () => {
        it('should calculate full taxes for manual gross amount', async () => {
            // Gross: $1000
            // Single, 2025 Rates
            // FICA: $1000 * 7.65% = $76.50
            // CO State: $1000 * 4.4% = $44.00
            // CO FAMLI: $1000 * 0.45% = $4.50
            // Fed Withholding: Dependent on W-4 (Default Single) -> likely tiny or 0 for $1000 weekly annualized
            // Actually $1000 * 52 = $52k. Standard deduction $15k. Taxable $37k. 
            // Tax is roughly 10-12%. So definitely > 0.

            const result = await PayrollService.calculateManualTaxes({
                caregiverId,
                employerId: 1, // Assumed from test setup
                grossAmount: 1000,
                payPeriodStart: '2025-06-01'
            });

            expect(result.grossWages).toBe(1000);

            // Validate Tax deductions are happening (not zero)
            expect(result.ssEmployee).toBeCloseTo(62.00, 2); // 6.2%
            expect(result.medicareEmployee).toBeCloseTo(14.50, 2); // 1.45%
            expect(result.coloradoStateIncomeTax).toBeCloseTo(44.00, 2); // 4.4%
            expect(result.coloradoFamliEmployee).toBeGreaterThan(0);

            // Validate Federal Tax is calculated (User making $52k/yr pays fed tax)
            // $1000 * 52 = 52000. 
            // 52000 - 15000 (std ded) = 37000 taxable.
            // Bracket 1 (10%): 11600 * 0.10 = 1160
            // Bracket 2 (12%): (37000 - 11600) * 0.12 = 25400 * 0.12 = 3048
            // Total Annual Tax = 1160 + 3048 = 4208
            // Weekly Tax = 4208 / 52 = 80.92
            expect(result.federalWithholding).toBeGreaterThan(50);
            expect(result.federalWithholding).toBeLessThan(100);

            // Validate Net Pay logic
            const expectedDeductions = result.ssEmployee + result.medicareEmployee + result.federalWithholding + result.coloradoStateIncomeTax + result.coloradoFamliEmployee;
            expect(result.netPay).toBeCloseTo(1000 - expectedDeductions, 2);
        });
    });
});
