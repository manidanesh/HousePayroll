import React, { useState } from 'react';
import CaregiverManagement from './CaregiverManagement';

const Dashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('caregivers');

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Household Payroll System</h1>
                <div className="header-actions">
                    <button className="btn-secondary">Settings</button>
                </div>
            </header>

            <nav className="dashboard-nav">
                <button
                    className={activeTab === 'caregivers' ? 'nav-item active' : 'nav-item'}
                    onClick={() => setActiveTab('caregivers')}
                >
                    Caregivers
                </button>
                <button
                    className={activeTab === 'time' ? 'nav-item active' : 'nav-item'}
                    onClick={() => setActiveTab('time')}
                >
                    Time Tracking
                </button>
                <button
                    className={activeTab === 'payroll' ? 'nav-item active' : 'nav-item'}
                    onClick={() => setActiveTab('payroll')}
                >
                    Payroll
                </button>
                <button
                    className={activeTab === 'reports' ? 'nav-item active' : 'nav-item'}
                    onClick={() => setActiveTab('reports')}
                >
                    Reports
                </button>
            </nav>

            <main className="dashboard-content">
                {activeTab === 'caregivers' && <CaregiverManagement />}

                {activeTab === 'time' && (
                    <div className="content-section">
                        <h2>Time Tracking</h2>
                        <p>Coming soon: Record daily hours for caregivers</p>
                    </div>
                )}

                {activeTab === 'payroll' && (
                    <div className="content-section">
                        <h2>Payroll Processing</h2>
                        <p>Coming soon: Process payroll and generate paystubs</p>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="content-section">
                        <h2>Reports & Exports</h2>
                        <p>Coming soon: View YTD summaries and export data</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
