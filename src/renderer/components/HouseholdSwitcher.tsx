import React, { useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';
import { Employer } from '../../types';

const HouseholdSwitcher: React.FC<{ onSwitch?: () => void }> = ({ onSwitch }) => {
    const [employers, setEmployers] = useState<Employer[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadEmployers();
    }, []);

    const loadEmployers = async () => {
        try {
            const data = await ipcAPI.employer.getAll();
            setEmployers(data);
        } catch (error) {
            console.error('Failed to load employers:', error);
        }
    };

    const handleSwitch = async (id: number) => {
        try {
            await ipcAPI.employer.setActive(id);
            await loadEmployers();
            if (onSwitch) onSwitch();
            window.location.reload();
        } catch (error) {
            console.error('Failed to switch household:', error);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete the household "${name}"? This will permanently remove all associated caregivers, time entries, and payroll records.`)) {
            try {
                await ipcAPI.employer.delete(id);
                await loadEmployers();
            } catch (error) {
                console.error('Failed to delete household:', error);
                alert('Failed to delete household. Ensure it is not the currently active one.');
            }
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const name = formData.get('name') as string;

        if (!name || name.length < 3) return;

        setLoading(true);
        try {
            const newEmp = await ipcAPI.employer.create({
                displayName: name,
                ssnOrEin: '00-0000000', // Placeholder for user to update in settings
                payFrequency: 'bi-weekly',
                defaultHourlyRate: 20.00,
                federalWithholdingEnabled: false,
                coloradoSutaRate: 0.017
            });
            await ipcAPI.employer.setActive(newEmp.id);
            window.location.reload();
        } catch (error) {
            console.error('Failed to create household:', error);
        } finally {
            setLoading(false);
        }
    };

    const activeEmployer = employers.find(e => e.isActive);

    return (
        <div className="household-switcher">
            <div className="active-household" onClick={() => setShowModal(true)}>
                <div className="household-info">
                    <span className="label">Active Household</span>
                    <span className="name">{activeEmployer?.displayName || 'Select...'}</span>
                </div>
                <div className="switch-icon">⇅</div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content household-modal" onClick={e => e.stopPropagation()}>
                        <h3>Manage Households</h3>

                        <div className="section-title">Switch Context</div>
                        <div className="household-list">
                            {employers.map(emp => (
                                <div
                                    key={emp.id}
                                    className={`household-item ${emp.isActive ? 'active' : ''}`}
                                    onClick={() => handleSwitch(emp.id)}
                                >
                                    <div className="item-info">
                                        <div className="item-text">
                                            <span className="item-name">{emp.displayName}</span>
                                            {emp.isActive && <span className="active-badge">Active</span>}
                                        </div>
                                        {!emp.isActive && (
                                            <button
                                                className="btn-delete-small"
                                                onClick={(e) => handleDelete(e, emp.id, emp.displayName)}
                                                title="Delete Household"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="divider"></div>

                        <div className="section-title">Add New Household</div>
                        <form onSubmit={handleCreate} className="create-household-form">
                            <input
                                name="name"
                                placeholder="Household Name (e.g. Smith Family)"
                                className="form-input"
                                required
                                minLength={3}
                            />
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Creating...' : '+ Create'}
                            </button>
                        </form>

                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .household-switcher {
                    padding: 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    margin-bottom: 12px;
                }
                .active-household {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255,255,255,0.05);
                    padding: 10px 14px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .active-household:hover {
                    background: rgba(255,255,255,0.1);
                }
                .household-info {
                    display: flex;
                    flex-direction: column;
                }
                .household-info .label {
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: rgba(255,255,255,0.5);
                    margin-bottom: 2px;
                }
                .household-info .name {
                    font-weight: 600;
                    font-size: 14px;
                    color: #fff;
                }
                .switch-icon {
                    font-size: 16px;
                    color: rgba(255,255,255,0.4);
                }
                .household-modal {
                    max-width: 400px;
                }
                .household-list {
                    margin: 20px 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .household-item {
                    padding: 14px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.2s;
                }
                .household-item:hover {
                    background: rgba(255,255,255,0.1);
                    transform: translateY(-1px);
                }
                .household-item.active {
                    border-color: #6366f1;
                    background: rgba(99, 102, 241, 0.1);
                }
                .item-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .item-name {
                    font-weight: 500;
                }
                .active-badge {
                    background: #6366f1;
                    color: white;
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .section-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: rgba(255,255,255,0.4);
                    margin-bottom: 10px;
                    font-weight: 600;
                }
                .divider {
                    height: 1px;
                    background: rgba(255,255,255,0.1);
                    margin: 20px 0;
                }
                .create-household-form {
                    display: flex;
                    gap: 10px;
                }
                .create-household-form .form-input {
                    flex: 1;
                    background: rgba(255,255,254,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    padding: 10px;
                    border-radius: 8px;
                }
                .btn-delete-small {
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.3);
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .btn-delete-small:hover {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }
                .item-text {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
            `}</style>
        </div>
    );
};

export default HouseholdSwitcher;
