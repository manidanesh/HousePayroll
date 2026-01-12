import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import SuccessModal from './SuccessModal';
import { useCaregiver } from '../context/caregiver-context';

const Reports: React.FC = () => {
    const { selectedCaregiver } = useCaregiver();
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [ytdData, setYtdData] = useState<any[]>([]);
    const [capStatus, setCapStatus] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [trends, setTrends] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [exporting, setExporting] = useState<boolean>(false);
    const [employer, setEmployer] = useState<any>(null);
    const [quarter, setQuarter] = useState<number>(Math.floor((new Date().getMonth() + 3) / 3));
    const [ean, setEan] = useState<string>('');
    const [showScheduleHAssistant, setShowScheduleHAssistant] = useState<boolean>(false);
    const [scheduleHData, setScheduleHData] = useState<any>(null);
    const [successModal, setSuccessModal] = useState<{ open: boolean, title: string, message: string }>({
        open: false,
        title: '',
        message: ''
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [ytd, caps, history, trendData, employer] = await Promise.all([
                ipcAPI.reports.getYTDSummary(year, selectedCaregiver?.id),
                ipcAPI.reports.getTaxCapStatus(year, selectedCaregiver?.id),
                ipcAPI.reports.getPayments(30, selectedCaregiver?.id),
                ipcAPI.reports.getTrends(year, selectedCaregiver?.id),
                ipcAPI.employer.get()
            ]);
            setYtdData(ytd);
            setCapStatus(caps);
            setPayments(history);
            setTrends(trendData);
            if (employer) {
                setEmployer(employer);
                setEan(employer.uiAccountNumber || '');
            }
        } catch (err: any) {
            toast.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [year]);

    const handleOpenScheduleHAssistant = async () => {
        try {
            const data = await ipcAPI.reports.getScheduleHData(year);
            setScheduleHData(data);
            setShowScheduleHAssistant(true);
        } catch (err: any) {
            toast.error('Failed to get Schedule H data');
            alert('Failed to load Schedule H data.');
        }
    };

    const handleExportYearEnd = async () => {
        setExporting(true);
        try {
            const result = await ipcAPI.reports.exportYearEnd(year);
            if (result.success) {
                setSuccessModal({
                    open: true,
                    title: 'Export Successful',
                    message: `Year-End Package successfully exported to:\n${result.path}`
                });
            }
        } catch (err: any) {
            toast.error('Export failed');
            alert('Failed to generate export package. Check logs.');
        } finally {
            setExporting(false);
        }
    };
    const handleExportScheduleH = async () => {
        setExporting(true);
        try {
            const result = await ipcAPI.reports.exportScheduleH(year);
            if (result.success) {
                setSuccessModal({
                    open: true,
                    title: 'Export Successful',
                    message: `IRS Schedule H Summary exported successfully to:\n${result.path}`
                });
            }
        } catch (err: any) {
            toast.error('Schedule H export failed');
            alert('Failed to export Schedule H Summary.');
        } finally {
            setExporting(false);
        }
    };

    const handleExportSUI = async () => {
        if (!ean) {
            alert('Please enter your Colorado Employer Account Number (EAN) first.');
            return;
        }
        setExporting(true);
        try {
            const result = await ipcAPI.tax.exportSUI(year, quarter, ean);
            if (result.success) {
                setSuccessModal({
                    open: true,
                    title: 'Export Successful',
                    message: `Colorado SUI (MyUI+) CSV exported to:\n${result.path}`
                });
            }
        } catch (err: any) {
            toast.error('SUI export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleExportFAMLI = async () => {
        setExporting(true);
        try {
            const result = await ipcAPI.tax.exportFAMLI(year, quarter);
            if (result.success) {
                setSuccessModal({
                    open: true,
                    title: 'Export Successful',
                    message: `Colorado FAMLI CSV exported to:\n${result.path}`
                });
            }
        } catch (err: any) {
            toast.error('FAMLI export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleGenerateW2 = async (caregiverId: number, caregiverName: string) => {
        setExporting(true);
        try {
            const result = await ipcAPI.tax.generateW2(year, caregiverId);
            if (result.success) {
                setSuccessModal({
                    open: true,
                    title: 'W-2 Generated',
                    message: `Form W-2 for ${caregiverName} successfully generated and saved to:\n${result.path}`
                });
            }
        } catch (err: any) {
            toast.error('W-2 generation failed');
            alert('Failed to generate W-2. Ensure address information is set up in Caregiver settings.');
        } finally {
            setExporting(false);
        }
    };

    const handleVoid = async (id: number) => {
        const reason = prompt('Please enter a reason for voiding this payment:');
        if (!reason) return;

        if (confirm('Are you sure you want to void this payment? This action is permanent and will remove it from financial totals.')) {
            try {
                await ipcAPI.payroll.void(id, reason);
                await loadData();
                setSuccessModal({
                    open: true,
                    title: 'Payment Voided',
                    message: 'The payroll record has been successfully voided.'
                });
            } catch (err: any) {
                toast.error('Failed to void payment');
                alert('Failed to void payment');
            }
        }
    };

    if (loading) return <div className="loading-screen"><h2>Loading reports...</h2></div>;

    return (
        <div className="reports-container">
            <header className="section-header">
                <h2>Reports & Financial Summaries</h2>
                <div className="year-selector">
                    <label>Year: </label>
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </header>

            <div className="compliance-note" style={{
                background: 'rgba(var(--primary-rgb), 0.1)',
                padding: '12px 20px',
                borderRadius: '8px',
                marginBottom: '24px',
                fontSize: '14px',
                borderLeft: '4px solid var(--primary)',
                color: 'var(--text-main)',
                lineHeight: '1.4'
            }}>
                <strong>⚖️ Compliance Note:</strong> This application prepares data for Colorado state filing (MyUI+ and My FAMLI+).
                Final filing and payment must be completed through the respective state portals.
            </div>

            <div className="reports-grid">
                {/* Monthly Trends Chart */}
                <section className="report-card full-width">
                    <h3>Monthly Wage Trends</h3>
                    <div style={{ width: '100%', height: 300, marginTop: '20px' }}>
                        <ResponsiveContainer>
                            <BarChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--primary)' }}
                                />
                                <Bar dataKey="wages" radius={[4, 4, 0, 0]}>
                                    {trends.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.wages > 0 ? 'var(--primary)' : 'var(--bg-app)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Tax Cap Progress Cards */}
                <section className="report-card full-width">
                    <h3>Legal Compliance: Tax Cap Tracking</h3>
                    <div className="cap-progress-grid">
                        {capStatus.map(cap => (
                            <div key={cap.caregiverId} className="cap-caregiver-item">
                                <h4>{cap.caregiverName}</h4>
                                <div className="progress-group">
                                    <label>FUTA ($7,000 Cap):</label>
                                    <div className="progress-bar-container">
                                        <div
                                            className={`progress-bar ${cap.futaReached ? 'cap-reached' : ''}`}
                                            style={{ width: `${(cap.futaWages / 7000) * 100}%` }}
                                        ></div>
                                    </div>
                                    <span>${cap.futaWages.toFixed(2)} / $7,000.00</span>
                                </div>
                                <div className="progress-group">
                                    <label>SUI (${(employer?.suiWageBase || 16000).toLocaleString()} Cap):</label>
                                    <div className="progress-bar-container">
                                        <div
                                            className={`progress-bar ${cap.grossWages >= (employer?.suiWageBase || 16000) ? 'cap-reached' : ''}`}
                                            style={{ width: `${Math.min(100, (cap.sutaWages / (employer?.suiWageBase || 16000)) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <span>${cap.sutaWages.toFixed(2)} / ${(employer?.suiWageBase || 16000).toLocaleString()}.00</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* YTD Summary Table */}
                <section className="report-card full-width">
                    <h3>Year-to-Date Financial Summary</h3>
                    <div className="table-responsive">
                        <table className="reporting-table">
                            <thead>
                                <tr>
                                    <th>Caregiver</th>
                                    <th>Gross Wages</th>
                                    <th>SS (Emp)</th>
                                    <th>Medicare (Emp)</th>
                                    <th>FIT</th>
                                    <th>FAMLI (EE)</th>
                                    <th>Net Pay</th>
                                    <th>Employer Taxes</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ytdData.map(item => (
                                    <tr key={item.caregiverId}>
                                        <td>{item.caregiverName}</td>
                                        <td>${item.grossWages.toFixed(2)}</td>
                                        <td>${item.ssEmployee.toFixed(2)}</td>
                                        <td>${item.medicareEmployee.toFixed(2)}</td>
                                        <td>${item.federalWithholding.toFixed(2)}</td>
                                        <td>${item.coloradoFamliEmployee.toFixed(2)}</td>
                                        <td className="bold">${item.netPay.toFixed(2)}</td>
                                        <td className="text-danger">${item.totalEmployerTaxes.toFixed(2)}</td>
                                        <td>
                                            <button
                                                className="btn-link"
                                                onClick={() => handleGenerateW2(item.caregiverId, item.caregiverName)}
                                                disabled={exporting}
                                            >
                                                📄 W-2
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Recent Payments Table */}
                <section className="report-card full-width">
                    <h3>Recent Payment History</h3>
                    <div className="table-responsive">
                        <table className="reporting-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Caregiver</th>
                                    <th>Period</th>
                                    <th>Gross</th>
                                    <th>Net</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id} className={p.is_voided ? 'row-voided' : ''}>
                                        <td>{p.payment_date || 'N/A'}</td>
                                        <td>{p.caregiver_name}</td>
                                        <td className="text-small">{p.pay_period_start} - {p.pay_period_end}</td>
                                        <td>${p.gross_wages.toFixed(2)}</td>
                                        <td className="bold">${p.net_pay.toFixed(2)}</td>
                                        <td>
                                            <span className={`status-badge ${p.is_voided ? 'inactive' : 'active'}`}>
                                                {p.is_voided ? 'VOIDED' : 'PAID'}
                                            </span>
                                            {p.is_late_payment === 1 && !p.is_voided && (
                                                <span className="status-badge warning" style={{ marginLeft: '4px', background: '#fee2e2', color: '#991b1b' }}>
                                                    LATE
                                                </span>
                                            )}
                                            {p.i9_snapshot === 0 && !p.is_voided && (
                                                <span className="status-badge warning" style={{ marginLeft: '4px', background: '#fee2e2', color: '#991b1b', border: '1px solid #ef4444' }}>
                                                    NO I-9
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {!p.is_voided && (
                                                <button
                                                    className="btn-link text-danger"
                                                    onClick={() => handleVoid(p.id)}
                                                >
                                                    Void
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {payments.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center">No payment records found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="report-card">
                    <h3>Year-End Accountant Package</h3>
                    <p>Generate a professional ZIP package containing all paystubs, YTD summaries, and Schedule H data.</p>

                    <div style={{ margin: '12px 0', padding: '10px', background: '#f5f7fa', borderRadius: '6px', fontSize: '13px', color: '#666', borderLeft: '3px solid #cbd5e0' }}>
                        <strong>ℹ️ Federal Filing Note:</strong> Household employers report Federal taxes (FICA, FUTA, FIT) <strong>annually</strong> via IRS Schedule H. This app does not generate Form 941 (Quarterly Federal Return) as it is not required for household employers.
                    </div>

                    <div className="export-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                        <button className="btn-primary" onClick={handleExportYearEnd} disabled={exporting}>
                            {exporting ? '📦 Exporting...' : '📦 Year-End Package (ZIP)'}
                        </button>
                        <button className="btn-secondary" onClick={handleExportScheduleH} disabled={exporting}>
                            📜 Schedule H Summary (CSV)
                        </button>
                        <button className="btn-secondary" onClick={handleOpenScheduleHAssistant}>
                            📋 Schedule H Assistant
                        </button>
                    </div>
                </section>

                <section className="report-card">
                    <h3>Colorado Tax Filing (Quarterly)</h3>
                    <p>Generate bulk-upload CSV files for Colorado state filing portals.</p>

                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label>Quarter:</label>
                        <select
                            value={quarter}
                            onChange={(e) => setQuarter(parseInt(e.target.value))}
                            style={{ padding: '8px', borderRadius: '4px', marginLeft: '10px' }}
                        >
                            <option value={1}>Q1 (Jan-Mar)</option>
                            <option value={2}>Q2 (Apr-Jun)</option>
                            <option value={3}>Q3 (Jul-Sep)</option>
                            <option value={4}>Q4 (Oct-Dec)</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label>Colorado EAN:</label>
                        <input
                            type="text"
                            value={ean}
                            onChange={(e) => setEan(e.target.value)}
                            placeholder="7-digit Account Number"
                            style={{ padding: '8px', borderRadius: '4px', marginLeft: '10px', width: '150px' }}
                        />
                    </div>

                    <div className="export-actions" style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-secondary" onClick={handleExportSUI} disabled={exporting}>
                            🏔️ MyUI+ (SUI) CSV
                        </button>
                        <button className="btn-secondary" onClick={handleExportFAMLI} disabled={exporting}>
                            🏔️ FAMLI CSV
                        </button>
                    </div>
                </section>
            </div>

            {showScheduleHAssistant && scheduleHData && (
                <div className="modal-overlay" onClick={() => setShowScheduleHAssistant(false)}>
                    <div className="modal-content sch-h-modal" onClick={e => e.stopPropagation()}>
                        <header className="modal-header">
                            <h3>IRS Schedule H Assistant ({year})</h3>
                            <button className="close-btn" onClick={() => setShowScheduleHAssistant(false)}>✕</button>
                        </header>
                        <div className="modal-body">
                            <p className="helper-text">Use these values to complete your federal Schedule H (Form 1040). These calculations are based on your finalized payroll records.</p>

                            <div className="sch-h-table">
                                <div className="sch-h-row header">
                                    <span>Line Item</span>
                                    <span>Value</span>
                                </div>
                                <div className="sch-h-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 1</span>
                                        <span className="line-desc">Total cash wages subject to SS taxes</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line1.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 2</span>
                                        <span className="line-desc">Social Security taxes</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line2.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 3</span>
                                        <span className="line-desc">Total cash wages subject to Medicare</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line3.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 4</span>
                                        <span className="line-desc">Medicare taxes</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line4.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 6</span>
                                        <span className="line-desc">Federal income tax withheld</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line6.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row bold-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 8</span>
                                        <span className="line-desc">Total taxes (SS + Medicare + FIT)</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line8.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row divider"></div>
                                <div className="sch-h-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 10</span>
                                        <span className="line-desc">Total FUTA wages</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line10.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 12</span>
                                        <span className="line-desc">Credit for state unemployment taxes</span>
                                    </div>
                                    <span className="line-val">-${scheduleHData.line12.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 13</span>
                                        <span className="line-desc">FUTA tax (after credit)</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line13.toFixed(2)}</span>
                                </div>
                                <div className="sch-h-row highlight-row">
                                    <div className="line-info">
                                        <span className="line-num">Line 26</span>
                                        <span className="line-desc">Total Household Employment Taxes</span>
                                    </div>
                                    <span className="line-val">${scheduleHData.line26.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-primary" onClick={() => setShowScheduleHAssistant(false)}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .sch-h-modal {
                    max-width: 600px;
                    width: 90%;
                }
                .helper-text {
                    color: var(--text-secondary);
                    font-size: 14px;
                    margin-bottom: 20px;
                    line-height: 1.5;
                }
                .sch-h-table {
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-card);
                    border: 1px solid var(--border-light);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .sch-h-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border-light);
                    align-items: center;
                }
                .sch-h-row:last-child {
                    border-bottom: none;
                }
                .sch-h-row.header {
                    background: var(--bg-app);
                    font-weight: 600;
                    color: var(--text-secondary);
                    font-size: 12px;
                    text-transform: uppercase;
                }
                .line-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .line-num {
                    font-weight: 700;
                    font-size: 12px;
                    color: var(--primary);
                }
                .line-desc {
                    font-size: 14px;
                }
                .line-val {
                    font-family: 'Courier New', monospace;
                    font-weight: 700;
                    font-size: 16px;
                }
                .bold-row {
                    background: rgba(var(--primary-rgb), 0.05);
                    font-weight: 600;
                }
                .highlight-row {
                    background: var(--primary);
                    color: white;
                }
                .highlight-row .line-num, .highlight-row .line-desc {
                    color: white;
                }
                .sch-h-row.divider {
                    height: 8px;
                    background: var(--bg-app);
                    padding: 0;
                }
            `}</style>
            <SuccessModal
                isOpen={successModal.open}
                title={successModal.title}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, open: false })}
            />
        </div>
    );
};

export default Reports;
