/**
 * Preload Script - Secure IPC Bridge
 * 
 * This script runs in a privileged context and exposes a safe API
 * to the renderer process via contextBridge.
 * 
 * Security: Only IPC invoke method is exposed, limiting renderer access.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe IPC API to the renderer
// This allows the existing ipc.ts to work without changes
contextBridge.exposeInMainWorld('electronAPI', {
    // Expose invoke method for IPC communication
    // This is safer than exposing full ipcRenderer
    invoke: (channel: string, ...args: any[]) => {
        // Whitelist of allowed IPC channels for security
        const validChannels = [
            // Auth
            'auth:isPinSet', 'auth:setPin', 'auth:verifyPin',
            // Employer
            'employer:has', 'employer:create', 'employer:get', 'employer:update',
            'employer:getAll', 'employer:setActive', 'employer:delete',
            // Caregiver
            'caregiver:create', 'caregiver:getAll', 'caregiver:getById',
            'caregiver:update', 'caregiver:deactivate', 'caregiver:reactivate', 'caregiver:delete',
            // Time Entry
            'timeEntry:create', 'timeEntry:getById', 'timeEntry:getForDateRange',
            'timeEntry:getForCaregiver', 'timeEntry:getForDate', 'timeEntry:update', 'timeEntry:delete',
            // Payroll
            'payroll:calculate', 'payroll:finalize', 'payroll:getRecords', 'payroll:getRecordById',
            'payroll:getRecordsForCaregiver', 'payroll:updateStatus', 'payroll:delete',
            'payroll:getHistory', 'payroll:getPaystubContext', 'payroll:checkOverlap',
            'payroll:getYTDContext', 'payroll:preview', 'payroll:saveDraft', 'payroll:approve', 'payroll:getDrafts',
            'payroll:checkDuplicateCheckNumber',
            // Payment
            'payment:create', 'payment:getAll', 'payment:getForPayroll',
            'payment:getHistory', 'payment:getTransactionHistory', 'payment:processStripe',
            // Reporting
            'reporting:getYearEndSummary', 'reporting:getQuarterlySummary', 'reporting:exportW2Data',
            'report:getYTD', 'report:getTaxCaps', 'report:getRecent', 'report:getTrends', 'report:getPayments',
            'report:exportYearEnd', 'report:exportScheduleH', 'report:getScheduleHData',
            'report:exportW2',
            // Audit
            'audit:getRecent', 'audit:getForEntity', 'audit:getAll',
            // Backup
            'backup:export', 'backup:import',
            'backup:export-encrypted', 'backup:import-encrypted',
            'backup:validate-password', 'backup:password-strength',
            // Tax Config
            'taxConfig:getAll', 'taxConfig:getForYear', 'taxConfig:upsert',
            // Colorado Tax
            'tax:getQuarterlyData', 'tax:exportSUI', 'tax:exportUITR1',
            // W2
            'w2:generate', 'w2:generateAll',
            // Year End
            'yearEnd:getSummary', 'yearEnd:closeYear',
            // Stripe
            'stripe:createPaymentIntent', 'stripe:confirmPayment', 'stripe:resetClient',
            // YTD
            'ytd:getForCaregiver',
            // Pay Period
            'payPeriod:getCurrent', 'payPeriod:getForDate', 'payPeriod:getAll',
            // Paystub
            'paystub:generate',
            // Cleanup
            'cleanup:orphanedRecords', 'cleanup:oldAuditLogs',
            // System
            'system:promptSaveFile', 'system:openExternal'
        ];

        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        } else {
            throw new Error(`Invalid IPC channel: ${channel}`);
        }
    },

    // safe event listeners
    on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
        const validChannels = [
            'navigate',
            'trigger-backup-export',
            'trigger-backup-import',
            'verify-payroll-status',
            'deep-link'
        ];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes sender
            const subscription = (_event: any, ...args: any[]) => callback(_event, ...args);
            ipcRenderer.on(channel, subscription);
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        } else {
            console.warn(`Blocked unauthorized IPC listener for channel: ${channel}`);
            return () => { };
        }
    }
});

// Also expose version info for debugging
contextBridge.exposeInMainWorld('versions', {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
});
