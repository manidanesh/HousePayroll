import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';
import PayrollDetail from './PayrollDetail';
import UnpaidWorkCalendar from './UnpaidWorkCalendar';
import { useCaregiver } from '../context/caregiver-context';
import { PaystubGenerator } from '../../utils/paystub-generator';

const PayrollHistory: React.FC = () => {
    const { selectedCaregiver } = useCaregiver();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'payroll' | 'transactions'>('payroll');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [caregivers, setCaregivers] = useState<any[]>([]);
    const [selectedCaregiverId, setSelectedCaregiverId] = useState<number | 'all'>(selectedCaregiver?.id || 'all');

    const loadHistory = async () => {
        setLoading(true);
        try {
            const [payrollData, txData, caregiverData] = await Promise.all([
                ipcAPI.payroll.getHistory(),
                ipcAPI.payment.getTransactionHistory(),
                ipcAPI.caregiver.getAll()
            ]);
            setHistory(payrollData);
            setTransactions(txData);
            setCaregivers(caregiverData);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const handleDownloadPDF = async (e: React.MouseEvent, recordId: number) => {
        e.stopPropagation(); // Prevent row click
        const toastId = toast.loading('Generating PDF...');

        try {
            const context = await ipcAPI.payroll.getPaystubContext(recordId);
            if (!context) throw new Error('Record not found');

            const employer = await ipcAPI.employer.get();
            const caregiver = await ipcAPI.caregiver.getById(context.record.caregiverId);

            const defaultName = `Paystub_${caregiver.fullLegalName}_${context.record.paymentDate}.pdf`;
            const pdfBytes = PaystubGenerator.generatePDFBytes(context, employer, caregiver);

            const result = await ipcAPI.system.promptSaveFile(defaultName, pdfBytes);

            if (result.success) {
                toast.success('PDF saved successfully', { id: toastId });
            } else {
                toast.dismiss(toastId);
            }
        } catch (err: any) {
            console.error(err);
            toast.error(`Failed to download PDF: ${err.message}`, { id: toastId });
        }
    };

    const f = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    if (selectedRecordId) {
        return <PayrollDetail recordId={selectedRecordId} onBack={() => {
            setSelectedRecordId(null);
            loadHistory(); // Refresh to ensure strict consistency
        }} />;
    }

    return (
        <div className="payroll-history">
            <div className="section-header-card card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Payroll & Payment History</h2>
                    <p className="text-muted">View all finalized payroll runs and electronic transactions</p>
                </div>
                <button className="btn-secondary" onClick={loadHistory}>Refresh</button>
            </div>

            <div className="tabs-container" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="tabs" style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className={`btn-tab ${activeTab === 'payroll' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payroll')}
                    >
                        Payroll Records
                    </button>
                    <button
                        className={`btn-tab ${activeTab === 'transactions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transactions')}
                    >
                        Electronic Transactions
                    </button>
                </div>

                {!selectedCaregiver && (
                    <div className="filter-box">
                        <select
                            className="form-select select-small"
                            value={String(selectedCaregiverId)}
                            onChange={(e) => setSelectedCaregiverId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            style={{ minWidth: '200px' }}
                        >
                            <option value="all">All Caregivers</option>
                            {caregivers.map(c => (
                                <option key={c.id} value={c.id}>{c.fullLegalName}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="history-list card">
                {loading ? (
                    <div className="loading">Loading history...</div>
                ) : activeTab === 'payroll' ? (
                    (() => {
                        const filtered = selectedCaregiverId === 'all'
                            ? history
                            : history.filter(h => h.caregiverId === selectedCaregiverId);

                        return filtered.length === 0 ? (
                            <div className="empty-state">
                                <p>No payroll records found for this selection.</p>
                            </div>
                        ) : (
                            <table className="preview-table interactive">
                                <thead>
                                    <tr>
                                        <th>Caregiver</th>
                                        <th>Pay Date</th>
                                        <th>Doc #</th>
                                        <th>Pay Period</th>
                                        <th>Gross Pay</th>
                                        <th>Taxes</th>
                                        <th>Net Pay</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(record => {
                                        // Calculate total employee taxes for display
                                        const totalTaxes =
                                            (record.ssEmployee || 0) +
                                            (record.medicareEmployee || 0) +
                                            (record.federalWithholding || 0) +
                                            (record.colorado_famli_employee || 0);

                                        return (
                                            <tr key={record.id} onClick={() => setSelectedRecordId(record.id)} style={{ cursor: 'pointer' }}>
                                                <td style={{ fontWeight: 600 }}>{record.caregiverName}</td>
                                                <td>{record.paymentDate}</td>
                                                <td>{record.checkNumber}</td>
                                                <td>{record.payPeriodStart} - {record.payPeriodEnd}</td>
                                                <td>{f(record.grossWages)}</td>
                                                <td style={{ color: '#d32f2f' }}>-{f(totalTaxes)}</td>
                                                <td style={{ fontWeight: 600, color: '#2e7d32' }}>{f(record.netPay)}</td>
                                                <td>
                                                    <span className={`status-badge ${record.isVoided ? 'inactive' : 'active'}`}>
                                                        {record.isVoided ? 'VOIDED' : 'PAID'}
                                                    </span>
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        className="btn-small btn-secondary"
                                                        onClick={(e) => handleDownloadPDF(e, record.id)}
                                                        title="Download Paystub PDF"
                                                        style={{ padding: '4px 8px', fontSize: '12px' }}
                                                    >
                                                        ⬇️ PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        );
                    })()
                ) : (
                    (() => {
                        const filtered = selectedCaregiverId === 'all'
                            ? transactions
                            : transactions.filter(t => t.caregiver_id === selectedCaregiverId);

                        return filtered.length === 0 ? (
                            <div className="empty-state">
                                <p>No electronic transactions found for this selection.</p>
                            </div>
                        ) : (
                            <table className="preview-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Caregiver</th>
                                        <th>Amount</th>
                                        <th>Source</th>
                                        <th>Destination</th>
                                        <th>Stripe ID</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(tx => (
                                        <tr key={tx.id}>
                                            <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                                            <td>{tx.caregiver_name}</td>
                                            <td style={{ fontWeight: 600 }}>{f(tx.amount_cents / 100)}</td>
                                            <td className="text-muted" style={{ fontSize: '12px' }}>{tx.source_masked}</td>
                                            <td className="text-muted" style={{ fontSize: '12px' }}>{tx.dest_masked}</td>
                                            <td className="text-muted" style={{ fontSize: '11px', fontFamily: 'monospace' }}>{tx.stripe_tx_id || 'N/A'}</td>
                                            <td>
                                                <span className={`status-badge ${tx.status}`}>
                                                    {tx.status.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        );
                    })()
                )}
            </div >

            <UnpaidWorkCalendar />

            <style>{`
                .interactive tbody tr:hover {
                    background-color: #f1f5f9;
                }
                .btn-tab {
                    padding: 8px 16px;
                    border: none;
                    background: none;
                    color: var(--text-muted);
                    font-weight: 600;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s;
                }
                .btn-tab.active {
                    color: var(--primary-color);
                    border-bottom-color: var(--primary-color);
                }
                .status-badge.paid { background-color: #e8f5e9; color: #2e7d32; }
                .status-badge.pending { background-color: #fff3e0; color: #ef6c00; }
                .status-badge.failed { background-color: #ffebee; color: #d32f2f; }
            `}</style>
        </div >
    );
};

export default PayrollHistory;
