import React, { useState, useEffect } from 'react';
import { EmployerService, Employer } from '../../services/employer-service';

const Settings: React.FC = () => {
    const [employer, setEmployer] = useState<Employer | null>(null);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        holidayPayMultiplier: '1.0',
        weekendPayMultiplier: '1.0',
        coloradoSutaRate: '0.0',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadEmployer();
    }, []);

    const loadEmployer = () => {
        const data = EmployerService.getEmployer();
        if (data) {
            setEmployer(data);
            setFormData({
                holidayPayMultiplier: data.holidayPayMultiplier.toString(),
                weekendPayMultiplier: data.weekendPayMultiplier.toString(),
                coloradoSutaRate: data.coloradoSutaRate.toString(),
            });
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
            setError('SUTA rate must be between 0 and 1');
            setLoading(false);
            return;
        }

        try {
            EmployerService.updateEmployer({
                holidayPayMultiplier: holidayMultiplier,
                weekendPayMultiplier: weekendMultiplier,
                coloradoSutaRate: sutaRate,
            });

            setSuccess('Settings updated successfully!');
            setEditing(false);
            loadEmployer();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update settings');
        } finally {
            setLoading(false);
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
                <h3>Pay Rate Multipliers</h3>
                <p className="section-description">
                    Configure differential pay rates for holidays and weekends. A multiplier of 1.0 means regular pay,
                    1.5 means time-and-a-half, etc.
                </p>

                {!editing ? (
                    <div className="settings-display">
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
                            <label>Colorado SUTA Rate:</label>
                            <span className="setting-value">
                                {(employer.coloradoSutaRate * 100).toFixed(3)}%
                            </span>
                        </div>

                        <button className="btn-primary" onClick={handleEdit}>
                            Edit Multipliers
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="settings-form">
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
                            <label>Colorado SUTA Rate *</label>
                            <input
                                type="number"
                                step="0.001"
                                min="0"
                                max="1"
                                value={formData.coloradoSutaRate}
                                onChange={(e) => setFormData({ ...formData, coloradoSutaRate: e.target.value })}
                                className="form-input"
                            />
                            <small>Enter as decimal (e.g., 0.017 for 1.7%)</small>
                        </div>

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
                <h3>Employer Information</h3>
                <div className="info-grid">
                    <div className="info-item">
                        <label>Display Name:</label>
                        <span>{employer.displayName}</span>
                    </div>
                    <div className="info-item">
                        <label>Pay Frequency:</label>
                        <span>{employer.payFrequency}</span>
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
            </div>
        </div>
    );
};

export default Settings;
