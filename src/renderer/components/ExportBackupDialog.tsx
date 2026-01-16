import React, { useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';
import '../styles/Dialog.css';

interface ExportBackupDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ExportBackupDialog: React.FC<ExportBackupDialogProps> = ({ isOpen, onClose }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [validationError, setValidationError] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [exportPath, setExportPath] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (password) {
            ipcAPI.backup.passwordStrength(password).then(setPasswordStrength);
            ipcAPI.backup.validatePassword(password).then(result => {
                setValidationError(result.error || '');
            });
        } else {
            setPasswordStrength(0);
            setValidationError('');
        }
    }, [password]);

    const handleExport = async () => {
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (validationError) {
            setError(validationError);
            return;
        }

        setIsExporting(true);
        setError('');

        try {
            const result = await ipcAPI.backup.exportEncrypted(password);
            if (result.success) {
                setExportSuccess(true);
                setExportPath(result.path || '');
            } else {
                setError(result.error || 'Export failed');
            }
        } catch (err: any) {
            setError(err.message || 'Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const handleClose = () => {
        setPassword('');
        setConfirmPassword('');
        setPasswordStrength(0);
        setValidationError('');
        setIsExporting(false);
        setShowPassword(false);
        setExportSuccess(false);
        setExportPath('');
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    const getStrengthColor = () => {
        if (passwordStrength < 40) return '#ef4444';
        if (passwordStrength < 70) return '#f59e0b';
        return '#10b981';
    };

    const getStrengthLabel = () => {
        if (passwordStrength < 40) return 'Weak';
        if (passwordStrength < 70) return 'Medium';
        return 'Strong';
    };

    const canExport = password.length >= 12 && password === confirmPassword && !validationError && !isExporting;

    return (
        <div className="dialog-overlay" onClick={handleClose}>
            <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
                {exportSuccess ? (
                    <>
                        <h2>✅ Backup Exported Successfully</h2>
                        <div className="dialog-body">
                            <p>Your encrypted backup has been saved to:</p>
                            <p className="export-path">{exportPath}</p>
                            <div className="info-box">
                                <strong>⚠️ Important:</strong>
                                <ul>
                                    <li>Store this backup in a safe location (iCloud, USB drive, etc.)</li>
                                    <li>Remember your password - it cannot be recovered</li>
                                    <li>This backup can be restored on any computer with this app</li>
                                </ul>
                            </div>
                        </div>
                        <div className="dialog-actions">
                            <button onClick={handleClose} className="btn btn-primary">
                                Done
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2>Export Encrypted Backup</h2>
                        <div className="dialog-body">
                            <p className="dialog-description">
                                Create a password-protected backup of your database. This backup can be restored
                                on any computer with the correct password.
                            </p>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div className="password-input-wrapper">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter a strong password"
                                        disabled={isExporting}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                                {password && (
                                    <div className="password-strength">
                                        <div className="strength-bar">
                                            <div
                                                className="strength-fill"
                                                style={{
                                                    width: `${passwordStrength}%`,
                                                    backgroundColor: getStrengthColor()
                                                }}
                                            />
                                        </div>
                                        <span style={{ color: getStrengthColor() }}>
                                            {getStrengthLabel()}
                                        </span>
                                    </div>
                                )}
                                {validationError && (
                                    <p className="error-text">{validationError}</p>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <input
                                    id="confirmPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                    disabled={isExporting}
                                />
                                {confirmPassword && password !== confirmPassword && (
                                    <p className="error-text">Passwords do not match</p>
                                )}
                            </div>

                            <div className="info-box">
                                <strong>Password Requirements:</strong>
                                <ul>
                                    <li>At least 12 characters</li>
                                    <li>Include uppercase and lowercase letters</li>
                                    <li>Include numbers and special characters</li>
                                </ul>
                            </div>

                            {error && (
                                <div className="error-box">
                                    {error}
                                </div>
                            )}
                        </div>

                        <div className="dialog-actions">
                            <button
                                onClick={handleClose}
                                className="btn btn-secondary"
                                disabled={isExporting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExport}
                                className="btn btn-primary"
                                disabled={!canExport}
                            >
                                {isExporting ? 'Exporting...' : 'Export Backup'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
