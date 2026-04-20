/**
 * TaxPaymentTracker — CO DOR Remittance Log
 *
 * Replaces the DR 1093 Line 2 estimate with real payment data.
 * Users log each quarterly/annual payment to Colorado Revenue Online here.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

interface TaxPaymentEntry {
    id: number;
    taxYear: number;
    paymentDate: string;
    amount: number;
    quarter: 1 | 2 | 3 | 4 | null;
    method: string;
    referenceNumber?: string;
    notes?: string;
    createdAt: string;
}

interface TaxPaymentSummary {
    taxYear: number;
    totalWithheld: number;   // Line 1 — from payroll records
    totalRemitted: number;   // Line 2 — from this tracker
    balance: number;         // Line 1 - Line 2
    payments: TaxPaymentEntry[];
}

const METHODS = ['EFT', 'CHECK', 'ONLINE', 'OTHER'] as const;
const QUARTERS = [1, 2, 3, 4] as const;

const fmt = (n: number) => `$${n.toFixed(2)}`;

interface Props {
    taxYear: number;
}

const TaxPaymentTracker: React.FC<Props> = ({ taxYear }) => {
    const [summary, setSummary] = useState<TaxPaymentSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);

    const [form, setForm] = useState({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: '',
        quarter: '' as '' | '1' | '2' | '3' | '4',
        method: 'EFT' as string,
        referenceNumber: '',
        notes: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const s = await window.electronAPI.invoke('taxPayment:getSummary', taxYear);
            setSummary(s);
        } catch {
            toast.error('Failed to load tax payment data');
        } finally {
            setLoading(false);
        }
    }, [taxYear]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
            toast.error('Enter a valid positive amount');
            return;
        }
        setSaving(true);
        try {
            await window.electronAPI.invoke('taxPayment:add', {
                taxYear,
                paymentDate: form.paymentDate,
                amount: parseFloat(form.amount),
                quarter: form.quarter ? parseInt(form.quarter) : undefined,
                method: form.method,
                referenceNumber: form.referenceNumber || undefined,
                notes: form.notes || undefined,
            });
            toast.success('Payment recorded');
            setShowForm(false);
            setForm({
                paymentDate: new Date().toISOString().split('T')[0],
                amount: '', quarter: '', method: 'EFT',
                referenceNumber: '', notes: ''
            });
            await load();
        } catch (err: any) {
            toast.error(`Failed: ${err.message ?? err}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        setDeleting(id);
        try {
            await window.electronAPI.invoke('taxPayment:delete', id);
            toast.success('Payment removed');
            await load();
        } catch {
            toast.error('Failed to delete payment');
        } finally {
            setDeleting(null);
        }
    };

    // ── Colour helpers ──
    const balanceColor = !summary ? '#888'
        : summary.balance > 0.01 ? '#dc2626'   // owe more
        : summary.balance < -0.01 ? '#16a34a'  // overpaid
        : '#16a34a';                             // balanced

    const balanceLabel = !summary ? '…'
        : summary.balance > 0.01 ? `⚠ Potential underpayment of ${fmt(summary.balance)}`
        : summary.balance < -0.01 ? `✅ Overpaid by ${fmt(Math.abs(summary.balance))}`
        : '✅ Fully reconciled';

    // ── Inline styles ──
    const card: React.CSSProperties = {
        background: 'var(--bg-app)', borderRadius: 10,
        border: '1px solid var(--border-light)', padding: '14px 18px', marginBottom: 10,
    };
    const label: React.CSSProperties = { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 };
    const input: React.CSSProperties = {
        width: '100%', padding: '7px 10px', borderRadius: 8,
        border: '1px solid var(--border-light)', background: 'var(--bg-card)',
        color: 'var(--text-main)', fontSize: 13, boxSizing: 'border-box',
    };

    return (
        <div>
            {/* ── DR 1093 Line Summary ──────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                    { label: 'Line 1 — CO Tax Withheld (from payroll)', value: summary ? fmt(summary.totalWithheld) : '…', highlight: false },
                    { label: 'Line 2 — Remitted to CDOR (this tracker)', value: summary ? fmt(summary.totalRemitted) : '…', highlight: false },
                    { label: 'Difference (Line 1 – Line 2)', value: summary ? fmt(summary.balance) : '…', highlight: true },
                ].map(({ label: lbl, value, highlight }) => (
                    <div key={lbl} style={{
                        background: highlight ? (summary && summary.balance > 0.01 ? '#fee2e2' : '#dcfce7') : 'var(--bg-app)',
                        border: `1px solid ${highlight ? balanceColor : 'var(--border-light)'}`,
                        borderRadius: 10, padding: '12px 16px'
                    }}>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6 }}>{lbl}</div>
                        <div style={{ fontWeight: 800, fontSize: 20, color: highlight ? balanceColor : 'var(--text-main)', fontFamily: 'monospace' }}>
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Balance status line ───────────────────────────────────── */}
            {summary && (
                <div style={{
                    fontSize: 13, fontWeight: 600, color: balanceColor,
                    marginBottom: 16, padding: '8px 12px',
                    background: summary.balance > 0.01 ? '#fee2e2' : summary.balance < -0.01 ? '#dcfce7' : '#dcfce7',
                    borderRadius: 8
                }}>
                    {balanceLabel}
                    {summary.balance === 0 && summary.totalRemitted === 0 && summary.totalWithheld > 0 && (
                        <span style={{ color: '#92400e', fontWeight: 400, marginLeft: 8 }}>
                            — No payments recorded yet. Add your CDOR remittances below.
                        </span>
                    )}
                </div>
            )}

            {/* ── Payment list ─────────────────────────────────────────── */}
            {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading…</p>}

            {!loading && summary && summary.payments.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13, marginBottom: 12 }}>
                    No payments recorded for {taxYear}. Add each payment you submitted to Colorado Revenue Online.
                </p>
            )}

            {!loading && summary && summary.payments.map(p => (
                <div key={p.id} style={{
                    ...card,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>{fmt(p.amount)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                            {new Date(p.paymentDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            {p.quarter && ` · Q${p.quarter} ${taxYear}`}
                            {` · ${p.method}`}
                            {p.referenceNumber && ` · Ref: ${p.referenceNumber}`}
                        </div>
                        {p.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{p.notes}</div>}
                    </div>
                    <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        style={{
                            border: 'none', background: 'none', cursor: 'pointer',
                            color: '#dc2626', fontSize: 12, fontWeight: 600, padding: '4px 8px',
                            opacity: deleting === p.id ? 0.4 : 1,
                        }}
                    >
                        {deleting === p.id ? '…' : 'Remove'}
                    </button>
                </div>
            ))}

            {/* ── Add payment button / form ─────────────────────────────── */}
            {!showForm ? (
                <button
                    onClick={() => setShowForm(true)}
                    style={{
                        padding: '9px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                        background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
                        marginTop: 8
                    }}
                >
                    + Record CDOR Payment
                </button>
            ) : (
                <form onSubmit={handleAdd} style={{ ...card, marginTop: 4 }}>
                    <div style={{ fontWeight: 700, marginBottom: 14 }}>Record Colorado DOR Remittance</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <div style={label}>Payment Date *</div>
                            <input
                                type="date"
                                style={input}
                                value={form.paymentDate}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <div style={label}>Amount ($) *</div>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                style={input}
                                value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <div style={label}>Quarter Covered</div>
                            <select
                                style={input}
                                value={form.quarter}
                                onChange={e => setForm(f => ({ ...f, quarter: e.target.value as any }))}
                            >
                                <option value="">Annual / Not Specified</option>
                                {QUARTERS.map(q => (
                                    <option key={q} value={String(q)}>Q{q} {taxYear}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div style={label}>Payment Method</div>
                            <select
                                style={input}
                                value={form.method}
                                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                            >
                                {METHODS.map(m => <option key={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <div style={label}>CO Revenue Online Confirmation #</div>
                            <input
                                type="text"
                                placeholder="Optional"
                                style={input}
                                value={form.referenceNumber}
                                onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
                            />
                        </div>
                        <div>
                            <div style={label}>Notes</div>
                            <input
                                type="text"
                                placeholder="Optional"
                                style={input}
                                value={form.notes}
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                                background: 'var(--primary)', color: '#fff', border: 'none',
                                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                            }}
                        >
                            {saving ? 'Saving…' : 'Save Payment'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            style={{
                                padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                                background: 'var(--bg-card)', color: 'var(--text-main)',
                                border: '1px solid var(--border-light)', cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default TaxPaymentTracker;
