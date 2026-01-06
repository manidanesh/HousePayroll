import React, { useState, useEffect } from 'react';
import { CaregiverService, Caregiver } from '../../services/caregiver-service';

const CaregiverManagement: React.FC = () => {
    const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingCaregiver, setEditingCaregiver] = useState<Caregiver | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    useEffect(() => {
        loadCaregivers();
    }, [showInactive]);

    const loadCaregivers = () => {
        const data = CaregiverService.getAllCaregivers(showInactive);
        setCaregivers(data);
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

    const handleDeactivate = (id: number) => {
        if (confirm('Are you sure you want to deactivate this caregiver?')) {
            CaregiverService.deactivateCaregiver(id);
            loadCaregivers();
        }
    };

    const handleReactivate = (id: number) => {
        CaregiverService.reactivateCaregiver(id);
        loadCaregivers();
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
                                        <span className={`status-badge ${caregiver.isActive ? 'active' : 'inactive'}`}>
                                            {caregiver.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-small btn-secondary"
                                            onClick={() => handleEdit(caregiver)}
                                        >
                                            Edit
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
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
                CaregiverService.updateCaregiver(caregiver.id, {
                    fullLegalName: formData.fullLegalName,
                    ssn: formData.ssn,
                    hourlyRate,
                    relationshipNote: formData.relationshipNote,
                });
            } else {
                // Create new caregiver
                CaregiverService.createCaregiver({
                    fullLegalName: formData.fullLegalName,
                    ssn: formData.ssn,
                    hourlyRate,
                    relationshipNote: formData.relationshipNote,
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
                            onChange={(e) => setFormData({ ...formData, ssn: e.target.value })}
                            placeholder="123-45-6789"
                            className="form-input"
                        />
                        <small>Encrypted and stored securely</small>
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

                    {error && <div className="error-message">{error}</div>}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : caregiver ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CaregiverManagement;
