/**
 * IPC Handlers - Main process handlers for database operations
 * All database access happens here, renderer communicates via IPC
 */

import { ipcMain, dialog } from 'electron';
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

    logger.info('IPC handlers registered');
}
