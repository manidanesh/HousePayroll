import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import TaxPaymentTracker from './TaxPaymentTracker';
import SSAFilingGuide from './SSAFilingGuide';

const ipc = (channel: string, ...args: any[]) => window.electronAPI.invoke(channel, ...args);

// ─── Types ───────────────────────────────────────────────────────────────────

interface TaxNotification {
    id: string;
    formType: string;
    deadline: string;
    deadlineLabel: string;
    daysUntil: number;
    level: 'info' | 'warning' | 'urgent' | 'overdue';
    message: string;
    isDismissed: boolean;
    isGenerated: boolean;
}

interface FormLogEntry {
    id: number;
    formType: string;
    taxYear: number;
    caregiverId?: number;
    caregiverName?: string;
    generatedAt: string;
    filePath?: string;
}

interface CaregiverYTD {
    caregiverId: number;
    caregiverName: string;
    grossWages: number;
    federalWithholding: number;
    coloradoStateIncomeTax?: number;
}

const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    info:    { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', dot: '#3b82f6' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', dot: '#f59e0b' },
    urgent:  { bg: '#fff1f2', border: '#f43f5e', text: '#9f1239', dot: '#f43f5e' },
    overdue: { bg: '#fef2f2', border: '#dc2626', text: '#7f1d1d', dot: '#dc2626' },
};

const FORM_LABELS: Record<string, string> = {
    W2: 'Form W-2 — Wage and Tax Statement',
    W3: 'Form W-3 — Transmittal of Wage and Tax Statements',
    SCHEDULE_H: 'IRS Schedule H — Form 1040 (Household Employment Taxes)',
    DR_1093: 'Colorado DR 1093 — Annual W-2 Transmittal',
};

// ─── Deadline Badge ───────────────────────────────────────────────────────────

const DeadlineBadge: React.FC<{ daysUntil: number; level: string }> = ({ daysUntil, level }) => {
    const c = LEVEL_COLORS[level] || LEVEL_COLORS.info;
    const label = daysUntil < 0
        ? `${Math.abs(daysUntil)}d overdue`
        : daysUntil === 0
        ? 'Due today'
        : `${daysUntil}d left`;

    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 99,
            background: c.bg, border: `1px solid ${c.border}`,
            color: c.text, fontWeight: 700, fontSize: 11
        }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
            {label}
        </span>
    );
};

// ─── Preview Modal ────────────────────────────────────────────────────────────

