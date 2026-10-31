/**
 * ColoradoTaxService Unit Tests
 */

import { ColoradoTaxService } from '../colorado-tax-service';
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;
import { EmployerService } from '../employer-service';
import { CaregiverService } from '../caregiver-service';

// Mock DB
jest.mock('../../database/db');

describe('ColoradoTaxService', () => {
    let service: ColoradoTaxService;

    beforeEach(() => {
        resetTestDatabase();
        service = new ColoradoTaxService(getDatabase());

        // Setup Employer
        EmployerService.createEmployer({
            displayName: 'Test Family',
            payFrequency: 'weekly',
            defaultHourlyRate: 20,
            ssnOrEin: '12-3456789',
            federalWithholdingEnabled: true,
            coloradoSutaRate: 0.017
        });
    });

    describe('getQuarterlyData', () => {
        it('should return empty array if no payrolls', () => {
            const data = service.getQuarterlyData(2025, 1);
            expect(data).toHaveLength(0);
        });

        // This test requires inserting payroll records which is complex because PayrollService isn't refactored yet fully 
        // and inserting raw records requires matching foreign keys.
        // We will defer complex integration tests until PayrollService is refactored.
    });

    describe('generateSUI_CSV', () => {
        it('should generate correct CSV format', () => {
            // The CSV now derives taxable wages and SUI due from per-record snapshots (FR-03).
            const mockData = [{
                caregiverId: 1,
                caregiverName: 'Mary Poppins',
                ssn: '123-00-1234',
                totalWages: 5000,
                priorYtdWages: 10000,
                hoursWorked: 200,
                eeContribution: 22.5,
                erContribution: 22.5,
                references: '101; 102',
                suiTaxable: 5000, // all 5000 subject to SUI (under the wage base)
                suiPaid: 85.00,    // 5000 * 0.017
            }];

            const csv = service.generateSUI_CSV('EAN123', 'FEIN123', 1, 2025, mockData);

            expect(csv).toContain('FEIN,EAN,Quarter,Year');
            expect(csv).toContain('Poppins,Mary');
            expect(csv).toContain('5000.00'); // Total Wages
            expect(csv).toContain('85.00');    // SUI Tax Due (from snapshot)
        });
    });
});
