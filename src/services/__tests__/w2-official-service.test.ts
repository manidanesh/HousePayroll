import { W2OfficialService } from '../w2-official-service';
import { PDFDocument } from 'pdf-lib';
import * as DBCode from '../../database/db';

const { getDatabase, resetTestDatabase } = DBCode as any;

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '/tmp/mock'), isPackaged: false } }));
jest.mock('../../database/db');

describe('W2OfficialService (official IRS form overlay)', () => {
    let employerId: number;
    let caregiverId: number;

    beforeEach(() => {
        resetTestDatabase();
        const db = getDatabase();
        const e = db.prepare(
            `INSERT INTO employers
                (display_name, ssn_or_ein_encrypted, pay_frequency, default_hourly_rate,
                 ui_account_number_enc, is_active, address_line1, city, state, zip)
             VALUES ('Test Household', 'enc:12-3456789', 'weekly', 20, 'enc:06327814', 1, '123 Main St', 'Denver', 'CO', '80202')`
        ).run();
        employerId = e.lastInsertRowid as number;
        const c = db.prepare(
            `INSERT INTO caregivers
                (full_legal_name, ssn_encrypted, hourly_rate, is_active, employer_id, address_line1, city, state, zip)
             VALUES ('Mary Q Poppins', 'enc:123-00-1234', 20, 1, ?, '456 Oak Ave', 'Denver', 'CO', '80203')`
        ).run(employerId);
        caregiverId = c.lastInsertRowid as number;

        // Finalized 2026 payroll record so getYTDSummary returns data.
        db.prepare(
            `INSERT INTO payroll_records
                (caregiver_id, employer_id, pay_period_start, pay_period_end, total_hours,
                 gross_wages, net_pay, ss_employee, medicare_employee, federal_withholding,
                 ss_employer, medicare_employer, futa, colorado_suta,
                 colorado_famli_employee, colorado_famli_employer, colorado_state_income_tax,
                 calculation_version, tax_version, is_finalized, is_voided)
             VALUES (?, ?, '2026-06-01', '2026-06-30', 100,
                     10000, 8800, 620, 145, 500,
                     620, 145, 60, 170,
                     44, 44, 440,
                     'v1', 't1', 1, 0)`
        ).run(caregiverId, employerId);
    });

    it('generates the official W-2 PDF, passes the mapping self-check, and embeds the SSN/EIN', async () => {
        const caregiver = {
            id: caregiverId, fullLegalName: 'Mary Q Poppins', ssn: '123-00-1234',
            addressLine1: '456 Oak Ave', city: 'Denver', state: 'CO', zip: '80203'
        } as any;
        const employer = {
            id: employerId, displayName: 'Test Household', ssnOrEin: '12-3456789',
            uiAccountNumber: '06327814', addressLine1: '123 Main St', city: 'Denver', state: 'CO', zip: '80202'
        } as any;

        // generateW2Buffer throws if the box->field mapping self-check fails.
        const buf = await W2OfficialService.generateW2Buffer(2026, caregiver, employer);

        expect(buf).toBeInstanceOf(Buffer);
        expect(buf.slice(0, 5).toString()).toBe('%PDF-');

        // Re-open the produced PDF and confirm the SSN landed in CopyA_Top's Box a field,
        // and the wages in Box 1 — proving the values were placed in the correct official fields.
        const doc = await PDFDocument.load(buf);
        const form = doc.getForm();
        const fields = form.getFields();
        const boxA = fields.find(f => f.getName().includes('CopyA_Top') && f.getName().includes('BoxA_ReadOrder'));
        const box1 = fields.find(f => f.getName().includes('CopyA_Top') && f.getName().includes('Box1_ReadOrder'));
        expect(boxA).toBeTruthy();
        expect(box1).toBeTruthy();
        expect((boxA as any).getText()).toBe('123-00-1234');
        expect((box1 as any).getText()).toBe('10000.00');
    });
});
