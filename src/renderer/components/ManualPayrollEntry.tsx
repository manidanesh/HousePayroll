import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from '../lib/ipc';

// Define window.ipcAPI type
declare global {
    interface Window {
        ipcAPI: any;
    }
}

interface ManualPayrollInput {
    caregiverId: number;
    employerId: number;
    payPeriodStart: string;
    payPeriodEnd: string;
    description: string;
    grossAmount: number;
    paymentDate?: string;
    checkNumber?: string;
}

interface TaxPreview {
    grossWages: number;
    ssEmployee: number;
    medicareEmployee: number;
    federalWithholding: number;
    coloradoFamliEmployee: number;
    netPay: number;
    ssEmployer: number;
    medicareEmployer: number;
    futa: number;
    coloradoSuta: number;
    coloradoFamliEmployer: number;
}

interface ManualPayrollEntryProps {
    onComplete?: () => void;
}

const ManualPayrollEntry: React.FC<ManualPayrollEntryProps> = ({ onComplete }) => {
    const [caregivers, setCaregivers] = useState<any[]>([]);
    const [employer, setEmployer] = useState<any>(null);
    const [taxPreview, setTaxPreview] = useState<TaxPreview | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [formData, setFormData] = useState<ManualPayrollInput>({
        caregiverId: 0,
        employerId: 0,
        payPeriodStart: '',
        payPeriodEnd: '',
        description: '',
        grossAmount: 0,
        paymentDate: '',
        checkNumber: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Load caregivers and employer on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [caregiversData, employerData] = await Promise.all([
                ipcAPI.caregiver.getAll(),
                ipcAPI.employer.get()
            ]);

            setCaregivers(caregiversData);
            setEmployer(employerData);

            if (employerData) {
                setFormData(prev => ({ ...prev, employerId: employerData.id }));
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load form data');
        }
    };

    const handleInputChange = (field: keyof ManualPayrollInput, value: any) => {
        setFormData((prev: ManualPayrollInput) => ({ ...prev, [field]: value }));
        // Clear error for this field
        if (errors[field as string]) {
            setErrors((prev: Record<string, string>) => {
                const newErrors = { ...prev };
                delete newErrors[field as string];
                return newErrors;
            });
        }
        // Clear taxPreview when data changes
        setTaxPreview(null);
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.caregiverId) {
            newErrors.caregiverId = 'Please select a caregiver';
        }

        if (!formData.payPeriodStart) {
            newErrors.payPeriodStart = 'Start date is required';
        }

        if (!formData.payPeriodEnd) {
            newErrors.payPeriodEnd = 'End date is required';
        }

        if (formData.payPeriodStart && formData.payPeriodEnd) {
            if (new Date(formData.payPeriodStart) >= new Date(formData.payPeriodEnd)) {
                newErrors.payPeriodEnd = 'End date must be after start date';
            }
        }

        if (!formData.description || formData.description.length < 10) {
            newErrors.description = 'Description must be at least 10 characters';
        }

        if (formData.description && formData.description.length > 500) {
            newErrors.description = 'Description must be less than 500 characters';
        }

        if (!formData.grossAmount || formData.grossAmount <= 0) {
            newErrors.grossAmount = 'Gross amount must be greater than $0';
        }

        if (formData.grossAmount > 100000) {
            newErrors.grossAmount = 'Gross amount seems unusually high. Please verify.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleCalculateTaxes = async () => {
        if (!validateForm()) {
            toast.error('Please fix form errors before previewing');
            return;
        }

        setIsCalculating(true);
        try {
            const result = await ipcAPI.payroll.calculateManualTaxes(formData);
            setTaxPreview(result);
            toast.success('Paystub preview ready!');
        } catch (error: any) {
            console.error('Tax calculation failed:', error);
            toast.error(error.message || 'Failed to calculate paystub');
        } finally {
            setIsCalculating(false);
        }
    };

    const handleCreatePaystub = async () => {
        if (!taxPreview) {
            toast.error('Please preview paystub first');
            return;
        }

        setIsCreating(true);
        try {
            const payroll = await ipcAPI.payroll.createManual(formData);
            toast.success('Manual paystub created successfully!');

            // Redirect to payroll detail
            if (onComplete) {
                onComplete();
            }
        } catch (error: any) {
            console.error('Failed to create payroll:', error);
            toast.error(error.message || 'Failed to create paystub');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="manual-payroll-container">
            <h2>Manual Payroll Entry</h2>
            <p className="text-muted">
                Create a payroll entry with manual gross amount. Taxes will be calculated automatically.
            </p>

            <div className="form-section">
                {/* Caregiver Selection */}
                <div className="form-group">
                    <label htmlFor="caregiver">
                        Caregiver <span className="required">*</span>
                    </label>
                    <select
                        id="caregiver"
                        value={formData.caregiverId}
                        onChange={(e) => handleInputChange('caregiverId', parseInt(e.target.value))}
                        className={errors.caregiverId ? 'error' : ''}
                    >
                        <option value="0">Select a care giver...</option>
                        {caregivers.map(cg => (
                            <option key={cg.id} value={cg.id}>{cg.fullLegalName}</option>
                        ))}
                    </select>
                    {errors.caregiverId && <span className="error-text">{errors.caregiverId}</span>}
                </div>

                {/* Pay Period */}
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="startDate">
                            Period Start <span className="required">*</span>
                        </label>
                        <input
                            type="date"
                            id="startDate"
                            value={formData.payPeriodStart}
                            onChange={(e) => handleInputChange('payPeriodStart', e.target.value)}
                            className={errors.payPeriodStart ? 'error' : ''}
                        />
                        {errors.payPeriodStart && <span className="error-text">{errors.payPeriodStart}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="endDate">
                            Period End <span className="required">*</span>
                        </label>
                        <input
                            type="date"
                            id="endDate"
                            value={formData.payPeriodEnd}
                            onChange={(e) => handleInputChange('payPeriodEnd', e.target.value)}
                            className={errors.payPeriodEnd ? 'error' : ''}
                        />
                        {errors.payPeriodEnd && <span className="error-text">{errors.payPeriodEnd}</span>}
                    </div>
                </div>

                {/* Description */}
                <div className="form-group">
                    <label htmlFor="description">
                        Description <span className="required">*</span>
                    </label>
                    <textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Weekend hours correction (1.3x premium), Holiday bonus, etc."
                        rows={3}
                        className={errors.description ? 'error' : ''}
                    />
                    <small className="text-muted">
                        {formData.description.length}/500 characters (minimum 10)
                    </small>
                    {errors.description && <span className="error-text">{errors.description}</span>}
                </div>

                {/* Gross Amount */}
                <div className="form-group">
                    <label htmlFor="grossAmount">
                        Gross Amount <span className="required">*</span>
                    </label>
                    <div className="input-with-prefix">
                        <span className="prefix">$</span>
                        <input
                            type="number"
                            id="grossAmount"
                            value={formData.grossAmount || ''}
                            onChange={(e) => handleInputChange('grossAmount', parseFloat(e.target.value) || 0)}
                            step="0.01"
                            min="0"
                            max="100000"
                            placeholder="0.00"
                            className={errors.grossAmount ? 'error' : ''}
                        />
                    </div>
                    {errors.grossAmount && <span className="error-text">{errors.grossAmount}</span>}
                </div>

                {/* Payment Date (Optional) */}
                <div className="form-group">
                    <label htmlFor="paymentDate">Payment Date (Optional)</label>
                    <input
                        type="date"
                        id="paymentDate"
                        value={formData.paymentDate}
                        onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                    />
                    <small className="text-muted">Defaults to period end date if not specified</small>
                </div>

                {/* Check Number (Optional) */}
                <div className="form-group">
                    <label htmlFor="checkNumber">Check Number (Optional)</label>
                    <input
                        type="text"
                        id="checkNumber"
                        value={formData.checkNumber || ''}
                        onChange={(e) => handleInputChange('checkNumber', e.target.value)}
                        placeholder="e.g. 101"
                    />
                </div>

                {/* Calculate Button */}
                <div className="form-actions">
                    <button
                        type="button"
                        onClick={handleCalculateTaxes}
                        disabled={isCalculating}
                        className="btn btn-secondary"
                    >
                        {isCalculating ? 'Calculating...' : '🔍 Preview Paystub'}
                    </button>
                </div>

                {/* Tax Preview */}
                {taxPreview && (
                    <div className="tax-preview">
                        <h3>📋 Paystub Preview</h3>
                        <table className="preview-table">
                            <tbody>
                                <tr>
                                    <td>Gross Pay</td>
                                    <td className="amount">${taxPreview.grossWages.toFixed(2)}</td>
                                </tr>
                                <tr className="section-header">
                                    <td colSpan={2}>Employee Deductions</td>
                                </tr>
                                <tr>
                                    <td>Social Security (6.2%)</td>
                                    <td className="amount">-${taxPreview.ssEmployee.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td>Medicare (1.45%)</td>
                                    <td className="amount">-${taxPreview.medicareEmployee.toFixed(2)}</td>
                                </tr>
                                {taxPreview.coloradoFamliEmployee > 0 && (
                                    <tr>
                                        <td>CO FAMLI (Employee)</td>
                                        <td className="amount">-${taxPreview.coloradoFamliEmployee.toFixed(2)}</td>
                                    </tr>
                                )}
                                {taxPreview.federalWithholding > 0 && (
                                    <tr>
                                        <td>Federal Withholding</td>
                                        <td className="amount">-${taxPreview.federalWithholding.toFixed(2)}</td>
                                    </tr>
                                )}
                                <tr className="total-row">
                                    <td><strong>Net Pay</strong></td>
                                    <td className="amount"><strong>${taxPreview.netPay.toFixed(2)}</strong></td>
                                </tr>
                                <tr className="section-header">
                                    <td colSpan={2}>Employer Taxes (Info Only)</td>
                                </tr>
                                <tr>
                                    <td>Social Security (6.2%)</td>
                                    <td className="amount">${taxPreview.ssEmployer.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td>Medicare (1.45%)</td>
                                    <td className="amount">${taxPreview.medicareEmployer.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td>FUTA (0.6%)</td>
                                    <td className="amount">${taxPreview.futa.toFixed(2)}</td>
                                </tr>
                                {taxPreview.coloradoSuta > 0 && (
                                    <tr>
                                        <td>CO SUTA</td>
                                        <td className="amount">${taxPreview.coloradoSuta.toFixed(2)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="form-actions">
                            <button
                                type="button"
                                onClick={handleCreatePaystub}
                                disabled={isCreating}
                                className="btn btn-primary"
                            >
                                {isCreating ? 'Creating...' : 'Create Paystub'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        .manual-payroll-container {
          max-width: 700px;
          margin: 0 auto;
          padding: 20px;
        }

        .form-section {
          background: white;
          border-radius: 8px;
          padding: 24px;
          margin-top: 20px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
        }

        .required {
          color: #dc3545;
        }

        input, select, textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: var(--primary-color, #007bff);
        }

        input.error, select.error, textarea.error {
          border-color: #dc3545;
        }

        .error-text {
          display: block;
          color: #dc3545;
          font-size: 13px;
          margin-top: 4px;
        }

        .text-muted {
          color: #666;
          font-size: 13px;
          display: block;
          margin-top: 4px;
        }

        .input-with-prefix {
          position: relative;
          display: flex;
          align-items: center;
        }

        .prefix {
          position: absolute;
          left: 12px;
          color: #666;
          font-weight: 500;
        }

        .input-with-prefix input {
          padding-left: 28px;
        }

        .form-actions {
          margin-top: 24px;
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 10px 24px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--primary-color, #007bff);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-secondary {
          background: #0ea5e9;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #0284c7;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(14, 165, 233, 0.3);
        }

        .tax-preview {
          margin-top: 32px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .tax-preview h3 {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 18px;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
        }

        .preview-table tr {
          border-bottom: 1px solid #dee2e6;
        }

        .preview-table td {
          padding: 10px 8px;
        }

        .preview-table .amount {
          text-align: right;
          font-family: monospace;
          font-weight: 500;
        }

        .preview-table .section-header td {
          background: #e9ecef;
          font-weight: 600;
          padding: 8px;
        }

        .preview-table .total-row {
          border-top: 2px solid #333;
        }

        .preview-table .total-row td {
          padding: 12px 8px;
          font-size: 16px;
        }
      `}</style>
        </div>
    );
};

export default ManualPayrollEntry;
