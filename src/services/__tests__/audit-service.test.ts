/**
 * AuditService Unit Tests
 */

import { AuditService } from '../audit-service';
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;
import { EmployerService } from '../employer-service';

jest.mock('../../database/db');

describe('AuditService', () => {
    let service: AuditService;

    beforeEach(() => {
        resetTestDatabase();
        service = new AuditService(getDatabase());

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

    describe('log', () => {
        it('should create an audit log entry', () => {
            service.log({
                tableName: 'test_table',
                recordId: 123,
                action: 'CREATE',
                changesJson: '{"test": true}'
            });

            const logs = service.getAllLogs();
            expect(logs.length).toBeGreaterThanOrEqual(1);
            expect(logs[0].table_name).toBe('test_table');
        });
    });
});
