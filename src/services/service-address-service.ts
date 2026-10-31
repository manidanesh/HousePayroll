import { getDatabase } from '../database/db';
import { BaseRepository } from '../core/base-repository';
import { EmployerService } from './employer-service';
import { AuditService } from './audit-service';

export interface ServiceAddress {
    id: number;
    employerId: number;
    caregiverId: number;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    effectiveStart: string;
    effectiveEnd?: string | null;
    reason?: string;
    createdAt: string;
    createdBy?: string;
}

export interface CreateServiceAddressInput {
    caregiverId: number;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zip: string;
    effectiveDate: string;
    reason?: string;
    /** Single-user app; defaults to 'employer'. */
    actor?: string;
}

/**
 * Versioned service / work-location address history for a caregiver.
 *
 * The service/work address is distinct from the employer's mailing address and the
 * caregiver's residential address. Each change ends the previous version's effective
 * period and inserts a new version, with overlap prevention enforced inside a single
 * transaction that also writes an atomic `SERVICE_ADDRESS_CHANGED` audit event (FR-08).
 *
 * Historical finalized paystubs are protected by the immutable `service_address_snapshot`
 * on `payroll_records` (written at finalization), NOT by live resolution here — so a
 * backdated change can never silently alter a finalized paystub (FR-07, FR-10).
 */
export class ServiceAddressService extends BaseRepository<ServiceAddress> {
    create(): ServiceAddress { throw new Error('Use changeAddress'); }
    update(): ServiceAddress { throw new Error('Address versions are immutable; use changeAddress'); }
    delete(): void { throw new Error('Address versions are immutable'); }
    getById(id: number): ServiceAddress | null {
        const row = this.get<any>('SELECT * FROM service_addresses WHERE id = ?', [id]);
        return row ? this.mapRow(row) : null;
    }

    // Static compatibility layer
    static changeAddress(input: CreateServiceAddressInput): ServiceAddress {
        return new ServiceAddressService(getDatabase()).changeAddress(input);
    }
    static getAddressForDate(caregiverId: number, date: string): ServiceAddress | null {
        return new ServiceAddressService(getDatabase()).getAddressForDate(caregiverId, date);
    }
    static getCurrentAddress(caregiverId: number): ServiceAddress | null {
        return new ServiceAddressService(getDatabase()).getCurrentAddress(caregiverId);
    }
    static getAddressHistory(caregiverId: number): ServiceAddress[] {
        return new ServiceAddressService(getDatabase()).getAddressHistory(caregiverId);
    }
    static getAffectedDraftRecords(caregiverId: number, fromDate: string): { id: number; payPeriodStart: string; payPeriodEnd: string }[] {
        return new ServiceAddressService(getDatabase()).getAffectedDraftRecords(caregiverId, fromDate);
    }
    static formatAddress(addr: ServiceAddress | null): string {
        return new ServiceAddressService(getDatabase()).formatAddress(addr);
    }

