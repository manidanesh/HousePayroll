import React, { useEffect, useState } from 'react';
import { ipcAPI } from '../lib/ipc';
import { PaystubGenerator } from '../../utils/paystub-generator';
import SuccessModal from './SuccessModal';

interface PayrollDetailProps {
    recordId: number;
    onBack: () => void;
}

const PayrollDetail: React.FC<PayrollDetailProps> = ({ recordId, onBack }) => {
    const [context, setContext] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [successModal, setSuccessModal] = useState<{ open: boolean, title: string, message: string }>({
        open: false,
        title: '',
        message: ''
    });
    const [employer, setEmployer] = useState<any>(null);
    const [caregiver, setCaregiver] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const ctx = await ipcAPI.payroll.getPaystubContext(recordId);
                setContext(ctx);
                const emp = await ipcAPI.employer.get();
                setEmployer(emp);
                const cg = await ipcAPI.caregiver.getById(ctx.record.caregiverId);
                setCaregiver(cg);
            } catch (err) {
                console.error(err);
                alert('Failed to load payroll detail');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [recordId]);

    const handleDownloadPDF = async () => {
        if (!context || !employer || !caregiver) return;
        try {
            const defaultName = `Paystub_${caregiver.fullLegalName}_${context.record.paymentDate}.pdf`;
            const pdfBytes = PaystubGenerator.generatePDFBytes(context, employer, caregiver);
            const result = await ipcAPI.system.promptSaveFile(defaultName, pdfBytes);

            if (result.success) {
                setSuccessModal({
                    open: true,
                    title: 'PDF Saved',
                    message: `PDF saved to:\n${result.path}`
                });
            }
        } catch (err: any) {
            console.error(err);
            alert(`Failed to generate PDF: ${err.message || 'Unknown error'}`);
        }
    };

    if (loading) return <div className="loading">Loading details...</div>;
    if (!context) return <div className="error">Record not found</div>;

    const { record, ytd } = context;
    const f = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    return (
        <div className="payroll-detail">
            <div className="detail-header">
                <div className="header-nav">
                    <button className="btn-secondary" onClick={onBack}>← Back to History</button>
                </div>

                <div className="header-main">
                    <div className="header-info-group">
                        <h2>Paystub #{record.checkNumber}</h2>
                        <div className="paystub-metadata">
                            <span className="payment-date">{record.paymentDate}</span>
                            <span className="separator"></span>
                            <span className="status-tag">{record.isVoided ? 'VOIDED' : 'PAID'}</span>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button className="btn-primary" onClick={handleDownloadPDF}>Download PDF</button>
                    </div>
                </div>
            </div>

            <div className="detail-card card">
                <div className="paystub-header-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <h4>{employer.displayName}</h4>
                        {employer.addressLine1 && <div className="text-muted">{employer.addressLine1}</div>}
                        {(employer.city || employer.state || employer.zip) && (
                            <div className="text-muted">
                                {[employer.city, employer.state].filter(Boolean).join(', ')} {employer.zip || ''}
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <h4>{caregiver.fullLegalName}</h4>
                        <div className="text-muted">Employee ID: {caregiver.id}</div>
                        <div className="text-muted">Period: {record.payPeriodStart} - {record.payPeriodEnd}</div>
                    </div>
                </div>

                <table className="preview-table">
                    <thead>
                        <tr>
                            <th>Earnings</th>
                            <th>Rate</th>
                            <th>Hours</th>
                            <th>Current</th>
                            <th>YTD</th>
                        </tr>
                    </thead>
                    <tbody>
                        {record.regular_hours > 0 && (
                            <tr>
                                <td>Regular Pay</td>
                                <td>{f(record.regular_wages / record.regular_hours)}</td>
                                <td>{record.regular_hours}</td>
                                <td>{f(record.regular_wages)}</td>
                                <td>{f(ytd.regularWages)}</td>
                            </tr>
                        )}
                        {record.weekend_hours > 0 && (
                            <tr>
                                <td>Weekend Pay</td>
                                <td>{f(record.weekend_wages / record.weekend_hours)}</td>
                                <td>{record.weekend_hours}</td>
                                <td>{f(record.weekend_wages)}</td>
                                <td>{f(ytd.weekendWages)}</td>
                            </tr>
                        )}
                        {record.holiday_hours > 0 && (
                            <tr>
                                <td>Holiday Pay</td>
                                <td>{f(record.holiday_wages / record.holiday_hours)}</td>
                                <td>{record.holiday_hours}</td>
                                <td>{f(record.holiday_wages)}</td>
                                <td>{f(ytd.holidayWages)}</td>
                            </tr>
                        )}
                        {record.overtime_hours > 0 && (
                            <tr>
                                <td>Overtime</td>
                                <td>{f(record.overtime_wages / record.overtime_hours)}</td>
                                <td>{record.overtime_hours}</td>
                                <td>{f(record.overtime_wages)}</td>
                                <td>{f(ytd.overtimeWages)}</td>
                            </tr>
                        )}
                        <tr className="row-total">
                            <td colSpan={3}>Gross Pay</td>
                            <td>{f(record.grossWages)}</td>
                            <td>{f(ytd.grossWages)}</td>
                        </tr>

                        <tr><td colSpan={5} className="section-header">Taxes & Deductions (Employee)</td></tr>
                        <tr>
                            <td>Social Security</td>
                            <td className="text-muted">6.2%</td>
                            <td>-</td>
                            <td>-{f(record.ssEmployee)}</td>
                            <td>-{f(ytd.ssEmployee)}</td>
                        </tr>
                        <tr>
                            <td>Medicare</td>
                            <td className="text-muted">1.45%</td>
                            <td>-</td>
                            <td>-{f(record.medicareEmployee)}</td>
                            <td>-{f(ytd.medicareEmployee)}</td>
                        </tr>
                        {record.colorado_famli_employee > 0 && (
                            <tr>
                                <td>CO FAMLI (Emp)</td>
                                <td className="text-muted">0.44%</td>
                                <td>-</td>
                                <td>-{f(record.colorado_famli_employee)}</td>
                                <td>-{f(ytd.coloradoFamliEmployee)}</td>
                            </tr>
                        )}
                        {record.federalWithholding > 0 && (
                            <tr>
                                <td>Federal Tax</td>
                                <td className="text-muted">-</td>
                                <td>-</td>
                                <td>-{f(record.federalWithholding)}</td>
                                <td>-{f(ytd.federalWithholding)}</td>
                            </tr>
                        )}

                        <tr className="row-net">
                            <td colSpan={3}>Net Pay</td>
                            <td>{f(record.netPay)}</td>
                            <td>{f(ytd.netPay)}</td>
                        </tr>

                        <tr><td colSpan={5} className="section-header">Employer Taxes (Info Only)</td></tr>
                        <tr>
                            <td>Social Security (Employer)</td>
                            <td className="text-muted">6.2%</td>
                            <td>-</td>
                            <td>{f(record.ssEmployer)}</td>
                            <td>{f(ytd.ssEmployer)}</td>
                        </tr>
                        <tr>
                            <td>Medicare (Employer)</td>
                            <td className="text-muted">1.45%</td>
                            <td>-</td>
                            <td>{f(record.medicareEmployer)}</td>
                            <td>{f(ytd.medicareEmployer)}</td>
                        </tr>
                        <tr>
                            <td>FUTA</td>
                            <td className="text-muted">0.6%</td>
                            <td>-</td>
                            <td>{f(record.futa)}</td>
                            <td>{f(ytd.futa)}</td>
                        </tr>
                        <tr>
                            <td>CO SUTA</td>
                            <td className="text-muted">-</td>
                            <td>-</td>
                            <td>{f(record.colorado_suta || 0)}</td>
                            <td>{f(ytd.coloradoSuta)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <SuccessModal
                isOpen={successModal.open}
                title={successModal.title}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, open: false })}
            />
        </div>
    );
};

export default PayrollDetail;
