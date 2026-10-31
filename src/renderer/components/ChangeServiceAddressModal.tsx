import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';

interface ChangeServiceAddressModalProps {
    caregiverId: number;
    caregiverName: string;
    onClose: () => void;
}

interface ServiceAddress {
    id: number;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    effectiveStart: string;
    effectiveEnd?: string | null;
    reason?: string;
    createdAt?: string;
}

const formatAddr = (a: ServiceAddress | null): string => {
    if (!a) return '—';
    return [a.addressLine1, a.addressLine2, [a.city, a.state].filter(Boolean).join(', '), a.zip]
        .filter(Boolean).join(' ').trim() || '—';
};

const ChangeServiceAddressModal: React.FC<ChangeServiceAddressModalProps> = ({ caregiverId, caregiverName, onClose }) => {
    const [step, setStep] = useState<'form' | 'confirm'>('form');
    const [current, setCurrent] = useState<ServiceAddress | null>(null);
    const [history, setHistory] = useState<ServiceAddress[]>([]);
    const [employerState, setEmployerState] = useState<string>('');
    const [affectedDrafts, setAffectedDrafts] = useState<{ id: number; payPeriodStart: string; payPeriodEnd: string }[]>([]);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zip: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: '',
    });

    const loadAll = async () => {
        try {
            const [cur, hist, emp] = await Promise.all([
                ipcAPI.serviceAddress.getCurrent(caregiverId),
                ipcAPI.serviceAddress.getHistory(caregiverId),
                ipcAPI.employer.get(),
            ]);
            setCurrent(cur);
            setHistory(hist || []);
            setEmployerState(emp?.state || '');
        } catch (err) {
            toast.error('Failed to load service address data');
        }
    };

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caregiverId]);

    const handleReview = async () => {
        if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim() || !form.effectiveDate) {
            toast.error('Street, City, State, ZIP and Effective Date are required');
            return;
        }
        try {
            const drafts = await ipcAPI.serviceAddress.getAffectedDrafts(caregiverId, form.effectiveDate);
            setAffectedDrafts(drafts || []);
            setStep('confirm');
        } catch {
            // Non-fatal: proceed to confirm without the draft list.
            setAffectedDrafts([]);
            setStep('confirm');
        }
    };

    const handleConfirm = async () => {
        setSaving(true);
        try {
            await ipcAPI.serviceAddress.change({
                caregiverId,
                addressLine1: form.addressLine1.trim(),
                addressLine2: form.addressLine2.trim() || undefined,
                city: form.city.trim(),
                state: form.state.trim(),
                zip: form.zip.trim(),
                effectiveDate: form.effectiveDate,
                reason: form.reason.trim() || undefined,
            });
            toast.success('Service address updated. Finalized historical payroll is unchanged.');
            setStep('form');
            setForm({ addressLine1: '', addressLine2: '', city: '', state: '', zip: '', effectiveDate: new Date().toISOString().slice(0, 10), reason: '' });
            await loadAll();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update service address');
        } finally {
            setSaving(false);
        }
    };

    const jurisdictionWarning = form.state.trim() && employerState && form.state.trim().toUpperCase() !== employerState.toUpperCase();

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3>Change Service Address — {caregiverName}</h3>
                    <button className="btn-small btn-secondary" onClick={onClose}>✕</button>
                </div>

                {/* Current address */}
                <div className="setting-row" style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 600 }}>Current service address:</label>
                    <span className="setting-value">{formatAddr(current)}</span>
                </div>

                {step === 'form' && (
                    <>
                        <p className="setting-help" style={{ marginBottom: 12, color: '#666' }}>
                            The service/work location is separate from the caregiver's home address and your mailing address.
                            New payroll will use the new address on the effective date; finalized historical paystubs keep their original address.
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); handleReview(); }}>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Street Address Line 1 *</label>
                                    <input className="form-input" value={form.addressLine1}
                                        onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Street Address Line 2</label>
                                    <input className="form-input" value={form.addressLine2}
                                        onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>City *</label>
                                    <input className="form-input" value={form.city}
                                        onChange={(e) => setForm({ ...form, city: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>State *</label>
                                    <input className="form-input" value={form.state} maxLength={2}
                                        onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="CO" />
                                </div>
                                <div className="form-group">
                                    <label>ZIP Code *</label>
                                    <input className="form-input" value={form.zip}
                                        onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Effective Date *</label>
                                    <input type="date" className="form-input" value={form.effectiveDate}
                                        onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Reason for change (optional)</label>
                                <input className="form-input" value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                            </div>
                            {jurisdictionWarning && (
                                <div style={{ marginTop: 8, padding: 10, background: '#fff8e1', border: '1px solid #f0c674', borderRadius: 6, color: '#8a6d1b' }}>
                                    ⚠ The new location is in a different state ({form.state.trim()}) than your employer profile ({employerState}).
                                    This may indicate a different tax jurisdiction. Tax settings are not changed automatically — review whether CO SUI/FAMLI/state withholding still apply.
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                                <button type="submit" className="btn-primary">Review change</button>
                            </div>
                        </form>
                    </>
                )}

                {step === 'confirm' && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div style={{ background: '#f7f7f7', padding: 12, borderRadius: 6 }}>
                                <strong>Previous</strong>
                                <div style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{formatAddr(current)}</div>
                            </div>
                            <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 6 }}>
                                <strong>New (effective {form.effectiveDate})</strong>
                                <div style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{formatAddr({
                                    id: 0, addressLine1: form.addressLine1, addressLine2: form.addressLine2,
                                    city: form.city, state: form.state, zip: form.zip, effectiveStart: form.effectiveDate,
                                })}</div>
                            </div>
                        </div>
                        {form.reason && <div className="setting-row"><label>Reason:</label><span>{form.reason}</span></div>}

                        <div style={{ padding: 10, background: '#eef6ff', border: '1px solid #b9d4f0', borderRadius: 6, marginBottom: 8 }}>
                            Finalized historical payroll will <strong>not</strong> be changed — each paystub keeps its original service address.
                        </div>
                        {jurisdictionWarning && (
                            <div style={{ padding: 10, background: '#fff8e1', border: '1px solid #f0c674', borderRadius: 6, marginBottom: 8, color: '#8a6d1b' }}>
                                ⚠ Different tax jurisdiction ({form.state} vs employer {employerState}). Tax settings are unchanged — review manually.
                            </div>
                        )}
                        {affectedDrafts.length > 0 && (
                            <div style={{ padding: 10, background: '#fff3cd', border: '1px solid #ffe69c', borderRadius: 6, marginBottom: 8 }}>
                                {affectedDrafts.length} draft payroll record(s) on/after {form.effectiveDate} will resolve to this new address:
                                <ul style={{ margin: '6px 0 0 18px' }}>
                                    {affectedDrafts.slice(0, 5).map(d => <li key={d.id}>{d.payPeriodStart} – {d.payPeriodEnd}</li>)}
                                    {affectedDrafts.length > 5 && <li>…and {affectedDrafts.length - 5} more</li>}
                                </ul>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                            <button className="btn-secondary" onClick={() => setStep('form')} disabled={saving}>← Back</button>
                            <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
                                {saving ? 'Saving…' : 'Confirm & save'}
                            </button>
                        </div>
                    </>
                )}

                {/* History */}
                <h4 style={{ margin: '24px 0 8px' }}>Service address history</h4>
                {history.length === 0 ? (
                    <p className="text-muted">No address versions recorded.</p>
                ) : (
                    <table className="preview-table" style={{ width: '100%' }}>
                        <thead>
                            <tr><th>Effective From</th><th>Effective To</th><th>Address</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {history.map(a => (
                                <tr key={a.id}>
                                    <td>{a.effectiveStart}</td>
                                    <td>{a.effectiveEnd || '—'}</td>
                                    <td>{formatAddr(a)}</td>
                                    <td>{a.effectiveEnd ? 'Historical' : 'Current'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ChangeServiceAddressModal;
