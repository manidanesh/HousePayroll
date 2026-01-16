import React, { useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';
import { PaystubGenerator } from '../../utils/paystub-generator';
import { isPaymentLate } from '../../utils/pay-timing-validator';
import SuccessModal from './SuccessModal';
import { useCaregiver } from '../context/caregiver-context';
import PayrollPreviewDetails from './PayrollPreviewDetails';
import ManualPayrollEntry from './ManualPayrollEntry';

const PayrollProcessing: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'time-based' | 'manual'>('time-based');
    const { selectedCaregiver } = useCaregiver();
    const [caregivers, setCaregivers] = useState<any[]>([]);
    const [selectedCaregiverId, setSelectedCaregiverId] = useState<number | null>(selectedCaregiver?.id || null);
    const [unpaidSummary, setUnpaidSummary] = useState<{ totalHours: number, earliestDate: string, latestDate: string } | null>(null);

    // Date selection
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const [calculation, setCalculation] = useState<any | null>(null); // Complex type - mixes PayrollCalculationResult and PayrollRecord
    const [loading, setLoading] = useState<boolean>(false);
    const [processing, setProcessing] = useState<boolean>(false);
    const [successModal, setSuccessModal] = useState<{ open: boolean, title: string, message: string }>({
        open: false,
        title: '',
        message: ''
    });
    const [employer, setEmployer] = useState<any | null>(null);
    const [checkNumber, setCheckNumber] = useState<string>('');
    const [checkBankName, setCheckBankName] = useState<string>('');
    const [checkAccountOwner, setCheckAccountOwner] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [ytdContext, setYtdContext] = useState<any>(null); // Keep as any for now - complex nested structure
    const [stripeAvailable, setStripeAvailable] = useState<boolean>(false);
    const [paymentMethod, setPaymentMethod] = useState<'check' | 'stripe'>('check');
    const [isLate, setIsLate] = useState<boolean>(false);

    // Preview mode state
    const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
    const [previewData, setPreviewData] = useState<any | null>(null);
    const [isApproving, setIsApproving] = useState<boolean>(false);
    const [pendingPayrolls, setPendingPayrolls] = useState<any[]>([]);

    useEffect(() => {
        if (calculation && paymentDate) {
            setIsLate(isPaymentLate(calculation.payPeriodEnd, paymentDate));
        } else {
            setIsLate(false);
        }
    }, [calculation, paymentDate]);

    const loadPending = async () => {
        const drafts = await ipcAPI.payroll.getDrafts();
        setPendingPayrolls(drafts);
    };

    useEffect(() => {
        const init = async () => {
            const list = await ipcAPI.caregiver.getAll();
            setCaregivers(list);
            const emp = await ipcAPI.employer.get();
            setEmployer(emp);
            const isStripeVerified = !!(emp && emp.stripeSecretKey && emp.paymentVerificationStatus === 'verified');
            setStripeAvailable(isStripeVerified);
            loadPending();
        };
        init();
    }, []);

    // Load unpaid hours summary when caregiver changes
    useEffect(() => {
        const loadUnpaidSummary = async () => {
            if (selectedCaregiverId) {
                // We'll use getForCaregiver with no dates to see all unfinalized
                const entries = await ipcAPI.timeEntry.getForCaregiver(selectedCaregiverId);
                const unpaid = entries.filter(e => !e.isFinalized);

                if (unpaid.length > 0) {
                    const totalHours = unpaid.reduce((sum, e) => sum + e.hoursWorked, 0);
                    const dates = unpaid.map(e => e.workDate).sort();
                    setUnpaidSummary({
                        totalHours,
                        earliestDate: dates[0],
                        latestDate: dates[dates.length - 1]
                    });

                    // Pre-fill dates if not already set
                    if (!startDate) setStartDate(dates[0]);
                    if (!endDate) setEndDate(dates[dates.length - 1]);
                } else {
                    setUnpaidSummary(null);
                }
            } else {
                setUnpaidSummary(null);
            }
        };
        loadUnpaidSummary();
    }, [selectedCaregiverId]);

    const handleResume = async (record: any) => {
        setSelectedCaregiverId(record.caregiverId);
        setStartDate(record.payPeriodStart);
        setEndDate(record.payPeriodEnd);

        if (record.isFinalized) {
            // Should not happen given getDrafts filter, but safety check
            return;
        }

        const ytd = await ipcAPI.payroll.getYTDContext(record.caregiverId, new Date(record.payPeriodStart).getFullYear());
        setYtdContext(ytd);

        if (record.status === 'draft') {
            // Reconstruct preview data from record
            // Note: This is an approximation since we don't store the exact preview structure
            // But we have enough to show the preview screen
            setPreviewData({
                ...record,
                taxes: {
                    socialSecurityEmployee: record.ssEmployee,
                    medicareEmployee: record.medicareEmployee,
                    federalWithholding: record.federalWithholding,
                    coloradoFamliEmployee: record.colorado_famli_employee,
                    socialSecurityEmployer: record.ssEmployer,
                    medicareEmployer: record.medicareEmployer,
                    futa: record.futa,
                    coloradoSuta: record.colorado_suta,
                    coloradoFamliEmployer: record.colorado_famli_employer,
                    coloradoStateIncomeTax: 0, // Not stored explicitly usually
                    totalEmployerTaxes: (record.ssEmployer || 0) + (record.medicareEmployer || 0) + (record.futa || 0) + (record.colorado_suta || 0) + (record.colorado_famli_employer || 0)
                },
                hoursByType: {
                    regular: record.regular_hours,
                    weekend: record.weekend_hours,
                    holiday: record.holiday_hours,
                    overtime: record.overtime_hours
                },
                wagesByType: {
                    regular: { subtotal: record.regular_wages },
                    weekend: { subtotal: record.weekend_wages || 0 }, // fallback
                    holiday: { subtotal: record.holiday_wages || 0 }, // fallback
                    overtime: { subtotal: record.overtime_wages || 0 } // fallback
                }
            });
            setIsPreviewMode(true);
        } else if (record.status === 'approved') {
            // Restore approved state
            const mappedRecord = {
                ...record,
                taxes: {
                    coloradoFamliEmployee: record.colorado_famli_employee || 0,
                    socialSecurityEmployer: record.ssEmployer || 0,
                    medicareEmployer: record.medicareEmployer || 0,
                    futa: record.futa || 0,
                    coloradoSuta: record.colorado_suta || 0,
                    coloradoFamliEmployer: record.colorado_famli_employer || 0,
                    totalEmployerTaxes: (record.ssEmployer || 0) +
                        (record.medicareEmployer || 0) +
                        (record.futa || 0) +
                        (record.colorado_suta || 0) +
                        (record.colorado_famli_employer || 0)
                }
            };
            setCalculation(mappedRecord);
            setIsPreviewMode(false);
            setPreviewData(null);
        }
    };

    const handleCalculate = async () => {
        if (!selectedCaregiverId || !startDate || !endDate) {
            setSuccessModal({ open: true, title: 'Input Required', message: 'Please select a caregiver and date range.' });
            return;
        }

        // Check for overlapping finalized payrolls
        const overlappingPayrolls = await ipcAPI.payroll.checkOverlap(selectedCaregiverId, startDate, endDate);

        if (overlappingPayrolls.length > 0) {
            const periodsList = overlappingPayrolls
                .map(p => `  • ${p.pay_period_start} to ${p.pay_period_end} (Check #${p.check_number || 'N/A'})`)
                .join('\n');

            const confirmed = confirm(
                `⚠️ Warning: This date range overlaps with finalized payroll periods:\n\n` +
                periodsList + '\n\n' +
                `Selected range: ${startDate} to ${endDate}\n\n` +
                `Processing overlapping periods may cause:\n` +
                `  • Duplicate payments\n` +
                `  • Incorrect tax calculations\n` +
                `  • Accounting discrepancies\n\n` +
                `Do you want to continue anyway?`
            );

            if (!confirmed) {
                return;
            }
        }

        setLoading(true);
        try {
            const caregiver = caregivers.find(c => c.id === selectedCaregiverId);

            // Get unfinalized time entries for this range
            let timeEntries = await ipcAPI.timeEntry.getForCaregiver(selectedCaregiverId, startDate, endDate);
            timeEntries = timeEntries.filter(te => !te.isFinalized);

            if (timeEntries.length === 0) {
                setSuccessModal({ open: true, title: 'No Time Entries', message: 'No unpaid time entries found for this period.' });
                setLoading(false);
                return;
            }

            const ytd = await ipcAPI.payroll.getYTDContext(selectedCaregiverId, new Date(startDate).getFullYear());
            setYtdContext(ytd);

            // 1. Calculate Payroll
            const input = {
                caregiverId: selectedCaregiverId,
                timeEntries: timeEntries.map(te => ({ date: te.workDate, hours: te.hoursWorked })),
                baseHourlyRate: caregiver.hourlyRate,
                holidayMultiplier: employer.holidayPayMultiplier || 1,
                weekendMultiplier: employer.weekendPayMultiplier || 1,
                ytdWagesBefore: ytd.grossWagesYTD || 0
            };

            const calculationResult = await ipcAPI.payroll.preview(input);

            // 2. Save as draft
            const draft = await ipcAPI.payroll.saveDraft(calculationResult, startDate, endDate);

            // 3. Immediately approve it (skip preview)
            const approvedRecord = await ipcAPI.payroll.approve(draft.id);

            // 4. Map to calculation state for finalization
            const mappedRecord = {
                ...approvedRecord,
                taxes: {
                    coloradoFamliEmployee: approvedRecord.colorado_famli_employee || 0,
                    socialSecurityEmployer: approvedRecord.ssEmployer || 0,
                    medicareEmployer: approvedRecord.medicareEmployer || 0,
                    futa: approvedRecord.futa || 0,
                    coloradoSuta: approvedRecord.colorado_suta || 0,
                    coloradoFamliEmployer: approvedRecord.colorado_famli_employer || 0,
                    totalEmployerTaxes: (approvedRecord.ssEmployer || 0) +
                        (approvedRecord.medicareEmployer || 0) +
                        (approvedRecord.futa || 0) +
                        (approvedRecord.colorado_suta || 0) +
                        (approvedRecord.colorado_famli_employer || 0)
                }
            };

            setCalculation(mappedRecord);
        } catch (error: any) {
            setSuccessModal({ open: true, title: 'Calculation Error', message: `Error: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleApprovePayroll = async () => {
        if (!previewData) return;

        setIsApproving(true);
        try {
            // Save as draft first
            const draft = await ipcAPI.payroll.saveDraft(previewData, startDate, endDate);

            // Approve the draft
            const approvedRecord = await ipcAPI.payroll.approve(draft.id);

            // Load YTD context for finalization
            const ytd = await ipcAPI.payroll.getYTDContext(selectedCaregiverId!, new Date(startDate).getFullYear());
            setYtdContext(ytd);

            // Set calculation for finalization step with compatibility mapping
            // The approved record is flat, but UI expects nested taxes object
            const mappedRecord = {
                ...approvedRecord,
                taxes: {
                    coloradoFamliEmployee: approvedRecord.colorado_famli_employee || 0,
                    socialSecurityEmployer: approvedRecord.ssEmployer || 0,
                    medicareEmployer: approvedRecord.medicareEmployer || 0,
                    futa: approvedRecord.futa || 0,
                    coloradoSuta: approvedRecord.colorado_suta || 0,
                    coloradoFamliEmployer: approvedRecord.colorado_famli_employer || 0,
                    totalEmployerTaxes: (approvedRecord.ssEmployer || 0) +
                        (approvedRecord.medicareEmployer || 0) +
                        (approvedRecord.futa || 0) +
                        (approvedRecord.colorado_suta || 0) +
                        (approvedRecord.colorado_famli_employer || 0)
                }
            };

            setCalculation(mappedRecord);
            setIsPreviewMode(false);
            setPreviewData(null);

            setSuccessModal({
                open: true,
                title: 'Payroll Approved!',
                message: 'Payroll has been approved. You can now finalize it with a check number.'
            });
        } catch (error: any) {
            setSuccessModal({ open: true, title: 'Approval Error', message: `Error: ${error.message}` });
        } finally {
            setIsApproving(false);
        }
    };

    const handleCancelPreview = () => {
        setIsPreviewMode(false);
        setPreviewData(null);
    };

    const validateCheckNumber = async (checkNum: string): Promise<boolean> => {
        if (!checkNum || checkNum.trim() === '') {
            setSuccessModal({
                open: true,
                title: 'Validation Error',
                message: 'Check number is required.'
            });
            return false;
        }

        // Check for duplicate
        try {
            const isDuplicate = await ipcAPI.payroll.checkDuplicateCheckNumber(
                checkNum,
                calculation?.id
            );

            if (isDuplicate) {
                setSuccessModal({
                    open: true,
                    title: 'Duplicate Check Number',
                    message: `Check number "${checkNum}" is already in use. Please enter a different check number.`
                });
                return false;
            }
        } catch (err: any) {
            setSuccessModal({
                open: true,
                title: 'Validation Error',
                message: `Error validating check number: ${err.message}`
            });
            return false;
        }

        return true;
    };

    const handleFinalize = async () => {
        if (!calculation || !checkNumber) {
            setSuccessModal({ open: true, title: 'Input Required', message: 'Please enter a check number.' });
            return;
        }

        // Validate check number for duplicates
        const isValid = await validateCheckNumber(checkNumber);
        if (!isValid) return;

        setProcessing(true);
        try {
            const caregiver = caregivers.find(c => c.id === selectedCaregiverId);

            // Generate PDF
            const pdfDoc = PaystubGenerator.generatePDF(
                { record: calculation, ytd: ytdContext },
                employer,
                caregiver
            );
            const pdfData = pdfDoc.output('arraybuffer');
            const uint8Array = new Uint8Array(pdfData);

            // Prompt user to save PDF
            const result = await ipcAPI.system.promptSaveFile(
                `Paystub_${caregiver.fullLegalName}_${calculation.payPeriodStart}.pdf`,
                uint8Array
            );

            // Finalize payroll
            await ipcAPI.payroll.finalize(
                calculation.id,
                checkNumber,
                paymentDate,
                uint8Array,
                isLate,
                paymentMethod,
                checkBankName,
                checkAccountOwner
            );

            if (result.success) {
                setSuccessModal({
                    open: true,
                    title: 'Payroll Finalized!',
                    message: `Payroll has been finalized successfully.\n\nPDF saved to:\n${result.path}`
                });
            } else {
                setSuccessModal({
                    open: true,
                    title: 'Payroll Finalized!',
                    message: `Payroll has been finalized successfully.\n\nNote: PDF was not saved (canceled by user).`
                });
            }

            // Reset form
            setCalculation(null);
            setCheckNumber('');
            setStartDate('');
            setEndDate('');

            // Trigger refresh of unpaid summary
            setSelectedCaregiverId(null);
            setTimeout(() => setSelectedCaregiverId(caregiver.id), 10);

        } catch (error: any) {
            setSuccessModal({ open: true, title: 'Finalization Error', message: `Error finalizing payroll: ${error.message}` });
        } finally {
            setProcessing(false);
        }
    };


    const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

    return (
        <div className="payroll-container">
            <h2>Run Payroll</h2>

            {/* Tab Navigation */}
            <div className="payroll-tabs">
                <button
                    className={`tab-button ${activeTab === 'time-based' ? 'active' : ''}`}
                    onClick={() => setActiveTab('time-based')}
                >
                    ⏱️ Time-Based Payroll
                </button>
                <button
                    className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manual')}
                >
                    ✍️ Manual Entry
                </button>
            </div>

            {/* Manual Entry Tab */}
            {activeTab === 'manual' && (
                <ManualPayrollEntry onComplete={() => setActiveTab('time-based')} />
            )}

            {/* Time-Based Payroll Tab */}
            {activeTab === 'time-based' && (
                <div className="payroll-processing">

                    {/* Resume Pending Payroll section removed - workflow simplified to go directly from Calculate to Finalize */}

                    <div className="payroll-controls">
                        {!selectedCaregiver ? (
                            <div className="form-group">
                                <label>Select Caregiver</label>
                                <select
                                    value={selectedCaregiverId || ''}
                                    onChange={(e) => {
                                        setSelectedCaregiverId(Number(e.target.value) || null);
                                        setCalculation(null);
                                        setStartDate('');
                                        setEndDate('');
                                    }}
                                    className="form-select"
                                >
                                    <option value="">-- Select Caregiver --</option>
                                    {caregivers.map(c => (
                                        <option key={c.id} value={c.id}>{c.fullLegalName}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="form-group">
                                <label>Active Caregiver</label>
                                <div className="caregiver-badge-locked" style={{
                                    padding: '10px 15px',
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    border: '1px solid #bae6fd',
                                    display: 'inline-block'
                                }}>
                                    👤 {selectedCaregiver.fullLegalName}
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedCaregiverId && unpaidSummary && (
                        <div className="unpaid-summary-box" style={{
                            background: '#fef3c7',
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '24px',
                            border: '1px solid #f59e0b'
                        }}>
                            <strong style={{ color: '#92400e' }}>Unpaid Hours Detected:</strong>
                            <div style={{ marginTop: '4px', fontSize: '14px' }}>
                                You have <strong>{unpaidSummary.totalHours.toFixed(1)} hours</strong> unpaid
                                between <strong>{unpaidSummary.earliestDate}</strong> and <strong>{unpaidSummary.latestDate}</strong>.
                            </div>
                        </div>
                    )}

                    {selectedCaregiverId && (
                        <div className="date-selection-section">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            {!calculation && (
                                <div className="action-section" style={{ marginTop: '24px' }}>
                                    <button
                                        className="btn-primary"
                                        onClick={handleCalculate}
                                        disabled={loading || !startDate || !endDate}
                                    >
                                        {loading ? 'Calculating...' : 'Calculate Payroll'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview Mode - Show preview before calculation */}
                    {isPreviewMode && previewData && (
                        <PayrollPreviewDetails
                            data={previewData}
                            onApprove={handleApprovePayroll}
                            onCancel={handleCancelPreview}
                            isApproving={isApproving}
                        />
                    )}

                    {calculation && (
                        <div className="calculation-results">
                            <h3>Payroll Summary</h3>
                            <div className="summary-grid">
                                <div className="summary-item">
                                    <span>Gross Pay:</span>
                                    <strong>{formatCurrency(calculation.grossWages)}</strong>
                                </div>
                                <div className="summary-item">
                                    <span>Federal Tax:</span>
                                    <strong>{formatCurrency(calculation.federalWithholding)}</strong>
                                </div>
                                <div className="summary-item">
                                    <span>Social Security:</span>
                                    <strong>{formatCurrency(calculation.ssEmployee)}</strong>
                                </div>
                                <div className="summary-item">
                                    <span>Medicare:</span>
                                    <strong>{formatCurrency(calculation.medicareEmployee)}</strong>
                                </div>
                                <div className="summary-item">
                                    <span>CO FAMLI:</span>
                                    <strong>{formatCurrency(calculation.taxes.coloradoFamliEmployee)}</strong>
                                </div>
                                <div className="summary-item highlight">
                                    <span>Net Pay:</span>
                                    <strong>{formatCurrency(calculation.netPay)}</strong>
                                </div>
                            </div>

                            <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#666' }}>Employer-Paid Taxes (Info Only)</h4>
                            <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', background: '#fcfcfc', border: '1px dashed #ddd' }}>
                                <div className="summary-item">
                                    <span>Employer SS:</span>
                                    <strong>{formatCurrency(calculation.taxes.socialSecurityEmployer)}</strong>
                                </div>
                                <div className="summary-item">
                                    <span>Employer Med:</span>
                                    <strong>{formatCurrency(calculation.taxes.medicareEmployer)}</strong>
                                </div>
                                <div className="summary-item">
                                    <span>FUTA (Fed):</span>
                                    <strong>{formatCurrency(calculation.taxes.futa)}</strong>
                                </div>
                                <div className="summary-item">
                                    <span>CO SUI (Employer):</span>
                                    <strong>{formatCurrency(calculation.taxes.coloradoSuta)}</strong>
                                </div>
                                <div className="summary-item">
                                    <span>CO FAMLI (Employer):</span>
                                    <strong>{formatCurrency(calculation.taxes.coloradoFamliEmployer)}</strong>
                                </div>
                                <div className="summary-item highlight" style={{ color: 'var(--text-main)', borderLeft: '1px solid #ddd' }}>
                                    <span>Total Emp Taxes:</span>
                                    <strong>{formatCurrency(calculation.taxes.totalEmployerTaxes)}</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    {calculation && !processing && (
                        <div className="finalize-section card" style={{ marginTop: '24px' }}>
                            <h3 style={{ marginBottom: '20px' }}>Finalize Payment</h3>

                            {isLate && (
                                <div className="wc-warning" style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    marginBottom: '24px',
                                    border: '1px solid #ef4444'
                                }}>
                                    <strong>⚠️ Compliance Advisory: Late Payment Detected</strong>
                                    <p style={{ marginTop: '8px', fontSize: '14px' }}>
                                        Colorado law requires employees to be paid within 10 days of the end of the pay period.
                                        The selected pay date of <strong>{paymentDate}</strong> is more than 10 days after the period end (<strong>{calculation.payPeriodEnd}</strong>).
                                    </p>
                                </div>
                            )}

                            {!caregivers.find(c => c.id === selectedCaregiverId)?.i9Completed && (
                                <div className="wc-warning" style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    marginBottom: '24px',
                                    border: '1px solid #ef4444'
                                }}>
                                    <strong>⚠️ Compliance Flag: Missing Federal Form I-9</strong>
                                    <p style={{ marginTop: '8px', fontSize: '14px' }}>
                                        Federal law requires employers to verify identity and employment eligibility using Form I-9.
                                        No completion record was found for this caregiver.
                                    </p>
                                    <button
                                        className="btn-small btn-secondary"
                                        style={{ marginTop: '12px' }}
                                        onClick={() => window.location.hash = '#/caregivers'}
                                    >
                                        👤 Go to Caregivers
                                    </button>
                                </div>
                            )}

                            {!employer?.wcAcknowledged && (
                                <div className="wc-warning" style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    marginBottom: '24px',
                                    border: '1px solid #ef4444'
                                }}>
                                    <strong>⚠️ Workers' Compensation Acknowledgment Required</strong>
                                    <p style={{ marginTop: '8px', fontSize: '14px' }}>
                                        Colorado law requires household employers to acknowledge their Workers' Compensation status.
                                        You must confirm this in <strong>Settings</strong> before you can finalize payroll.
                                    </p>
                                    <button
                                        className="btn-small btn-secondary"
                                        style={{ marginTop: '12px' }}
                                        onClick={() => window.location.hash = '#/settings'}
                                    >
                                        ⚙️ Go to Settings
                                    </button>
                                </div>
                            )}

                            {selectedCaregiverId && (
                                <div className="payment-method-selector" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
                                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Choose Payment Method *</label>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            className={`btn-small ${paymentMethod === 'check' ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => {
                                                setPaymentMethod('check');
                                            }}
                                            disabled={!employer?.wcAcknowledged}
                                        >
                                            📄 Paper Check / Cash
                                        </button>

                                        {(() => {
                                            const caregiver = caregivers.find(c => c.id === selectedCaregiverId);
                                            const employerVerified = employer?.paymentVerificationStatus === 'verified';
                                            const caregiverLinked = caregiver?.payoutMethod === 'electronic' && caregiver?.stripePayoutId;
                                            const canStripe = employerVerified && caregiverLinked;

                                            return (
                                                <button
                                                    type="button"
                                                    className={`btn-small ${paymentMethod === 'stripe' ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => setPaymentMethod('stripe')}
                                                    disabled={!canStripe || !employer?.wcAcknowledged}
                                                    title={!employerVerified ? "Employer funding source not verified in Settings" :
                                                        !caregiverLinked ? "Caregiver not configured for electronic payouts" :
                                                            "Pay via Stripe ACH"}
                                                    style={!canStripe ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                                >
                                                    💳 Electronic (Stripe)
                                                </button>
                                            );
                                        })()}
                                    </div>
                                    {!stripeAvailable && paymentMethod === 'check' && (
                                        <small style={{ color: '#666', marginTop: '8px', display: 'block' }}>
                                            Electronic payouts are disabled until Employer & Caregiver accounts are verified.
                                        </small>
                                    )}
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Check/Payment Number *</label>
                                    <input
                                        type="text"
                                        value={checkNumber}
                                        onChange={(e) => setCheckNumber(e.target.value)}
                                        className="form-input"
                                        placeholder="e.g. 1001"
                                        disabled={!employer?.wcAcknowledged}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Payment Date</label>
                                    <input
                                        type="date"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        className="form-input"
                                        disabled={!employer?.wcAcknowledged}
                                    />
                                </div>
                            </div>

                            {/* Bank Information (only for check payments) */}
                            {paymentMethod === 'check' && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Bank Name</label>
                                        <input
                                            type="text"
                                            value={checkBankName}
                                            onChange={(e) => setCheckBankName(e.target.value)}
                                            className="form-input"
                                            placeholder="e.g. Chase Bank"
                                            disabled={!employer?.wcAcknowledged}
                                        />
                                        <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                                            Optional: Name of bank check is drawn from
                                        </small>
                                    </div>
                                    <div className="form-group">
                                        <label>Account Owner</label>
                                        <input
                                            type="text"
                                            value={checkAccountOwner}
                                            onChange={(e) => setCheckAccountOwner(e.target.value)}
                                            className="form-input"
                                            placeholder="e.g. John Smith"
                                            disabled={!employer?.wcAcknowledged}
                                        />
                                        <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                                            Optional: Name on checking account
                                        </small>
                                    </div>
                                </div>
                            )}

                            <div className="header-actions" style={{ marginTop: '24px', justifyContent: 'flex-start' }}>
                                {paymentMethod === 'check' ? (
                                    <button
                                        className="btn-success"
                                        onClick={handleFinalize}
                                        disabled={!checkNumber || !paymentDate || !employer?.wcAcknowledged}
                                    >
                                        Finalize & Generate PDF
                                    </button>
                                ) : (
                                    <button
                                        className="btn-primary"
                                        disabled={true}
                                        title="Stripe Payouts: Future Release. (Employer Funding Source Required)"
                                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                    >
                                        🔒 Finalize & Pay via Stripe (Future Release)
                                    </button>
                                )}
                                <button
                                    className="btn-secondary"
                                    onClick={() => setCalculation(null)}
                                    style={{ marginLeft: '12px' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <SuccessModal
                isOpen={successModal.open}
                title={successModal.title}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, open: false })}
            />
        </div>
    );
};

export default PayrollProcessing;

const styles = {};
