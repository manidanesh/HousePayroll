import React, { useState, useEffect } from 'react';
import { TimeEntryService, TimeEntryWithCaregiver } from '../../services/time-entry-service';
import { CaregiverService, Caregiver } from '../../services/caregiver-service';
import { HolidayCalendar } from '../../utils/holiday-calendar';

const TimeTracking: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
    const [timeEntries, setTimeEntries] = useState<TimeEntryWithCaregiver[]>([]);
    const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        loadCaregivers();
    }, []);

    useEffect(() => {
        loadTimeEntries();
    }, [selectedDate]);

    const loadCaregivers = () => {
        const data = CaregiverService.getAllCaregivers();
        setCaregivers(data);
    };

    const loadTimeEntries = () => {
        const entries = TimeEntryService.getTimeEntriesForDate(selectedDate);
        setTimeEntries(entries);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedDate(e.target.value);
    };

    const handleAddEntry = () => {
        setShowAddForm(true);
    };

    const handleFormClose = () => {
        setShowAddForm(false);
        loadTimeEntries();
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this time entry?')) {
            try {
                TimeEntryService.deleteTimeEntry(id);
                loadTimeEntries();
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to delete time entry');
            }
        }
    };

    // Get caregivers who don't have time entries for selected date
    const availableCaregivers = caregivers.filter(
        c => !timeEntries.some(te => te.caregiverId === c.id)
    );

    // Get day type and holiday name for selected date
    const dayType = HolidayCalendar.getDayType(selectedDate);
    const holidayName = HolidayCalendar.getHolidayName(selectedDate);

    return (
        <div className="time-tracking-container">
            <div className="time-tracking-header">
                <div>
                    <h2>Time Tracking</h2>
                    {dayType !== 'regular' && (
                        <div className="day-type-indicator">
                            <span className={`day-type-badge ${dayType}`}>
                                {dayType === 'holiday' ? `🎉 ${holidayName}` : '📅 Weekend'}
                            </span>
                            {dayType === 'holiday' && <span className="multiplier-note">Holiday pay rate applies</span>}
                            {dayType === 'weekend' && <span className="multiplier-note">Weekend pay rate applies</span>}
                        </div>
                    )}
                </div>
                <div className="date-selector">
                    <label>Date:</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={handleDateChange}
                        className="date-input"
                    />
                    <button
                        className="btn-primary"
                        onClick={handleAddEntry}
                        disabled={availableCaregivers.length === 0}
                    >
                        + Add Time Entry
                    </button>
                </div>
            </div>

            {showAddForm && (
                <TimeEntryForm
                    date={selectedDate}
                    availableCaregivers={availableCaregivers}
                    onClose={handleFormClose}
                />
            )}

            <div className="time-entries-list">
                {timeEntries.length === 0 ? (
                    <div className="empty-state">
                        <p>No time entries for {formatDate(selectedDate)}</p>
                        {availableCaregivers.length > 0 && (
                            <button className="btn-primary" onClick={handleAddEntry}>
                                Add Time Entry
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="time-entries-table">
                        <thead>
                            <tr>
                                <th>Caregiver</th>
                                <th>Hours Worked</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {timeEntries.map((entry) => (
                                <tr key={entry.id} className={entry.isFinalized ? 'finalized' : ''}>
                                    <td>{entry.caregiverName}</td>
                                    <td>{entry.hoursWorked.toFixed(2)} hrs</td>
                                    <td>
                                        <span className={`status-badge ${entry.isFinalized ? 'finalized' : 'draft'}`}>
                                            {entry.isFinalized ? 'Finalized' : 'Draft'}
                                        </span>
                                    </td>
                                    <td>
                                        {!entry.isFinalized && (
                                            <button
                                                className="btn-small btn-danger"
                                                onClick={() => handleDelete(entry.id)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <WeeklySummary selectedDate={selectedDate} />
        </div>
    );
};

interface TimeEntryFormProps {
    date: string;
    availableCaregivers: Caregiver[];
    onClose: () => void;
}

const TimeEntryForm: React.FC<TimeEntryFormProps> = ({ date, availableCaregivers, onClose }) => {
    const [caregiverId, setCaregiverId] = useState<string>(
        availableCaregivers.length > 0 ? availableCaregivers[0].id.toString() : ''
    );
    const [hoursWorked, setHoursWorked] = useState<string>('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const hours = parseFloat(hoursWorked);
        if (isNaN(hours) || hours <= 0) {
            setError('Please enter valid hours (greater than 0)');
            setLoading(false);
            return;
        }

        if (hours > 24) {
            setError('Hours cannot exceed 24 per day');
            setLoading(false);
            return;
        }

        try {
            TimeEntryService.createTimeEntry({
                caregiverId: parseInt(caregiverId),
                workDate: date,
                hoursWorked: hours,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create time entry');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Add Time Entry for {formatDate(date)}</h3>

                <form onSubmit={handleSubmit} className="time-entry-form">
                    <div className="form-group">
                        <label>Caregiver *</label>
                        <select
                            value={caregiverId}
                            onChange={(e) => setCaregiverId(e.target.value)}
                            className="form-select"
                        >
                            {availableCaregivers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.fullLegalName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Hours Worked *</label>
                        <input
                            type="number"
                            step="0.25"
                            value={hoursWorked}
                            onChange={(e) => setHoursWorked(e.target.value)}
                            placeholder="8.00"
                            className="form-input"
                            autoFocus
                        />
                        <small>Enter hours in decimal format (e.g., 8.5 for 8 hours 30 minutes)</small>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Adding...' : 'Add Entry'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface WeeklySummaryProps {
    selectedDate: string;
}

const WeeklySummary: React.FC<WeeklySummaryProps> = ({ selectedDate }) => {
    const [summary, setSummary] = useState<{ [key: number]: number }>({});
    const [caregivers, setCaregivers] = useState<Caregiver[]>([]);

    useEffect(() => {
        loadSummary();
    }, [selectedDate]);

    const loadSummary = () => {
        const { startDate, endDate } = getWeekRange(selectedDate);
        const entries = TimeEntryService.getTimeEntriesForDateRange(startDate, endDate);
        const allCaregivers = CaregiverService.getAllCaregivers();

        // Calculate totals per caregiver
        const totals: { [key: number]: number } = {};
        entries.forEach(entry => {
            totals[entry.caregiverId] = (totals[entry.caregiverId] || 0) + entry.hoursWorked;
        });

        setSummary(totals);
        setCaregivers(allCaregivers.filter(c => totals[c.id] > 0));
    };

    if (caregivers.length === 0) {
        return null;
    }

    const { startDate, endDate } = getWeekRange(selectedDate);

    return (
        <div className="weekly-summary">
            <h3>Week Summary ({formatDate(startDate)} - {formatDate(endDate)})</h3>
            <table className="summary-table">
                <thead>
                    <tr>
                        <th>Caregiver</th>
                        <th>Total Hours</th>
                    </tr>
                </thead>
                <tbody>
                    {caregivers.map(c => (
                        <tr key={c.id}>
                            <td>{c.fullLegalName}</td>
                            <td>{summary[c.id].toFixed(2)} hrs</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Helper functions
function getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function formatDate(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getWeekRange(dateString: string): { startDate: string; endDate: string } {
    const date = new Date(dateString + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0 = Sunday

    // Get Monday of the week
    const monday = new Date(date);
    monday.setDate(date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

    // Get Sunday of the week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        startDate: monday.toISOString().split('T')[0],
        endDate: sunday.toISOString().split('T')[0],
    };
}

export default TimeTracking;
