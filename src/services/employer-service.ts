/**
 * EmployerService - Manages employer profile operations
 */

import { getDatabase, encrypt, decrypt } from '../database/db';
import { AuditService } from './audit-service';

export interface Employer {
    id: number;
    displayName: string;
    childName?: string;
    ssnOrEin: string;
    payFrequency: 'weekly' | 'bi-weekly' | 'monthly';
    defaultHourlyRate: number;
    federalWithholdingEnabled: boolean;
    coloradoSutaRate: number;
    holidayPayMultiplier: number;
    weekendPayMultiplier: number;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    paystubTitle?: string;
    serviceAddress?: string;
    stripePublishableKey?: string;
    stripeSecretKey?: string;
    stripeAccountId?: string;
    paymentVerificationStatus?: 'none' | 'pending' | 'verified';
    maskedFundingAccount?: string;
    fein?: string;
    uiAccountNumber?: string;
    suiWageBase: number;
    suiEffectiveDate?: string;
    wcAcknowledged: boolean;
    wcCarrier?: string;
    wcPolicyNumber?: string;
    wcAcknowledgmentDate?: string;
    coloradoFamliRateEE: number;
    coloradoFamliRateER: number;
    isActive: boolean;
    createdAt: string;
}

export class EmployerService {
    /**
     * Check if employer profile exists
     */
    static hasEmployerProfile(): boolean {
        const db = getDatabase();
        const result = db.prepare('SELECT COUNT(*) as count FROM employers').get() as { count: number };
        return result.count > 0;
    }

