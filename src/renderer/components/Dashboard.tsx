import React, { useState, useEffect } from 'react';
import CaregiverManagement from './CaregiverManagement';
import TaxCenter from './TaxCenter';
import TimeTracking from './TimeTracking';
import Settings from './Settings';
import Reports from './Reports';
import PayrollProcessing from './PayrollProcessing';
import PayrollHistory from './PayrollHistory';
import AuditLog from './AuditLog';
import PaymentsDashboard from './PaymentsDashboard';
import HouseholdSwitcher from './HouseholdSwitcher';
import { useCaregiver } from '../context/caregiver-context';
import { ipcAPI } from '../lib/ipc';

const Dashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('caregivers');
    const { selectedCaregiver, clearSelection } = useCaregiver();
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        return localStorage.getItem('theme') === 'dark';
    });
    const [taxNotifCount, setTaxNotifCount] = useState<number>(0);

    // Load tax notification badge count on mount
    useEffect(() => {
        window.electronAPI?.invoke('taxNotif:getUnreadCount')
            .then((count: number) => setTaxNotifCount(count ?? 0))
            .catch(() => {});
    }, []);

    React.useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    React.useEffect(() => {
        // macOS Touch Bar & Menu integration logic
        const removeNav = ipcAPI.system.on('navigate', (event: any, path: string) => {
            if (path.includes('/caregivers')) setActiveTab('caregivers');
            else if (path.includes('/payroll/run')) setActiveTab('payroll');
            else if (path.includes('/settings')) setActiveTab('settings');
        });

        const removePayroll = ipcAPI.system.on('verify-payroll-status', () => {
            setActiveTab('payroll');
        });

        return () => {
            removeNav();
            removePayroll();
        };
    }, []);

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    const renderHeaderTitle = () => {
        const prefix = selectedCaregiver ? `${selectedCaregiver.fullLegalName} | ` : '';
        switch (activeTab) {
            case 'caregivers': return 'Caregiver Management';
            case 'time': return prefix + 'Timesheet Tracking';
            case 'payroll': return prefix + 'Payroll Processing';
            case 'pay_history': return prefix + 'Pay History';
            case 'reports': return prefix + 'Financial Reports';
            case 'payments': return prefix + 'Stripe Payments';
            case 'history': return prefix + 'Audit Trail';
            case 'taxCenter': return '📋 Tax Season Center';
            case 'settings': return 'System Settings';
            default: return 'Dashboard';
        }
    };

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h1>TIMESHEET & PAYROLL</h1>
                </div>

                <HouseholdSwitcher />

                <nav className="sidebar-nav">
                    <button
                        className={`sidebar-item ${activeTab === 'caregivers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('caregivers')}
                    >
                        👥 Caregivers
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'time' ? 'active' : ''}`}
                        onClick={() => setActiveTab('time')}
                    >
                        📅 Time Tracking
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'payroll' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payroll')}
                    >
                        💰 Run Payroll
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'pay_history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pay_history')}
                    >
                        🕑 Pay History
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reports')}
                    >
                        📈 Reports
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'payments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payments')}
                    >
                        💳 Stripe Payments
                    </button>
                    <button
                        className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        📜 Audit Trail
                    </button>

                    {/* Tax Season Center — always visible, badge when deadlines approaching */}
                    <button
                        className={`sidebar-item ${activeTab === 'taxCenter' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('taxCenter'); setTaxNotifCount(0); }}
                        style={{ position: 'relative' }}
                    >
                        📋 Tax Center
                        {taxNotifCount > 0 && (
                            <span style={{
                                position: 'absolute', top: 6, right: 10,
                                background: '#dc2626', color: '#fff',
                                borderRadius: 99, fontSize: 10, fontWeight: 800,
                                minWidth: 18, height: 18, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                padding: '0 4px'
                            }}>
                                {taxNotifCount}
                            </span>
                        )}
                    </button>

                    <button
                        className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        ⚙️ Settings
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <button className="theme-toggle" onClick={toggleTheme}>
                        <span>{isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
                        <div className="toggle-switch"></div>
                    </button>
                </div>
            </aside>

            <div className="dashboard-content-wrapper">
                <header className="dashboard-header-modern">
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <h2>{renderHeaderTitle()}</h2>
                        {selectedCaregiver && (
                            <button
                                className="btn-small btn-secondary"
                                onClick={clearSelection}
                                style={{ marginLeft: '15px' }}
                            >
                                🔄 Switch Employee
                            </button>
                        )}
                    </div>
                </header>

                {/* Tax Deadline Notification Banner — shown on any tab when urgent */}
                {taxNotifCount > 0 && activeTab !== 'taxCenter' && (
                    <div style={{
                        background: '#7f1d1d', color: '#fff',
                        padding: '10px 20px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 13, fontWeight: 600
                    }}>
                        <span>🚨 {taxNotifCount} tax deadline{taxNotifCount > 1 ? 's' : ''} require{taxNotifCount === 1 ? 's' : ''} your attention</span>
                        <button
                            onClick={() => { setActiveTab('taxCenter'); setTaxNotifCount(0); }}
                            style={{
                                background: '#fff', color: '#7f1d1d',
                                border: 'none', borderRadius: 8,
                                padding: '5px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 12
                            }}
                        >
                            Go to Tax Center →
                        </button>
                    </div>
                )}

                <main className="dashboard-content">
                    {activeTab === 'caregivers' && <CaregiverManagement />}
                    {activeTab === 'time' && <TimeTracking />}
                    {activeTab === 'payroll' && <PayrollProcessing />}
                    {activeTab === 'pay_history' && <PayrollHistory />}
                    {activeTab === 'reports' && <Reports />}
                    {activeTab === 'payments' && <PaymentsDashboard />}
                    {activeTab === 'history' && <AuditLog />}
                    {activeTab === 'taxCenter' && <TaxCenter />}
                    {activeTab === 'settings' && <Settings />}
                </main>
            </div>
        </div>
    );
};

export default Dashboard;
