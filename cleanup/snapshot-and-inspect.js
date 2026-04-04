/**
 * Phase 1: Snapshot payroll_records and inspect duplicates
 *
 * Reads all payroll_records from the live DB, writes a snapshot JSON,
 * then reports any duplicate approved non-voided records.
 *
 * NO changes are made to the DB.
 *
 * Usage: node cleanup/snapshot-and-inspect.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(
    process.env.HOME,
    'Library', 'Application Support', 'household-payroll', 'payroll.db'
);
const SNAPSHOT_PATH = path.join(__dirname, 'snapshot.json');

// ── 1. Open DB (read-only) ────────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: true });

// ── 2. Export all payroll_records ─────────────────────────────────────────────
const allRecords = db.prepare('SELECT * FROM payroll_records ORDER BY id ASC').all();
fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(allRecords, null, 2));
console.log(`\nSnapshot written → ${SNAPSHOT_PATH}`);
console.log(`Total payroll_records: ${allRecords.length}\n`);

// ── 3. Find duplicates ────────────────────────────────────────────────────────
// A duplicate group = 2+ approved, non-voided records with the same
// caregiver_id + pay_period_start + pay_period_end
const approved = allRecords.filter(r => r.status === 'approved' && r.is_voided === 0);

const groups = {};
for (const r of approved) {
    const key = `${r.caregiver_id}|${r.pay_period_start}|${r.pay_period_end}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
}

const duplicateGroups = Object.entries(groups).filter(([, records]) => records.length > 1);

// ── 4. Report ─────────────────────────────────────────────────────────────────
if (duplicateGroups.length === 0) {
    console.log('✅  No duplicate approved records found.');
    db.close();
    process.exit(0);
}

console.log(`⚠️   Found ${duplicateGroups.length} duplicate group(s):\n`);

for (const [key, records] of duplicateGroups) {
    const [caregiverId, start, end] = key.split('|');

    // Look up caregiver name
    const cg = db.prepare('SELECT full_legal_name FROM caregivers WHERE id = ?').get(Number(caregiverId));
    const name = cg ? cg.full_legal_name : `caregiver #${caregiverId}`;

    console.log(`  Caregiver: ${name} (id=${caregiverId})`);
    console.log(`  Period:    ${start} → ${end}`);
    console.log(`  Records (${records.length}):`);

    // Sort by id so the "keep" candidate (highest id) is last
    records.sort((a, b) => a.id - b.id);

    for (const r of records) {
        const flags = [];
        if (r.is_finalized) flags.push('FINALIZED ⚠️');
        const keepTag = r.id === records[records.length - 1].id ? ' ← KEEP (most recent)' : ' ← VOID candidate';
        console.log(`    id=${r.id}  gross=${r.gross_wages}  finalized=${r.is_finalized}  created=${r.created_at}${flags.length ? '  ' + flags.join(', ') : ''}${keepTag}`);
    }

    const hasFinalized = records.some(r => r.is_finalized);
    if (hasFinalized) {
        console.log(`  ⚠️  WARNING: one or more records in this group are FINALIZED — manual review required`);
    }
    console.log();
}

console.log('─────────────────────────────────────────────────────────');
console.log(`Summary: ${duplicateGroups.length} group(s) with duplicates`);
const totalToVoid = duplicateGroups.reduce((sum, [, r]) => sum + r.length - 1, 0);
console.log(`Records that would be voided: ${totalToVoid}`);
const finalizedCount = duplicateGroups.reduce((sum, [, r]) => sum + r.filter(x => x.is_finalized).length, 0);
if (finalizedCount > 0) {
    console.log(`⚠️  Finalized records involved: ${finalizedCount} — these need manual review before any cleanup`);
}

db.close();
