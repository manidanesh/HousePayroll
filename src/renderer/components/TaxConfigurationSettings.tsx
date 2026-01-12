import React, { useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';

interface TaxConfig {
    id: number;
    taxYear: number;
    ssRateEmployee: number;
    ssRateEmployer: number;
    ssWageBase: number;
    medicareRateEmployee: number;
    medicareRateEmployer: number;
    medicareWageBase: number | null;
    futaRate: number;
    futaWageBase: number;
    effectiveDate: string;
    version: string;
    isDefault: boolean;
    notes?: string;
}

const TaxConfigurationSettings: React.FC = () => {
    const [taxConfigs, setTaxConfigs] = useState<TaxConfig[]>([]);
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
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadTaxConfigurations();
    }, []);

    useEffect(() => {
        if (selectedTaxYear && taxConfigs.length > 0) {
            loadTaxConfigForYear(selectedTaxYear);
        }
    }, [selectedTaxYear, taxConfigs]);

    const loadTaxConfigurations = async () => {
        try {
            const configs = await ipcAPI.taxConfig.getAll();
            setTaxConfigs(configs);
        } catch (error) {
            console.error('Failed to load tax configurations:', error);
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
            setEditing(false);
        } catch (error) {
            console.error('Failed to load tax config for year:', error);
        }
    };

    const handleChange = (field: string, value: string) => {
        setTaxConfigData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            setError('');
            setSuccess('');

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

            setSuccess(`Tax configuration for ${selectedTaxYear} saved successfully!`);
            setEditing(false);
        } catch (error: any) {
            setError(error.message || 'Failed to save tax configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleAddNewYear = () => {
        const nextYear = Math.max(...taxConfigs.map(c => c.taxYear), new Date().getFullYear()) + 1;
        setSelectedTaxYear(nextYear);
        setEditing(true);
        setSuccess('');
        setError('');
    };

    const handleResetToDefaults = () => {
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

    const availableYears = taxConfigs.map(c => c.taxYear).sort((a, b) => b - a);

    return (
        <div className="tax-config-section">
            <h3>Federal Tax Configuration</h3>
            <div className="alert alert-info" style={{ marginBottom: '20px' }}>
                <strong>ℹ️ Advanced Setting:</strong> Configure federal tax rates and wage base caps by year.
                These values are typically set by the IRS and should only be modified when tax laws change.
                <strong> Most users will not need to change these values.</strong>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Tax Year</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select
                        value={selectedTaxYear}
                        onChange={(e) => setSelectedTaxYear(Number(e.target.value))}
                        className="form-select"
                        style={{ maxWidth: '200px' }}
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleAddNewYear}
                        className="btn-secondary btn-small"
                        type="button"
                    >
                        + Add New Year
                    </button>
                    {!editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="btn-primary btn-small"
                            type="button"
                        >
                            ✏️ Edit
                        </button>
                    )}
                </div>
            </div>

            <div className="tax-config-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '20px',
                opacity: editing ? 1 : 0.7,
                pointerEvents: editing ? 'auto' : 'none'
            }}>
                <div className="form-group">
                    <label>Social Security Rate (Employee)</label>
                    <input
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={taxConfigData.ssRateEmployee}
                        onChange={(e) => handleChange('ssRateEmployee', e.target.value)}
                        className="form-input"
                        disabled={!editing}
                    />
                    <small>Default: 6.2% (0.062)</small>
                </div>

                <div className="form-group">
                    <label>Social Security Rate (Employer)</label>
                    <input
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={taxConfigData.ssRateEmployer}
                        onChange={(e) => handleChange('ssRateEmployer', e.target.value)}
                        className="form-input"
                        disabled={!editing}
                    />
                    <small>Default: 6.2% (0.062)</small>
                </div>

                <div className="form-group">
                    <label>Social Security Wage Base</label>
                    <input
                        type="number"
                        step="100"
                        min="0"
                        value={taxConfigData.ssWageBase}
                        onChange={(e) => handleChange('ssWageBase', e.target.value)}
                        className="form-input"
                        disabled={!editing}
                    />
                    <small>2025: $168,600 | 2026: TBD (verify with IRS)</small>
                </div>

                <div className="form-group">
                    <label>Medicare Rate (Employee)</label>
                    <input
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={taxConfigData.medicareRateEmployee}
                        onChange={(e) => handleChange('medicareRateEmployee', e.target.value)}
                        className="form-input"
                        disabled={!editing}
                    />
                    <small>Default: 1.45% (0.0145) - No wage limit</small>
                </div>

                <div className="form-group">
                    <label>Medicare Rate (Employer)</label>
                    <input
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={taxConfigData.medicareRateEmployer}
                        onChange={(e) => handleChange('medicareRateEmployer', e.target.value)}
                        className="form-input"
                        disabled={!editing}
                    />
                    <small>Default: 1.45% (0.0145)</small>
                </div>

                <div className="form-group">
                    <label>FUTA Rate</label>
                    <input
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={taxConfigData.futaRate}
                        onChange={(e) => handleChange('futaRate', e.target.value)}
                        className="form-input"
                        disabled={!editing}
                    />
                    <small>Default: 0.6% (0.006) after state credit</small>
                </div>

                <div className="form-group">
                    <label>FUTA Wage Base</label>
                    <input
                        type="number"
                        step="100"
                        min="0"
                        value={taxConfigData.futaWageBase}
                        onChange={(e) => handleChange('futaWageBase', e.target.value)}
                        className="form-input"
                        disabled={!editing}
                    />
                    <small>Default: $7,000</small>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Notes</label>
                    <textarea
                        value={taxConfigData.notes}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        className="form-input"
                        rows={2}
                        placeholder="Optional notes about this tax configuration..."
                        disabled={!editing}
                    />
                </div>
            </div>

            {editing && (
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleSave}
                        className="btn-primary"
                        disabled={loading}
                        type="button"
                    >
                        {loading ? 'Saving...' : 'Save Tax Configuration'}
                    </button>
                    <button
                        onClick={() => {
                            setEditing(false);
                            loadTaxConfigForYear(selectedTaxYear);
                        }}
                        className="btn-secondary"
                        disabled={loading}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleResetToDefaults}
                        className="btn-secondary"
                        disabled={loading}
                        type="button"
                    >
                        Reset to Defaults
                    </button>
                </div>
            )}

            <div className="alert alert-warning" style={{ marginTop: '20px' }}>
                <strong>⚠️ Important:</strong> Incorrect tax rates may result in compliance issues with the IRS.
                Only modify these values if you have specific tax requirements or if IRS rates have officially changed.
                Always verify rates with official IRS publications (Circular E, Publication 15).
            </div>
        </div>
    );
};

export default TaxConfigurationSettings;
