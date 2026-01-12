import React, { useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';

interface OnboardingWizardProps {
    onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        displayName: '',
        ssnOrEin: '',
        payFrequency: 'bi-weekly' as 'weekly' | 'bi-weekly' | 'monthly',
        defaultHourlyRate: '20.00',
        coloradoSutaRate: '0.017',
        federalWithholdingEnabled: false,
    });
    const [caregiverData, setCaregiverData] = useState({
        fullLegalName: '',
        hourlyRate: '20.00',
        ssn: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const formatSSN = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length <= 3) return cleaned;
        if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`;
    };

    const isEmployerValid = formData.displayName.length >= 3 && formData.ssnOrEin.length >= 9;
    const isCaregiverValid = caregiverData.fullLegalName.length >= 3 && caregiverData.ssn.length >= 9;

    const handleEmployerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.displayName.trim() || !formData.ssnOrEin.trim()) {
            setError('Please fill in all required fields.');
            return;
        }

        setStep(2);
    };

    const handleCaregiverSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!caregiverData.fullLegalName.trim() || !caregiverData.ssn.trim()) {
            setError('Please fill in caregiver details.');
            return;
        }

        setStep(3);
    };

    const finalizeOnboarding = async () => {
        setLoading(true);
        try {
            // 1. Create Employer
            await ipcAPI.employer.create({
                displayName: formData.displayName,
                ssnOrEin: formData.ssnOrEin,
                payFrequency: formData.payFrequency,
                defaultHourlyRate: parseFloat(formData.defaultHourlyRate),
                coloradoSutaRate: parseFloat(formData.coloradoSutaRate),
                federalWithholdingEnabled: formData.federalWithholdingEnabled,
            });

            // 2. Create first Caregiver
            await ipcAPI.caregiver.create({
                fullLegalName: caregiverData.fullLegalName,
                hourlyRate: parseFloat(caregiverData.hourlyRate),
                ssn: caregiverData.ssn,
            });

            onComplete();
        } catch (err) {
            setError('Failed to complete onboarding. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="setup-container">
            <div className="setup-card onboarding-card" style={{ maxWidth: '700px' }}>
                <div className="onboarding-progress">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1. Employer</div>
                    <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2. Caregiver</div>
                    <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3. Finish</div>
                </div>

                {step === 1 && (
                    <div className="onboarding-step animation-slide-up">
                        <h1>Welcome to Household Payroll</h1>
                        <p>Let's set up your employer profile first.</p>
                        <form onSubmit={handleEmployerSubmit} className="setup-form">
                            <div className="form-group">
                                <label>Household / Employer Name</label>
                                <input
                                    className="form-input"
                                    value={formData.displayName}
                                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                    placeholder="e.g. The Smith Family"
                                />
                            </div>
                            <div className="form-group">
                                <label>SSN or EIN</label>
                                <input
                                    className="form-input"
                                    value={formData.ssnOrEin}
                                    onChange={e => setFormData({ ...formData, ssnOrEin: formatSSN(e.target.value) })}
                                    placeholder="000-00-0000"
                                    maxLength={11}
                                />
                                {formData.ssnOrEin && formData.ssnOrEin.length < 11 && <small style={{ color: '#e74c3c' }}>Must be 9 digits (000-00-0000)</small>}
                            </div>
                            <div className="info-grid">
                                <div className="form-group">
                                    <label>Pay Frequency</label>
                                    <select
                                        className="form-select"
                                        value={formData.payFrequency}
                                        onChange={e => setFormData({ ...formData, payFrequency: e.target.value as any })}
                                    >
                                        <option value="weekly">Weekly</option>
                                        <option value="bi-weekly">Bi-Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>SUTA Rate (CO)</label>
                                    <input
                                        className="form-input"
                                        value={formData.coloradoSutaRate}
                                        onChange={e => setFormData({ ...formData, coloradoSutaRate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary" disabled={!isEmployerValid}>Next Step: Add Caregiver →</button>
                        </form>
                    </div>
                )}

                {step === 2 && (
                    <div className="onboarding-step animation-slide-up">
                        <h1>Add Your First Caregiver</h1>
                        <p>You can add more later in the management tab.</p>
                        <form onSubmit={handleCaregiverSubmit} className="setup-form">
                            <div className="form-group">
                                <label>Caregiver Full Legal Name</label>
                                <input
                                    className="form-input"
                                    value={caregiverData.fullLegalName}
                                    onChange={e => setCaregiverData({ ...caregiverData, fullLegalName: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Social Security Number</label>
                                <input
                                    className="form-input"
                                    value={caregiverData.ssn}
                                    onChange={e => setCaregiverData({ ...caregiverData, ssn: formatSSN(e.target.value) })}
                                    placeholder="000-00-0000"
                                    maxLength={11}
                                />
                                {caregiverData.ssn && caregiverData.ssn.length < 11 && <small style={{ color: '#e74c3c' }}>Must be 9 digits (000-00-0000)</small>}
                            </div>
                            <div className="form-group">
                                <label>Standard Hourly Rate ($)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={caregiverData.hourlyRate}
                                    onChange={e => setCaregiverData({ ...caregiverData, hourlyRate: e.target.value })}
                                />
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                                <button type="submit" className="btn-primary" disabled={!isCaregiverValid}>Continue →</button>
                            </div>
                        </form>
                    </div>
                )}

                {step === 3 && (
                    <div className="onboarding-step animation-slide-up" style={{ textAlign: 'center' }}>
                        <h1>Setup Complete! 🎉</h1>
                        <p>You're ready to start tracking time and generating paystubs.</p>
                        <div className="setup-summary" style={{ margin: '30px 0', padding: '20px', background: 'var(--bg-app)', borderRadius: '12px' }}>
                            <div className="result-item"><span>Employer:</span> <strong>{formData.displayName}</strong></div>
                            <div className="result-item"><span>Primary Caregiver:</span> <strong>{caregiverData.fullLegalName}</strong></div>
                        </div>
                        <button className="btn-primary" onClick={finalizeOnboarding} disabled={loading}>
                            {loading ? 'Finalizing...' : 'Start Using App 🚀'}
                        </button>
                    </div>
                )}

                {error && <div className="error-message" style={{ marginTop: '20px' }}>{error}</div>}
            </div>

            <style>{`
                .onboarding-progress {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 40px;
                    padding: 0 20px;
                }
                .progress-step {
                    color: var(--text-muted);
                    font-weight: 600;
                    font-size: 14px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid var(--border-light);
                    flex: 1;
                    text-align: center;
                }
                .progress-step.active {
                    color: var(--primary);
                    border-bottom-color: var(--primary);
                }
                .onboarding-card {
                    padding: 40px;
                }
                .animation-slide-up {
                    animation: var(--anim-slide-up);
                }
            `}</style>
        </div>
    );
};

export default OnboardingWizard;
