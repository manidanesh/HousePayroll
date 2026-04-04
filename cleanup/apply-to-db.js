/**
 * Phase 4: Apply cleanup to the real DB
 *
 * - Reads live DB, builds cleanup plan using the same logic as dry-run
 * - Wraps all updates in a single transaction (all-or-nothing)
 * - Sets is_voided=1 and void_reason on duplicate non-finalized records
 * - Skips correction records (ids 2 & 4) and any finalized records
 * - Prints a full report of what was done
 *
 * Usage: node cleanup/apply-to-db.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const { buildCleanupPlan } = require('./cleanup-logic');

const DB_PATH = path.join(
    process.env.HOME,
    'Library', 'Application Support', 'household-payroll', 'payroll.db'
);

const db = new Database(DB_PATH);

// Read all records
const allRecords = db.prepare('SELECT * FROM payroll_records ORDER BY id ASC').all();
console.log(`\nLoaded ${allRecords.length} records from DB`);

const plan = buildCleanupPlan(allRecords);

if (plan.toVoid.length === 0) {
    console.log('✅  Nothing to void — DB is already clean.');
    db.close();
    process.exit(0);
}

console.log(`\nAbout to void ${plan.toVoid.length} records:`);
for (const v of plan.toVoid) {
    const r = allRecords.find(x => x.id === v.id);
    console.log(`  id=${v.id}  period=${r.pay_period_start}→${r.pay_period_end}  gross=${r.gross_wages}  reason="${v.voidReason}"`);
}

// Execute in a single transaction
const applyVoids = db.transaction((voids) => {
    const stmt = db.prepare(
        `UPDATE payroll_records SET is_voided = 1, void_reason = ? WHERE id = ? AND is_finalized = 0 AND is_voided = 0`
    );
    let applied = 0;
    for (const v of voids) {
        const result = stmt.run(v.voidReason, v.id);
        if (result.changes === 1) {
            applied++;
        } else {
            // Safety: if row was already voided or finalized, skip silently
            console.log(`  ⚠️  id=${v.id} — no change (already voided or finalized?)`);
        }
    }
    return applied;
});

const applied = applyVoids(plan.toVoid);

// Verify
const remaining = db.prepare(`
    SELECT caregiver_id, pay_period_start, pay_period_end, COUNT(*) as cnt
    FROM payroll_records
    WHERE status = 'approved' AND is_voided = 0
    GROUP BY caregiver_id, pay_period_start, pay_period_end
    HAVING cnt > 1
`).all();

console.log(`\n═══════════════════════════════════════════════`);
console.log(`Applied: ${applied} record(s) voided`);
console.log(`Skipped: ${plan.skipped.length} record(s) (correction group / finalized)`);

if (remaining.length === 0) {
    console.log('✅  Verification passed — no duplicate approved records remain');
} else {
    console.log(`⚠️  ${remaining.length} duplicate group(s) still remain (correction records — expected):`);
    for (const r of remaining) {
        console.log(`  caregiver=${r.caregiver_id}  period=${r.pay_period_start}→${r.pay_period_end}  count=${r.cnt}`);
    }
}

db.close();
