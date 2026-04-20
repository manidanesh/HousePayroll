/**
 * TaxNotificationService — Deadline tracking and notification state
 *
 * Computes which tax deadlines are approaching and maintains
 * dismissal state so users are not spammed.
 */
import { getDatabase } from '../database/db';
import { EmployerService } from './employer-service';

export type NotificationLevel = 'info' | 'warning' | 'urgent' | 'overdue';

export interface TaxNotification {
    id: string;               // e.g. "W2_2024_14day"
    formType: string;         // "W-2", "Schedule H", "DR 1093"
    deadline: string;         // ISO date string
    deadlineLabel: string;    // "January 31, 2025"
    daysUntil: number;        // negative = past due
    level: NotificationLevel;
    message: string;
    isDismissed: boolean;
    isGenerated: boolean;
}

interface FormDeadline {
    formType: string;
    label: string;
    getDeadline: (year: number) => Date;
    warningDays: number[];
}

/** Adjust a date forward past weekends */
function adjustForWeekend(d: Date): Date {
    const day = d.getDay(); // 0=Sun, 6=Sat
    if (day === 6) { d.setDate(d.getDate() + 2); }
    else if (day === 0) { d.setDate(d.getDate() + 1); }
    return d;
}

const FORM_DEADLINES: FormDeadline[] = [
    {
        formType: 'W-2',
        label: 'Form W-2 (Wage and Tax Statement)',
        getDeadline: (year) => adjustForWeekend(new Date(year + 1, 0, 31)), // Jan 31 next year
        warningDays: [45, 30, 14, 7, 1],
    },
    {
        formType: 'DR 1093',
        label: 'Colorado DR 1093 (Annual W-2 Transmittal)',
        getDeadline: (year) => adjustForWeekend(new Date(year + 1, 0, 31)), // Jan 31 next year
        warningDays: [45, 30, 14, 7, 1],
    },
    {
        formType: 'Schedule H',
        label: 'IRS Schedule H (Form 1040)',
        getDeadline: (year) => adjustForWeekend(new Date(year + 1, 3, 15)), // Apr 15 next year
        warningDays: [60, 30, 14, 7, 1],
    },
];

function formatDeadline(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildMessage(formType: string, deadline: string, daysUntil: number): string {
    if (daysUntil < 0) {
        return `⛔ OVERDUE: ${formType} was due on ${deadline}. Generate now to minimize penalties.`;
    }
    if (daysUntil === 0) {
        return `🚨 DUE TODAY: ${formType} must be generated and filed today (${deadline}).`;
    }
    if (daysUntil === 1) {
        return `🚨 Final Reminder: ${formType} is due TOMORROW, ${deadline}.`;
    }
    if (daysUntil <= 7) {
        return `🚨 Urgent: ${formType} is due in ${daysUntil} days (${deadline}).`;
    }
    if (daysUntil <= 14) {
        return `⚠️ Action needed: ${formType} is due in ${daysUntil} days (${deadline}).`;
    }
    if (daysUntil <= 30) {
        return `📋 Tax season reminder: ${formType} is due in ${daysUntil} days (${deadline}).`;
    }
    return `📅 Upcoming: ${formType} is due on ${deadline} (${daysUntil} days away).`;
}

function getLevel(daysUntil: number): NotificationLevel {
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 7) return 'urgent';
    if (daysUntil <= 14) return 'warning';
    return 'info';
}

export class TaxNotificationService {

    /** Initialize the required DB tables if they don't exist */
    static ensureTables(): void {
        const db = getDatabase();
        db.exec(`
            CREATE TABLE IF NOT EXISTS tax_form_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employer_id INTEGER NOT NULL,
                form_type TEXT NOT NULL,
                tax_year INTEGER NOT NULL,
                caregiver_id INTEGER,
                caregiver_name TEXT,
                generated_at TEXT NOT NULL,
                file_path TEXT
            );
            CREATE TABLE IF NOT EXISTS tax_notification_dismissals (
                id TEXT PRIMARY KEY,
                dismissed_at TEXT NOT NULL
            );
        `);
    }

