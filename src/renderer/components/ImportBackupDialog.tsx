import React, { useState } from 'react';
import { ipcAPI } from '../lib/ipc';
import '../styles/Dialog.css';

interface ImportBackupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ImportBackupDialog: React.FC<ImportBackupDialogProps> = ({ isOpen, onClose, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [importSuccess, setImportSuccess] = useState(false);

    const handleImport = async () => {
        if (!password) {
            setError('Please enter the backup password');
            return;
        }

        setIsImporting(true);
        setError('');

        try {
            const result = await ipcAPI.backup.importEncrypted(password);
            if (result.success) {
                setImportSuccess(true);
                setTimeout(() => {
                    onSuccess();
                    handleClose();
                }, 2000);
            } else {
                setError(result.error || 'Import failed');
            }
        } catch (err: any) {
            setError(err.message || 'Import failed');
        } finally {
            setIsImporting(false);
        }
    };

    const handleClose = () => {
        setPassword('');
        setIsImporting(false);
        setShowPassword(false);
        setError('');
        setImportSuccess(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="dialog-overlay" onClick={handleClose}>
            <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
                {importSuccess ? (
                    <>
                        <h2>✅ Backup Imported Successfully</h2>
                        <div className="dialog-body">
                            <p>Your database has been restored from the backup.</p>
                            <p>The application will reload to reflect the changes.</p>
                        </div>
                    </>
                ) : (
                    <>
                        <h2>Import Encrypted Backup</h2>
                        <div className="dialog-body">
                            <div className="warning-box">
                                <strong>⚠️ Warning:</strong>
                                <p>
                                    Importing a backup will replace your current database. Your current data
                                    will be backed up automatically before the import.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="import-password">Backup Password</label>
                                <div className="password-input-wrapper">
                                    <input
                                        id="import-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter backup password"
                                        disabled={isImporting}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && password) {
                                                handleImport();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                            </div>

                            <div className="info-box">
                                <strong>How it works:</strong>
                                <ul>
                                    <li>Select your backup file (.hpb)</li>
                                    <li>Enter the password you used when creating the backup</li>
                                    <li>Your current database will be backed up first</li>
                                    <li>The backup will be decrypted and restored</li>
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
                                disabled={isImporting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                className="btn btn-primary"
                                disabled={!password || isImporting}
                            >
                                {isImporting ? 'Importing...' : 'Import Backup'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
