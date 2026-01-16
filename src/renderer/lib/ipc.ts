/**
 * IPC API - Renderer-side wrapper for IPC communication
 * Provides type-safe API for calling main process functions
 * 
 * SECURITY: Uses window.electronAPI exposed via preload script
 * instead of direct electron access for better security.
 */

import { CreateEmployerInput, UpdateEmployerInput, Employer, CreateCaregiverInput, UpdateCaregiverInput, Caregiver, CreateTimeEntryInput, TimeEntry, PayrollCalculationInput, PayrollCalculationResult, PayrollRecord, CreatePaymentInput, Payment } from '../../types';

// Type definition for the electronAPI exposed by preload
declare global {
    interface Window {
        electronAPI: {
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            on: (channel: string, callback: (event: any, ...args: any[]) => void) => () => void;
        };
        versions: {
            node: string;
            chrome: string;
            electron: string;
        };
    }
}

// Use the secure electronAPI from preload script
const ipcRenderer = {
    invoke: window.electronAPI.invoke,
    on: window.electronAPI.on
};

export const ipcAPI = {
    // Auth
    auth: {
        isPinSet: (): Promise<boolean> => ipcRenderer.invoke('auth:isPinSet'),
        setPin: (pin: string): Promise<void> => ipcRenderer.invoke('auth:setPin', pin),
        verifyPin: (pin: string): Promise<boolean> => ipcRenderer.invoke('auth:verifyPin', pin),
    },

    // Employer
    employer: {
        has: (): Promise<boolean> => ipcRenderer.invoke('employer:has'),
        create: (data: CreateEmployerInput): Promise<Employer> => ipcRenderer.invoke('employer:create', data),
        get: (): Promise<Employer> => ipcRenderer.invoke('employer:get'),
        update: (data: UpdateEmployerInput): Promise<Employer> => ipcRenderer.invoke('employer:update', data),
        getAll: (): Promise<Employer[]> => ipcRenderer.invoke('employer:getAll'),
        setActive: (id: number): Promise<void> => ipcRenderer.invoke('employer:setActive', id),
        delete: (id: number): Promise<void> => ipcRenderer.invoke('employer:delete', id),
    },

    // Caregiver
    caregiver: {
        create: (data: CreateCaregiverInput): Promise<Caregiver> => ipcRenderer.invoke('caregiver:create', data),
        getAll: (includeInactive?: boolean): Promise<Caregiver[]> => ipcRenderer.invoke('caregiver:getAll', includeInactive),
        getById: (id: number): Promise<Caregiver> => ipcRenderer.invoke('caregiver:getById', id),
        update: (id: number, data: UpdateCaregiverInput): Promise<Caregiver> => ipcRenderer.invoke('caregiver:update', id, data),
        deactivate: (id: number): Promise<void> => ipcRenderer.invoke('caregiver:deactivate', id),
        reactivate: (id: number): Promise<void> => ipcRenderer.invoke('caregiver:reactivate', id),
        delete: (id: number): Promise<void> => ipcRenderer.invoke('caregiver:delete', id),
    },

    // Time Entry
    timeEntry: {
        create: (data: any): Promise<any> => ipcRenderer.invoke('timeEntry:create', data),
        getById: (id: number): Promise<any> => ipcRenderer.invoke('timeEntry:getById', id),
        getForDateRange: (startDate: string, endDate: string): Promise<any[]> =>
            ipcRenderer.invoke('timeEntry:getForDateRange', startDate, endDate),
        getForCaregiver: (caregiverId: number, startDate?: string, endDate?: string): Promise<any[]> =>
            ipcRenderer.invoke('timeEntry:getForCaregiver', caregiverId, startDate, endDate),
        getForDate: (date: string): Promise<any[]> => ipcRenderer.invoke('timeEntry:getForDate', date),
        update: (id: number, hoursWorked: number): Promise<any> =>
            ipcRenderer.invoke('timeEntry:update', id, hoursWorked),
        delete: (id: number): Promise<void> => ipcRenderer.invoke('timeEntry:delete', id),
        getTotalHours: (caregiverId: number, startDate: string, endDate: string): Promise<number> =>
            ipcRenderer.invoke('timeEntry:getTotalHours', caregiverId, startDate, endDate),
    },

    // Payroll
    payroll: {
        calculate: (input: any): Promise<any> =>
            ipcRenderer.invoke('payroll:calculate', input),
        preview: (input: any): Promise<any> =>
            ipcRenderer.invoke('payroll:preview', input),
        saveDraft: (result: any, periodStart: string, periodEnd: string): Promise<any> =>
            ipcRenderer.invoke('payroll:saveDraft', result, periodStart, periodEnd),
        approve: (draftId: number): Promise<any> =>
            ipcRenderer.invoke('payroll:approve', draftId),
        deleteDraft: (draftId: number): Promise<void> =>
            ipcRenderer.invoke('payroll:deleteDraft', draftId),
        getDrafts: (): Promise<any[]> =>
            ipcRenderer.invoke('payroll:getDrafts'),
        create: (result: any, start: string, end: string): Promise<any> =>
            ipcRenderer.invoke('payroll:create', result, start, end),
        getById: (id: number): Promise<any> => ipcRenderer.invoke('payroll:getById', id),
        getYTDWages: (caregiverId: number, year: number): Promise<number> =>
            ipcRenderer.invoke('payroll:getYTDWages', caregiverId, year),
        getLastFinalizedDate: (caregiverId: number): Promise<string | null> =>
            ipcRenderer.invoke('payroll:getLastFinalizedDate', caregiverId),
        checkOverlap: (caregiverId: number, startDate: string, endDate: string): Promise<any[]> =>
            ipcRenderer.invoke('payroll:checkOverlap', caregiverId, startDate, endDate),
        finalize: (id: number, checkNumber: string, paymentDate: string, pdfData?: Uint8Array, isLatePayment?: boolean, paymentMethod?: string, checkBankName?: string, checkAccountOwner?: string): Promise<void> =>
            ipcRenderer.invoke('payroll:finalize', id, checkNumber, paymentDate, pdfData, isLatePayment, paymentMethod, checkBankName, checkAccountOwner),
        checkDuplicateCheckNumber: (checkNumber: string, excludeRecordId?: number): Promise<boolean> =>
            ipcRenderer.invoke('payroll:checkDuplicateCheckNumber', checkNumber, excludeRecordId),
        void: (id: number, reason: string): Promise<void> =>
            ipcRenderer.invoke('payroll:void', id, reason),
        getPaystubContext: (recordId: number): Promise<any> =>
            ipcRenderer.invoke('payroll:getPaystubContext', recordId),
        getYTDContext: (caregiverId: number, year: number): Promise<any> =>
            ipcRenderer.invoke('payroll:getYTDContext', caregiverId, year),
        getHistory: (): Promise<any[]> =>
            ipcRenderer.invoke('payroll:getHistory'),
    },

    // Reports
    reports: {
        getYTDSummary: (year: number, caregiverId?: number): Promise<any[]> => ipcRenderer.invoke('report:getYTD', year, caregiverId),
        getTaxCapStatus: (year: number, caregiverId?: number): Promise<any[]> => ipcRenderer.invoke('report:getTaxCaps', year, caregiverId),
        getRecentPayments: (limit?: number, caregiverId?: number): Promise<any[]> => ipcRenderer.invoke('report:getRecent', limit, caregiverId),
        exportW2CSV: (year: number): Promise<void> => ipcRenderer.invoke('report:exportW2', year),
        exportYearEnd: (year: number): Promise<{ success: boolean, path?: string }> => ipcRenderer.invoke('report:exportYearEnd', year),
        exportScheduleH: (year: number): Promise<{ success: boolean, path?: string }> => ipcRenderer.invoke('report:exportScheduleH', year),
        getScheduleHData: (year: number): Promise<any> => ipcRenderer.invoke('report:getScheduleHData', year),
        getTrends: (year: number, caregiverId?: number): Promise<any[]> => ipcRenderer.invoke('report:getTrends', year, caregiverId),
        getPayments: (limit?: number, caregiverId?: number): Promise<any[]> => ipcRenderer.invoke('report:getPayments', limit, caregiverId),
    },
    // Audit
    audit: {
        getAll: (): Promise<any[]> => ipcRenderer.invoke('audit:getAll'),
    },
    // Backup
    backup: {
        export: (): Promise<{ success: boolean, path?: string }> => ipcRenderer.invoke('backup:export'),
        import: (): Promise<{ success: boolean }> => ipcRenderer.invoke('backup:import'),
        exportEncrypted: (password: string): Promise<{ success: boolean, path?: string, error?: string }> =>
            ipcRenderer.invoke('backup:export-encrypted', password),
        importEncrypted: (password: string): Promise<{ success: boolean, error?: string }> =>
            ipcRenderer.invoke('backup:import-encrypted', password),
        validatePassword: (password: string): Promise<{ valid: boolean, error?: string }> =>
            ipcRenderer.invoke('backup:validate-password', password),
        passwordStrength: (password: string): Promise<number> =>
            ipcRenderer.invoke('backup:password-strength', password),
    },

    // Colorado Tax
    tax: {
        getQuarterlyData: (year: number, quarter: number): Promise<any[]> =>
            ipcRenderer.invoke('tax:getQuarterlyData', year, quarter),
        exportSUI: (year: number, quarter: number, ean: string): Promise<{ success: boolean, path?: string }> =>
            ipcRenderer.invoke('tax:exportSUI', year, quarter, ean),
        exportFAMLI: (year: number, quarter: number): Promise<{ success: boolean, path?: string }> =>
            ipcRenderer.invoke('tax:exportFAMLI', year, quarter),
        generateW2: (year: number, caregiverId: number): Promise<{ success: boolean, path?: string }> =>
            ipcRenderer.invoke('tax:generateW2', year, caregiverId),
    },
    // System
    system: {
        promptSaveFile: (defaultName: string, data: Uint8Array): Promise<{ success: boolean; path?: string }> =>
            ipcRenderer.invoke('system:promptSaveFile', defaultName, data),
        on: (channel: string, callback: (event: any, ...args: any[]) => void) => ipcRenderer.on(channel, callback),
    },
    // Stripe
    stripe: {
        addBankAccount: (caregiverId: number, routing: string, account: string): Promise<any> =>
            ipcRenderer.invoke('stripe:addBankAccount', caregiverId, routing, account),
        resetClient: (): Promise<void> => ipcRenderer.invoke('stripe:resetClient'),
    },
    // Payment
    payment: {
        create: (data: any): Promise<any> => ipcRenderer.invoke('payment:create', data),
        getHistory: (limit?: number, caregiverId?: number): Promise<any[]> => ipcRenderer.invoke('payment:getHistory', limit, caregiverId),
        processStripe: (paymentId: number): Promise<{ success: boolean, stripeId: string }> =>
            ipcRenderer.invoke('payment:processStripe', paymentId),
        getTransactionHistory: (limit?: number, caregiverId?: number): Promise<any[]> =>
            ipcRenderer.invoke('payment:getTransactionHistory', limit, caregiverId),
    },

    // Tax Configuration
    taxConfig: {
        getForYear: (year: number): Promise<any> => ipcRenderer.invoke('taxConfig:getForYear', year),
        getAll: (): Promise<any[]> => ipcRenderer.invoke('taxConfig:getAll'),
        upsert: (config: any): Promise<any> => ipcRenderer.invoke('taxConfig:upsert', config),
    },

    // Database utilities
    database: {
        cleanupCaregivers: (): Promise<{ success: boolean; message: string; deletedCounts: any }> =>
            ipcRenderer.invoke('database:cleanup:caregivers'),
        getStats: (): Promise<any> =>
            ipcRenderer.invoke('database:stats'),
    },
};
