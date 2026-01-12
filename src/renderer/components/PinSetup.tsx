import React, { useState } from 'react';
import { ipcAPI } from '../lib/ipc';

interface PinSetupProps {
    onPinSetup: () => void;
}

const PinSetup: React.FC<PinSetupProps> = ({ onPinSetup }) => {
    const [pin, setPin] = useState<string>('');
    const [confirmPin, setConfirmPin] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            setError('PIN must be exactly 4 digits');
            return;
        }

        if (pin !== confirmPin) {
            setError('PINs do not match');
            return;
        }

        try {
            await ipcAPI.auth.setPin(pin);
            onPinSetup();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to set up PIN');
        }
    };

    const handlePinChange = (value: string) => {
        if (/^\d{0,4}$/.test(value)) {
            setPin(value);
        }
    };

    const handleConfirmPinChange = (value: string) => {
        if (/^\d{0,4}$/.test(value)) {
            setConfirmPin(value);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h1>Welcome to Household Payroll</h1>
                <p>Set up your 4-digit PIN to secure your payroll data</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label>Create PIN (4 digits)</label>
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => handlePinChange(e.target.value)}
                            maxLength={4}
                            placeholder="••••"
                            className="pin-input"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Confirm PIN</label>
                        <input
                            type="password"
                            value={confirmPin}
                            onChange={(e) => handleConfirmPinChange(e.target.value)}
                            maxLength={4}
                            placeholder="••••"
                            className="pin-input"
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="btn-primary">
                        Set Up PIN
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PinSetup;