    /**
     * Get all actionable notifications for the current tax year.
     * Only returns notifications for deadlines that haven't passed by more than 90 days,
     * and only during "tax season" (Nov 1 → Apr 30 of the following year).
     */
    static getActiveNotifications(year?: number): TaxNotification[] {
        TaxNotificationService.ensureTables();

        const now = new Date();
        const taxYear = year ?? (now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1);

        const notifications: TaxNotification[] = [];
        const employer = EmployerService.getEmployer();
        if (!employer) return notifications;

        const db = getDatabase();

        // Load generated forms for this year
        const generatedForms = new Set<string>();
        try {
            const rows = db.prepare(
                `SELECT DISTINCT form_type FROM tax_form_log WHERE employer_id = ? AND tax_year = ?`
            ).all(employer.id, taxYear) as Array<{ form_type: string }>;
            rows.forEach(r => generatedForms.add(r.form_type));
        } catch { /* table may not exist yet */ }

        // Load dismissed notifications
        const dismissed = new Set<string>();
        try {
            const rows = db.prepare(`SELECT id FROM tax_notification_dismissals`).all() as Array<{ id: string }>;
            rows.forEach(r => dismissed.add(r.id));
        } catch { /* table may not exist yet */ }

        for (const form of FORM_DEADLINES) {
            const deadline = form.getDeadline(taxYear);
            const deadlineStr = formatDeadline(deadline);
            const diffMs = deadline.getTime() - now.getTime();
            const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            // Skip if more than 45 days overdue (stale)
            if (daysUntil < -45) continue;

            // Determine the closest warning tier that applies
            const level = getLevel(daysUntil);
            const tierLabel = daysUntil < 0
                ? 'overdue'
                : form.warningDays.find(d => daysUntil <= d)?.toString() ?? 'info';

            const notifId = `${form.formType.replace(/\s+/g, '_')}_${taxYear}_${tierLabel}`;
            const message = buildMessage(form.label, deadlineStr, daysUntil);

            notifications.push({
                id: notifId,
                formType: form.formType,
                deadline: deadline.toISOString(),
                deadlineLabel: deadlineStr,
                daysUntil,
                level,
                message,
                isDismissed: dismissed.has(notifId),
                isGenerated: generatedForms.has(form.formType),
            });
        }

        return notifications;
    }

    /** Dismiss a notification by ID (stored in DB so it survives app restarts) */
    static dismiss(notificationId: string): void {
        TaxNotificationService.ensureTables();
        const db = getDatabase();
        try {
            db.prepare(`
                INSERT OR REPLACE INTO tax_notification_dismissals (id, dismissed_at)
                VALUES (?, ?)
            `).run(notificationId, new Date().toISOString());
        } catch { /* non-fatal */ }
    }

    /** Clear any dismissals older than 7 days (so they re-appear at next tier) */
    static clearStaleDismissals(): void {
        const db = getDatabase();
        try {
            const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            db.prepare(`DELETE FROM tax_notification_dismissals WHERE dismissed_at < ?`).run(cutoff);
        } catch { /* non-fatal */ }
    }

    /** Mark a form type as generated for a tax year */
    static markGenerated(formType: string, year: number, filePath?: string): void {
        const employer = EmployerService.getEmployer();
        if (!employer) return;
        TaxNotificationService.ensureTables();
        const db = getDatabase();
        try {
            db.prepare(`
                INSERT INTO tax_form_log (employer_id, form_type, tax_year, generated_at, file_path)
                VALUES (?, ?, ?, ?, ?)
            `).run(employer.id, formType, year, new Date().toISOString(), filePath ?? null);
        } catch { /* non-fatal */ }
    }

    /** Returns how many un-dismissed notifications exist (for badge count) */
    static getUnreadCount(): number {
        return TaxNotificationService.getActiveNotifications()
            .filter(n => !n.isDismissed && !n.isGenerated).length;
    }

    /** Returns the current tax year (Nov–Dec = next year's filing) */
    static getCurrentTaxYear(): number {
        const now = new Date();
        return now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
    }
}
