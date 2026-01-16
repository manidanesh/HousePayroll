import { container } from './container';
import { getDatabase } from '../database/db';
import { EmployerService } from '../services/employer-service';
import { CaregiverService } from '../services/caregiver-service';
import { PayPeriodService } from '../services/pay-period-service';
import { TaxConfigurationService } from '../services/tax-configuration-service';
import { ColoradoTaxService } from '../services/colorado-tax-service';
import { TimeEntryService } from '../services/time-entry-service';
import { PayrollService } from '../services/payroll-service';
import { PaymentService } from '../services/payment-service';
import { AuditService } from '../services/audit-service';
import { ReportingService } from '../services/reporting-service';
import { BackupService } from '../services/backup-service';

export function registerServices() {
    const db = getDatabase();

    container.register('EmployerService', new EmployerService(db));
    container.register('CaregiverService', new CaregiverService(db));
    container.register('PayPeriodService', new PayPeriodService(db));
    container.register('TaxConfigurationService', new TaxConfigurationService(db));
    container.register('ColoradoTaxService', new ColoradoTaxService(db));
    container.register('TimeEntryService', new TimeEntryService(db));
    container.register('PayrollService', new PayrollService(db));
    container.register('PaymentService', new PaymentService(db));
    container.register('AuditService', new AuditService(db));
    container.register('ReportingService', new ReportingService(db));
    container.register('BackupService', new BackupService(db));
}