    /**
     * Commit a new service-address version effective on `input.effectiveDate`.
     * Ends the previous version's period and bounds the new version by any future-dated
     * version, preventing overlaps. The write + audit are committed atomically.
     */
    changeAddress(input: CreateServiceAddressInput): ServiceAddress {
        // Validate required fields (FR-10).
        if (!input.caregiverId) throw new Error('Caregiver is required');
        if (!input.addressLine1?.trim()) throw new Error('Street Address Line 1 is required');
        if (!input.city?.trim()) throw new Error('City is required');
        if (!input.state?.trim()) throw new Error('State is required');
        if (!input.zip?.trim()) throw new Error('ZIP Code is required');
        if (!input.effectiveDate?.trim()) throw new Error('Effective date is required');

        const employer = EmployerService.getEmployer();
        if (!employer) throw new Error('No active employer found');

        const db = getDatabase();
        const actor = input.actor || 'employer';

        const tx = db.transaction(() => {
            // Prevent a duplicate effective-start date.
            const dup = this.get<{ id: number }>(
                'SELECT id FROM service_addresses WHERE caregiver_id = ? AND effective_start = ?',
                [input.caregiverId, input.effectiveDate]
            );
            if (dup) {
                throw new Error(`A service address version already exists effective on ${input.effectiveDate}`);
            }

            // The version active just before/at the new date, and the next future-dated version.
            const prev = this.get<any>(
                'SELECT * FROM service_addresses WHERE caregiver_id = ? AND effective_start <= ? ORDER BY effective_start DESC LIMIT 1',
                [input.caregiverId, input.effectiveDate]
            );
            const next = this.get<any>(
                'SELECT * FROM service_addresses WHERE caregiver_id = ? AND effective_start > ? ORDER BY effective_start ASC LIMIT 1',
                [input.caregiverId, input.effectiveDate]
            );

            const dayBefore = (d: string) => {
                const dt = new Date(d + 'T00:00:00Z');
                dt.setUTCDate(dt.getUTCDate() - 1);
                return dt.toISOString().slice(0, 10);
            };

            // End the previous version just before the new one takes effect (overlap prevention).
            if (prev && (prev.effective_end === null || prev.effective_end === undefined || prev.effective_end >= input.effectiveDate)) {
                this.run(
                    'UPDATE service_addresses SET effective_end = ? WHERE id = ?',
                    [dayBefore(input.effectiveDate), prev.id]
                );
            }

            // Bound the new version by the next future-dated version, if any.
            const newEffectiveEnd = next ? dayBefore(next.effective_start) : null;

            const res = this.run(
                `INSERT INTO service_addresses
                    (employer_id, caregiver_id, address_line1, address_line2, city, state, zip,
                     effective_start, effective_end, reason, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    employer.id, input.caregiverId,
                    input.addressLine1.trim(),
                    input.addressLine2?.trim() || null,
                    input.city.trim(),
                    input.state.trim(),
                    input.zip.trim(),
                    input.effectiveDate,
                    newEffectiveEnd,
                    input.reason?.trim() || null,
                    actor
                ]
            );

            const created = this.getById(res.lastInsertRowid as number)!;

            // Flag any draft payroll the backdated change would touch (FR-10) — finalized records
            // are protected by the snapshot and are intentionally NOT listed here.
            const affectedDrafts = this.getAffectedDraftRecords(input.caregiverId, input.effectiveDate);

            // Atomic audit event (FR-08). logStrict throws on failure so the whole change rolls back.
            AuditService.logStrict({
                tableName: 'service_addresses',
                recordId: created.id,
                action: 'SERVICE_ADDRESS_CHANGED',
                changesJson: JSON.stringify({
                    previous: prev ? this.mapRow(prev) : null,
                    new: created,
                    effectiveDate: input.effectiveDate,
                    reason: input.reason || null,
                    affectedDraftPayroll: affectedDrafts,
                }),
                actor,
            });

            return created;
        });

        return tx();
    }

    /** Resolve the address in effect on a given work/service date (nullable if none covers it). */
    getAddressForDate(caregiverId: number, date: string): ServiceAddress | null {
        const row = this.get<any>(
            `SELECT * FROM service_addresses
             WHERE caregiver_id = ? AND effective_start <= ?
               AND (effective_end IS NULL OR effective_end >= ?)
             ORDER BY effective_start DESC LIMIT 1`,
            [caregiverId, date, date]
        );
        return row ? this.mapRow(row) : null;
    }

    /** The currently active version (effective_end NULL, latest effective_start). */
    getCurrentAddress(caregiverId: number): ServiceAddress | null {
        const row = this.get<any>(
            `SELECT * FROM service_addresses
             WHERE caregiver_id = ? AND effective_end IS NULL
             ORDER BY effective_start DESC LIMIT 1`,
            [caregiverId]
        );
        return row ? this.mapRow(row) : null;
    }

    /** Full version history, newest first. */
    getAddressHistory(caregiverId: number): ServiceAddress[] {
        const rows = this.all<any>(
            'SELECT * FROM service_addresses WHERE caregiver_id = ? ORDER BY effective_start DESC',
            [caregiverId]
        );
        return rows.map(r => this.mapRow(r));
    }

    /**
     * Draft (non-finalized) payroll records for this caregiver whose period starts on/after
     * `fromDate` — i.e. those a backdated address change would affect. Finalized records are
     * excluded because they are protected by the immutable snapshot (FR-10).
     */
    getAffectedDraftRecords(caregiverId: number, fromDate: string): { id: number; payPeriodStart: string; payPeriodEnd: string }[] {
        const employer = EmployerService.getEmployer();
        if (!employer) return [];
        return this.all<any>(
            `SELECT id, pay_period_start, pay_period_end FROM payroll_records
             WHERE caregiver_id = ? AND employer_id = ? AND is_finalized = 0 AND is_voided = 0
               AND pay_period_start >= ?`,
            [caregiverId, employer.id, fromDate]
        ).map(r => ({ id: r.id, payPeriodStart: r.pay_period_start, payPeriodEnd: r.pay_period_end }));
    }

    /** Format a versioned address as the single-line string shown on paystubs. */
    formatAddress(addr: ServiceAddress | null): string {
        if (!addr) return '';
        return [
            addr.addressLine1,
            addr.addressLine2,
            [addr.city, addr.state].filter(Boolean).join(', '),
            addr.zip
        ].filter(Boolean).join(' ').trim();
    }

    private mapRow(row: any): ServiceAddress {
        return {
            id: row.id,
            employerId: row.employer_id,
            caregiverId: row.caregiver_id,
            addressLine1: row.address_line1,
            addressLine2: row.address_line2,
            city: row.city,
            state: row.state,
            zip: row.zip,
            effectiveStart: row.effective_start,
            effectiveEnd: row.effective_end,
            reason: row.reason,
            createdAt: row.created_at,
            createdBy: row.created_by,
        };
    }
}
