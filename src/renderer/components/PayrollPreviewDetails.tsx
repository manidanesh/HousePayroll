import React from 'react';

interface PayrollPreviewDetailsProps {
    data: any; // EnhancedPayrollResult
    onApprove: () => void;
    onCancel: () => void;
    isApproving?: boolean;
}

export const PayrollPreviewDetails: React.FC<PayrollPreviewDetailsProps> = ({
    data,
    onApprove,
    onCancel,
    isApproving = false
}) => {
    if (!data) return null;

    return (
        <div className="payroll-preview-container">
            <div className="payroll-preview-header">
                <h2>⚠️ Payroll Preview - Review Before Approving</h2>
                <p className="preview-subtitle">Please review all calculations carefully before finalizing this payroll.</p>
            </div>

            <div className="payroll-preview-content">
                {/* Hours Breakdown */}
                <section className="preview-section">
                    <h3>Hours Worked</h3>
                    <table className="preview-table">
                        <tbody>
                            <tr>
                                <td>Regular Hours:</td>
                                <td className="value">{data.hoursByType.regular.toFixed(2)} hrs</td>
                                <td className="rate">@ ${data.wagesByType.regular.rate.toFixed(2)}/hr</td>
                            </tr>
                            {data.hoursByType.weekend > 0 && (
                                <tr>
                                    <td>Weekend Hours:</td>
                                    <td className="value">{data.hoursByType.weekend.toFixed(2)} hrs</td>
                                    <td className="rate">@ ${data.wagesByType.weekend.rate.toFixed(2)}/hr</td>
                                </tr>
                            )}
                            {data.hoursByType.holiday > 0 && (
                                <tr>
                                    <td>Holiday Hours:</td>
                                    <td className="value">{data.hoursByType.holiday.toFixed(2)} hrs</td>
                                    <td className="rate">@ ${data.wagesByType.holiday.rate.toFixed(2)}/hr</td>
                                </tr>
                            )}
                            {data.hoursByType.overtime > 0 && (
                                <tr className="overtime-row">
                                    <td>Overtime Hours:</td>
                                    <td className="value">{data.hoursByType.overtime.toFixed(2)} hrs</td>
                                    <td className="rate">@ ${data.wagesByType.overtime.rate.toFixed(2)}/hr (1.5x)</td>
                                </tr>
                            )}
                            <tr className="total-row">
                                <td><strong>Total Hours:</strong></td>
                                <td className="value"><strong>{data.totalHours.toFixed(2)} hrs</strong></td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                {/* Gross Wages Breakdown */}
                <section className="preview-section">
                    <h3>Gross Wages</h3>
                    <table className="preview-table">
                        <tbody>
                            <tr>
                                <td>Regular Wages:</td>
                                <td className="value">${data.wagesByType.regular.subtotal.toFixed(2)}</td>
                            </tr>
                            {data.wagesByType.weekend.subtotal > 0 && (
                                <tr>
                                    <td>Weekend Wages:</td>
                                    <td className="value">${data.wagesByType.weekend.subtotal.toFixed(2)}</td>
                                </tr>
                            )}
                            {data.wagesByType.holiday.subtotal > 0 && (
                                <tr>
                                    <td>Holiday Wages:</td>
                                    <td className="value">${data.wagesByType.holiday.subtotal.toFixed(2)}</td>
                                </tr>
                            )}
                            {data.wagesByType.overtime.subtotal > 0 && (
                                <tr className="overtime-row">
                                    <td>Overtime Wages:</td>
                                    <td className="value">${data.wagesByType.overtime.subtotal.toFixed(2)}</td>
                                </tr>
                            )}
                            <tr className="total-row">
                                <td><strong>Gross Pay:</strong></td>
                                <td className="value"><strong>${data.grossWages.toFixed(2)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                {/* Tax Deductions */}
                <section className="preview-section">
                    <h3>Tax Deductions (Employee)</h3>
                    <table className="preview-table">
                        <tbody>
                            <tr>
                                <td>Social Security (6.2%):</td>
                                <td className="value">-${data.taxes.socialSecurityEmployee.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Medicare (1.45%):</td>
                                <td className="value">-${data.taxes.medicareEmployee.toFixed(2)}</td>
                            </tr>
                            {data.federalWithholding > 0 && (
                                <tr>
                                    <td>Federal Income Tax:</td>
                                    <td className="value">-${data.federalWithholding.toFixed(2)}</td>
                                </tr>
                            )}
                            {data.taxes.coloradoStateIncomeTax > 0 && (
                                <tr>
                                    <td>Colorado State Tax (4.4%):</td>
                                    <td className="value">-${data.taxes.coloradoStateIncomeTax.toFixed(2)}</td>
                                </tr>
                            )}
                            {data.taxes.coloradoFamliEmployee > 0 && (
                                <tr>
                                    <td>Colorado FAMLI (0.44%):</td>
                                    <td className="value">-${data.taxes.coloradoFamliEmployee.toFixed(2)}</td>
                                </tr>
                            )}
                            <tr className="total-row deduction-row">
                                <td><strong>Total Deductions:</strong></td>
                                <td className="value">
                                    <strong>
                                        -${(
                                            data.taxes.socialSecurityEmployee +
                                            data.taxes.medicareEmployee +
                                            (data.federalWithholding || 0) +
                                            (data.taxes.coloradoStateIncomeTax || 0) +
                                            (data.taxes.coloradoFamliEmployee || 0)
                                        ).toFixed(2)}
                                    </strong>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                {/* Employer Taxes */}
                <section className="preview-section employer-section">
                    <h3>Employer Taxes (Your Cost)</h3>
                    <table className="preview-table">
                        <tbody>
                            <tr>
                                <td>Social Security (6.2%):</td>
                                <td className="value">${data.taxes.socialSecurityEmployer.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Medicare (1.45%):</td>
                                <td className="value">${data.taxes.medicareEmployer.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>FUTA (0.6%):</td>
                                <td className="value">${data.taxes.futa.toFixed(2)}</td>
                            </tr>
                            {data.taxes.coloradoSuta > 0 && (
                                <tr>
                                    <td>Colorado SUI:</td>
                                    <td className="value">${data.taxes.coloradoSuta.toFixed(2)}</td>
                                </tr>
                            )}
                            {data.taxes.coloradoFamliEmployer > 0 && (
                                <tr>
                                    <td>Colorado FAMLI (0.44%):</td>
                                    <td className="value">${data.taxes.coloradoFamliEmployer.toFixed(2)}</td>
                                </tr>
                            )}
                            <tr className="total-row">
                                <td><strong>Total Employer Taxes:</strong></td>
                                <td className="value">
                                    <strong>
                                        ${(
                                            data.taxes.socialSecurityEmployer +
                                            data.taxes.medicareEmployer +
                                            data.taxes.futa +
                                            (data.taxes.coloradoSuta || 0) +
                                            (data.taxes.coloradoFamliEmployer || 0)
                                        ).toFixed(2)}
                                    </strong>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                {/* Net Pay */}
                <section className="preview-section net-pay-section">
                    <h3>Employee Net Pay (Take Home)</h3>
                    <div className="net-pay-amount">
                        ${data.netPay.toFixed(2)}
                    </div>
                    <p className="net-pay-note">This is the amount the employee will receive</p>
                </section>

                {/* Warnings/Alerts */}
                {data.hoursByType.overtime > 0 && (
                    <div className="alert alert-warning">
                        ⚠️ <strong>Overtime Detected:</strong> {data.hoursByType.overtime.toFixed(2)} hours at 1.5x rate (${data.wagesByType.overtime.rate.toFixed(2)}/hr)
                    </div>
                )}

                {!data.isMinimumWageCompliant && (
                    <div className="alert alert-danger">
                        ❌ <strong>Minimum Wage Violation:</strong> This payroll does not meet minimum wage requirements!
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="payroll-preview-actions">
                <button
                    className="btn-secondary btn-large"
                    onClick={onCancel}
                    disabled={isApproving}
                >
                    ❌ Cancel & Discard
                </button>
                <button
                    className="btn-primary btn-large"
                    onClick={onApprove}
                    disabled={isApproving}
                >
                    {isApproving ? '⏳ Approving...' : '✅ Approve & Finalize Payroll'}
                </button>
            </div>

            <style>{`
                .payroll-preview-container {
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .payroll-preview-header {
                    text-align: center;
                    margin-bottom: 32px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #e74c3c;
                }

                .payroll-preview-header h2 {
                    color: #e74c3c;
                    margin: 0 0 8px 0;
                    font-size: 24px;
                }

                .preview-subtitle {
                    color: #666;
                    margin: 0;
                    font-size: 14px;
                }

                .payroll-preview-content {
                    max-width: 800px;
                    margin: 0 auto;
                }

                .preview-section {
                    margin-bottom: 32px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 6px;
                }

                .preview-section h3 {
                    margin: 0 0 16px 0;
                    color: #2c3e50;
                    font-size: 18px;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 8px;
                }

                .employer-section h3 {
                    border-bottom-color: #9b59b6;
                }

                .net-pay-section {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                }

                .net-pay-section h3 {
                    color: white;
                    border-bottom-color: rgba(255,255,255,0.3);
                }

                .preview-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .preview-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .preview-table td:first-child {
                    color: #555;
                }

                .preview-table td.value {
                    text-align: right;
                    font-weight: 600;
                    color: #2c3e50;
                    font-family: 'Courier New', monospace;
                }

                .preview-table td.rate {
                    text-align: right;
                    color: #7f8c8d;
                    font-size: 13px;
                }

                .preview-table .total-row {
                    background: #ecf0f1;
                    font-size: 16px;
                }

                .preview-table .total-row td {
                    padding: 14px 12px;
                    border-bottom: none;
                }

                .preview-table .deduction-row {
                    background: #ffe6e6;
                }

                .preview-table .overtime-row {
                    background: #fff3cd;
                }

                .net-pay-amount {
                    font-size: 48px;
                    font-weight: bold;
                    margin: 20px 0;
                    font-family: 'Courier New', monospace;
                }

                .net-pay-note {
                    margin: 0;
                    opacity: 0.9;
                    font-size: 14px;
                }

                .alert {
                    padding: 12px 16px;
                    border-radius: 4px;
                    margin: 16px 0;
                }

                .alert-warning {
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    color: #856404;
                }

                .alert-danger {
                    background: #f8d7da;
                    border-left: 4px solid #dc3545;
                    color: #721c24;
                }

                .payroll-preview-actions {
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                    margin-top: 32px;
                    padding-top: 24px;
                    border-top: 2px solid #e0e0e0;
                }

                .btn-large {
                    padding: 14px 32px;
                    font-size: 16px;
                    font-weight: 600;
                    min-width: 220px;
                }

                .btn-large:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

export default PayrollPreviewDetails;
