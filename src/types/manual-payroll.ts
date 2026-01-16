// Manual Payroll Entry Types
export interface ManualPayrollInput {
    caregiverId: number;
    employerId: number;
    payPeriodStart: string;
    payPeriodEnd: string;
    description: string;
    grossAmount: number;
    paymentDate?: string;
}
