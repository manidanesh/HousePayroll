import React, { useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';

const AuditLog: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await ipcAPI.audit.getAll();
            setLogs(data);
        } catch (err) {
            console.error('Failed to load audit logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const formatAction = (action: string) => {
        switch (action) {
            case 'CREATE': return <span className="badge badge-success">CREATE</span>;
            case 'UPDATE': return <span className="badge badge-info">UPDATE</span>;
            case 'DELETE': return <span className="badge badge-danger">DELETE</span>;
            case 'FINALIZED': return <span className="badge badge-primary">FINALIZED</span>;
            default: return action;
        }
    };

    if (loading) return <div>Loading audit trail...</div>;

    return (
        <div className="audit-log-container">
            <header className="section-header">
                <h2>System Audit Trail</h2>
                <button className="btn-secondary" onClick={loadLogs}>🔄 Refresh</button>
            </header>

            <div className="table-responsive card">
                <table className="reporting-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Table</th>
                            <th>Action</th>
                            <th>ID</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                    {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td><code>{log.table_name}</code></td>
                                <td>{formatAction(log.action)}</td>
                                <td>{log.record_id}</td>
                                <td style={{ fontSize: '0.8rem' }}>
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                        {log.changes_json || 'N/A'}
                                    </pre>
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No audit logs found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditLog;
