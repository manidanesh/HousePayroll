/**
 * Cleanup Logic - operates purely on an in-memory dataset (no DB access)
 *
 * Rules:
 * - Skip group Jan 1–14 (both records finalized, different gross = correction record, not a duplicate)
 * - For all other groups: keep the record with the highest id, void the rest
 * - Only void non-finalized records (finalized ones are never touched)
 * - Void reason: "duplicate - superseded by record #<keepId>"
 */

const CORRECTION_RECORD_IDS = new Set([2, 4]); // Jan 1–14 group — leave untouched

/**
 * Given an array of payroll_records rows, returns a cleanup plan:
 * {
 *   toVoid: [{ id, voidReason }],   // records to mark is_voided=1
 *   toKeep: [id],                   // records to leave untouched
 *   skipped: [{ id, reason }]       // records skipped with explanation
 * }
 */
function buildCleanupPlan(records) {
    const toVoid = [];
    const toKeep = [];
    const skipped = [];

    // Group approved, non-voided records by caregiver + period
    const groups = {};
    for (const r of records) {
        if (r.status !== 'approved' || r.is_voided !== 0) continue;
        const key = `${r.caregiver_id}|${r.pay_period_start}|${r.pay_period_end}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
    }

    for (const [, group] of Object.entries(groups)) {
        if (group.length <= 1) continue; // no duplicate

        // Sort ascending by id — highest id is the keeper
        group.sort((a, b) => a.id - b.id);
        const keeper = group[group.length - 1];

        for (const r of group) {
            // Skip correction records entirely
            if (CORRECTION_RECORD_IDS.has(r.id)) {
                skipped.push({ id: r.id, reason: 'correction record — manual review required' });
                continue;
            }

            if (r.id === keeper.id) {
                // Skip keeper if it's in the correction set (shouldn't happen, but guard)
                toKeep.push(r.id);
                continue;
            }

            // Never void a finalized record
            if (r.is_finalized) {
                skipped.push({ id: r.id, reason: 'finalized — cannot auto-void' });
                continue;
            }

            toVoid.push({
                id: r.id,
                voidReason: `duplicate - superseded by record #${keeper.id}`
            });
        }
    }

    return { toVoid, toKeep, skipped };
}

/**
 * Apply the cleanup plan to a dataset (in-memory copy).
 * Returns a new array — original is not mutated.
 */
function applyCleanupPlan(records, plan) {
    const voidMap = new Map(plan.toVoid.map(v => [v.id, v.voidReason]));
    return records.map(r => {
        if (voidMap.has(r.id)) {
            return { ...r, is_voided: 1, void_reason: voidMap.get(r.id) };
        }
        return { ...r };
    });
}

module.exports = { buildCleanupPlan, applyCleanupPlan, CORRECTION_RECORD_IDS };
