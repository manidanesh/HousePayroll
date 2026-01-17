import React, { useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';
import { useCaregiver } from '../context/caregiver-context';

interface CaregiverSelectionScreenProps {
    onSelect: () => void;
}

const CaregiverSelectionScreen: React.FC<CaregiverSelectionScreenProps> = ({ onSelect }) => {
    const [caregivers, setCaregivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { setSelectedCaregiver } = useCaregiver();

    useEffect(() => {
        const load = async () => {
            try {
                const data = await ipcAPI.caregiver.getAll(false); // Only active ones
                setCaregivers(data);

                // Auto-select if only one caregiver exists
                if (data.length === 1) {
                    setSelectedCaregiver({ id: data[0].id, fullLegalName: data[0].fullLegalName });
                    onSelect();
                }
            } catch (err) {
                console.error('Failed to load caregivers for selection:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSelect = (c: any) => {
        setSelectedCaregiver({ id: c.id, fullLegalName: c.fullLegalName });
        onSelect();
    };

    if (loading) return <div className="loading">Loading caregivers...</div>;

    return (
        <div className="selection-overlay">
            <div className="selection-card card">
                <h1>Welcome Back</h1>
                <p>Please select the caregiver you are managing for this session:</p>

                <div className="caregiver-grid">
                    {caregivers.map(c => (
                        <div key={c.id} className="caregiver-select-box" onClick={() => handleSelect(c)}>
                            <div className="avatar">{c.fullLegalName.split(' ').map((n: string) => n[0]).join('')}</div>
                            <h3>{c.fullLegalName}</h3>
                            <p className="text-muted">{c.relationshipNote || 'Caregiver'}</p>
                            <button className="btn-select">Select</button>
                        </div>
                    ))}
                    <div className="caregiver-select-box add-new" onClick={() => { /* This might need to link to onboarding or something if they want to add another */ }}>
                        <div className="avatar">+</div>
                        <h3>Add New</h3>
                        <p className="text-muted">Register a new caregiver</p>
                    </div>
                </div>
            </div>

            <style>{`
                .selection-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                .selection-card {
                    max-width: 800px;
                    width: 90%;
                    text-align: center;
                    padding: 40px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
                }
                .caregiver-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 20px;
                    margin-top: 40px;
                }
                .caregiver-select-box {
                    padding: 24px;
                    background: white;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .caregiver-select-box:hover {
                    border-color: var(--primary-color);
                    transform: translateY(-4px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                .avatar {
                    width: 60px;
                    height: 60px;
                    background: #e2e8f0;
                    color: #475569;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    font-size: 20px;
                    font-weight: 700;
                }
                .caregiver-select-box:hover .avatar {
                    background: var(--primary-color);
                    color: white;
                }
                .btn-select {
                    margin-top: 16px;
                    padding: 8px 24px;
                    background: #f1f5f9;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    color: #475569;
                    cursor: pointer;
                }
                .caregiver-select-box:hover .btn-select {
                    background: var(--primary-color);
                    color: white;
                }
            `}</style>
        </div>
    );
};

export default CaregiverSelectionScreen;
