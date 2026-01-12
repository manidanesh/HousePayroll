import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';
import { HolidayCalendar } from '../../utils/holiday-calendar';
import { useCaregiver } from '../context/caregiver-context';
import { Caregiver, TimeEntry } from '../../types';

const TimeTracking: React.FC = () => {
    const { selectedCaregiver } = useCaregiver();
    const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
    const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
    const [weekEntries, setWeekEntries] = useState<{ [key: string]: { [key: number]: number } }>({});
    const [finalizedEntries, setFinalizedEntries] = useState<{ [key: string]: { [key: number]: boolean } }>({});
    const [entryIds, setEntryIds] = useState<{ [key: string]: { [key: number]: number } }>({});
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [historyEntries, setHistoryEntries] = useState<TimeEntry[]>([]);

    // Get Mon-Sun range for the current selected date
    const weekDays = useMemo(() => {
        const date = new Date(selectedDate + 'T00:00:00');
        const day = date.getDay(); // 0 is Sunday
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
        const monday = new Date(date.setDate(diff));

        const days = [];
        for (let i = 0; i < 7; i++) {
            const current = new Date(monday);
            current.setDate(monday.getDate() + i);
            const dateStr = current.toISOString().split('T')[0];
            days.push({
                date: dateStr,
                displayDate: current.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
                dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
                dayType: HolidayCalendar.getDayType(dateStr),
                holidayName: HolidayCalendar.getHolidayName(dateStr)
            });
        }
        return days;
    }, [selectedDate]);

    const startDate = weekDays[0].date;
    const endDate = weekDays[6].date;

    useEffect(() => {
        loadData();
    }, [selectedDate, selectedCaregiver]);

    const loadData = async () => {
        setLoading(true);
        try {
            const hStart = new Date(startDate + 'T00:00:00');
            hStart.setDate(hStart.getDate() - 56); // 8 weeks back
            const historyStartStr = hStart.toISOString().split('T')[0];

            const [allCaregivers, entries, fullHistory] = await Promise.all([
                ipcAPI.caregiver.getAll(),
                ipcAPI.timeEntry.getForDateRange(startDate, endDate),
                ipcAPI.timeEntry.getForDateRange(historyStartStr, endDate)
            ]);

            const activeList = allCaregivers.filter((c: Caregiver) => c.isActive);
            if (selectedCaregiver) {
                setCaregivers(activeList.filter((c: Caregiver) => c.id === selectedCaregiver.id));
            } else {
                setCaregivers(activeList);
            }

            // Organize entries by date and caregiverId
            const entryMap: { [key: string]: { [key: number]: number } } = {};
            const finalizedMap: { [key: string]: { [key: number]: boolean } } = {};
            const idMap: { [key: string]: { [key: number]: number } } = {};

            entries.forEach((e: TimeEntry) => {
                if (!entryMap[e.workDate]) entryMap[e.workDate] = {};
                entryMap[e.workDate][e.caregiverId] = e.hoursWorked;

                if (!finalizedMap[e.workDate]) finalizedMap[e.workDate] = {};
                finalizedMap[e.workDate][e.caregiverId] = e.isFinalized;

                if (!idMap[e.workDate]) idMap[e.workDate] = {};
                idMap[e.workDate][e.caregiverId] = e.id;
            });
            setWeekEntries(entryMap);
            setFinalizedEntries(finalizedMap);
            setEntryIds(idMap);

            // Filter history by selected caregiver if one is selected
            const filteredHistory = selectedCaregiver
                ? fullHistory.filter((e: TimeEntry) => e.caregiverId === selectedCaregiver.id)
                : fullHistory;

            setHistoryEntries(filteredHistory);
        } catch (error) {
            toast.error('Failed to load timesheet data');
        } finally {
            setLoading(false);
        }
    };

    const handleHourChange = (caregiverId: number, date: string, value: string) => {
        const hours = value === '' ? 0 : parseFloat(value);
        if (isNaN(hours)) return;

        setWeekEntries(prev => ({
            ...prev,
            [date]: {
                ...(prev[date] || {}),
                [caregiverId]: hours
            }
        }));
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            const savePromises: Promise<any>[] = [];

            for (const date of Object.keys(weekEntries)) {
                for (const caregiverIdStr of Object.keys(weekEntries[date])) {
                    const caregiverId = parseInt(caregiverIdStr);
                    const hours = weekEntries[date][caregiverId];
                    const existingId = entryIds[date]?.[caregiverId];
                    const isFinalized = finalizedEntries[date]?.[caregiverId];

                    if (isFinalized) continue;

                    if (existingId) {
                        if (hours > 0) {
                            savePromises.push(ipcAPI.timeEntry.update(existingId, hours));
                        } else {
                            savePromises.push(ipcAPI.timeEntry.delete(existingId));
                        }
                    } else if (hours > 0) {
                        savePromises.push(ipcAPI.timeEntry.create({
                            caregiverId,
                            workDate: date,
                            hoursWorked: hours
                        }));
                    }
                }
            }

            await Promise.all(savePromises);
            await loadData();
            alert('Timesheet saved successfully!');
        } catch (error) {
            toast.error('Failed to save timesheet');
            alert('Failed to save timesheet. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const calculateWeekTotal = (caregiverId: number): number => {
        let total = 0;
        weekDays.forEach(day => {
            total += weekEntries[day.date]?.[caregiverId] || 0;
        });
        return total;
    };

    const weeklyHistory = useMemo(() => {
        const weeks: { [key: string]: { start: string, end: string, days: { [key: string]: number }, total: number } } = {};

        // Build weeks from actual time entries only
        historyEntries.forEach(entry => {
            const d = new Date(entry.workDate + 'T00:00:00');
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            const weekKey = monday.toISOString().split('T')[0];

            // Create week if it doesn't exist
            if (!weeks[weekKey]) {
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                weeks[weekKey] = {
                    start: weekKey,
                    end: sunday.toISOString().split('T')[0],
                    days: {},
                    total: 0
                };
            }

            // Add hours for this specific day only
            weeks[weekKey].days[entry.workDate] = (weeks[weekKey].days[entry.workDate] || 0) + entry.hoursWorked;
            weeks[weekKey].total += entry.hoursWorked;
        });

        // Filter out current week to only show history
        const currentMonday = weekDays[0].date;
        return Object.values(weeks)
            .filter(w => w.start !== currentMonday)
            .sort((a, b) => b.start.localeCompare(a.start));
    }, [historyEntries, weekDays]);

    if (loading) {
        return <div className="loading-screen"><h2>Loading Timesheet...</h2></div>;
    }

    return (
        <div className="timesheet-container">
            <div className="time-tracking-header">
                <div>
                    <h2>Weekly Timesheet</h2>
                    <p className="text-secondary">Week of {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}</p>
                </div>
                <div className="date-selector">
                    <label>Go to date:</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="date-input"
                    />
                    <button className="btn-primary" onClick={saveChanges} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save All Changes'}
                    </button>
                </div>
            </div>

            <table className="timesheet-grid">
                <thead>
                    <tr>
                        <th className="caregiver-name-cell">Caregiver</th>
                        {weekDays.map(day => (
                            <th key={day.date} className={day.dayType === 'weekend' ? 'col-weekend' : day.dayType === 'holiday' ? 'col-holiday' : ''}>
                                <div className="day-header">
                                    <span className="day-name">{day.dayName}</span>
                                    <span className="day-date">{day.displayDate}</span>
                                    {day.dayType === 'holiday' && (
                                        <span className="holiday-label" title={day.holidayName || undefined}>🎉 Holiday</span>
                                    )}
                                </div>
                            </th>
                        ))}
                        <th className="total-cell">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {caregivers.map(caregiver => (
                        <tr key={caregiver.id}>
                            <td className="caregiver-name-cell">{caregiver.fullLegalName}</td>
                            {weekDays.map(day => (
                                <td key={`${caregiver.id}-${day.date}`} className={day.dayType === 'weekend' ? 'col-weekend' : day.dayType === 'holiday' ? 'col-holiday' : ''}>
                                    <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        max="24"
                                        className={`timesheet-input ${finalizedEntries[day.date]?.[caregiver.id] ? 'finalized' : ''}`}
                                        value={weekEntries[day.date]?.[caregiver.id] || ''}
                                        onChange={(e) => handleHourChange(caregiver.id, day.date, e.target.value)}
                                        placeholder="0"
                                        disabled={finalizedEntries[day.date]?.[caregiver.id]}
                                        title={finalizedEntries[day.date]?.[caregiver.id] ? "This entry is finalized and cannot be edited." : ""}
                                    />
                                </td>
                            ))}
                            <td className="total-cell">
                                <strong>{calculateWeekTotal(caregiver.id).toFixed(2)}</strong>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="timesheet-actions">
                {caregivers.length === 0 && (
                    <div className="alert alert-info">
                        <strong>No active caregivers found.</strong> Please add a caregiver in the Caregiver Management section.
                    </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button className="btn-secondary" onClick={loadData} style={{ flex: '0 0 auto', minWidth: '160px' }}>
                        Discard Changes
                    </button>
                    <button className="btn-primary" onClick={saveChanges} disabled={isSaving} style={{ flex: '1', minWidth: '200px' }}>
                        Save Weekly Timesheet
                    </button>
                </div>
            </div>

            <div className="timesheet-history-section">
                <div className="section-header-card card" style={{ marginBottom: '20px', marginTop: '40px' }}>
                    <h3>Timesheet History</h3>
                    <p className="text-muted">Summary of work reported over previous weeks</p>
                </div>

                <div className="weekly-history-list">
                    {weeklyHistory.map(week => (
                        <div key={week.start} className="weekly-history-item card" onClick={() => setSelectedDate(week.start)}>
                            <div className="week-range">
                                <strong>{formatDateDisplay(week.start)} - {formatDateDisplay(week.end)}</strong>
                            </div>
                            <div className="week-days-visual">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => {
                                    const d = new Date(week.start + 'T00:00:00');
                                    d.setDate(d.getDate() + idx);
                                    const dateStr = d.toISOString().split('T')[0];
                                    const hasWork = week.days[dateStr] && week.days[dateStr] > 0;
                                    return (
                                        <div key={dayName} className={`day-indicator ${hasWork ? 'has-work' : 'no-work'}`} title={`${dayName}: ${week.days[dateStr] || 0} hrs`}>
                                            <span className="day-initial">{dayName[0]}</span>
                                            <div className="work-dot"></div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="week-total">
                                <span className="label">Total:</span>
                                <strong>{week.total.toFixed(2)} hrs</strong>
                            </div>
                            <div className="week-action">
                                <button className="btn-small">View Details</button>
                            </div>
                        </div>
                    ))}
                    {weeklyHistory.length === 0 && (
                        <div className="empty-history text-muted">No previous work history found.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper Functions
function getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function formatDateDisplay(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

export default TimeTracking;
