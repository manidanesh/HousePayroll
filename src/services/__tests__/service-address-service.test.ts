import { ServiceAddressService } from '../service-address-service';
import * as DBCode from '../../database/db';

const { getDatabase, resetTestDatabase } = DBCode as any;

jest.mock('../../database/db');

describe('ServiceAddressService', () => {
    let employerId: number;
    let caregiverId: number;

    beforeEach(() => {
        resetTestDatabase();
        const db = getDatabase();
        const empRes = db.prepare(
            `INSERT INTO employers
                (display_name, ssn_or_ein_encrypted, pay_frequency, default_hourly_rate, state, is_active)
             VALUES ('Test HH', 'enc:12-3456789', 'weekly', 20, 'CO', 1)`
        ).run();
        employerId = empRes.lastInsertRowid as number;
        const cgRes = db.prepare(
            `INSERT INTO caregivers (full_legal_name, ssn_encrypted, hourly_rate, is_active, employer_id)
             VALUES ('Mary Poppins', 'enc:123-00-1234', 20, 1, ?)`
        ).run(employerId);
        caregiverId = cgRes.lastInsertRowid as number;
    });

    it('creates an initial version and resolves it by date', () => {
        ServiceAddressService.changeAddress({
            caregiverId, addressLine1: '123 Main St', city: 'Denver', state: 'CO', zip: '80202', effectiveDate: '2026-01-01'
        });
        const addr = ServiceAddressService.getAddressForDate(caregiverId, '2026-03-15');
        expect(addr).not.toBeNull();
        expect(addr!.addressLine1).toBe('123 Main St');
    });

    it('ends the previous version and activates the new one on the effective date (FR-06)', () => {
        ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'A St', city: 'Denver', state: 'CO', zip: '80201', effectiveDate: '2026-01-01' });
        ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'B St', city: 'Aurora', state: 'CO', zip: '80012', effectiveDate: '2026-07-01' });

        const before = ServiceAddressService.getAddressForDate(caregiverId, '2026-05-01');
        const after = ServiceAddressService.getAddressForDate(caregiverId, '2026-09-01');
        expect(before!.addressLine1).toBe('A St');
        expect(after!.addressLine1).toBe('B St');

        const history = ServiceAddressService.getAddressHistory(caregiverId);
        expect(history.length).toBe(2);
        const oldVersion = history.find(h => h.addressLine1 === 'A St');
        expect(oldVersion!.effectiveEnd).toBe('2026-06-30');
        const newVersion = history.find(h => h.addressLine1 === 'B St');
        expect(newVersion!.effectiveEnd).toBeNull();
    });

    it('prevents overlapping/duplicate effective dates (FR-10)', () => {
        ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'A St', city: 'Denver', state: 'CO', zip: '80201', effectiveDate: '2026-01-01' });
        expect(() =>
            ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'C St', city: 'Denver', state: 'CO', zip: '80203', effectiveDate: '2026-01-01' })
        ).toThrow();
    });

    it('a backdated change splits the existing period without overlap (FR-10)', () => {
        ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'A St', city: 'Denver', state: 'CO', zip: '80201', effectiveDate: '2026-01-01' });
        // Backdate a new address to mid-period.
        ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'B St', city: 'Aurora', state: 'CO', zip: '80012', effectiveDate: '2026-03-01' });

        expect(ServiceAddressService.getAddressForDate(caregiverId, '2026-02-15')!.addressLine1).toBe('A St');
        expect(ServiceAddressService.getAddressForDate(caregiverId, '2026-04-01')!.addressLine1).toBe('B St');

        const history = ServiceAddressService.getAddressHistory(caregiverId);
        const oldVersion = history.find(h => h.addressLine1 === 'A St');
        expect(oldVersion!.effectiveEnd).toBe('2026-02-28'); // ended the day before the backdated version
    });

    it('audit-logs each change as SERVICE_ADDRESS_CHANGED atomically (FR-08)', () => {
        ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'A St', city: 'Denver', state: 'CO', zip: '80201', effectiveDate: '2026-01-01' });
        const db = getDatabase();
        const rows = db.prepare("SELECT action FROM audit_log WHERE table_name = 'service_addresses'").all() as { action: string }[];
        expect(rows.some(r => r.action === 'SERVICE_ADDRESS_CHANGED')).toBe(true);
    });

    it('validates required address fields (FR-10)', () => {
        expect(() => ServiceAddressService.changeAddress({ caregiverId, addressLine1: '', city: 'Denver', state: 'CO', zip: '80201', effectiveDate: '2026-01-01' })).toThrow();
        expect(() => ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'X', city: '', state: 'CO', zip: '80201', effectiveDate: '2026-01-01' })).toThrow();
        expect(() => ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'X', city: 'Denver', state: 'CO', zip: '80201', effectiveDate: '' } as any)).toThrow();
    });

    it('rolls back the whole change if the audit write fails (FR-08 atomicity)', () => {
        const db = getDatabase();
        // Drop the audit_log table so the strict audit write inside the transaction fails.
        db.exec('DROP TABLE audit_log');

        expect(() =>
            ServiceAddressService.changeAddress({ caregiverId, addressLine1: 'A St', city: 'Denver', state: 'CO', zip: '80201', effectiveDate: '2026-01-01' })
        ).toThrow();
        // Recreate for any subsequent teardown; verify no address version was committed.
        db.exec(`CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT, record_id INTEGER, employer_id INTEGER, action TEXT, changes_json TEXT, calculation_version TEXT, actor TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        expect(ServiceAddressService.getAddressHistory(caregiverId).length).toBe(0);
    });
});
