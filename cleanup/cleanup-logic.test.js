/**
 * Tests for cleanup-logic.js — operates entirely on in-memory datasets
 *
 * Usage: node cleanup/cleanup-logic.test.js
 */

const { buildCleanupPlan, applyCleanupPlan, CORRECTION_RECORD_IDS } = require('./cleanup-logic');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅  ${label}`);
        passed++;
    } else {
        console.log(`  ❌  ${label}`);
        failed++;
    }
}

function makeRecord(overrides) {
    return {
        id: 1,
        caregiver_id: 1,
        pay_period_start: '2026-01-01',
        pay_period_end: '2026-01-07',
        gross_wages: 1000,
        status: 'approved',
        is_voided: 0,
        is_finalized: 0,
        void_reason: null,
        ...overrides
    };
}

// ── Test 1: No duplicates → empty plan ───────────────────────────────────────
console.log('\nTest 1: No duplicates → empty plan');
{
    const records = [
        makeRecord({ id: 1, caregiver_id: 1, pay_period_start: '2026-01-01', pay_period_end: '2026-01-07' }),
        makeRecord({ id: 2, caregiver_id: 1, pay_period_start: '2026-01-08', pay_period_end: '2026-01-14' }),
    ];
    const plan = buildCleanupPlan(records);
    assert(plan.toVoid.length === 0, 'toVoid is empty');
    assert(plan.toKeep.length === 0, 'toKeep is empty (no duplicates to resolve)');
}

// ── Test 2: Simple duplicate → older voided, newer kept ──────────────────────
console.log('\nTest 2: Simple duplicate → older voided, newer kept');
{
    const records = [
        makeRecord({ id: 10, caregiver_id: 1, pay_period_start: '2026-02-01', pay_period_end: '2026-02-07', gross_wages: 500 }),
        makeRecord({ id: 15, caregiver_id: 1, pay_period_start: '2026-02-01', pay_period_end: '2026-02-07', gross_wages: 500 }),
    ];
    const plan = buildCleanupPlan(records);
    assert(plan.toVoid.length === 1, 'one record to void');
    assert(plan.toVoid[0].id === 10, 'older record (id=10) is voided');
    assert(plan.toVoid[0].voidReason === 'duplicate - superseded by record #15', 'void reason references keeper id');
    assert(plan.toKeep.includes(15), 'newer record (id=15) is kept');
}

// ── Test 3: Triple duplicate → two voided, newest kept ───────────────────────
console.log('\nTest 3: Triple duplicate → two voided, newest kept');
{
    const records = [
        makeRecord({ id: 5, caregiver_id: 2, pay_period_start: '2026-03-01', pay_period_end: '2026-03-07' }),
        makeRecord({ id: 6, caregiver_id: 2, pay_period_start: '2026-03-01', pay_period_end: '2026-03-07' }),
        makeRecord({ id: 7, caregiver_id: 2, pay_period_start: '2026-03-01', pay_period_end: '2026-03-07' }),
    ];
    const plan = buildCleanupPlan(records);
    assert(plan.toVoid.length === 2, 'two records to void');
    assert(plan.toVoid.map(v => v.id).includes(5), 'id=5 voided');
    assert(plan.toVoid.map(v => v.id).includes(6), 'id=6 voided');
    assert(plan.toKeep.includes(7), 'id=7 kept');
}

// ── Test 4: Finalized duplicate → skipped, not voided ────────────────────────
console.log('\nTest 4: Finalized record in duplicate group → skipped');
{
    const records = [
        makeRecord({ id: 20, caregiver_id: 3, pay_period_start: '2026-04-01', pay_period_end: '2026-04-07', is_finalized: 1 }),
        makeRecord({ id: 21, caregiver_id: 3, pay_period_start: '2026-04-01', pay_period_end: '2026-04-07', is_finalized: 0 }),
    ];
    const plan = buildCleanupPlan(records);
    assert(!plan.toVoid.map(v => v.id).includes(20), 'finalized record (id=20) is NOT voided');
    assert(plan.skipped.map(s => s.id).includes(20), 'finalized record (id=20) is in skipped list');
}

// ── Test 5: Correction record group (ids 2 & 4) → both skipped ───────────────
console.log('\nTest 5: Correction record group (ids 2 & 4) → both skipped');
{
    const records = [
        makeRecord({ id: 2, caregiver_id: 1, pay_period_start: '2026-01-01', pay_period_end: '2026-01-14', gross_wages: 1225, is_finalized: 1 }),
        makeRecord({ id: 4, caregiver_id: 1, pay_period_start: '2026-01-01', pay_period_end: '2026-01-14', gross_wages: 90, is_finalized: 1 }),
    ];
    const plan = buildCleanupPlan(records);
    assert(plan.toVoid.length === 0, 'no records voided for correction group');
    assert(plan.skipped.map(s => s.id).includes(2), 'id=2 skipped');
    assert(plan.skipped.map(s => s.id).includes(4), 'id=4 skipped');
}

// ── Test 6: Different caregivers same period → no duplicate ──────────────────
console.log('\nTest 6: Different caregivers, same period → not a duplicate');
{
    const records = [
        makeRecord({ id: 30, caregiver_id: 1, pay_period_start: '2026-05-01', pay_period_end: '2026-05-07' }),
        makeRecord({ id: 31, caregiver_id: 2, pay_period_start: '2026-05-01', pay_period_end: '2026-05-07' }),
    ];
    const plan = buildCleanupPlan(records);
    assert(plan.toVoid.length === 0, 'different caregivers not treated as duplicates');
}

// ── Test 7: applyCleanupPlan mutates correctly ────────────────────────────────
console.log('\nTest 7: applyCleanupPlan sets is_voided=1 and void_reason on target records');
{
    const records = [
        makeRecord({ id: 40, caregiver_id: 4, pay_period_start: '2026-06-01', pay_period_end: '2026-06-07' }),
        makeRecord({ id: 41, caregiver_id: 4, pay_period_start: '2026-06-01', pay_period_end: '2026-06-07' }),
    ];
    const plan = buildCleanupPlan(records);
    const cleaned = applyCleanupPlan(records, plan);

    const r40 = cleaned.find(r => r.id === 40);
    const r41 = cleaned.find(r => r.id === 41);

    assert(r40.is_voided === 1, 'id=40 is_voided set to 1');
    assert(r40.void_reason === 'duplicate - superseded by record #41', 'id=40 void_reason correct');
    assert(r41.is_voided === 0, 'id=41 (keeper) is_voided unchanged');
    assert(records[0].is_voided === 0, 'original dataset not mutated');
}

// ── Test 8: Run against actual snapshot ──────────────────────────────────────
console.log('\nTest 8: Snapshot validation — no duplicates remain after cleanup (except correction group)');
{
    const snapshotPath = path.join(__dirname, 'snapshot.json');
    if (!fs.existsSync(snapshotPath)) {
        console.log('  ⏭  snapshot.json not found — skipping (run snapshot-and-inspect.js first)');
    } else {
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        const plan = buildCleanupPlan(snapshot);
        const cleaned = applyCleanupPlan(snapshot, plan);

        const approvedAfter = cleaned.filter(r => r.status === 'approved' && r.is_voided === 0);
        const groups = {};
        for (const r of approvedAfter) {
            const key = `${r.caregiver_id}|${r.pay_period_start}|${r.pay_period_end}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        }
        const remaining = Object.values(groups).filter(g => g.length > 1);

        // Only the correction group (ids 2 & 4) should remain
        const onlyCorrections = remaining.every(g =>
            g.every(r => CORRECTION_RECORD_IDS.has(r.id))
        );
        assert(onlyCorrections, 'only correction records remain as duplicates after cleanup');

        // None of the voided records should be finalized
        const voidedIds = new Set(plan.toVoid.map(v => v.id));
        const voidedFinalized = snapshot.filter(r => voidedIds.has(r.id) && r.is_finalized);
        assert(voidedFinalized.length === 0, 'no finalized records are in the void list');

        // All voided records should have been non-finalized
        assert(plan.toVoid.every(v => {
            const r = snapshot.find(x => x.id === v.id);
            return r && r.is_finalized === 0;
        }), 'all voided records were non-finalized');
    }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
    console.log('✅  All tests passed — cleanup logic is safe to apply to DB');
} else {
    console.log('❌  Some tests failed — do NOT apply to DB until fixed');
}
process.exit(failed > 0 ? 1 : 0);
