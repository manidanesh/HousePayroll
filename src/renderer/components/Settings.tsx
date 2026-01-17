import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';
import { Employer, TaxConfiguration } from '../../types';
import AuditLog from './AuditLog';
import SuccessModal from './SuccessModal';
import TaxConfigurationSettings from './TaxConfigurationSettings';
import { ExportBackupDialog } from './ExportBackupDialog';
import { ImportBackupDialog } from './ImportBackupDialog';

const Settings: React.FC = () => {
    const [employer, setEmployer] = useState<Employer | null>(null);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        displayName: '',
        childName: '',
        payFrequency: 'bi-weekly',
        defaultHourlyRate: '0.00',
        federalWithholdingEnabled: false,
        holidayPayMultiplier: '1.0',
        weekendPayMultiplier: '1.0',
        coloradoSutaRate: '0.0',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zip: '',
        paystubTitle: '',
        serviceAddress: '',
        stripePublishableKey: '',
        stripeSecretKey: '',
        stripeAccountId: '',
        maskedFundingAccount: '',
        fein: '',
        uiAccountNumber: '',
        suiWageBase: '16000',
        suiEffectiveDate: '',
        wcAcknowledged: false,
        wcCarrier: '',
        wcPolicyNumber: '',
        coloradoFamliRateEE: '0.0045',
        coloradoFamliRateER: '0.0045',
    });
    const [error, setError] = useState<string>('');
    const [successModal, setSuccessModal] = useState<{ open: boolean, title: string, message: string }>({
        open: false,
        title: '',
        message: ''
    });
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);

    // Tax Configuration State
    const [taxConfigs, setTaxConfigs] = useState<TaxConfiguration[]>([]);
    const [selectedTaxYear, setSelectedTaxYear] = useState<number>(new Date().getFullYear());
    const [taxConfigData, setTaxConfigData] = useState({
        ssRateEmployee: '0.062',
        ssRateEmployer: '0.062',
        ssWageBase: '176100',
        medicareRateEmployee: '0.0145',
        medicareRateEmployer: '0.0145',
        futaRate: '0.006',
        futaWageBase: '7000',
        notes: ''
    });
    const [taxConfigEditing, setTaxConfigEditing] = useState(false);

    useEffect(() => {
        loadEmployer();
        loadTaxConfigurations();
    }, []);

    useEffect(() => {
        if (selectedTaxYear && taxConfigs.length > 0) {
            loadTaxConfigForYear(selectedTaxYear);
        }
    }, [selectedTaxYear, taxConfigs]);

    // Listen for macOS menu bar events
    useEffect(() => {
        const removeExport = ipcAPI.system.on('trigger-backup-export', () => setShowExportDialog(true));
        const removeImport = ipcAPI.system.on('trigger-backup-import', () => setShowImportDialog(true));

        return () => {
            removeExport();
            removeImport();
        };
    }, []);

    const loadEmployer = async () => {
        try {
            const data = await ipcAPI.employer.get();
            if (data) {
                setEmployer(data);
                setFormData({
                    displayName: data.displayName || '',
                    childName: data.childName || '',
                    payFrequency: data.payFrequency || 'bi-weekly',
                    defaultHourlyRate: data.defaultHourlyRate ? data.defaultHourlyRate.toFixed(2) : '0.00',
                    federalWithholdingEnabled: !!data.federalWithholdingEnabled,
                    holidayPayMultiplier: data.holidayPayMultiplier.toString(),
                    weekendPayMultiplier: data.weekendPayMultiplier.toString(),
                    coloradoSutaRate: data.coloradoSutaRate.toString(),
                    addressLine1: data.addressLine1 || '',
                    addressLine2: data.addressLine2 || '',
                    city: data.city || '',
                    state: data.state || '',
                    zip: data.zip || '',
                    paystubTitle: data.paystubTitle || '',
                    serviceAddress: data.serviceAddress || '',
                    stripePublishableKey: data.stripePublishableKey || '',
                    stripeSecretKey: data.stripeSecretKey || '',
                    stripeAccountId: data.stripeAccountId || '',
                    maskedFundingAccount: data.maskedFundingAccount || '',
                    fein: data.fein || '',
                    uiAccountNumber: data.uiAccountNumber || '',
                    suiWageBase: data.suiWageBase ? data.suiWageBase.toString() : '16000',
                    suiEffectiveDate: data.suiEffectiveDate || '',
                    wcAcknowledged: !!data.wcAcknowledged,
                    wcCarrier: data.wcCarrier || '',
                    wcPolicyNumber: data.wcPolicyNumber || '',
                    coloradoFamliRateEE: data.coloradoFamliRateEE ? data.coloradoFamliRateEE.toString() : '0.0045',
                    coloradoFamliRateER: data.coloradoFamliRateER ? data.coloradoFamliRateER.toString() : '0.0045',
                });
            }
        } catch (error) {
            toast.error('Failed to load employer settings');
        }
    };

    const handleEdit = () => {
        setEditing(true);
        setError('');
        setSuccess('');
    };

    const handleCancel = () => {
        setEditing(false);
        setError('');
        loadEmployer();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // Validation
        const holidayMultiplier = parseFloat(formData.holidayPayMultiplier);
        const weekendMultiplier = parseFloat(formData.weekendPayMultiplier);
        const sutaRate = parseFloat(formData.coloradoSutaRate);
        const hourlyRate = parseFloat(formData.defaultHourlyRate);

        if (isNaN(hourlyRate) || hourlyRate < 0) {
            setError('Hourly rate must be a positive number');
            setLoading(false);
            return;
        }

        if (isNaN(holidayMultiplier) || holidayMultiplier < 1 || holidayMultiplier > 3) {
            setError('Holiday multiplier must be between 1.0 and 3.0');
            setLoading(false);
            return;
        }

        if (isNaN(weekendMultiplier) || weekendMultiplier < 1 || weekendMultiplier > 3) {
            setError('Weekend multiplier must be between 1.0 and 3.0');
            setLoading(false);
            return;
        }

        if (isNaN(sutaRate) || sutaRate < 0 || sutaRate > 1) {
            setError('SUI rate must be between 0 and 1 (e.g., 0.0305 for 3.05%)');
            setLoading(false);
            return;
        }

        const wageBase = parseFloat(formData.suiWageBase);
        if (isNaN(wageBase) || wageBase < 0) {
            setError('SUI Wage Base must be a positive number');
            setLoading(false);
            return;
        }

        if (!formData.displayName.trim()) {
            setError('Display name is required');
            setLoading(false);
            return;
        }

        if (!employer) {
            setError('Employer profile not found');
            setLoading(false);
            return;
        }

        const wcAcknowledgeDateChanged = (formData.wcAcknowledged && (
            formData.wcAcknowledged !== employer.wcAcknowledged ||
            formData.wcCarrier !== employer.wcCarrier ||
            formData.wcPolicyNumber !== employer.wcPolicyNumber
        ));

        try {
            await ipcAPI.employer.update({
                displayName: formData.displayName,
                childName: formData.childName,
                payFrequency: formData.payFrequency as any,
                defaultHourlyRate: hourlyRate,
                federalWithholdingEnabled: formData.federalWithholdingEnabled,
                holidayPayMultiplier: holidayMultiplier,
                weekendPayMultiplier: weekendMultiplier,
                coloradoSutaRate: sutaRate,
                addressLine1: formData.addressLine1,
                addressLine2: formData.addressLine2,
                city: formData.city,
                state: formData.state,
                zip: formData.zip,
                paystubTitle: formData.paystubTitle,
                serviceAddress: formData.serviceAddress,
                stripePublishableKey: formData.stripePublishableKey,
                stripeSecretKey: formData.stripeSecretKey,
                stripeAccountId: formData.stripeAccountId,
                maskedFundingAccount: formData.maskedFundingAccount,
                fein: formData.fein,
                uiAccountNumber: formData.uiAccountNumber,
                suiWageBase: wageBase,
                suiEffectiveDate: formData.suiEffectiveDate,
                wcAcknowledged: formData.wcAcknowledged,
                wcCarrier: formData.wcCarrier,
                wcPolicyNumber: formData.wcPolicyNumber,
                coloradoFamliRateEE: parseFloat(formData.coloradoFamliRateEE),
                coloradoFamliRateER: parseFloat(formData.coloradoFamliRateER),
                wcAcknowledgmentDate: wcAcknowledgeDateChanged ? new Date().toISOString() : employer.wcAcknowledgmentDate
            });

            // If keys were updated, reset the stripe client in the main process
            await ipcAPI.stripe.resetClient();

            setSuccess('Settings updated successfully!');
            setEditing(false);
            loadEmployer();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update settings');
        } finally {
            setLoading(false);
        }
    };

    // Tax Configuration Functions
    const loadTaxConfigurations = async () => {
        try {
            const configs = await ipcAPI.taxConfig.getAll();
            setTaxConfigs(configs);
        } catch (error) {
            toast.error('Failed to load tax configurations');
        }
    };

    const loadTaxConfigForYear = async (year: number) => {
        try {
            const config = await ipcAPI.taxConfig.getForYear(year);
            setTaxConfigData({
                ssRateEmployee: config.ssRateEmployee.toString(),
                ssRateEmployer: config.ssRateEmployer.toString(),
                ssWageBase: config.ssWageBase.toString(),
                medicareRateEmployee: config.medicareRateEmployee.toString(),
                medicareRateEmployer: config.medicareRateEmployer.toString(),
                futaRate: config.futaRate.toString(),
                futaWageBase: config.futaWageBase.toString(),
                notes: config.notes || ''
            });
        } catch (error) {
            toast.error('Failed to load tax configuration');
        }
    };

    const handleTaxConfigChange = (field: string, value: string) => {
        setTaxConfigData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveTaxConfig = async () => {
        try {
            setLoading(true);
            setError('');

            // Validation
            const ssRateEE = parseFloat(taxConfigData.ssRateEmployee);
            const ssRateER = parseFloat(taxConfigData.ssRateEmployer);
            const ssWageBase = parseFloat(taxConfigData.ssWageBase);
            const medicareRateEE = parseFloat(taxConfigData.medicareRateEmployee);
            const medicareRateER = parseFloat(taxConfigData.medicareRateEmployer);
            const futaRate = parseFloat(taxConfigData.futaRate);
            const futaWageBase = parseFloat(taxConfigData.futaWageBase);

            if (isNaN(ssRateEE) || ssRateEE < 0 || ssRateEE > 1) {
                setError('Social Security employee rate must be between 0 and 1');
                setLoading(false);
                return;
            }

            if (isNaN(ssWageBase) || ssWageBase < 0) {
                setError('Social Security wage base must be a positive number');
                setLoading(false);
                return;
            }

            const config = {
                taxYear: selectedTaxYear,
                ssRateEmployee: ssRateEE,
                ssRateEmployer: ssRateER,
                ssWageBase,
                medicareRateEmployee: medicareRateEE,
                medicareRateEmployer: medicareRateER,
                medicareWageBase: null,
                futaRate,
                futaWageBase,
                effectiveDate: `${selectedTaxYear}-01-01`,
                version: `${selectedTaxYear}.1`,
                isDefault: false,
                notes: taxConfigData.notes
            };

            await ipcAPI.taxConfig.upsert(config);
            await loadTaxConfigurations();

            setSuccessModal({
                open: true,
                title: 'Tax Configuration Saved',
                message: `Tax rates for ${selectedTaxYear} have been updated successfully.`
            });
            setTaxConfigEditing(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save tax configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleAddNewTaxYear = () => {
        const nextYear = Math.max(...taxConfigs.map(c => c.taxYear || c.year), new Date().getFullYear()) + 1;
        setSelectedTaxYear(nextYear);
        setTaxConfigEditing(true);
    };

    const handleResetToDefaults = async () => {
        if (confirm(`Reset ${selectedTaxYear} tax configuration to IRS defaults?`)) {
            const defaults = {
                ssRateEmployee: '0.062',
                ssRateEmployer: '0.062',
                ssWageBase: '176100',
                medicareRateEmployee: '0.0145',
                medicareRateEmployer: '0.0145',
                futaRate: '0.006',
                futaWageBase: '7000',
                notes: `IRS ${selectedTaxYear} default rates`
            };
            setTaxConfigData(defaults);
        }
    };

    const handleExport = async () => {
        try {
            const result = await ipcAPI.backup.export();
            if (result.success) {
                setSuccess(`Backup exported successfully to: ${result.path}`);
            }
        } catch (err) {
            setError('Failed to export backup');
            console.error(err);
        }
    };

    const handleImport = async () => {
        const confirmed = confirm('WARNING: Importing a backup will OVERWRITE your current database. This action cannot be undone. All current payroll and caregiver data will be replaced. Are you absolutely sure?');

        if (confirmed) {
            try {
                const result = await ipcAPI.backup.import();
                if (result.success) {
                    setSuccessModal({
                        open: true,
                        title: 'Database Restored',
                        message: 'Database restored successfully.\n\nThe application will now reload to apply changes.'
                    });
                    setTimeout(() => window.location.reload(), 3000);
                }
            } catch (err) {
                setError('Failed to restore backup');
                console.error(err);
            }
        }
    };



    if (!employer) {
        return (
            <div className="settings-container">
                <p>Loading employer profile...</p>
            </div>
        );
    }

    return (
        <div className="settings-container">
            <h2>Employer Settings</h2>

            <div className="settings-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3>Employer Profile</h3>
                    {!editing && (
                        <button className="btn-secondary btn-small" onClick={handleEdit}>
                            ✏️ Edit Profile
                        </button>
                    )}
                </div>
                <p className="section-description">
                    Manage your household employer details, pay rates, and tax settings.
                </p>

                {!editing ? (
                    <div className="settings-display">
                        <div className="info-grid" style={{ marginBottom: '20px' }}>
                            <div className="info-item">
                                <label>Display Name:</label>
                                <span>{employer.displayName}</span>
                            </div>
                            <div className="info-item">
                                <label>Pay Frequency:</label>
                                <span style={{ textTransform: 'capitalize' }}>{employer.payFrequency}</span>
                            </div>
                            <div className="info-item">
                                <label>Default Hourly Rate:</label>
                                <span>${employer.defaultHourlyRate.toFixed(2)}/hr</span>
                            </div>
                            <div className="info-item">
                                <label>Federal Withholding:</label>
                                <span>{employer.federalWithholdingEnabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        </div>

                        <h4>Pay Rate Multipliers & Taxes</h4>
                        <div className="setting-row">
                            <label>Holiday Pay Multiplier:</label>
                            <span className="setting-value">
                                {employer.holidayPayMultiplier}×
                                <span className="setting-example">
                                    (${(employer.defaultHourlyRate * employer.holidayPayMultiplier).toFixed(2)}/hr)
                                </span>
                            </span>
                        </div>

                        <div className="setting-row">
                            <label>Weekend Pay Multiplier:</label>
                            <span className="setting-value">
                                {employer.weekendPayMultiplier}×
                                <span className="setting-example">
                                    (${(employer.defaultHourlyRate * employer.weekendPayMultiplier).toFixed(2)}/hr)
                                </span>
                            </span>
                        </div>

                        <div className="setting-row">
                            <label>Colorado SUI Rate:</label>
                            <span className="setting-value">
                                {(employer.coloradoSutaRate * 100).toFixed(3)}%
                            </span>
                        </div>

                        <h4>Colorado FAMLI Configuration</h4>
                        <div className="setting-row">
                            <label>Employee Rate:</label>
                            <span className="setting-value">{(employer.coloradoFamliRateEE * 100).toFixed(3)}%</span>
                        </div>
                        <div className="setting-row">
                            <label>Employer Rate:</label>
                            <span className="setting-value">{(employer.coloradoFamliRateER * 100).toFixed(3)}%</span>
                        </div>

                        <h4>Colorado SUI / CDLE Configuration</h4>
                        <div className="setting-row">
                            <label>Employer FEIN:</label>
                            <span className="setting-value">{employer.fein ? '•••••••••' : 'Not set'}</span>
                        </div>
                        <div className="setting-row">
                            <label>UI Account Number:</label>
                            <span className="setting-value">{employer.uiAccountNumber ? '••••••••' : 'Not set'}</span>
                        </div>
                        <div className="setting-row">
                            <label>SUI Wage Base:</label>
                            <span className="setting-value">${employer.suiWageBase.toLocaleString()}</span>
                        </div>
                        <div className="setting-row">
                            <label>Rate Effective Date:</label>
                            <span className="setting-value">{employer.suiEffectiveDate || 'Not set'}</span>
                        </div>

                        <div className="setting-row" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                            <label>Address:</label>
                            <span className="setting-value">
                                {employer.addressLine1 ? (
                                    <>
                                        {employer.addressLine1} {employer.addressLine2}, {employer.city}, {employer.state} {employer.zip}
                                    </>
                                ) : 'Not set'}
                            </span>
                        </div>

                        <h4>Paystub Header Options</h4>
                        <div className="setting-row">
                            <label>Child/Patient Name:</label>
                            <span className="setting-value">{employer.childName || 'Not set'}</span>
                        </div>
                        <div className="setting-row">
                            <label>Paystub Title:</label>
                            <span className="setting-value">{employer.paystubTitle || 'Default'}</span>
                        </div>
                        <div className="setting-row">
                            <label>Service Address:</label>
                            <span className="setting-value">{employer.serviceAddress || 'Use Household Address'}</span>
                        </div>

                        <h4>Payment Accounts (Employer Funding)</h4>
                        <div className="setting-row">
                            <label>Electronic Payments:</label>
                            <span className="setting-value">
                                {employer.paymentVerificationStatus === 'verified' ? (
                                    <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>✅ Verified ({employer.maskedFundingAccount || 'Account Linked'})</span>
                                ) : employer.paymentVerificationStatus === 'pending' ? (
                                    <span style={{ color: 'var(--warning-color)', fontWeight: '600' }}>⏳ Verification Pending</span>
                                ) : (
                                    <span style={{ color: 'var(--danger-color)', fontWeight: '600' }}>❌ Not Configured (Cash/Check Only)</span>
                                )}
                            </span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#666', marginTop: '-8px', marginBottom: '16px' }}>
                            Employer funding source is private and never visible on caregiver paystubs.
                        </p>

                        <h4>Stripe Integration</h4>
                        <div className="setting-row">
                            <label>Stripe Status:</label>
                            <span className="setting-value">
                                {employer.stripeSecretKey ? (
                                    <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>✅ Configured</span>
                                ) : (
                                    <span style={{ color: 'var(--warning-color)', fontWeight: '600' }}>❌ Not Configured</span>
                                )}
                            </span>
                        </div>

                        <h4>Colorado Workers' Compensation</h4>
                        <div className="setting-row">
                            <label>WC Status:</label>
                            <span className="setting-value">
                                {employer.wcAcknowledged ? (
                                    <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>✅ Acknowledged</span>
                                ) : (
                                    <span style={{ color: 'var(--warning-color)', fontWeight: '600' }}>⚠️ Not Acknowledged</span>
                                )}
                            </span>
                        </div>
                        {employer.wcAcknowledged && (
                            <>
                                <div className="setting-row">
                                    <label>Carrier Name:</label>
                                    <span className="setting-value">{employer.wcCarrier || 'Not set'}</span>
                                </div>
                                <div className="setting-row">
                                    <label>Policy Number:</label>
                                    <span className="setting-value">{employer.wcPolicyNumber || 'Not set'}</span>
                                </div>
                                <div className="setting-row">
                                    <label>Acknowledgment Date:</label>
                                    <span className="setting-value">{employer.wcAcknowledgmentDate ? new Date(employer.wcAcknowledgmentDate).toLocaleDateString() : 'Not set'}</span>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="settings-form">
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Display Name *</label>
                                <input
                                    type="text"
                                    value={formData.displayName}
                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                    className="form-input"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Child/Patient Name</label>
                                <input
                                    type="text"
                                    value={formData.childName}
                                    onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                                    className="form-input"
                                    placeholder="e.g., Emma"
                                />
                                <small>Used in paystub header: "Caregiving Services for [Name]"</small>
                            </div>
                        </div>

                        <h4 style={{ margin: '20px 0 10px' }}>Paystub Customization</h4>
                        <div className="form-group">
                            <label>Custom Paystub Title</label>
                            <input
                                type="text"
                                value={formData.paystubTitle}
                                onChange={(e) => setFormData({ ...formData, paystubTitle: e.target.value })}
                                className="form-input"
                                placeholder="e.g., Caregiving Services"
                            />
                            <small>Overrides the default "Caregiving Services" title on the PDF.</small>
                        </div>

                        <div className="form-group">
                            <label>Service Address (for Paystub)</label>
                            <textarea
                                value={formData.serviceAddress}
                                onChange={(e) => setFormData({ ...formData, serviceAddress: e.target.value })}
                                className="form-input"
                                rows={2}
                                placeholder="e.g., 123 Maple St, Denver, CO 80202"
                            />
                            <small>If provided, this address will be used on the paystub instead of your household address.</small>
                        </div>

                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Pay Frequency *</label>
                                <select
                                    value={formData.payFrequency}
                                    onChange={(e) => setFormData({ ...formData, payFrequency: e.target.value as any })}
                                    className="form-select"
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="bi-weekly">Bi-Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Default Hourly Rate ($) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.defaultHourlyRate}
                                    onChange={(e) => setFormData({ ...formData, defaultHourlyRate: e.target.value })}
                                    className="form-input"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Federal Withholding</label>
                                <div className="checkbox-group" style={{ marginTop: '30px' }}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={formData.federalWithholdingEnabled}
                                            onChange={(e) => setFormData({ ...formData, federalWithholdingEnabled: e.target.checked })}
                                        />
                                        Enable Federal Tax Withholding
                                    </label>
                                </div>
                            </div>
                        </div>

                        <h4 style={{ margin: '20px 0 10px' }}>Multipliers & Taxes</h4>

                        <div className="form-group">
                            <label>Holiday Pay Multiplier *</label>
                            <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="3.0"
                                value={formData.holidayPayMultiplier}
                                onChange={(e) => setFormData({ ...formData, holidayPayMultiplier: e.target.value })}
                                className="form-input"
                            />
                            <small>1.0 = regular pay, 1.5 = time-and-a-half, 2.0 = double time</small>
                        </div>

                        <div className="form-group">
                            <label>Weekend Pay Multiplier *</label>
                            <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="3.0"
                                value={formData.weekendPayMultiplier}
                                onChange={(e) => setFormData({ ...formData, weekendPayMultiplier: e.target.value })}
                                className="form-input"
                            />
                            <small>1.0 = regular pay, 1.25 = 25% premium, 1.5 = time-and-a-half</small>
                        </div>

                        <div className="form-group">
                            <label>Colorado SUI Premium Rate *</label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                max="1"
                                value={formData.coloradoSutaRate}
                                onChange={(e) => setFormData({ ...formData, coloradoSutaRate: e.target.value })}
                                className="form-input"
                            />
                            <small>Enter as decimal (e.g., 0.0305 for 3.05%)</small>
                        </div>

                        {/* Federal Tax Configuration Section */}
                        <div style={{ marginTop: '30px', marginBottom: '30px' }}>
                            <TaxConfigurationSettings />
                        </div>

                        <h4 style={{ margin: '20px 0 10px' }}>Colorado FAMLI Configuration</h4>
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>FAMLI Employee Rate *</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    max="1"
                                    value={formData.coloradoFamliRateEE}
                                    onChange={(e) => setFormData({ ...formData, coloradoFamliRateEE: e.target.value })}
                                    className="form-input"
                                />
                                <small>Default: 0.0044 (0.44% for 2026)</small>
                            </div>
                            <div className="form-group">
                                <label>FAMLI Employer Rate *</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    max="1"
                                    value={formData.coloradoFamliRateER}
                                    onChange={(e) => setFormData({ ...formData, coloradoFamliRateER: e.target.value })}
                                    className="form-input"
                                />
                                <small>Default: 0.0044 (0.44% for 2026)</small>
                            </div>
                        </div>

                        <h4 style={{ margin: '20px 0 10px' }}>Colorado SUI / CDLE Details</h4>
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Employer FEIN</label>
                                <input
                                    type="password"
                                    value={formData.fein}
                                    onChange={(e) => setFormData({ ...formData, fein: e.target.value })}
                                    className="form-input"
                                    placeholder="e.g. 413371288"
                                />
                                <small>9-digit Federal Employer ID</small>
                            </div>
                            <div className="form-group">
                                <label>Colorado UI Account Number</label>
                                <input
                                    type="password"
                                    value={formData.uiAccountNumber}
                                    onChange={(e) => setFormData({ ...formData, uiAccountNumber: e.target.value })}
                                    className="form-input"
                                    placeholder="e.g. 06327814"
                                />
                                <small>8-digit State UI Account Number</small>
                            </div>
                        </div>

                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>SUI Wage Base *</label>
                                <input
                                    type="number"
                                    step="1"
                                    value={formData.suiWageBase}
                                    onChange={(e) => setFormData({ ...formData, suiWageBase: e.target.value })}
                                    className="form-input"
                                />
                                <small>Default: $16,000</small>
                            </div>
                            <div className="form-group">
                                <label>Rate Effective Date</label>
                                <input
                                    type="date"
                                    value={formData.suiEffectiveDate}
                                    onChange={(e) => setFormData({ ...formData, suiEffectiveDate: e.target.value })}
                                    className="form-input"
                                />
                            </div>
                        </div>

                        <h4 style={{ margin: '20px 0 10px' }}>Address</h4>
                        <div className="form-group">
                            <label>Address Line 1</label>
                            <input
                                type="text"
                                value={formData.addressLine1}
                                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Address Line 2 (Optional)</label>
                            <input
                                type="text"
                                value={formData.addressLine2}
                                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
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
                                <label>ZIP Code</label>
                                <input
                                    type="text"
                                    value={formData.zip}
                                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                                    className="form-input"
                                />
                            </div>
                        </div>

                        <h4 style={{ margin: '20px 0 10px' }}>Payment Accounts & Funding</h4>
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Stripe Employer Account ID</label>
                                <input
                                    type="text"
                                    value={formData.stripeAccountId}
                                    onChange={(e) => setFormData({ ...formData, stripeAccountId: e.target.value })}
                                    className="form-input"
                                    placeholder="acct_..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Masked Funding Account</label>
                                <input
                                    type="text"
                                    value={formData.maskedFundingAccount}
                                    onChange={(e) => setFormData({ ...formData, maskedFundingAccount: e.target.value })}
                                    className="form-input"
                                    placeholder="Bank ****5678"
                                />
                            </div>
                        </div>

                        <h4 style={{ margin: '20px 0 10px' }}>Stripe API Keys (Test or Live)</h4>
                        <p className="setting-help" style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                            Find these in your <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer">Stripe Dashboard</a>.
                            Keys are encrypted and stored only on this device.
                        </p>

                        <div className="form-group">
                            <label>Publishable Key (pk_...)</label>
                            <input
                                type="text"
                                value={formData.stripePublishableKey}
                                onChange={(e) => setFormData({ ...formData, stripePublishableKey: e.target.value })}
                                className="form-input"
                                placeholder="pk_test_..."
                            />
                        </div>

                        <div className="form-group">
                            <label>Secret Key (sk_...)</label>
                            <input
                                type="password"
                                value={formData.stripeSecretKey}
                                onChange={(e) => setFormData({ ...formData, stripeSecretKey: e.target.value })}
                                className="form-input"
                                placeholder="sk_test_..."
                            />
                        </div>

                        <h4 style={{ margin: '20px 0 10px' }}>Colorado Workers' Compensation <span className="tag-employer-only" style={{ fontSize: '10px', verticalAlign: 'middle', marginLeft: '8px', padding: '2px 6px', background: '#e0e0e0', borderRadius: '4px', color: '#666' }}>Employer Only</span></h4>
                        <p className="setting-help" style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                            <strong>Legal Requirement:</strong> This is a legally required record for Colorado household employers, even if you are exempt from carrying insurance.
                        </p>
                        <div className="form-group">
                            <div className="checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.wcAcknowledged}
                                        onChange={(e) => setFormData({ ...formData, wcAcknowledged: e.target.checked })}
                                    />
                                    <strong>I acknowledge that I have Workers' Compensation coverage or am legally exempt.</strong>
                                </label>
                            </div>
                        </div>

                        {formData.wcAcknowledged && (
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Carrier Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.wcCarrier}
                                        onChange={(e) => setFormData({ ...formData, wcCarrier: e.target.value })}
                                        className="form-input"
                                        placeholder="e.g. Pinnacol Assurance"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Policy Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.wcPolicyNumber}
                                        onChange={(e) => setFormData({ ...formData, wcPolicyNumber: e.target.value })}
                                        className="form-input"
                                        placeholder="e.g. WC-12345-67"
                                    />
                                </div>
                            </div>
                        )}

                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">{success}</div>}

                        <div className="form-actions">
                            <button type="button" className="btn-secondary" onClick={handleCancel}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="settings-section">
                <h3>Data Management</h3>
                <p className="section-description">
                    Export your database for safekeeping or restore from a previous backup.
                </p>

                <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>🔐 Encrypted Backups (Recommended)</h4>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                    Password-protected backups that can be restored on any computer. Perfect for disaster recovery.
                </p>
                <div className="export-actions" style={{ marginBottom: '24px' }}>
                    <button className="btn-primary" onClick={() => setShowExportDialog(true)}>
                        🔐 Export Encrypted Backup
                    </button>
                    <button className="btn-secondary" onClick={() => setShowImportDialog(true)}>
                        📂 Import Encrypted Backup
                    </button>
                </div>

                <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>💾 Quick Backups (Local Only)</h4>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                    Simple database backups for local use. Cannot be restored on a different computer.
                </p>
                <div className="export-actions">
                    <button className="btn-secondary" onClick={handleExport}>
                        💾 Backup Database
                    </button>
                    <button className="btn-danger btn-small" onClick={handleImport} style={{ padding: '10px 20px', fontSize: '14px' }}>
                        📂 Restore from Backup
                    </button>
                </div>
                <small style={{ display: 'block', marginTop: '12px', color: '#888' }}>
                    Note: Restoring will overwrite all current data and restart the application.
                </small>
            </div>
            <SuccessModal
                isOpen={successModal.open}
                title={successModal.title}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, open: false })}
            />
            <ExportBackupDialog
                isOpen={showExportDialog}
                onClose={() => setShowExportDialog(false)}
            />
            <ImportBackupDialog
                isOpen={showImportDialog}
                onClose={() => setShowImportDialog(false)}
                onSuccess={() => {
                    setSuccessModal({
                        open: true,
                        title: 'Database Restored',
                        message: 'Database restored successfully.\n\nThe application will now reload to apply changes.'
                    });
                    setTimeout(() => window.location.reload(), 3000);
                }}
            />
        </div >
    );
};

export default Settings;
