import React, { useState } from 'react';
import { ipcAPI } from '../lib/ipc';

interface EmployerSetupProps {
    onComplete: () => void;
}

const EmployerSetup: React.FC<EmployerSetupProps> = ({ onComplete }) => {
    const [formData, setFormData] = useState({
        displayName: '',
        ssnOrEin: '',
        payFrequency: 'bi-weekly' as 'weekly' | 'bi-weekly' | 'monthly',
        defaultHourlyRate: '',
        coloradoSutaRate: '',
        federalWithholdingEnabled: false,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        if (!formData.displayName.trim()) {
            setError('Display name is required');
            setLoading(false);
            return;
        }

        if (!formData.ssnOrEin.trim()) {
            setError('SSN or EIN is required');
            setLoading(false);
            return;
        }

        const hourlyRate = parseFloat(formData.defaultHourlyRate);
        if (isNaN(hourlyRate) || hourlyRate <= 0) {
            setError('Valid hourly rate is required');
            setLoading(false);
            return;
        }

        const sutaRate = parseFloat(formData.coloradoSutaRate);
        if (isNaN(sutaRate) || sutaRate < 0 || sutaRate > 1) {
            setError('SUTA rate must be between 0 and 1 (e.g., 0.017 for 1.7%)');
            setLoading(false);
            return;
        }

        try {
            await ipcAPI.employer.create({
                displayName: formData.displayName,
                ssnOrEin: formData.ssnOrEin,
                payFrequency: formData.payFrequency,
                defaultHourlyRate: hourlyRate,
                coloradoSutaRate: sutaRate,
                federalWithholdingEnabled: formData.federalWithholdingEnabled,
            });

            onComplete();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create employer profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="setup-container">
            <div className="setup-card">
                <h1>Employer Profile Setup</h1>
                <p>Set up your household employer information</p>

                <form onSubmit={handleSubmit} className="setup-form">
                    <div className="form-group">
                        <label>Household Name / Display Name *</label>
                        <input
                            type="text"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            placeholder="e.g., Smith Household"
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>SSN or EIN *</label>
                        <input
                            type="text"
                            value={formData.ssnOrEin}
                            onChange={(e) => setFormData({ ...formData, ssnOrEin: e.target.value })}
                            placeholder="123-45-6789 or 12-3456789"
                            className="form-input"
                        />
                        <small>Encrypted and stored securely</small>
                    </div>

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

                    <div className="form-group">
                        <label>Default Hourly Rate *</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.defaultHourlyRate}
                            onChange={(e) => setFormData({ ...formData, defaultHourlyRate: e.target.value })}
                            placeholder="20.00"
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>Colorado SUTA Rate *</label>
                        <input
                            type="number"
                            step="0.001"
                            value={formData.coloradoSutaRate}
                            onChange={(e) => setFormData({ ...formData, coloradoSutaRate: e.target.value })}
                            placeholder="0.017 (for 1.7%)"
                            className="form-input"
                        />
                        <small>Enter as decimal (e.g., 0.017 for 1.7%)</small>
                    </div>

                    <div className="form-group-checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.federalWithholdingEnabled}
                                onChange={(e) => setFormData({ ...formData, federalWithholdingEnabled: e.target.checked })}
                            />
                            Enable Federal Income Tax Withholding
                        </label>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Employer Profile'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EmployerSetup;
