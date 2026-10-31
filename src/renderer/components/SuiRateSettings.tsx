import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';

interface SuiRateRow {
    id: number;
    taxYear: number;
    effectiveDate: string;
    uiRate: number;
    annualWageBase: number | null;
    wageBaseConfirmed: boolean;
    source: string | null;
    jurisdiction: string;
}

const emptyForm = {
    taxYear: new Date().getFullYear() + 1,
    effectiveDate: `${new Date().getFullYear() + 1}-01-01`,
    uiRatePercent: '',
    annualWageBase: '',
    wageBaseConfirmed: true,
    source: '',
};

/**
 * Employer-specific, effective-dated Colorado SUI rate configuration (FR-01, FR-04).
 * Changes are committed atomically with a RATE_CHANGED audit event in the main process.
 */
const SuiRateSettings: React.FC = () => {
    const [rates, setRates] = useState<SuiRateRow[]>([]);
    const [editing, setEditing] = useState<SuiRateRow | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const data = await ipcAPI.suiRate.getAll();
            setRates(data || []);
        } catch {
            toast.error('Failed to load SUI rate configuration');
        }
    };

    useEffect(() => { load(); }, []);

    const startEdit = (r: SuiRateRow) => {
        setEditing(r);
        setForm({
            taxYear: r.taxYear,
            effectiveDate: r.effectiveDate,
            uiRatePercent: (r.uiRate * 100).toString(),
            annualWageBase: r.annualWageBase?.toString() || '',
            wageBaseConfirmed: r.wageBaseConfirmed,
            source: r.source || '',
        });
        setShowForm(true);
    };

    const startAdd = () => {
        setEditing(null);
        setForm({ ...emptyForm, taxYear: (rates[rates.length - 1]?.taxYear || new Date().getFullYear()) + 1, effectiveDate: `${(rates[rates.length - 1]?.taxYear || new Date().getFullYear()) + 1}-01-01` });
        setShowForm(true);
    };

    const handleSave = async () => {
        const pct = parseFloat(form.uiRatePercent);
        const wb = form.annualWageBase.trim() === '' ? null : parseFloat(form.annualWageBase);
        if (isNaN(pct) || pct < 0 || pct > 100) { toast.error('UI rate must be a percentage between 0 and 100'); return; }
        if (wb !== null && (isNaN(wb) || wb < 0)) { toast.error('Wage base must be a positive number'); return; }
        setSaving(true);
        try {
            await ipcAPI.suiRate.upsert({
                employerId: 0, // ignored by the handler; the active employer is used
                taxYear: Number(form.taxYear),
                effectiveDate: form.effectiveDate,
                uiRate: pct / 100,
                annualWageBase: wb,
                wageBaseConfirmed: form.wageBaseConfirmed,
                source: form.source.trim() || undefined,
            });
            toast.success('SUI rate saved (change audit-logged).');
            setShowForm(false);
            setEditing(null);
            await load();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save SUI rate');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="settings-card" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4>Colorado SUI Premium Rates (effective-dated)</h4>
                {!showForm && <button className="btn-small btn-primary" onClick={startAdd}>+ Add rate</button>}
            </div>
            <p className="setting-help" style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
                Employer-specific UI rates resolved by payment date. The applicable wage base is the annual taxable wage base for the
                tax year. Changes are audit-logged. Leave the wage base unconfirmed to block finalizing payroll for that year until verified.
            </p>

            {showForm && (
                <div style={{ background: '#f7f7f7', padding: 12, borderRadius: 6, marginBottom: 12 }}>
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label>Tax Year *</label>
                            <input type="number" className="form-input" value={form.taxYear}
                                onChange={(e) => setForm({ ...form, taxYear: Number(e.target.value) })} />
                        </div>
                        <div className="form-group">
                            <label>Effective Date *</label>
                            <input type="date" className="form-input" value={form.effectiveDate}
                                onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>UI Rate (%) *</label>
                            <input className="form-input" value={form.uiRatePercent} placeholder="e.g. 3.17"
                                onChange={(e) => setForm({ ...form, uiRatePercent: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Annual Taxable Wage Base</label>
                            <input className="form-input" value={form.annualWageBase} placeholder="e.g. 32100"
                                onChange={(e) => setForm({ ...form, annualWageBase: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Source / Reference</label>
                            <input className="form-input" value={form.source} placeholder="CDLE rate notice"
                                onChange={(e) => setForm({ ...form, source: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Wage base confirmed</label>
                            <label style={{ fontWeight: 400 }}>
                                <input type="checkbox" checked={form.wageBaseConfirmed}
                                    onChange={(e) => setForm({ ...form, wageBaseConfirmed: e.target.checked })} />
                                {' '}Official wage base verified
                            </label>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button className="btn-secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : (editing ? 'Update' : 'Add')}</button>
                    </div>
                </div>
            )}

            {rates.length === 0 ? (
                <p className="text-muted">No SUI rate rows configured.</p>
            ) : (
                <table className="preview-table" style={{ width: '100%' }}>
                    <thead>
                        <tr><th>Tax Year</th><th>Effective Date</th><th>UI Rate</th><th>Wage Base</th><th>Confirmed</th><th>Source</th><th></th></tr>
                    </thead>
                    <tbody>
                        {rates.map(r => (
                            <tr key={r.id}>
                                <td>{r.taxYear}</td>
                                <td>{r.effectiveDate}</td>
                                <td>{(r.uiRate * 100).toFixed(4)}%</td>
                                <td>{r.annualWageBase ? `$${r.annualWageBase.toLocaleString()}` : '—'}</td>
                                <td>{r.wageBaseConfirmed ? '✅' : '⚠ Unconfirmed'}</td>
                                <td>{r.source || '—'}</td>
                                <td><button className="btn-small btn-secondary" onClick={() => startEdit(r)}>Edit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default SuiRateSettings;
