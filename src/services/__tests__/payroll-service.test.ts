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

    describe('approveDraft - bug condition', () => {
        /**
         * Property 1: Bug Condition - Duplicate Approved Record Not Rejected
         *
         * Validates: Requirements 1.1
         *
         * EXPECTED OUTCOME ON UNFIXED CODE: The duplicate test FAILS (no error thrown).
         * This proves the bug exists — approveDraft(B.id) returns successfully instead
         * of throwing, leaving two approved records for the same caregiver and period.
         */
        it('should throw when approving a draft for a caregiver+period that already has an approved record', () => {
            const result = createMockResult(caregiverId);

            // Save and approve draft A
            const draftA = service.saveDraft(result, '2025-02-01', '2025-02-07');
            service.approveDraft(draftA.id);

            // Save draft B for the same caregiver + same pay period
            const draftB = service.saveDraft(result, '2025-02-01', '2025-02-07');

            // BUG CONDITION: approveDraft(B.id) should throw but currently does NOT
            // This test is EXPECTED TO FAIL on unfixed code — failure confirms the bug
            expect(() => service.approveDraft(draftB.id)).toThrow(
                'An approved payroll record already exists for this caregiver and pay period.'
            );
        });

        it('should NOT throw when the only prior record for the same period is voided', () => {
            const result = createMockResult(caregiverId);

            // Save and approve draft A, then void it
            const draftA = service.saveDraft(result, '2025-02-01', '2025-02-07');
            service.approveDraft(draftA.id);
            service.voidPayrollRecord(draftA.id, 'test void');

            // Save draft B for the same caregiver + same pay period
            const draftB = service.saveDraft(result, '2025-02-01', '2025-02-07');

            // Voided record is not an active duplicate — should succeed on both unfixed and fixed code
            expect(() => service.approveDraft(draftB.id)).not.toThrow();
        });
    });

    describe('approveDraft - preservation', () => {
        /**
         * Property 2: Preservation - Normal Approval Behavior Unaffected
         *
         * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
         *
         * These tests observe baseline behavior on UNFIXED code and MUST ALL PASS.
         * They encode the behaviors that the fix must preserve.
         */

        it('should return status=approved for a draft with a unique caregiver/period (no prior approved record)', () => {
            const fc = require('fast-check');

            // Observation on unfixed code: approveDraft for a unique caregiver/period returns status='approved'
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 12 }).chain((month: number) => {
                        const start = `2025-${String(month).padStart(2, '0')}-01`;
                        const end = `2025-${String(month).padStart(2, '0')}-07`;
                        return fc.constant({ start, end });
                    }),
                    ({ start, end }: { start: string; end: string }) => {
                        resetTestDatabase();
                        // Re-setup employer and caregiver after reset
                        EmployerService.createEmployer({
                            displayName: 'Test Family',
                            payFrequency: 'weekly',
                            defaultHourlyRate: 20,
                            ssnOrEin: '12-3456789',
                            federalWithholdingEnabled: true,
                            coloradoSutaRate: 0.017
                        });
                        const cg = CaregiverService.createCaregiver({
                            fullLegalName: 'Nanny Test',
                            ssn: '123-44-5555',
                            hourlyRate: 20
                        });
                        const svc = new PayrollService(getDatabase());
                        const result = createMockResult(cg.id);

                        // No prior approved record — should succeed and return approved status
                        const draft = svc.saveDraft(result, start, end);
                        svc.approveDraft(draft.id);

                        // Verify via getDrafts which maps status correctly
                        const drafts = svc.getDrafts();
                        const record = drafts.find(d => d.id === draft.id);
                        return record !== undefined && record.status === 'approved';
                    }
                ),
                { numRuns: 5 }
            );
        });

        it('should succeed when the only prior record for the same period is voided', () => {
            const fc = require('fast-check');

            // Observation on unfixed code: voided record is not an active duplicate — approval succeeds
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 12 }).chain((month: number) => {
                        const start = `2025-${String(month).padStart(2, '0')}-01`;
                        const end = `2025-${String(month).padStart(2, '0')}-07`;
                        return fc.constant({ start, end });
                    }),
                    ({ start, end }: { start: string; end: string }) => {
                        resetTestDatabase();
                        EmployerService.createEmployer({
                            displayName: 'Test Family',
                            payFrequency: 'weekly',
                            defaultHourlyRate: 20,
                            ssnOrEin: '12-3456789',
                            federalWithholdingEnabled: true,
                            coloradoSutaRate: 0.017
                        });
                        const cg = CaregiverService.createCaregiver({
                            fullLegalName: 'Nanny Test',
                            ssn: '123-44-5555',
                            hourlyRate: 20
                        });
                        const svc = new PayrollService(getDatabase());
                        const result = createMockResult(cg.id);

                        // Approve draft A then void it
                        const draftA = svc.saveDraft(result, start, end);
                        svc.approveDraft(draftA.id);
                        svc.voidPayrollRecord(draftA.id, 'test void');

                        // Draft B for same period — voided record is not a conflict
                        const draftB = svc.saveDraft(result, start, end);
                        let threw = false;
                        try {
                            svc.approveDraft(draftB.id);
                        } catch {
                            threw = true;
                        }

                        return !threw;
                    }
                ),
                { numRuns: 5 }
            );
        });

        it('should throw "Payroll is not in draft status" when called on a non-draft record', () => {
            const fc = require('fast-check');

            // Observation on unfixed code: non-draft records are rejected with the existing status check
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 12 }).chain((month: number) => {
                        const start = `2025-${String(month).padStart(2, '0')}-01`;
                        const end = `2025-${String(month).padStart(2, '0')}-07`;
                        return fc.constant({ start, end });
                    }),
                    ({ start, end }: { start: string; end: string }) => {
                        resetTestDatabase();
                        EmployerService.createEmployer({
                            displayName: 'Test Family',
                            payFrequency: 'weekly',
                            defaultHourlyRate: 20,
                            ssnOrEin: '12-3456789',
                            federalWithholdingEnabled: true,
                            coloradoSutaRate: 0.017
                        });
                        const cg = CaregiverService.createCaregiver({
                            fullLegalName: 'Nanny Test',
                            ssn: '123-44-5555',
                            hourlyRate: 20
                        });
                        const svc = new PayrollService(getDatabase());
                        const result = createMockResult(cg.id);

                        // Approve the draft — it is now in 'approved' status, not 'draft'
                        const draft = svc.saveDraft(result, start, end);
                        svc.approveDraft(draft.id);

                        // Calling approveDraft again on the same (now approved) record must throw
                        let threw = false;
                        let errorMessage = '';
                        try {
                            svc.approveDraft(draft.id);
                        } catch (e: any) {
                            threw = true;
                            errorMessage = e.message;
                        }

                        return threw && errorMessage === 'Payroll is not in draft status';
                    }
                ),
                { numRuns: 5 }
            );
        });

        it('should succeed for a different caregiver on the same pay period (not a duplicate)', () => {
            const fc = require('fast-check');

            // Observation on unfixed code: different caregiver is not a duplicate — approval succeeds
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 12 }).chain((month: number) => {
                        const start = `2025-${String(month).padStart(2, '0')}-01`;
                        const end = `2025-${String(month).padStart(2, '0')}-07`;
                        return fc.constant({ start, end });
                    }),
                    ({ start, end }: { start: string; end: string }) => {
                        resetTestDatabase();
                        EmployerService.createEmployer({
                            displayName: 'Test Family',
                            payFrequency: 'weekly',
                            defaultHourlyRate: 20,
                            ssnOrEin: '12-3456789',
                            federalWithholdingEnabled: true,
                            coloradoSutaRate: 0.017
                        });
                        // Caregiver 1
                        const cg1 = CaregiverService.createCaregiver({
                            fullLegalName: 'Nanny One',
                            ssn: '111-22-3333',
                            hourlyRate: 20
                        });
                        // Caregiver 2
                        const cg2 = CaregiverService.createCaregiver({
                            fullLegalName: 'Nanny Two',
                            ssn: '444-55-6666',
                            hourlyRate: 20
                        });
                        const svc = new PayrollService(getDatabase());

                        // Approve caregiver 1 for the period
                        const draftCg1 = svc.saveDraft(createMockResult(cg1.id), start, end);
                        svc.approveDraft(draftCg1.id);

                        // Approve caregiver 2 for the same period — different caregiver, not a duplicate
                        const draftCg2 = svc.saveDraft(createMockResult(cg2.id), start, end);
                        let threw = false;
                        try {
                            svc.approveDraft(draftCg2.id);
                        } catch {
                            threw = true;
                        }

                        return !threw;
                    }
                ),
                { numRuns: 5 }
            );
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
