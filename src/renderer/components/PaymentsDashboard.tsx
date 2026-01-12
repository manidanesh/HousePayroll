import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';

interface PaymentRecord {
    id: number;
    caregiverId: number;
    amount: number;
    currency: string;
    stripeId?: string;
    status: 'pending' | 'paid' | 'failed';
    errorMessage?: string;
    createdAt: string;
}

const PaymentsDashboard: React.FC = () => {
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [caregivers, setCaregivers] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [history, cgList] = await Promise.all([
                ipcAPI.payment.getHistory(50),
                ipcAPI.caregiver.getAll(true)
            ]);
            setPayments(history);
            setCaregivers(cgList);
        } catch (error) {
            toast.error('Failed to load payments');
        } finally {
            setLoading(false);
        }
    };

    const getCaregiverName = (id: number) => {
        const cg = caregivers.find(c => c.id === id);
        return cg ? cg.fullLegalName : `Unknown (${id})`;
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'paid': return 'status-paid';
            case 'pending': return 'status-pending';
            case 'failed': return 'status-failed';
            default: return '';
        }
    };

    return (
        <div className="payments-dashboard">
            <div className="stats-grid">
                <div className="stat-card">
                    <label>Total Payouts</label>
                    <div className="stat-value">
                        ${payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="stat-card">
                    <label>Pending ACH</label>
                    <div className="stat-value" style={{ color: 'var(--warning-color)' }}>
                        ${payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            <div className="history-section" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3>Transaction History</h3>
                    <button className="btn-secondary btn-small" onClick={loadData}>🔄 Refresh</button>
                </div>

                {loading ? (
                    <p>Loading transactions...</p>
                ) : payments.length === 0 ? (
                    <div className="empty-state">
                        <p>No transactions found. Payments initiated via Stripe will appear here.</p>
                    </div>
                ) : (
                    <table className="caregivers-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Caregiver</th>
                                <th>Amount</th>
                                <th>Stripe ID</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(payment => (
                                <tr key={payment.id}>
                                    <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                                    <td>{getCaregiverName(payment.caregiverId)}</td>
                                    <td>${payment.amount.toFixed(2)}</td>
                                    <td style={{ fontSize: '12px', fontFamily: 'monospace', color: '#666' }}>
                                        {payment.stripeId || '-'}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${getStatusBadgeClass(payment.status)}`}>
                                            {payment.status.toUpperCase()}
                                        </span>
                                        {payment.errorMessage && (
                                            <div style={{ fontSize: '10px', color: 'var(--danger-color)', marginTop: '4px' }}>
                                                {payment.errorMessage}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default PaymentsDashboard;
