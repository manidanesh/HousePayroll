import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';
import { useCaregiver } from '../context/caregiver-context';
import { Caregiver } from '../../types';

const CaregiverManagement: React.FC = () => {
    const { selectedCaregiver, selectCaregiver } = useCaregiver();
    const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingCaregiver, setEditingCaregiver] = useState<Caregiver | null>(null);
    const [onboardingCaregiver, setOnboardingCaregiver] = useState<Caregiver | null>(null);
    const [viewingHistoryId, setViewingHistoryId] = useState<number | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    useEffect(() => {
        loadCaregivers();
    }, [showInactive]);

    const loadCaregivers = async () => {
        try {
            const data = await ipcAPI.caregiver.getAll(showInactive);
            setCaregivers(data);
        } catch (error) {
            toast.error('Failed to load caregivers');
        }
    };

    const handleAddNew = () => {
        setEditingCaregiver(null);
        setShowForm(true);
    };

    const handleEdit = (caregiver: Caregiver) => {
        setEditingCaregiver(caregiver);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingCaregiver(null);
        loadCaregivers();
    };

    const handleDeactivate = async (id: number) => {
        if (confirm('Are you sure you want to deactivate this caregiver?')) {
            try {
                await ipcAPI.caregiver.deactivate(id);
                loadCaregivers();
            } catch (error) {
                toast.error('Failed to deactivate caregiver');
            }
        }
    };

    const handleReactivate = async (id: number) => {
        try {
            await ipcAPI.caregiver.reactivate(id);
            loadCaregivers();
        } catch (error) {
            toast.error('Failed to reactivate caregiver');
        }
    };

    return (
        <div className="caregivers-container">
            <div className="caregivers-header">
                <h2>Caregiver Management</h2>
                <div className="header-actions">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        Show Inactive
                    </label>
                    <button className="btn-primary" onClick={handleAddNew}>
                        + Add Caregiver
                    </button>
                </div>
            </div>

            {showForm && (
                <CaregiverForm
                    caregiver={editingCaregiver}
                    onClose={handleFormClose}
                />
            )}

            {onboardingCaregiver && (
                <StripeBankForm
                    caregiver={onboardingCaregiver}
                    onClose={() => {
                        setOnboardingCaregiver(null);
                        loadCaregivers();
                    }}
                />
            )}

            <div className="caregivers-list">
                {caregivers.length === 0 ? (
                    <div className="empty-state">
                        <p>No caregivers found</p>
                        <button className="btn-primary" onClick={handleAddNew}>
                            Add Your First Caregiver
                        </button>
                    </div>
                ) : (
                    <table className="caregivers-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Hourly Rate</th>
                                <th>Relationship</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {caregivers.map((caregiver) => (
                                <tr key={caregiver.id} className={!caregiver.isActive ? 'inactive' : ''}>
                                    <td>{caregiver.fullLegalName}</td>
                                    <td>${caregiver.hourlyRate.toFixed(2)}/hr</td>
                                    <td>{caregiver.relationshipNote || '-'}</td>
                                    <td>
                                        <span className={`status - badge ${caregiver.isActive ? 'active' : 'inactive'} `}>
                                            {caregiver.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        {caregiver.isActive && (
                                            <button
                                                className="btn-small btn-primary"
                                                onClick={() => selectCaregiver(caregiver)}
                                                disabled={selectedCaregiver?.id === caregiver.id}
                                                style={selectedCaregiver?.id === caregiver.id ? { opacity: 0.6 } : {}}
                                            >
                                                {selectedCaregiver?.id === caregiver.id ? '✓ Selected' : 'Select'}
                                            </button>
                                        )}
                                        <button
                                            className="btn-small btn-secondary"
                                            onClick={() => handleEdit(caregiver)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn-small btn-info"
                                            onClick={() => setViewingHistoryId(caregiver.id)}
                                        >
                                            📜 History
                                        </button>
                                        <button
                                            className="btn-small btn-secondary"
                                            disabled={true}
                                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                            title="Stripe Payouts: Future Release. (Employer Funding Source Required)"
                                        >
                                            💳 Link Stripe (Coming Soon)
                                        </button>
                                        {caregiver.isActive ? (
                                            <button
                                                className="btn-small btn-danger"
                                                onClick={() => handleDeactivate(caregiver.id)}
                                            >
                                                Deactivate
                                            </button>
                                        ) : (
                                            <button
                                                className="btn-small btn-success"
                                                onClick={() => handleReactivate(caregiver.id)}
                                            >
                                                Reactivate
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {viewingHistoryId && (
                <CaregiverHistoryModal
                    caregiverId={viewingHistoryId}
                    caregiverName={caregivers.find(c => c.id === viewingHistoryId)?.fullLegalName || 'Caregiver'}
                    onClose={() => setViewingHistoryId(null)}
                />
            )}
        </div>
    );
};

interface CaregiverFormProps {
    caregiver: Caregiver | null;
    onClose: () => void;
}

const CaregiverForm: React.FC<CaregiverFormProps> = ({ caregiver, onClose }) => {
    const [formData, setFormData] = useState({
        fullLegalName: caregiver?.fullLegalName || '',
        ssn: caregiver?.ssn || '',
        hourlyRate: caregiver?.hourlyRate.toString() || '',
        relationshipNote: caregiver?.relationshipNote || '',
        addressLine1: caregiver?.addressLine1 || '',
        addressLine2: caregiver?.addressLine2 || '',
        city: caregiver?.city || '',
        state: caregiver?.state || '',
        zip: caregiver?.zip || '',
        i9Completed: caregiver?.i9Completed || false,
        i9CompletionDate: caregiver?.i9CompletionDate || '',
        i9Notes: caregiver?.i9Notes || '',
        payoutMethod: caregiver?.payoutMethod || 'check',
        maskedDestinationAccount: caregiver?.maskedDestinationAccount || '',
        stripePayoutId: caregiver?.stripePayoutId || '',
        // W-4 Federal Withholding Information
        w4FilingStatus: caregiver?.w4FilingStatus || 'single',
        w4MultipleJobs: caregiver?.w4MultipleJobs || false,
        w4DependentsAmount: caregiver?.w4DependentsAmount?.toString() || '0',
        w4OtherIncome: caregiver?.w4OtherIncome?.toString() || '0',
        w4Deductions: caregiver?.w4Deductions?.toString() || '0',
        w4ExtraWithholding: caregiver?.w4ExtraWithholding?.toString() || '0',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const formatSSN = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length <= 3) return cleaned;
        if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`;
    };

    const isFormValid = formData.fullLegalName.length >= 3 &&
        formData.ssn.length === 11 &&
        parseFloat(formData.hourlyRate) > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        if (!formData.fullLegalName.trim()) {
            setError('Full legal name is required');
            setLoading(false);
            return;
        }

        if (!formData.ssn.trim()) {
            setError('SSN is required');
            setLoading(false);
            return;
        }

        const hourlyRate = parseFloat(formData.hourlyRate);
        if (isNaN(hourlyRate) || hourlyRate <= 0) {
            setError('Valid hourly rate is required');
            setLoading(false);
            return;
        }

        try {
            if (caregiver) {
                // Update existing caregiver
                await ipcAPI.caregiver.update(caregiver.id, {
                    fullLegalName: formData.fullLegalName,
                    ssn: formData.ssn,
                    hourlyRate,
                    relationshipNote: formData.relationshipNote,
                    addressLine1: formData.addressLine1,
                    addressLine2: formData.addressLine2,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    i9Notes: formData.i9Notes,
                    payoutMethod: formData.payoutMethod,
                    maskedDestinationAccount: formData.maskedDestinationAccount,
                    stripePayoutId: formData.stripePayoutId,
                    // W-4 Information
                    w4FilingStatus: formData.w4FilingStatus as 'single' | 'married' | 'head_of_household',
                    w4MultipleJobs: formData.w4MultipleJobs,
                    w4DependentsAmount: parseFloat(formData.w4DependentsAmount) || 0,
                    w4OtherIncome: parseFloat(formData.w4OtherIncome) || 0,
                    w4Deductions: parseFloat(formData.w4Deductions) || 0,
                    w4ExtraWithholding: parseFloat(formData.w4ExtraWithholding) || 0,
                });
            } else {
                // Create new caregiver
                await ipcAPI.caregiver.create({
                    fullLegalName: formData.fullLegalName,
                    ssn: formData.ssn,
                    hourlyRate,
                    relationshipNote: formData.relationshipNote,
                    addressLine1: formData.addressLine1,
                    addressLine2: formData.addressLine2,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    i9Completed: formData.i9Completed,
                    i9CompletionDate: formData.i9CompletionDate,
                    i9Notes: formData.i9Notes,
                    payoutMethod: formData.payoutMethod,
                    maskedDestinationAccount: formData.maskedDestinationAccount,
                    stripePayoutId: formData.stripePayoutId,
                    // W-4 Information
                    w4FilingStatus: formData.w4FilingStatus as 'single' | 'married' | 'head_of_household',
                    w4MultipleJobs: formData.w4MultipleJobs,
                    w4DependentsAmount: parseFloat(formData.w4DependentsAmount) || 0,
                    w4OtherIncome: parseFloat(formData.w4OtherIncome) || 0,
                    w4Deductions: parseFloat(formData.w4Deductions) || 0,
                    w4ExtraWithholding: parseFloat(formData.w4ExtraWithholding) || 0,
                });
            }

            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save caregiver');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{caregiver ? 'Edit Caregiver' : 'Add New Caregiver'}</h3>

                <form onSubmit={handleSubmit} className="caregiver-form">
                    <div className="form-group">
                        <label>Full Legal Name *</label>
                        <input
                            type="text"
                            value={formData.fullLegalName}
                            onChange={(e) => setFormData({ ...formData, fullLegalName: e.target.value })}
                            placeholder="John Doe"
                            className="form-input"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Social Security Number *</label>
                        <input
                            type="text"
                            value={formData.ssn}
                            onChange={(e) => setFormData({ ...formData, ssn: formatSSN(e.target.value) })}
                            placeholder="000-00-0000"
                            className="form-input"
                            maxLength={11}
                        />
                        {formData.ssn && formData.ssn.length < 11 && <small style={{ color: '#e74c3c' }}>SSN must be 9 digits (000-00-0000)</small>}
                        <div style={{ marginTop: '4px' }}>
                            <small>Encrypted and stored securely</small>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Hourly Rate *</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.hourlyRate}
                            onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                            placeholder="20.00"
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>Relationship Note (Optional)</label>
                        <input
                            type="text"
                            value={formData.relationshipNote}
                            onChange={(e) => setFormData({ ...formData, relationshipNote: e.target.value })}
                            placeholder="e.g., Grandmother's caregiver"
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>Address Line 1</label>
                        <input
                            type="text"
                            value={formData.addressLine1}
                            onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                            placeholder="123 Main St"
                            className="form-input"
                        />
                    </div>

                    <div className="form-grid-3">
                        <div className="form-group">
                            <label>City</label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>State</label>
                            <input
                                type="text"
                                maxLength={2}
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                                className="form-input"
                                placeholder="CO"
                            />
                        </div>
                        <div className="form-group">
                            <label>ZIP</label>
                            <input
                                type="text"
                                value={formData.zip}
                                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                                className="form-input"
                            />
                        </div>
                    </div>

                    <div className="form-section-divider" style={{ margin: '24px 0', borderTop: '1px solid #eee' }}></div>
                    <h4 style={{ marginBottom: '16px' }}>Federal I-9 Verification</h4>

                    <div className="form-group">
                        <label className="checkbox-label" style={{ fontWeight: 'bold' }}>
                            <input
                                type="checkbox"
                                checked={formData.i9Completed}
                                onChange={(e) => setFormData({ ...formData, i9Completed: e.target.checked })}
                            />
                            I-9 Form Completed
                        </label>
                        <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                            Federal law requires employers to verify identity and employment eligibility.
                        </small>
                    </div>

                    {formData.i9Completed && (
                        <div className="form-group">
                            <label>Completion Date</label>
                            <input
                                type="date"
                                value={formData.i9CompletionDate}
                                onChange={(e) => setFormData({ ...formData, i9CompletionDate: e.target.value })}
                                className="form-input"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Optional I-9 Notes</label>
                        <textarea
                            value={formData.i9Notes}
                            onChange={(e) => setFormData({ ...formData, i9Notes: e.target.value })}
                            placeholder="e.g., Documents verified on first day of work"
                            className="form-input"
                            style={{ height: '60px', resize: 'vertical' }}
                        />
                    </div>

                    <div className="form-section-divider" style={{ margin: '24px 0', borderTop: '1px solid #eee' }}></div>
                    <h4 style={{ marginBottom: '16px' }}>Federal Tax Withholding (W-4)</h4>
                    <small style={{ display: 'block', marginBottom: '16px', color: '#666' }}>
                        Configure federal income tax withholding based on employee's Form W-4.
                        Leave defaults if employee hasn't submitted W-4 yet.
                    </small>

                    <div className="form-group">
                        <label>Filing Status *</label>
                        <select
                            value={formData.w4FilingStatus}
                            onChange={(e) => setFormData({ ...formData, w4FilingStatus: e.target.value as 'single' | 'married' | 'head_of_household' })}
                            className="form-input"
                        >
                            <option value="single">Single or Married Filing Separately</option>
                            <option value="married">Married Filing Jointly</option>
                            <option value="head_of_household">Head of Household</option>
                        </select>
                        <small>From W-4 Step 1(c)</small>
                    </div>

                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.w4MultipleJobs}
                                onChange={(e) => setFormData({ ...formData, w4MultipleJobs: e.target.checked })}
                            />
                            Multiple jobs or spouse works (Step 2)
                        </label>
                        <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                            Check if employee has multiple jobs or spouse works. This increases withholding.
                        </small>
                    </div>

                    <div className="form-grid-2">
                        <div className="form-group">
                            <label>Dependents Credit (Annual)</label>
                            <input
                                type="number"
                                step="100"
                                value={formData.w4DependentsAmount}
                                onChange={(e) => setFormData({ ...formData, w4DependentsAmount: e.target.value })}
                                placeholder="0"
                                className="form-input"
                            />
                            <small>From W-4 Step 3 (e.g., $2,000 per child)</small>
                        </div>

                        <div className="form-group">
                            <label>Other Income (Annual)</label>
                            <input
                                type="number"
                                step="100"
                                value={formData.w4OtherIncome}
                                onChange={(e) => setFormData({ ...formData, w4OtherIncome: e.target.value })}
                                placeholder="0"
                                className="form-input"
                            />
                            <small>From W-4 Step 4(a) (interest, dividends)</small>
                        </div>
                    </div>

                    <div className="form-grid-2">
                        <div className="form-group">
                            <label>Deductions (Annual)</label>
                            <input
                                type="number"
                                step="100"
                                value={formData.w4Deductions}
                                onChange={(e) => setFormData({ ...formData, w4Deductions: e.target.value })}
                                placeholder="0"
                                className="form-input"
                            />
                            <small>From W-4 Step 4(b) (itemized deductions)</small>
                        </div>

                        <div className="form-group">
                            <label>Extra Withholding (Per Paycheck)</label>
                            <input
                                type="number"
                                step="1"
                                value={formData.w4ExtraWithholding}
                                onChange={(e) => setFormData({ ...formData, w4ExtraWithholding: e.target.value })}
                                placeholder="0"
                                className="form-input"
                            />
                            <small>From W-4 Step 4(c) (additional per paycheck)</small>
                        </div>
                    </div>

                    <div className="form-section-divider" style={{ margin: '24px 0', borderTop: '1px solid #eee' }}></div>
                    <h4 style={{ marginBottom: '16px' }}>Payment Details</h4>

                    <div className="form-group">
                        <label>Preferred Payout Method</label>
                        <select
                            value={formData.payoutMethod}
                            onChange={(e) => setFormData({ ...formData, payoutMethod: e.target.value as any })}
                            className="form-select"
                        >
                            <option value="check">📄 Paper Check / Cash</option>
                            <option value="electronic">💳 Electronic (Stripe Payout)</option>
                        </select>
                    </div>

                    {formData.payoutMethod === 'electronic' && (
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Masked Bank Account</label>
                                <input
                                    type="text"
                                    value={formData.maskedDestinationAccount}
                                    onChange={(e) => setFormData({ ...formData, maskedDestinationAccount: e.target.value })}
                                    className="form-input"
                                    placeholder="Bank ****1234"
                                />
                            </div>
                            <div className="form-group">
                                <label>Stripe Payout ID</label>
                                <input
                                    type="text"
                                    value={formData.stripePayoutId}
                                    onChange={(e) => setFormData({ ...formData, stripePayoutId: e.target.value })}
                                    className="form-input"
                                    placeholder="acct_... or ba_..."
                                />
                            </div>
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading || !isFormValid}>
                            {loading ? 'Saving...' : caregiver ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface StripeBankFormProps {
    caregiver: Caregiver;
    onClose: () => void;
}

const StripeBankForm: React.FC<StripeBankFormProps> = ({ caregiver, onClose }) => {
    const [routingNumber, setRoutingNumber] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [confirmAccount, setConfirmAccount] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (accountNumber !== confirmAccount) {
            setError('Account numbers do not match');
            return;
        }

        if (routingNumber.length !== 9) {
            setError('Routing number must be 9 digits');
            return;
        }

        setLoading(true);
        try {
            await ipcAPI.stripe.addBankAccount(caregiver.id, routingNumber, accountNumber);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to link bank account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '24px', marginRight: '12px' }}>💳</span>
                    <h3>Stripe Bank Setup</h3>
                </div>

                <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                    <strong>[DEACTIVATED]</strong> Registration of bank details for <strong>{caregiver.fullLegalName}</strong> is currently on hold.
                    Payout support requires an Employer Funding Source configuration (Future Release).
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Routing Number (9 digits)</label>
                        <input
                            type="text"
                            value={routingNumber}
                            onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                            className="form-input"
                            placeholder="123456789"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Account Number</label>
                        <input
                            type="password"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                            className="form-input"
                            placeholder="Enter account number"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Confirm Account Number</label>
                        <input
                            type="text"
                            value={confirmAccount}
                            onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ''))}
                            className="form-input"
                            placeholder="Re-enter account number"
                            required
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="form-actions" style={{ marginTop: '24px' }}>
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={true}>
                            Feature Unavailable
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface CaregiverHistoryModalProps {
    caregiverId: number;
    caregiverName: string;
    onClose: () => void;
}

const CaregiverHistoryModal: React.FC<CaregiverHistoryModalProps> = ({ caregiverId, caregiverName, onClose }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'payroll' | 'transactions'>('payroll');

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const [h, t] = await Promise.all([
                    ipcAPI.payroll.getHistory(),
                    ipcAPI.payment.getTransactionHistory()
                ]);
                setHistory(h.filter(x => x.caregiverId === caregiverId));
                setTransactions(t.filter(x => x.caregiver_id === caregiverId));
            } catch (err) {
                toast.error('Failed to load caregiver history');
            } finally {
                setLoading(false);
            }
        };
        loadHistory();
    }, [caregiverId]);

    const f = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    return (
        <div className="modal-overlay">
            <div className="modal-content wide-modal">
                <div className="modal-header">
                    <h3>Payment History: {caregiverName}</h3>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div className="tabs" style={{ marginBottom: '15px' }}>
                        <button
                            className={`btn - tab ${activeTab === 'payroll' ? 'active' : ''} `}
                            onClick={() => setActiveTab('payroll')}
                        >
                            Payroll Records
                        </button>
                        <button
                            className={`btn - tab ${activeTab === 'transactions' ? 'active' : ''} `}
                            onClick={() => setActiveTab('transactions')}
                        >
                            Electronic Transfers
                        </button>
                    </div>

                    {loading ? (
                        <div className="loading">Loading history...</div>
                    ) : activeTab === 'payroll' ? (
                        history.length === 0 ? <p className="empty-state">No payroll records found.</p> : (
                            <table className="preview-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Doc #</th>
                                        <th>Period</th>
                                        <th>Gross</th>
                                        <th>Net</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(r => (
                                        <tr key={r.id}>
                                            <td>{r.paymentDate}</td>
                                            <td>{r.checkNumber}</td>
                                            <td>{r.payPeriodStart} - {r.payPeriodEnd}</td>
                                            <td>{f(r.grossWages)}</td>
                                            <td style={{ fontWeight: 600 }}>{f(r.netPay)}</td>
                                            <td>
                                                <span className={`status - badge ${r.isVoided ? 'inactive' : 'active'} `}>
                                                    {r.isVoided ? 'VOIDED' : 'PAID'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        transactions.length === 0 ? <p className="empty-state">No electronic transfers found.</p> : (
                            <table className="preview-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Amount</th>
                                        <th>Destination</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(t => (
                                        <tr key={t.id}>
                                            <td>{new Date(t.created_at).toLocaleDateString()}</td>
                                            <td style={{ fontWeight: 600 }}>{f(t.amount_cents / 100)}</td>
                                            <td className="text-muted" style={{ fontSize: '12px' }}>{t.dest_masked}</td>
                                            <td>
                                                <span className={`status - badge ${t.status} `}>
                                                    {t.status.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>

            <style>{`
    .wide - modal { max - width: 800px; width: 90 %; }
                .btn - tab {
    padding: 8px 16px;
    border: none;
    background: none;
    cursor: pointer;
    font - weight: 600;
    border - bottom: 2px solid transparent;
}
                .btn - tab.active {
    color: var(--primary - color);
    border - bottom - color: var(--primary - color);
}
`}</style>
        </div>
    );
};

export default CaregiverManagement;