const PreviewModal: React.FC<{
    formType: string;
    year: number;
    onClose: () => void;
}> = ({ formType, year, onClose }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        ipc('taxForm:getPreviewData', year, formType)
            .then(setData)
            .catch(() => toast.error('Failed to load preview'))
            .finally(() => setLoading(false));
    }, [formType, year]);

    const renderContent = () => {
        if (!data) return <p style={{ color: 'var(--text-secondary)' }}>No data available for {year}.</p>;

        if (formType === 'SCHEDULE_H') {
            const rows = [
                ['Q-A', 'Any employee paid ≥ FICA threshold?', data.questionA ? '✅ Yes' : '☐ No'],
                ['Q-B', 'Federal income tax withheld?', data.questionB ? '✅ Yes' : '☐ No'],
                ['Q-C', 'Total wages ≥ $1,000 in any quarter?', data.questionC ? '✅ Yes' : '☐ No'],
                null,
                ['Line 1', 'SS-taxable wages', `$${data.line1?.toFixed(2)}`],
                ['Line 2', 'Social Security taxes (×12.4%)', `$${data.line2?.toFixed(2)}`],
                ['Line 3', 'Medicare-taxable wages', `$${data.line3?.toFixed(2)}`],
                ['Line 4', 'Medicare taxes (×2.9%)', `$${data.line4?.toFixed(2)}`],
                ['Line 5', 'Additional Medicare wages (>$200k)', `$${data.line5?.toFixed(2)}`],
                ['Line 6', 'Additional Medicare Tax (×0.9%)', `$${data.line6?.toFixed(2)}`],
                ['Line 7', 'Federal income tax withheld', `$${data.line7?.toFixed(2)}`],
                ['Line 8', 'Total Part I', `$${data.line8?.toFixed(2)}`],
                null,
                ['Line 15', 'FUTA wages (capped at $7,000/employee)', `$${data.line15?.toFixed(2)}`],
                ['Line 16', 'FUTA Tax (×0.6%)', `$${data.line16?.toFixed(2)}`],
                null,
                ['Line 26', '🏦 TOTAL HOUSEHOLD TAXES', `$${data.line26?.toFixed(2)}`],
            ];
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {rows.map((row, i) => row === null ? (
                        <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '8px 0' }} />
                    ) : (
                        <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '7px 10px', borderRadius: 6,
                            background: row[0] === 'Line 26' ? 'var(--primary)' : i % 2 === 0 ? 'var(--bg-app)' : 'transparent',
                            color: row[0] === 'Line 26' ? '#fff' : 'inherit'
                        }}>
                            <div>
                                <span style={{ fontWeight: 700, fontSize: 11, color: row[0] === 'Line 26' ? '#cce' : 'var(--primary)', marginRight: 8 }}>{row[0]}</span>
                                <span style={{ fontSize: 13 }}>{row[1]}</span>
                            </div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{row[2]}</span>
                        </div>
                    ))}
                </div>
            );
        }

        if (formType === 'DR_1093') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            ['Employer', data.employerName],
                            ['CO UI Account #', data.uiAccountNumber],
                            ['Tax Year', data.taxYear],
                            ['W-2 Forms Count', data.w2Count],
                        ].map(([label, val]) => (
                            <div key={label} style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '10px 14px' }}>
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</div>
                                <div style={{ fontWeight: 700 }}>{val}</div>
                            </div>
                        ))}
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />
                    {[
                        ['Line 1', 'Total CO income tax withheld per W-2s', data.line1],
                        ['Line 2', 'Total CO income tax remitted (estimate — VERIFY)', data.line2],
                    ].map(([lineNum, desc, val]) => (
                        <div key={lineNum as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-app)' }}>
                            <div>
                                <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: 8, fontSize: 11 }}>{lineNum}</span>
                                <span style={{ fontSize: 13 }}>{desc}</span>
                            </div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>${(val as number).toFixed(2)}</span>
                        </div>
                    ))}
                    <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                        ⚠ Line 2 must be verified against your actual CO DOR payment records before filing.
                    </div>
                </div>
            );
        }

        if (formType === 'W2' && Array.isArray(data)) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.map((d: CaregiverYTD) => (
                        <div key={d.caregiverId} style={{ background: 'var(--bg-app)', borderRadius: 8, padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>👤 {d.caregiverName}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                                {[
                                    ['Box 1 — Wages', d.grossWages],
                                    ['Box 2 — FIT', d.federalWithholding],
                                    ['Box 17 — CO SIT', (d as any).coloradoStateIncomeTax ?? 0],
                                ].map(([label, val]) => (
                                    <div key={label as string}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{label}</div>
                                        <div style={{ fontWeight: 600 }}>${(val as number).toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        if (formType === 'W3') {
            if (!data) return <p style={{ color: 'var(--text-secondary)' }}>No payroll data for {year}.</p>;
            const rows: [string, string, string][] = [
                ['c',  'Total W-2s',                    String(data.w2Count)],
                ['e',  "Employer's EIN",                 data.ein],
                ['f',  "Employer's Name",                data.employerName],
                ['g',  "Employer's Address",             data.employerAddress],
            ];
            const numRows: [string, string, string, boolean][] = [
                ['1',  'Wages, tips, other compensation',  `$${data.box1Wages?.toFixed(2)}`,   false],
                ['2',  'Federal income tax withheld',       `$${data.box2FIT?.toFixed(2)}`,     false],
                ['3',  'Social security wages',              `$${data.box3SSWages?.toFixed(2)}`, false],
                ['4',  'Social security tax withheld',      `$${data.box4SSTax?.toFixed(2)}`,   false],
                ['5',  'Medicare wages and tips',            `$${data.box5MedWages?.toFixed(2)}`,false],
                ['6',  'Medicare tax withheld',              `$${data.box6MedTax?.toFixed(2)}`,  false],
                ['14', 'Other — CO FAMLI EE Premiums',    `$${data.box14Other?.toFixed(2)}`,  false],
                ['16', 'State wages (CO)',                   `$${data.box16StateWages?.toFixed(2)}`,false],
                ['17', 'CO State Income Tax withheld',       `$${data.box17StateTax?.toFixed(2)}`,true],
            ];
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                        ☑️ Box b: Kind of Payer — <strong>Hshld. emp. (Household Employer)</strong>
                    </div>
                    {rows.map(([b, d, v]) => (
                        <div key={b} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 6, background: 'var(--bg-app)' }}>
                            <div><span style={{ fontWeight: 700, fontSize: 11, color: 'var(--primary)', marginRight: 8 }}>Box {b}</span><span style={{ fontSize: 13 }}>{d}</span></div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{v}</span>
                        </div>
                    ))}
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)' }} />
                    {numRows.map(([b, d, v, hl]) => (
                        <div key={b} style={{
                            display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 6,
                            background: hl ? 'var(--primary)' : 'var(--bg-app)',
                            color: hl ? '#fff' : 'inherit'
                        }}>
                            <div>
                                <span style={{ fontWeight: 700, fontSize: 11, color: hl ? '#cce' : 'var(--primary)', marginRight: 8 }}>Box {b}</span>
                                <span style={{ fontSize: 13 }}>{d}</span>
                            </div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{v}</span>
                        </div>
                    ))}
                </div>
            );
        }

        return <pre style={{ fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width: '94%', maxHeight: '85vh', overflowY: 'auto' }}>
                <header className="modal-header">
                    <h3 style={{ fontSize: 15 }}>📋 Preview — {FORM_LABELS[formType] ?? formType} ({year})</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </header>
                <div className="modal-body">
                    {loading ? <p>Loading preview data…</p> : renderContent()}
                </div>
                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

// ─── Main TaxCenter Component ─────────────────────────────────────────────────

const TaxCenter: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const [taxYear, setTaxYear] = useState<number>(
        new Date().getMonth() >= 10 ? currentYear : currentYear - 1
    );
    const [activeTab, setActiveTab] = useState<'forms' | 'guide'>('forms');
    const [notifications, setNotifications] = useState<TaxNotification[]>([]);
    const [formLog, setFormLog] = useState<FormLogEntry[]>([]);
    const [caregivers, setCaregivers] = useState<CaregiverYTD[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [previewForm, setPreviewForm] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [notifs, log, ytd] = await Promise.all([
                ipc('taxNotif:getAll', taxYear),
                ipc('taxForm:getLog', taxYear),
                ipc('report:getYTD', taxYear),
            ]);
            setNotifications(notifs ?? []);
            setFormLog(log ?? []);
            setCaregivers(ytd ?? []);
        } catch {
            toast.error('Failed to load Tax Center data');
        } finally {
            setLoading(false);
        }
    }, [taxYear]);

    useEffect(() => { loadData(); }, [loadData]);

    const activeNotifications = notifications.filter(n => !n.isDismissed);

    const dismissNotif = async (id: string) => {
        await ipc('taxNotif:dismiss', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isDismissed: true } : n));
    };

    const generate = async (action: () => Promise<any>, formKey: string, successMsg: string) => {
        setGenerating(formKey);
        try {
            const result = await action();
            if (result?.success) {
                toast.success(successMsg);
                await loadData();
            }
        } catch (err: any) {
            toast.error(`Generation failed: ${err.message ?? err}`);
        } finally {
            setGenerating(null);
        }
    };

    const openFile = async (filePath: string) => {
        const result = await ipc('taxForm:openFile', filePath);
        if (!result?.success) toast.error('File not found. It may have been moved.');
    };

    const lastGenerated = (formType: string, caregiverId?: number): FormLogEntry | undefined =>
        formLog.find(e =>
            e.formType === formType && (caregiverId === undefined || e.caregiverId === caregiverId)
        );

    const GeneratedBadge: React.FC<{ entry?: FormLogEntry }> = ({ entry }) => {
        if (!entry) return null;
        const d = new Date(entry.generatedAt).toLocaleDateString();
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>✅ Generated {d}</span>
                {entry.filePath && (
                    <button
                        onClick={() => openFile(entry.filePath!)}
                        style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Open PDF
                    </button>
                )}
            </div>
        );
    };

    // ── Styles ──
    const card: React.CSSProperties = {
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 18,
    };

    const sectionTitle: React.CSSProperties = {
        fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14
    };

    const btn = (variant: 'primary' | 'secondary' | 'ghost', disabled = false): React.CSSProperties => ({
        padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1, border: 'none',
        background: variant === 'primary' ? 'var(--primary)' : variant === 'secondary' ? 'var(--bg-app)' : 'transparent',
        color: variant === 'primary' ? '#fff' : 'var(--text-main)',
        ...(variant === 'secondary' ? { border: '1px solid var(--border-light)' } : {})
    });

    return (
        <div style={{ padding: '0 4px', maxWidth: 860, margin: '0 auto' }}>

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>📋 Tax Season Center</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                        Generate, preview, and download your required tax forms
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tax Year:</label>
                    <select
                        value={taxYear}
                        onChange={e => setTaxYear(parseInt(e.target.value))}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600 }}
                    >
                        {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Tab switcher ──────────────────────────────────────── */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 20,
                background: 'var(--bg-card)', borderRadius: 10, padding: 4,
                border: '1px solid var(--border-light)', width: 'fit-content'
            }}>
                {(['forms', 'guide'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '7px 18px', borderRadius: 7, fontWeight: 600, fontSize: 13,
                            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                            background: activeTab === tab ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                        }}
                    >
                        {tab === 'forms' ? '📋 Tax Forms' : '📤 SSA Filing Guide'}
                    </button>
                ))}
            </div>

            {activeTab === 'guide' && <SSAFilingGuide />}

            {activeTab === 'forms' && loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
            {activeTab === 'forms' && !loading && (
                <>
                    {/* ── Deadlines ───────────────────────────────────────── */}
                    {activeNotifications.length > 0 && (
                        <div style={card}>
                            <div style={sectionTitle}>⏰ Upcoming Deadlines</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {activeNotifications.map(n => {
                                    const c = LEVEL_COLORS[n.level];
                                    return (
                                        <div
                                            key={n.id}
                                            style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                background: c.bg, border: `1px solid ${c.border}`,
                                                borderRadius: 10, padding: '12px 16px'
                                            }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: c.text }}>{n.message}</div>
                                                {n.isGenerated && (
                                                    <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✅ Form already generated for {taxYear}</div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 16 }}>
                                                <DeadlineBadge daysUntil={n.daysUntil} level={n.level} />
                                                <button
                                                    onClick={() => dismissNotif(n.id)}
                                                    style={{ ...btn('ghost'), fontSize: 11, color: c.text, padding: '4px 8px' }}
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Legal disclaimer ────────────────────────────────── */}
                    <div style={{
                        background: 'rgba(var(--primary-rgb), 0.06)',
                        border: '1px solid rgba(var(--primary-rgb), 0.2)',
                        borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)'
                    }}>
                        ⚖️ <strong>Legal Note:</strong> These PDFs are pre-filled reference documents.
                        W-2 Copy A must be submitted to the SSA via Business Services Online (BSO). DR 1093 must be filed
                        with the Colorado DOR by Jan 31. Schedule H is filed with your personal Form 1040 by April 15.
                    </div>

                    {/* ── Form W-2 ────────────────────────────────────────── */}
                    <div style={card}>
                        <div style={sectionTitle}>Form W-2 — Wage and Tax Statement</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
                            Generate individual W-2 PDFs for each caregiver. Provide Copy B to each caregiver by <strong>January 31</strong>.
                        </p>

                        {caregivers.length === 0 && (
                            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No finalized payroll records found for {taxYear}.</p>
                        )}

                        {caregivers.map(cg => {
                            const last = lastGenerated('W2', cg.caregiverId);
                            const key = `w2_${cg.caregiverId}`;
                            return (
                                <div key={cg.caregiverId} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    borderBottom: '1px solid var(--border-light)', padding: '12px 0'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>👤 {cg.caregiverName}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                                            Gross: ${cg.grossWages.toFixed(2)} · FIT: ${cg.federalWithholding.toFixed(2)}
                                        </div>
                                        <GeneratedBadge entry={last} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button style={btn('secondary')} onClick={() => setPreviewForm('W2')}>
                                            Preview Data
                                        </button>
                                        <button
                                            style={btn('primary', generating === key)}
                                            disabled={generating === key}
                                            onClick={() => generate(
                                                () => ipc('taxForm:generateW2', taxYear, cg.caregiverId),
                                                key, `W-2 for ${cg.caregiverName} saved successfully`
                                            )}
                                        >
                                            {generating === key ? 'Generating…' : '📄 Generate PDF'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {caregivers.length > 1 && (
                            <div style={{ marginTop: 14 }}>
                                <button
                                    style={btn('primary', generating === 'w2_all')}
                                    disabled={generating === 'w2_all'}
                                    onClick={() => generate(
                                        () => ipc('taxForm:generateW2All', taxYear),
                                        'w2_all', 'All W-2s saved to selected folder'
                                    )}
                                >
                                    {generating === 'w2_all' ? 'Generating…' : '📦 Generate All W-2s (Choose Folder)'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Schedule H ──────────────────────────────────────── */}
                    <div style={card}>
                        <div style={sectionTitle}>IRS Schedule H — Form 1040 (Federal)</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
                            Pre-fill all Schedule H lines from your payroll records. File with your personal Form 1040 by <strong>April 15</strong>.
                        </p>

                        {(() => {
                            const last = lastGenerated('SCHEDULE_H');
                            return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <GeneratedBadge entry={last} />
                                        {!last && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Not yet generated for {taxYear}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button style={btn('secondary')} onClick={() => setPreviewForm('SCHEDULE_H')}>
                                            Preview Data
                                        </button>
                                        <button
                                            style={btn('primary', generating === 'sch_h')}
                                            disabled={generating === 'sch_h'}
                                            onClick={() => generate(
                                                () => ipc('taxForm:generateScheduleH', taxYear),
                                                'sch_h', 'Schedule H PDF saved successfully'
                                            )}
                                        >
                                            {generating === 'sch_h' ? 'Generating…' : '📄 Generate PDF'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* ── Form W-3 ─────────────────────────────────────────── */}
                    <div style={card}>
                        <div style={sectionTitle}>Form W-3 — SSA W-2 Transmittal</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 8 }}>
                            Employer-level cover sheet that summarises all W-2 forms submitted to the
                            Social Security Administration. Due <strong>January 31</strong> (same as W-2).
                            If filing electronically via <strong>SSA Business Services Online (BSO)</strong>,
                            a paper W-3 is not required.
                        </p>
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#1d4ed8', marginBottom: 14 }}>
                            ☑️ Box b: <strong>Hshld. emp.</strong> will be pre-checked — household employers file household
                            employment taxes via <strong>Schedule H</strong>, not Form 941.
                        </div>
                        {(() => {
                            const last = lastGenerated('W3');
                            return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <GeneratedBadge entry={last} />
                                        {!last && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Not yet generated for {taxYear}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button style={btn('secondary')} onClick={() => setPreviewForm('W3')}>
                                            Preview Totals
                                        </button>
                                        <button
                                            style={btn('primary', generating === 'w3')}
                                            disabled={generating === 'w3'}
                                            onClick={() => generate(
                                                () => ipc('taxForm:generateW3', taxYear),
                                                'w3', 'W-3 Transmittal PDF saved successfully'
                                            )}
                                        >
                                            {generating === 'w3' ? 'Generating…' : '📄 Generate PDF'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* ── DR 1093 ─────────────────────────────────────────── */}
                    <div style={card}>
                        <div style={sectionTitle}>Colorado DR 1093 — Annual W-2 Transmittal</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }}>
                            Annual transmittal of state W-2 forms to the Colorado DOR. File by <strong>January 31</strong>.
                        </p>

                        {/* ── Line 2 Payment Tracker ───────────────────────── */}
                        <div style={{
                            background: 'rgba(var(--primary-rgb), 0.04)',
                            border: '1px solid rgba(var(--primary-rgb), 0.15)',
                            borderRadius: 10, padding: '16px 18px', marginBottom: 18
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                🏔 CDOR Payment Tracker — DR 1093 Line 2
                            </div>
                            <TaxPaymentTracker taxYear={taxYear} />
                        </div>

                        {/* ── Generate button ──────────────────────────────── */}
                        {(() => {
                            const last = lastGenerated('DR_1093');
                            return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <GeneratedBadge entry={last} />
                                        {!last && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Not yet generated for {taxYear}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button style={btn('secondary')} onClick={() => setPreviewForm('DR_1093')}>
                                            Preview Data
                                        </button>
                                        <button
                                            style={btn('primary', generating === 'dr1093')}
                                            disabled={generating === 'dr1093'}
                                            onClick={() => generate(
                                                () => ipc('taxForm:generateDR1093', taxYear),
                                                'dr1093', 'DR 1093 PDF saved successfully'
                                            )}
                                        >
                                            {generating === 'dr1093' ? 'Generating…' : '📄 Generate PDF'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* ── Generation History ──────────────────────────────── */}
                    {formLog.length > 0 && (
                        <div style={card}>
                            <div style={sectionTitle}>📁 Generation History ({taxYear})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {formLog.map(entry => (
                                    <div
                                        key={entry.id}
                                        style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '8px 12px', borderRadius: 8, background: 'var(--bg-app)', fontSize: 13
                                        }}
                                    >
                                        <div>
                                            <span style={{ fontWeight: 600 }}>
                                                {entry.formType === 'W2' ? '📄 W-2' :
                                                 entry.formType === 'W3' ? '📤 W-3 Transmittal' :
                                                 entry.formType === 'SCHEDULE_H' ? '📋 Schedule H' : '🏔 DR 1093'}
                                            </span>
                                            {entry.caregiverName && <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>— {entry.caregiverName}</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                                            <span>{new Date(entry.generatedAt).toLocaleString()}</span>
                                            {entry.filePath && (
                                                <button
                                                    onClick={() => openFile(entry.filePath!)}
                                                    style={{ ...btn('ghost'), fontSize: 11, padding: '2px 8px', color: 'var(--primary)' }}
                                                >
                                                    Open
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Preview Modal ────────────────────────────────────────────── */}
            {previewForm && (
                <PreviewModal
                    formType={previewForm}
                    year={taxYear}
                    onClose={() => setPreviewForm(null)}
                />
            )}
        </div>
    );
};

export default TaxCenter;
