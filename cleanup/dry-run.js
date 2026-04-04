/**
 * Phase 2: Dry-run cleanup on the snapshot dataset
 *
 * Loads snapshot.json, runs the cleanup logic, prints what WOULD happen.
 * Zero DB changes.
 *
 * Usage: node cleanup/dry-run.js
 */

const fs = require('fs');
const path = require('path');
const { buildCleanupPlan, applyCleanupPlan } = require('./cleanup-logic');

const SNAPSHOT_PATH = path.join(__dirname, 'snapshot.json');
const records = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

console.log(`\nLoaded ${records.length} records from snapshot\n`);

const plan = buildCleanupPlan(records);

console.log('═══════════════════════════════════════════════');
console.log('DRY-RUN CLEANUP PLAN');
console.log('═══════════════════════════════════════════════\n');

console.log(`Records to VOID (${plan.toVoid.length}):`);
for (const v of plan.toVoid) {
    const r = records.find(x => x.id === v.id);
    console.log(`  id=${v.id}  caregiver=${r.caregiver_id}  period=${r.pay_period_start}→${r.pay_period_end}  gross=${r.gross_wages}  finalized=${r.is_finalized}`);
    console.log(`    reason: "${v.voidReason}"`);
}

console.log(`\nRecords to KEEP (${plan.toKeep.length}):`);
for (const id of plan.toKeep) {
    const r = records.find(x => x.id === id);
    console.log(`  id=${id}  caregiver=${r.caregiver_id}  period=${r.pay_period_start}→${r.pay_period_end}  gross=${r.gross_wages}  finalized=${r.is_finalized}`);
}

console.log(`\nRecords SKIPPED (${plan.skipped.length}):`);
for (const s of plan.skipped) {
    const r = records.find(x => x.id === s.id);
    console.log(`  id=${s.id}  caregiver=${r.caregiver_id}  period=${r.pay_period_start}→${r.pay_period_end}  gross=${r.gross_wages}`);
    console.log(`    reason: "${s.reason}"`);
}

// Apply to in-memory copy and validate
const cleaned = applyCleanupPlan(records, plan);

// Post-cleanup duplicate check
const approvedAfter = cleaned.filter(r => r.status === 'approved' && r.is_voided === 0);
const groups = {};
for (const r of approvedAfter) {
    const key = `${r.caregiver_id}|${r.pay_period_start}|${r.pay_period_end}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
}
const remaining = Object.values(groups).filter(g => g.length > 1);

console.log('\n═══════════════════════════════════════════════');
console.log('POST-CLEANUP VALIDATION');
console.log('═══════════════════════════════════════════════');
if (remaining.length === 0) {
    console.log('✅  No duplicate approved records remain after cleanup');
} else {
    console.log(`⚠️  ${remaining.length} duplicate group(s) still remain (likely correction records or finalized — manual review needed):`);
    for (const g of remaining) {
        console.log(`  caregiver=${g[0].caregiver_id}  period=${g[0].pay_period_start}→${g[0].pay_period_end}  ids=${g.map(r => r.id).join(', ')}`);
    }
}
