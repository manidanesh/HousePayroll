import React, { useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';
import { useCaregiver } from '../context/caregiver-context';

const UnpaidWorkCalendar: React.FC = () => {
    const { selectedCaregiver } = useCaregiver();
    const [entries, setEntries] = useState<any[]>([]);
    const [caregivers, setCaregivers] = useState<any[]>([]);
    const [selectedCaregiverId, setSelectedCaregiverId] = useState<number | 'all'>(selectedCaregiver?.id || 'all');
    const [loading, setLoading] = useState(true);
    const [currentDate] = useState(new Date());

    useEffect(() => {
        loadData();
    }, [selectedCaregiver]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch caregivers
            const caregiverList = await ipcAPI.caregiver.getAll();
            setCaregivers(caregiverList);

            // Fetch last 4 months of data to be safe
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 3);
            start.setDate(1);

            const startDateStr = start.toISOString().split('T')[0];
            const endDateStr = end.toISOString().split('T')[0];

            const data = await ipcAPI.timeEntry.getForDateRange(startDateStr, endDateStr);
            setEntries(data);
        } catch (err) {
            console.error('Failed to load calendar data:', err);
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (month: number, year: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month: number, year: number) => {
        return new Date(year, month, 1).getDay();
    };

    const renderMonth = (monthOffset: number) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
        const month = date.getMonth();
        const year = date.getFullYear();
        const monthName = date.toLocaleString('default', { month: 'long' });

        const daysInMonth = getDaysInMonth(month, year);
        const firstDay = getFirstDayOfMonth(month, year);

        const days = [];
        // Empty slots for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        // Days of the month
        for (let d = 1; d <= daysInMonth; d++) {
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            // Filter entries based on selection
            let dayEntries = entries.filter(e => e.workDate === dayStr);
            if (selectedCaregiverId !== 'all') {
                dayEntries = dayEntries.filter(e => e.caregiverId === selectedCaregiverId);
            }

            let statusClass = '';
            if (dayEntries.length > 0) {
                const anyUnpaid = dayEntries.some(e => !e.isFinalized);
                statusClass = anyUnpaid ? 'status-unpaid' : 'status-paid';
            }

            days.push(
                <div key={d} className={`calendar-day ${statusClass}`}>
                    <span className="day-number">{d}</span>
                    {dayEntries.length > 0 && (
                        <div
                            className="work-indicator"
                            title={dayEntries.map(e =>
                                `${e.caregiverName}: ${e.hoursWorked}h (${e.isFinalized ? 'Paid' : 'Unpaid'})`
                            ).join('\n')}
                        ></div>
                    )}
                </div>
            );
        }

        return (
            <div className="calendar-month-box" key={`${month}-${year}`}>
                <h4>{monthName} {year}</h4>
                <div className="calendar-grid-header">
                    <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                </div>
                <div className="calendar-grid">
                    {days}
                </div>
            </div>
        );
    };

    if (loading) return <div className="calendar-loading">Loading calendar...</div>;

    return (
        <div className="unpaid-work-calendar-section">
            <div className="section-header-card card" style={{ marginBottom: '20px' }}>
                <div className="header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3>Work & Payment Status</h3>
                        <p className="text-muted">A quick look at reported hours and their payment status</p>
                    </div>
                    {!selectedCaregiver && (
                        <div className="calendar-filter">
                            <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>
                                Filter by Caregiver
                            </label>
                            <select
                                className="form-select select-small"
                                value={String(selectedCaregiverId)}
                                onChange={(e) => setSelectedCaregiverId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                style={{ minWidth: '180px' }}
                            >
                                <option value="all">All Caregivers</option>
                                {caregivers.map(c => (
                                    <option key={c.id} value={c.id}>{c.fullLegalName}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="calendar-legend">
                    <div className="legend-item">
                        <span className="dot status-paid"></span>
                        <span>Paid</span>
                    </div>
                    <div className="legend-item">
                        <span className="dot status-unpaid"></span>
                        <span>Unpaid (Reported)</span>
                    </div>
                </div>
            </div>

            <div className="calendar-container-horizontal">
                {renderMonth(0)}
                {renderMonth(1)}
                {renderMonth(2)}
            </div>
        </div>
    );
};

export default UnpaidWorkCalendar;
