import React, { useState } from 'react';
import { ipcAPI } from '../lib/ipc';

interface PinLoginProps {
    onLogin: () => void;
}

const PinLogin: React.FC<PinLoginProps> = ({ onLogin }) => {
    const [pin, setPin] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const isValid = await ipcAPI.auth.verifyPin(pin);
            if (isValid) {
                onLogin();
            } else {
                setError('Incorrect PIN. Please try again.');
                setPin('');
            }
        } catch (err) {
            setError('Authentication failed. Please try again.');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const handlePinChange = (value: string) => {
        if (/^\d{0,4}$/.test(value)) {
            setPin(value);
            setError(''); // Clear error when user starts typing
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h1>Household Payroll</h1>
                <p>Enter your PIN to continue</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => handlePinChange(e.target.value)}
                            maxLength={4}
                            placeholder="••••"
                            className="pin-input"
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="btn-primary" disabled={loading || pin.length !== 4}>
                        {loading ? 'Verifying...' : 'Unlock'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PinLogin;
