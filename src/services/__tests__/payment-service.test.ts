/**
 * PaymentService Unit Tests
 */

import { PaymentService } from '../payment-service';
import * as DBCode from '../../database/db';
const { getDatabase, resetTestDatabase } = DBCode as any;
import { EmployerService } from '../employer-service';
import { CaregiverService } from '../caregiver-service';

jest.mock('../../database/db');

describe('PaymentService', () => {
    let service: PaymentService;
    let caregiverId: number;

    beforeEach(() => {
        resetTestDatabase();
        service = new PaymentService(getDatabase());

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

    describe('createRecord', () => {
        it('should create a payment record', () => {
            const payment = service.createRecord({
                caregiverId,
                amount: 500,
                status: 'pending'
            });

            expect(payment.id).toBeDefined();
            expect(payment.amount).toBe(500);
            expect(payment.status).toBe('pending');
        });

        it('should log transaction automatically', () => {
            service.createRecord({
                caregiverId,
                amount: 500,
                status: 'paid'
            });

            const transactions = service.getTransactionHistory();
            expect(transactions.length).toBe(1);
            expect(transactions[0].amount_cents).toBe(50000);
        });
    });

    describe('updateStatus', () => {
        it('should update status', () => {
            const payment = service.createRecord({
                caregiverId,
                amount: 500,
                status: 'pending'
            });

            service.updateStatus(payment.id, 'paid');

            const updated = service.getPaymentById(payment.id);
            expect(updated?.status).toBe('paid');
        });
    });
});
