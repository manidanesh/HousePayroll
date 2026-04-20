/**
 * IPC Handlers - Main process handlers for database operations
 * All database access happens here, renderer communicates via IPC
 */

import { ipcMain, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from '../database/db';
import { AuthService } from '../services/auth-service';
import { EmployerService } from '../services/employer-service';
import { CaregiverService } from '../services/caregiver-service';
import { TimeEntryService } from '../services/time-entry-service';

import { PayrollService } from '../services/payroll-service';
import { ReportingService } from '../services/reporting-service';
import { TaxComputer } from '../core/tax-computer';
import { EnhancedPayrollCalculator } from '../core/enhanced-payroll-calculator';
import { BackupService } from '../services/backup-service';
import { YearEndService } from '../services/year-end-service';
import { ColoradoTaxService } from '../services/colorado-tax-service';
import { W2Service } from '../services/w2-service';
import { TaxFormService } from '../services/tax-form-service';
import { TaxNotificationService } from '../services/tax-notification-service';
import { TaxPaymentService } from '../services/tax-payment-service';
import { W3Service } from '../services/w3-service';
import { decrypt } from '../database/db';
import { AuditService } from '../services/audit-service';
import { StripeService } from '../services/stripe-service';
import { PaymentService } from '../services/payment-service';
import { DatabaseCleanup } from '../services/database-cleanup';
import { YTDService } from '../services/ytd-service';
import { FederalWithholdingCalculator, W4Information, PayFrequency } from '../core/federal-withholding-calculator';
import { CreateEmployerInput, UpdateEmployerInput, CreateCaregiverInput, UpdateCaregiverInput, CreateTimeEntryInput, PayrollCalculationInput, PayrollCalculationResult, CreatePaymentInput } from '../types';
import { logger } from '../utils/logger';
import { sanitizeData } from '../utils/sanitizer';

export function registerIpcHandlers() {
    // Auth handlers
    ipcMain.handle('auth:isPinSet', () => {
        return AuthService.isPinSet();
    });

    ipcMain.handle('auth:setPin', (_event, pin: string) => {
        return AuthService.setupPin(pin);
    });

    ipcMain.handle('auth:verifyPin', (_event, pin: string) => {
        return AuthService.verifyPin(pin);
    });

    // Employer handlers
    ipcMain.handle('employer:has', () => {
        logger.info('Checking employer profile existence');
        return EmployerService.hasEmployerProfile();
    });

    ipcMain.handle('employer:create', (_event, data: CreateEmployerInput) => {
        try {
            return EmployerService.createEmployer(data);
        } catch (err: any) {
            logger.error('Failed to create employer', err, { data: sanitizeData(data) });
            throw err;
        }
    });

    ipcMain.handle('employer:get', () => {
        logger.info('Fetching employer profile');
        return EmployerService.getEmployer();
    });

    ipcMain.handle('employer:update', (_event, data: UpdateEmployerInput) => {
        try {
            return EmployerService.updateEmployer(data);
        } catch (err: any) {
            logger.error('Failed to update employer', err, { data: sanitizeData(data) });
            throw err;
        }
    });

    ipcMain.handle('employer:getAll', () => {
        return EmployerService.getAllEmployers();
    });

    ipcMain.handle('employer:setActive', (_event, id: number) => {
        return EmployerService.setActiveEmployer(id);
    });

    ipcMain.handle('employer:delete', (_event, id: number) => {
        return EmployerService.deleteEmployer(id);
    });

    // Caregiver handlers
    ipcMain.handle('caregiver:create', (_event, data: CreateCaregiverInput) => {
        try {
            const caregiver = CaregiverService.createCaregiver(data);
            // Strip SSN before sending to renderer
            const { ssn, ...safeCaregiver } = caregiver;
            return safeCaregiver;
        } catch (err: any) {
            logger.error('Failed to create caregiver', err, { data: sanitizeData(data) });
            throw err;
        }
    });

    ipcMain.handle('caregiver:getAll', (_event, includeInactive?: boolean) => {
        return CaregiverService.getAllCaregiversForRenderer(includeInactive);
    });

    ipcMain.handle('caregiver:getById', (_event, id: number) => {
        return CaregiverService.getCaregiverByIdForRenderer(id);
    });

    ipcMain.handle('caregiver:update', (_event, id: number, data: UpdateCaregiverInput) => {
        try {
            const caregiver = CaregiverService.updateCaregiver(id, data);
            // Strip SSN before sending to renderer
            const { ssn, ...safeCaregiver } = caregiver;
            return safeCaregiver;
        } catch (err: any) {
            logger.error('Failed to update caregiver', err, { id, data: sanitizeData(data) });
            throw err;
        }
    });

    ipcMain.handle('caregiver:deactivate', (_event, id: number) => {
        return CaregiverService.deactivateCaregiver(id);
    });

    ipcMain.handle('caregiver:reactivate', (_event, id: number) => {
        return CaregiverService.reactivateCaregiver(id);
    });

    ipcMain.handle('caregiver:delete', (_event, id: number) => {
        return CaregiverService.deleteCaregiver(id);
    });

    // Time entry handlers
    ipcMain.handle('timeEntry:create', (_event, data: CreateTimeEntryInput) => {
        return TimeEntryService.createTimeEntry(data);
    });

    ipcMain.handle('timeEntry:getById', (_event, id: number) => {
        return TimeEntryService.getTimeEntryById(id);
    });

    ipcMain.handle('timeEntry:getForDateRange', (_event, startDate: string, endDate: string) => {
        return TimeEntryService.getTimeEntriesForDateRange(startDate, endDate);
    });

    ipcMain.handle('timeEntry:getForCaregiver', (_event, caregiverId: number, startDate?: string, endDate?: string) => {
        return TimeEntryService.getTimeEntriesForCaregiver(caregiverId, startDate, endDate);
    });

    ipcMain.handle('timeEntry:getForDate', (_event, date: string) => {
        return TimeEntryService.getTimeEntriesForDate(date);
    });

    ipcMain.handle('timeEntry:update', (_event, id: number, hoursWorked: number) => {
        return TimeEntryService.updateTimeEntry(id, hoursWorked);
    });

    ipcMain.handle('timeEntry:delete', (_event, id: number) => {
        return TimeEntryService.deleteTimeEntry(id);
    });

    ipcMain.handle('timeEntry:getTotalHours', (_event, caregiverId: number, startDate: string, endDate: string) => {
        return TimeEntryService.getTotalHours(caregiverId, startDate, endDate);
    });

    // Payroll handlers
    ipcMain.handle('payroll:create', (_event, result: PayrollCalculationResult, start: string, end: string) => {
        return PayrollService.createPayrollRecord(result, start, end);
    });

    ipcMain.handle('payroll:getById', (_event, id: number) => {
        return PayrollService.getPayrollRecordById(id);
    });
    // YTD handlers
    ipcMain.handle('ytd:getGrossWages', (_event, caregiverId: number, year: number) => {
        return YTDService.getYTDGrossWages(caregiverId, year);
    });

    ipcMain.handle('payroll:finalize', (_event, id: number, checkNumber: string, paymentDate: string, pdfData?: Uint8Array, isLatePayment?: boolean, paymentMethod?: string, checkBankName?: string, checkAccountOwner?: string) => {
        return PayrollService.finalizePayroll(id, checkNumber, paymentDate, pdfData, isLatePayment, paymentMethod, checkBankName, checkAccountOwner);
    });



    ipcMain.handle('payroll:checkDuplicateCheckNumber', (_event, checkNumber: string, excludeRecordId?: number) => {
        const employer = EmployerService.getEmployer();
        if (!employer) return false;

        return PayrollService.checkDuplicateCheckNumber(checkNumber, employer.id, excludeRecordId);
    });

    ipcMain.handle('payroll:void', (_event, id: number, reason: string) => {
        return PayrollService.voidPayrollRecord(id, reason);
    });

    ipcMain.handle('payroll:getPaystubContext', (_event, recordId: number) => {
        return PayrollService.getPaystubContext(recordId);
    });

    ipcMain.handle('ytd:getContext', (_event, caregiverId: number, year: number) => {
        return YTDService.getYTDContext(caregiverId, year);
    });

    // Legacy handler for backward compatibility
    ipcMain.handle('payroll:getYTDContext', (_event, caregiverId: number, year: number) => {
        return YTDService.getYTDContext(caregiverId, year);
    });

    ipcMain.handle('payroll:getHistory', () => {
        return PayrollService.getPayrollHistory();
    });

    ipcMain.handle('payroll:getLastFinalizedDate', (_event, caregiverId: number) => {
        return PayrollService.getLastFinalizedDate(caregiverId);
    });

    ipcMain.handle('payroll:checkOverlap', (_event, caregiverId: number, startDate: string, endDate: string) => {
        return PayrollService.checkOverlappingPayrolls(caregiverId, startDate, endDate);
    });

    // Reporting handlers
    ipcMain.handle('report:getYTD', (_event, year: number, caregiverId?: number) => {
        return ReportingService.getYTDSummary(year, caregiverId);
    });

    ipcMain.handle('report:getTaxCaps', async (_event, year: number, caregiverId?: number) => {
        return ReportingService.getTaxCapStatus(year, caregiverId);
    });

    ipcMain.handle('report:getTrends', async (_event, year: number, caregiverId?: number) => {
        return ReportingService.getMonthlyWageTrends(year, caregiverId);
    });

    ipcMain.handle('report:exportW2', (_event, year: number) => {
        return ReportingService.generateW2CSV(year);
    });

    ipcMain.handle('report:exportScheduleH', async (_event, year: number) => {
        const csv = ReportingService.generateScheduleHSUM(year);

        const result = await dialog.showSaveDialog({
            title: `Export IRS Schedule H Summary for ${year}`,
            defaultPath: `Schedule_H_Summary_${year}.csv`,
            filters: [{ name: 'CSV File', extensions: ['csv'] }]
        });

        if (result.filePath) {
            const fs = require('fs');
            fs.writeFileSync(result.filePath, csv);
            return { success: true, path: result.filePath };
        }
        return { success: false };
    });

    ipcMain.handle('report:getScheduleHData', (_event, year: number) => {
        return ReportingService.getScheduleHData(year);
    });

    ipcMain.handle('report:getPayments', (_event, limit?: number, caregiverId?: number) => {
        return PaymentService.getHistory(limit, caregiverId);
    });

    // Payroll Calculation handler (New for compliance logic)
    ipcMain.handle('payroll:calculate', async (_event, input: PayrollCalculationInput) => {
        const db = getDatabase();

        // 1. Determine tax year from pay period end date
        const payYear = input.payPeriodEnd ? new Date(input.payPeriodEnd).getFullYear() : new Date().getFullYear();

        // 2. Get year-specific tax configuration
        const { TaxConfigurationService } = require('../services/tax-configuration-service');
        const taxConfig = TaxConfigurationService.getConfigForYear(payYear);

        // 3. Get employer-specific rates
        const employer = EmployerService.getEmployer();

        const rates: any = {
            ssRateEmployee: taxConfig.ssRateEmployee,
            ssRateEmployer: taxConfig.ssRateEmployer,
            ssWageBase: taxConfig.ssWageBase,
            medicareRateEmployee: taxConfig.medicareRateEmployee,
            medicareRateEmployer: taxConfig.medicareRateEmployer,
            medicareWageBase: taxConfig.medicareWageBase,
            futaRate: taxConfig.futaRate,
            futaWageBase: taxConfig.futaWageBase,
            coloradoSutaRate: employer?.coloradoSutaRate || 0,
            coloradoSutaCap: employer?.suiWageBase || 16000,
            coloradoFamliRate: employer?.coloradoFamliRateEE || 0.0044,
            coloradoFamliRateER: employer?.coloradoFamliRateER || 0.0044
        };

        const taxComp = new TaxComputer(rates, taxConfig.version);
        const calculator = new EnhancedPayrollCalculator(taxComp);

        // Get caregiver's W-4 information for federal withholding
        const caregiver = CaregiverService.getCaregiverById(input.caregiverId);
        let federalWithholdingAmount = 0;

        if (caregiver) {
            // First calculate gross pay
            const prelimResult = calculator.calculatePayroll(input);

            // Build W-4 information
            const w4Info: W4Information = {
                filingStatus: (caregiver.w4FilingStatus as any) || 'single',
                multipleJobs: caregiver.w4MultipleJobs || false,
                dependentsAmount: caregiver.w4DependentsAmount || 0,
                otherIncome: caregiver.w4OtherIncome || 0,
                deductions: caregiver.w4Deductions || 0,
                extraWithholding: caregiver.w4ExtraWithholding || 0
            };

            // Get YTD wages
            const ytdGrossWages = YTDService.getYTDGrossWages(input.caregiverId, new Date().getFullYear());

            // Map employer pay frequency to calculator format
            const payFrequency = (employer?.payFrequency === 'bi-weekly'
                ? 'biweekly'
                : employer?.payFrequency === 'weekly'
                    ? 'weekly'
                    : employer?.payFrequency === 'monthly'
                        ? 'monthly'
                        : 'biweekly') as PayFrequency; // default fallback

            // Calculate federal withholding
            const federalResult = FederalWithholdingCalculator.calculateWithholding(
                prelimResult.grossWages,
                payFrequency as PayFrequency,
                w4Info,
                ytdGrossWages
            );

            federalWithholdingAmount = federalResult.federalWithholding;
        }

        // Overtime calculation enabled for legal compliance
        // Colorado law requires 1.5x pay for hours over 40/week
        // input.disableOvertime = false; // ✅ ENABLED (commented out to allow overtime)

        return calculator.calculatePayroll({
            ...input,
            federalWithholdingAmount
        });
    });

    // Payroll review workflow handlers
    ipcMain.handle('payroll:preview', async (event, input: PayrollCalculationInput) => {
        const { TaxConfigurationService } = require('../services/tax-configuration-service');
        const taxConfig = TaxConfigurationService.getConfigForYear(new Date().getFullYear());
        if (!taxConfig) throw new Error('Tax configuration not found');

        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('Employer not found');

        const rates = {
            ssRateEmployee: taxConfig.ssRateEmployee,
            ssRateEmployer: taxConfig.ssRateEmployer,
            ssWageBase: taxConfig.ssWageBase,
            medicareRateEmployee: taxConfig.medicareRateEmployee,
            medicareRateEmployer: taxConfig.medicareRateEmployer,
            futaRate: taxConfig.futaRate,
            futaWageBase: taxConfig.futaWageBase,
            coloradoSutaRate: employer.coloradoSutaRate,
            coloradoSutaCap: 16000,
            coloradoFamliRate: employer.coloradoFamliRateEE,
            coloradoFamliRateER: employer.coloradoFamliRateER,
        };

        const taxComp = new TaxComputer(rates, taxConfig.version);
        const calculator = new EnhancedPayrollCalculator(taxComp);

        // Get caregiver's W-4 information for federal withholding
        const caregiver = CaregiverService.getCaregiverById(input.caregiverId);
        let federalWithholdingAmount = 0;

        if (caregiver) {
            // First calculate gross pay
            const prelimResult = calculator.calculatePayroll(input);

            // Build W-4 information
            const w4Info: W4Information = {
                filingStatus: (caregiver.w4FilingStatus as any) || 'single',
                multipleJobs: caregiver.w4MultipleJobs || false,
                dependentsAmount: caregiver.w4DependentsAmount || 0,
                otherIncome: caregiver.w4OtherIncome || 0,
                deductions: caregiver.w4Deductions || 0,
                extraWithholding: caregiver.w4ExtraWithholding || 0
            };

            // Get YTD wages
            const ytdGrossWages = YTDService.getYTDGrossWages(input.caregiverId, new Date().getFullYear());

            // Map employer pay frequency to calculator format
            const payFrequency = (employer?.payFrequency === 'bi-weekly'
                ? 'biweekly'
                : employer?.payFrequency === 'weekly'
                    ? 'weekly'
                    : employer?.payFrequency === 'monthly'
                        ? 'monthly'
                        : 'biweekly') as PayFrequency; // default fallback

            // Calculate federal withholding
            const federalResult = FederalWithholdingCalculator.calculateWithholding(
                prelimResult.grossWages,
                payFrequency as PayFrequency,
                w4Info,
                ytdGrossWages
            );

            federalWithholdingAmount = federalResult.federalWithholding;
        }

        const result = calculator.calculatePayroll({
            ...input,
            federalWithholdingAmount
        });
        return PayrollService.previewPayroll(result);
    });

    ipcMain.handle('payroll:saveDraft', async (event, result: any, periodStart: string, periodEnd: string) => {
        return PayrollService.saveDraft(result, periodStart, periodEnd);
    });

    ipcMain.handle('payroll:approve', async (event, draftId: number) => {
        return PayrollService.approveDraft(draftId);
    });

    ipcMain.handle('payroll:deleteDraft', async (event, draftId: number) => {
        PayrollService.deleteDraft(draftId);
    });

    ipcMain.handle('payroll:getDrafts', async () => {
        return PayrollService.getDrafts();
    });

    // Manual Payroll Entry Handlers
    ipcMain.handle('payroll:calculateManualTaxes', async (_event, params: {
        caregiverId: number;
        employerId: number;
        grossAmount: number;
        payPeriodStart: string;
    }) => {
        logger.info('Calculating taxes for manual entry', { grossAmount: params.grossAmount });
        return await PayrollService.calculateManualTaxes(params);
    });

    ipcMain.handle('payroll:createManual', async (_event, params: {
        caregiverId: number;
        employerId: number;
        payPeriodStart: string;
        payPeriodEnd: string;
        description: string;
        grossAmount: number;
        paymentDate?: string;
    }) => {
        logger.info('Creating manual payroll entry', {
            caregiverId: params.caregiverId,
            grossAmount: params.grossAmount,
            description: params.description
        });
        return await PayrollService.createManualPayroll(params);
    });

    ipcMain.handle('audit:getAll', async () => {
        return AuditService.getAllLogs();
    });

    ipcMain.handle('report:exportYearEnd', async (_event, year: number) => {
        const result = await dialog.showSaveDialog({
            title: `Export Year-End Package for ${year}`,
            defaultPath: `Household_Payroll_Export_${year}.zip`,
            filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        });

        if (result.filePath) {
            await YearEndService.generateExportPackage(year, result.filePath);
            return { success: true, path: result.filePath };
        }
        return { success: false };
    });

    // Backup & Restore Handlers
    ipcMain.handle('backup:export', async () => {
        const result = await dialog.showSaveDialog({
            title: 'Export Database Backup',
            defaultPath: 'payroll_backup.db',
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (result.filePath) {
            await BackupService.exportBackup(result.filePath);
            return { success: true, path: result.filePath };
        }
        return { success: false };
    });

    ipcMain.handle('backup:import', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Import Database Backup',
            properties: ['openFile'],
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (result.filePaths && result.filePaths.length > 0) {
            await BackupService.importBackup(result.filePaths[0]);
            return { success: true };
        }
        return { success: false };
    });

    // Encrypted Backup Handlers
    ipcMain.handle('backup:export-encrypted', async (_event, password: string) => {
        try {
            const result = await dialog.showSaveDialog({
                title: 'Export Encrypted Backup',
                defaultPath: `household-payroll-backup-${new Date().toISOString().split('T')[0]}.hpb`,
                filters: [{ name: 'Household Payroll Backup', extensions: ['hpb'] }]
            });

            if (result.filePath) {
                await BackupService.exportEncryptedBackup(password, result.filePath);
                logger.info('Encrypted backup exported via IPC', { path: result.filePath });
                return { success: true, path: result.filePath };
            }
            return { success: false };
        } catch (error: any) {
            logger.error('Failed to export encrypted backup via IPC', { error: error.message });
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('backup:import-encrypted', async (_event, password: string) => {
        try {
            const result = await dialog.showOpenDialog({
                title: 'Import Encrypted Backup',
                properties: ['openFile'],
                filters: [{ name: 'Household Payroll Backup', extensions: ['hpb'] }]
            });

            if (result.filePaths && result.filePaths.length > 0) {
                await BackupService.importFromBackup(result.filePaths[0], password);
                logger.info('Encrypted backup imported via IPC', { path: result.filePaths[0] });
                return { success: true };
            }
            return { success: false };
        } catch (error: any) {
            logger.error('Failed to import encrypted backup via IPC', { error: error.message });
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('backup:validate-password', (_event, password: string) => {
        const { validatePassword } = require('../utils/password-crypto');
        const error = validatePassword(password);
        return { valid: !error, error };
    });

    ipcMain.handle('backup:password-strength', (_event, password: string) => {
        const { calculatePasswordStrength } = require('../utils/password-crypto');
        return calculatePasswordStrength(password);
    });


    // Colorado Tax Handlers
    ipcMain.handle('tax:getQuarterlyData', (_event, year: number, quarter: number) => {
        return ColoradoTaxService.getQuarterlyData(year, quarter);
    });

    ipcMain.handle('tax:exportSUI', async (_event, year: number, quarter: number, ean: string) => {
        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('Employer not found');
        const fein = decrypt(employer.fein || '');

        const data = ColoradoTaxService.getQuarterlyData(year, quarter);
        const decryptedData = data.map(item => ({
            ...item,
            ssn: decrypt(item.ssn)
        }));

        const csv = ColoradoTaxService.generateSUI_CSV(ean, fein, quarter, year, decryptedData);

        const result = await dialog.showSaveDialog({
            title: `Export Colorado SUI (MyUI+) for Q${quarter} ${year}`,
            defaultPath: `Colorado_SUI_Q${quarter}_${year}.csv`,
            filters: [{ name: 'CSV File', extensions: ['csv'] }]
        });

        if (result.filePath) {
            fs.writeFileSync(result.filePath, csv);

            // Log the export for audit compliance
            ReportingService.logExport('SUI_CSV', year, quarter, path.basename(result.filePath), csv);

            return { success: true, path: result.filePath };
        }
        return { success: false };
    });

    ipcMain.handle('tax:exportFAMLI', async (_event, year: number, quarter: number) => {
        const data = ColoradoTaxService.getQuarterlyData(year, quarter);
        const decryptedData = data.map(item => ({
            ...item,
            ssn: decrypt(item.ssn)
        }));

        const csv = ColoradoTaxService.generateFAMLI_CSV(decryptedData);

        const result = await dialog.showSaveDialog({
            title: `Export Colorado FAMLI for Q${quarter} ${year}`,
            defaultPath: `Colorado_FAMLI_Q${quarter}_${year}.csv`,
            filters: [{ name: 'CSV File', extensions: ['csv'] }]
        });

        if (result.filePath) {
            fs.writeFileSync(result.filePath, csv);

            // Log the export for audit compliance
            ReportingService.logExport('FAMLI_CSV', year, quarter, path.basename(result.filePath), csv);

            return { success: true, path: result.filePath };
        }
        return { success: false };
    });

    ipcMain.handle('tax:generateW2', async (_event, year: number, caregiverId: number) => {
        const caregiver = CaregiverService.getCaregiverById(caregiverId);
        const employer = EmployerService.getEmployer();

        if (!caregiver || !employer) {
            throw new Error('Caregiver or Employer not found');
        }

        const result = await dialog.showSaveDialog({
            title: `Generate W-2 for ${caregiver.fullLegalName} (${year})`,
            defaultPath: `W2_${caregiver.fullLegalName.replace(/\s+/g, '_')}_${year}.pdf`,
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });

        if (result.filePath) {
            await W2Service.generateW2PDF(year, caregiver, employer, result.filePath);
            return { success: true, path: result.filePath };
        }
        return { success: false };
    });

    // System Handlers
    ipcMain.handle('system:promptSaveFile', async (_event, defaultName: string, data: Uint8Array) => {
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Save Paystub PDF',
            defaultPath: defaultName,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (canceled || !filePath) {
            return { success: false };
        }
        const fs = require('fs');
        try {
            fs.writeFileSync(filePath, Buffer.from(data));
            return { success: true, filePath: filePath };
        } catch (err: any) {
            logger.error('Failed to save file', { error: err });
            return { success: false, error: (err as Error).message };
        }
    });

    // Stripe Handlers
    ipcMain.handle('stripe:addBankAccount', (_event, caregiverId: number, routing: string, account: string) => {
        return StripeService.addBankAccount(caregiverId, routing, account);
    });

    ipcMain.handle('stripe:resetClient', () => {
        return StripeService.resetClient();
    });

    // Payment Handlers
    ipcMain.handle('payment:create', (_event, data: CreatePaymentInput) => {
        return PaymentService.createRecord(data);
    });

    ipcMain.handle('payment:getHistory', (_event, limit?: number) => {
        return PaymentService.getHistory(limit);
    });

    ipcMain.handle('payment:processStripe', async (_event, paymentId: number) => {
        const payment = PaymentService.getById(paymentId);
        if (!payment) throw new Error('Payment not found');

        try {
            const stripeId = await StripeService.createPayment(payment.payrollRecordId!, payment.amount, payment.caregiverId);
            PaymentService.updateStatus(paymentId, 'pending', undefined);
            // In a real app, you'd update this via webhook, but for this test mode we'll mark as pending
            return { success: true, stripeId };
        } catch (err: any) {
            PaymentService.updateStatus(paymentId, 'failed', err.message);
            throw err;
        }
    });

    ipcMain.handle('payment:getTransactionHistory', (_event, limit?: number, caregiverId?: number) => {
        return PaymentService.getTransactionHistory(limit, caregiverId);
    });

    // Tax Configuration handlers
    ipcMain.handle('taxConfig:getForYear', (_event, year: number) => {
        const { TaxConfigurationService } = require('../services/tax-configuration-service');
        return TaxConfigurationService.getConfigForYear(year);
    });

    ipcMain.handle('taxConfig:getAll', () => {
        const { TaxConfigurationService } = require('../services/tax-configuration-service');
        return TaxConfigurationService.getAllConfigurations();
    });

    ipcMain.handle('taxConfig:upsert', (_event, config: any) => {
        const { TaxConfigurationService } = require('../services/tax-configuration-service');
        return TaxConfigurationService.upsertConfiguration(config);
    });

    // Database cleanup handlers
    ipcMain.handle('database:cleanup:caregivers', async () => {
        return DatabaseCleanup.cleanupCaregiverData();
    });

    ipcMain.handle('database:stats', async () => {
        return DatabaseCleanup.getDatabaseStats();
    });

    // ── Tax Form Generation Handlers ────────────────────────────────────────

    /** Generate a single caregiver W-2 PDF and open save dialog */
    ipcMain.handle('taxForm:generateW2', async (_event, year: number, caregiverId: number) => {
        const caregiver = CaregiverService.getCaregiverById(caregiverId);
        if (!caregiver) throw new Error('Caregiver not found');

        const result = await dialog.showSaveDialog({
            title: `Generate W-2 for ${caregiver.fullLegalName} (${year})`,
            defaultPath: `W2_${caregiver.fullLegalName.replace(/\s+/g, '_')}_${year}.pdf`,
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });

        if (!result.filePath) return { success: false };

        const buffer = await TaxFormService.generateW2Buffer(year, caregiverId);
        fs.writeFileSync(result.filePath, buffer);
        TaxFormService.logGeneration('W2', year, caregiverId, caregiver.fullLegalName, result.filePath);
        TaxNotificationService.markGenerated('W-2', year, result.filePath);
        logger.info(`W-2 generated for ${caregiver.fullLegalName} (${year})`, { path: result.filePath });
        return { success: true, path: result.filePath };
    });

    /** Generate W-2 PDFs for ALL caregivers, save to a folder */
    ipcMain.handle('taxForm:generateW2All', async (_event, year: number) => {
        const result = await dialog.showOpenDialog({
            title: `Choose folder to save all W-2s for ${year}`,
            properties: ['openDirectory', 'createDirectory']
        });

        if (!result.filePaths || result.filePaths.length === 0) return { success: false };
        const folder = result.filePaths[0];

        const buffers = await TaxFormService.generateAllW2Buffers(year);
        const saved: string[] = [];
        for (const { caregiverName, buffer } of buffers) {
            const filePath = path.join(folder, `W2_${caregiverName.replace(/\s+/g, '_')}_${year}.pdf`);
            fs.writeFileSync(filePath, buffer);
            saved.push(filePath);
        }
        TaxNotificationService.markGenerated('W-2', year, folder);
        return { success: true, count: saved.length, folder };
    });

    /** Generate Schedule H PDF and open save dialog */
    ipcMain.handle('taxForm:generateScheduleH', async (_event, year: number) => {
        const result = await dialog.showSaveDialog({
            title: `Generate IRS Schedule H for ${year}`,
            defaultPath: `Schedule_H_${year}.pdf`,
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });

        if (!result.filePath) return { success: false };

        const buffer = await TaxFormService.generateScheduleHBuffer(year);
        fs.writeFileSync(result.filePath, buffer);
        TaxFormService.logGeneration('SCHEDULE_H', year, undefined, undefined, result.filePath);
        TaxNotificationService.markGenerated('Schedule H', year, result.filePath);
        logger.info(`Schedule H generated for ${year}`, { path: result.filePath });
        return { success: true, path: result.filePath };
    });

    /** Generate DR 1093 PDF and open save dialog */
    ipcMain.handle('taxForm:generateDR1093', async (_event, year: number) => {
        const result = await dialog.showSaveDialog({
            title: `Generate Colorado DR 1093 for ${year}`,
            defaultPath: `DR_1093_${year}.pdf`,
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });

        if (!result.filePath) return { success: false };

        const buffer = await TaxFormService.generateDR1093Buffer(year);
        fs.writeFileSync(result.filePath, buffer);
        TaxFormService.logGeneration('DR_1093', year, undefined, undefined, result.filePath);
        TaxNotificationService.markGenerated('DR 1093', year, result.filePath);
        logger.info(`DR 1093 generated for ${year}`, { path: result.filePath });
        return { success: true, path: result.filePath };
    });

    /** Return preview data for a form (for the Tax Center preview modal) */
    ipcMain.handle('taxForm:getPreviewData', (_event, year: number, formType: string) => {
        if (formType === 'SCHEDULE_H') {
            return ReportingService.getScheduleHData(year);
        }
        if (formType === 'W2') {
            return ReportingService.getYTDSummary(year);
        }
        if (formType === 'DR_1093') {
            const employer = EmployerService.getEmployer();
            if (!employer) return null;
            const db = getDatabase();
            const row = db.prepare(`
                SELECT COUNT(DISTINCT caregiver_id) as w2_count,
                       COALESCE(SUM(colorado_state_income_tax), 0) as total_co_sit
                FROM payroll_records
                WHERE employer_id = ? AND pay_period_end BETWEEN ? AND ?
                  AND is_finalized = 1 AND is_voided = 0
            `).get(employer.id, `${year}-01-01`, `${year}-12-31`) as any;
            return {
                employerName: employer.displayName,
                uiAccountNumber: employer.uiAccountNumber || 'Not Set',
                w2Count: row?.w2_count ?? 0,
                line1: row?.total_co_sit ?? 0,
                line2: row?.total_co_sit ?? 0,
                taxYear: year
            };
        }
        if (formType === 'W3') {
            return W3Service.computeW3Totals(year);
        }
        return null;
    });

    /** Return form generation log for given year */
    ipcMain.handle('taxForm:getLog', (_event, year: number) => {
        return TaxFormService.getFormLog(year);
    });

    /** Open a previously saved form file in the OS default PDF viewer */
    ipcMain.handle('taxForm:openFile', async (_event, filePath: string) => {
        if (fs.existsSync(filePath)) {
            await shell.openPath(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    });

    // ── Tax Notification Handlers ───────────────────────────────────────────

    ipcMain.handle('taxNotif:getAll', (_event, year?: number) => {
        TaxNotificationService.clearStaleDismissals();
        return TaxNotificationService.getActiveNotifications(year);
    });

    ipcMain.handle('taxNotif:dismiss', (_event, notificationId: string) => {
        TaxNotificationService.dismiss(notificationId);
        return { success: true };
    });

    ipcMain.handle('taxNotif:getUnreadCount', () => {
        return TaxNotificationService.getUnreadCount();
    });

    ipcMain.handle('taxNotif:getCurrentTaxYear', () => {
        return TaxNotificationService.getCurrentTaxYear();
    });

    // ── CO Tax Payment Tracker Handlers ─────────────────────────────────────

    /** Add a new CO DOR remittance payment (for DR 1093 Line 2) */
    ipcMain.handle('taxPayment:add', (_event, input: {
        taxYear: number;
        paymentDate: string;
        amount: number;
        quarter?: 1 | 2 | 3 | 4;
        method?: string;
        referenceNumber?: string;
        notes?: string;
    }) => {
        return TaxPaymentService.addPayment(input as any);
    });

    /** Delete a CO DOR remittance payment by ID */
    ipcMain.handle('taxPayment:delete', (_event, id: number) => {
        TaxPaymentService.deletePayment(id);
        return { success: true };
    });

    /** Get all payments for a given tax year */
    ipcMain.handle('taxPayment:list', (_event, taxYear: number) => {
        return TaxPaymentService.getPayments(taxYear);
    });

    /** Get full DR 1093 Line 1 / Line 2 summary for a tax year */
    ipcMain.handle('taxPayment:getSummary', (_event, taxYear: number) => {
        return TaxPaymentService.getSummary(taxYear);
    });

    // ── W-3 Transmittal Handlers ─────────────────────────────────────────────

    /** Get pre-computed W-3 totals for preview */
    ipcMain.handle('taxForm:getW3Preview', (_event, year: number) => {
        return W3Service.computeW3Totals(year);
    });

    /** Generate W-3 PDF — prompts for save location */
    ipcMain.handle('taxForm:generateW3', async (_event, year: number) => {
        const employer = EmployerService.getEmployer();
        if (!employer) return { success: false, error: 'No employer profile found' };

        const { dialog } = await import('electron');
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: `Save W-3 Transmittal (${year})`,
            defaultPath: `W3_Transmittal_${year}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });

        if (canceled || !filePath) return { success: false, canceled: true };

        try {
            const buf = await W3Service.generateW3Buffer(year);
            const fs = await import('fs');
            fs.writeFileSync(filePath, buf);

            // Log to tax_form_log
            const db = getDatabase();
            db.prepare(`
                INSERT INTO tax_form_log (employer_id, form_type, tax_year, generated_at, file_path)
                VALUES (?, 'W3', ?, datetime('now'), ?)
            `).run(employer.id, year, filePath);

            logger.info(`W-3 generated (${year})`, { path: filePath });
            return { success: true, filePath };
        } catch (err: any) {
            logger.error('W-3 generation failed', { error: err.message });
            return { success: false, error: err.message };
        }
    });

    // ── Shell — open URLs in default browser ─────────────────────────────────
    ipcMain.handle('shell:openExternal', (_event, url: string) => {
        // Whitelist only known-safe domains
        const allowed = ['https://www.ssa.gov/', 'https://ssa.gov/', 'https://www.irs.gov/', 'https://tax.colorado.gov/'];
        if (!allowed.some(prefix => url.startsWith(prefix))) {
            logger.warn('Blocked shell:openExternal for unrecognized URL', { url });
            return { success: false, error: 'URL not in allowlist' };
        }
        shell.openExternal(url);
        return { success: true };
    });

    logger.info('IPC handlers registered');
}