    /**
     * Create employer profile
     */
    static createEmployer(data: {
        displayName: string;
        childName?: string;
        ssnOrEin: string;
        payFrequency: 'weekly' | 'bi-weekly' | 'monthly';
        defaultHourlyRate: number;
        federalWithholdingEnabled: boolean;
        coloradoSutaRate: number;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        zip?: string;
        paystubTitle?: string;
        serviceAddress?: string;
    }): Employer {
        const db = getDatabase();

        // Encrypt SSN/EIN
        const ssnOrEinEncrypted = encrypt(data.ssnOrEin);

        const result = db.prepare(`
      INSERT INTO employers (
        display_name, child_name, ssn_or_ein_encrypted, pay_frequency, 
        default_hourly_rate, federal_withholding_enabled, colorado_suta_rate,
        address_line1, address_line2, city, state, zip, paystub_title, service_address, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            data.displayName,
            data.childName || null,
            ssnOrEinEncrypted,
            data.payFrequency,
            data.defaultHourlyRate,
            data.federalWithholdingEnabled ? 1 : 0,
            data.coloradoSutaRate,
            data.addressLine1 || null,
            data.addressLine2 || null,
            data.city || null,
            data.state || null,
            data.zip || null,
            data.paystubTitle || null,
            data.serviceAddress || null,
            0 // New employers not active by default if others exist
        );

        const employer = this.getEmployer()!;

        // Log audit
        AuditService.log({
            tableName: 'employers',
            recordId: employer.id,
            action: 'CREATE',
            changesJson: JSON.stringify(data)
        });

        return employer;
    }

    /**
     * Get the currently active employer profile
     */
    static getEmployer(): Employer | null {
        const db = getDatabase();
        const row = db.prepare('SELECT * FROM employers WHERE is_active = 1 LIMIT 1').get() as any;

        if (!row) {
            // Fallback to first if none active
            const first = db.prepare('SELECT * FROM employers ORDER BY id ASC LIMIT 1').get() as any;
            if (first) {
                db.prepare('UPDATE employers SET is_active = 1 WHERE id = ?').run(first.id);
                return this.mapRowToEmployer(first);
            }
            return null;
        }

        return this.mapRowToEmployer(row);
    }

    /**
     * Get all employer profiles
     */
    static getAllEmployers(): Employer[] {
        const db = getDatabase();
        const rows = db.prepare('SELECT * FROM employers ORDER BY display_name ASC').all() as any[];
        return rows.map(row => this.mapRowToEmployer(row));
    }

    /**
     * Set the active employer profile
     */
    static setActiveEmployer(id: number): void {
        const db = getDatabase();
        db.transaction(() => {
            db.prepare('UPDATE employers SET is_active = 0').run();
            db.prepare('UPDATE employers SET is_active = 1 WHERE id = ?').run(id);
        })();
    }

    private static mapRowToEmployer(row: any): Employer {
        return {
            id: row.id,
            displayName: row.display_name,
            childName: row.child_name || undefined,
            ssnOrEin: decrypt(row.ssn_or_ein_encrypted),
            payFrequency: row.pay_frequency,
            defaultHourlyRate: row.default_hourly_rate,
            federalWithholdingEnabled: row.federal_withholding_enabled === 1,
            coloradoSutaRate: row.colorado_suta_rate,
            holidayPayMultiplier: row.holiday_pay_multiplier || 1.0,
            weekendPayMultiplier: row.weekend_pay_multiplier || 1.0,
            addressLine1: row.address_line1,
            addressLine2: row.address_line2,
            city: row.city,
            state: row.state,
            zip: row.zip,
            paystubTitle: row.paystub_title,
            serviceAddress: row.service_address,
            stripePublishableKey: row.stripe_publishable_key_enc ? decrypt(row.stripe_publishable_key_enc) : undefined,
            stripeSecretKey: row.stripe_secret_key_enc ? decrypt(row.stripe_secret_key_enc) : undefined,
            stripeAccountId: row.stripe_account_id_enc ? decrypt(row.stripe_account_id_enc) : undefined,
            paymentVerificationStatus: row.payment_verification_status || 'none',
            maskedFundingAccount: row.masked_funding_account,
            fein: row.fein_enc ? decrypt(row.fein_enc) : undefined,
            uiAccountNumber: row.ui_account_number_enc ? decrypt(row.ui_account_number_enc) : undefined,
            suiWageBase: row.sui_wage_base || 16000.0,
            suiEffectiveDate: row.sui_effective_date,
            wcAcknowledged: row.wc_acknowledged === 1,
            wcCarrier: row.wc_carrier_enc ? decrypt(row.wc_carrier_enc) : undefined,
            wcPolicyNumber: row.wc_policy_number_enc ? decrypt(row.wc_policy_number_enc) : undefined,
            wcAcknowledgmentDate: row.wc_acknowledgment_date,
            coloradoFamliRateEE: row.colorado_famli_rate_ee || 0.0045,
            coloradoFamliRateER: row.colorado_famli_rate_er || 0.0045,
            isActive: row.is_active === 1,
            createdAt: row.created_at,
        };
    }

    /**
     * Update employer profile
     */
    static updateEmployer(data: {
        displayName?: string;
        childName?: string;
        ssnOrEin?: string;
        payFrequency?: 'weekly' | 'bi-weekly' | 'monthly';
        defaultHourlyRate?: number;
        federalWithholdingEnabled?: boolean;
        coloradoSutaRate?: number;
        holidayPayMultiplier?: number;
        weekendPayMultiplier?: number;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        zip?: string;
        paystubTitle?: string;
        serviceAddress?: string;
        stripePublishableKey?: string;
        stripeSecretKey?: string;
        stripeAccountId?: string;
        paymentVerificationStatus?: 'none' | 'pending' | 'verified';
        maskedFundingAccount?: string;
        fein?: string;
        uiAccountNumber?: string;
        suiWageBase?: number;
        suiEffectiveDate?: string;
        wcAcknowledged?: boolean;
        wcCarrier?: string;
        wcPolicyNumber?: string;
        wcAcknowledgmentDate?: string;
        coloradoFamliRateEE?: number;
        coloradoFamliRateER?: number;
    }): Employer {
        const db = getDatabase();
        const current = this.getEmployer();

        if (!current) {
            throw new Error('No employer profile found');
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (data.displayName !== undefined) {
            updates.push('display_name = ?');
            values.push(data.displayName);
        }
        if (data.ssnOrEin !== undefined) {
            updates.push('ssn_or_ein_encrypted = ?');
            values.push(encrypt(data.ssnOrEin));
        }
        if (data.childName !== undefined) {
            updates.push('child_name = ?');
            values.push(data.childName);
        }
        if (data.payFrequency !== undefined) {
            updates.push('pay_frequency = ?');
            values.push(data.payFrequency);
        }
        if (data.defaultHourlyRate !== undefined) {
            updates.push('default_hourly_rate = ?');
            values.push(data.defaultHourlyRate);
        }
        if (data.federalWithholdingEnabled !== undefined) {
            updates.push('federal_withholding_enabled = ?');
            values.push(data.federalWithholdingEnabled ? 1 : 0);
        }
        if (data.coloradoSutaRate !== undefined) {
            updates.push('colorado_suta_rate = ?');
            values.push(data.coloradoSutaRate);
        }
        if (data.holidayPayMultiplier !== undefined) {
            updates.push('holiday_pay_multiplier = ?');
            values.push(data.holidayPayMultiplier);
        }
        if (data.weekendPayMultiplier !== undefined) {
            updates.push('weekend_pay_multiplier = ?');
            values.push(data.weekendPayMultiplier);
        }
        if (data.addressLine1 !== undefined) {
            updates.push('address_line1 = ?');
            values.push(data.addressLine1);
        }
        if (data.addressLine2 !== undefined) {
            updates.push('address_line2 = ?');
            values.push(data.addressLine2);
        }
        if (data.city !== undefined) {
            updates.push('city = ?');
            values.push(data.city);
        }
        if (data.state !== undefined) {
            updates.push('state = ?');
            values.push(data.state);
        }
        if (data.zip !== undefined) {
            updates.push('zip = ?');
            values.push(data.zip);
        }
        if (data.paystubTitle !== undefined) {
            updates.push('paystub_title = ?');
            values.push(data.paystubTitle);
        }
        if (data.serviceAddress !== undefined) {
            updates.push('service_address = ?');
            values.push(data.serviceAddress);
        }
        if (data.stripePublishableKey !== undefined) {
            updates.push('stripe_publishable_key_enc = ?');
            values.push(data.stripePublishableKey ? encrypt(data.stripePublishableKey) : null);
        }
        if (data.stripeSecretKey !== undefined) {
            updates.push('stripe_secret_key_enc = ?');
            values.push(data.stripeSecretKey ? encrypt(data.stripeSecretKey) : null);
        }
        if (data.stripeAccountId !== undefined) {
            updates.push('stripe_account_id_enc = ?');
            values.push(data.stripeAccountId ? encrypt(data.stripeAccountId) : null);
        }
        if (data.paymentVerificationStatus !== undefined) {
            updates.push('payment_verification_status = ?');
            values.push(data.paymentVerificationStatus);
        }
        if (data.maskedFundingAccount !== undefined) {
            updates.push('masked_funding_account = ?');
            values.push(data.maskedFundingAccount);
        }
        if (data.fein !== undefined) {
            updates.push('fein_enc = ?');
            values.push(data.fein ? encrypt(data.fein) : null);
        }
        if (data.uiAccountNumber !== undefined) {
            updates.push('ui_account_number_enc = ?');
            values.push(data.uiAccountNumber ? encrypt(data.uiAccountNumber) : null);
        }
        if (data.suiWageBase !== undefined) {
            updates.push('sui_wage_base = ?');
            values.push(data.suiWageBase);
        }
        if (data.suiEffectiveDate !== undefined) {
            updates.push('sui_effective_date = ?');
            values.push(data.suiEffectiveDate);
        }
        if (data.wcAcknowledged !== undefined) {
            updates.push('wc_acknowledged = ?');
            values.push(data.wcAcknowledged ? 1 : 0);
        }
        if (data.wcCarrier !== undefined) {
            updates.push('wc_carrier_enc = ?');
            values.push(data.wcCarrier ? encrypt(data.wcCarrier) : null);
        }
        if (data.wcPolicyNumber !== undefined) {
            updates.push('wc_policy_number_enc = ?');
            values.push(data.wcPolicyNumber ? encrypt(data.wcPolicyNumber) : null);
        }
        if (data.wcAcknowledgmentDate !== undefined) {
            updates.push('wc_acknowledgment_date = ?');
            values.push(data.wcAcknowledgmentDate);
        }
        if (data.coloradoFamliRateEE !== undefined) {
            updates.push('colorado_famli_rate_ee = ?');
            values.push(data.coloradoFamliRateEE);
        }
        if (data.coloradoFamliRateER !== undefined) {
            updates.push('colorado_famli_rate_er = ?');
            values.push(data.coloradoFamliRateER);
        }

        if (updates.length === 0) {
            return current;
        }

        values.push(current.id);

        db.prepare(`
      UPDATE employers SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

        const employer = this.getEmployer()!;

        // Log audit
        AuditService.log({
            tableName: 'employers',
            recordId: employer.id,
            action: 'UPDATE',
            changesJson: JSON.stringify(data)
        });

        return employer;
    }

    /**
     * Delete an employer profile (and all associated data)
     */
    static deleteEmployer(id: number): void {
        const db = getDatabase();
        db.transaction(() => {
            db.prepare('DELETE FROM payroll_records WHERE employer_id = ?').run(id);
            db.prepare('DELETE FROM time_entries WHERE employer_id = ?').run(id);
            db.prepare('DELETE FROM caregivers WHERE employer_id = ?').run(id);
            db.prepare('DELETE FROM audit_log WHERE employer_id = ?').run(id);
            db.prepare('DELETE FROM employers WHERE id = ?').run(id);
        })();
    }
}
