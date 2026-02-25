"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var path = __importStar(require("path"));
var os = __importStar(require("os"));
var fs = __importStar(require("fs"));
var paystub_generator_1 = require("./src/utils/paystub-generator");
var dbPath = path.join(os.homedir(), 'Library/Application Support/household-payroll/payroll.db');
var db = new better_sqlite3_1.default(dbPath, { readonly: true });
console.log('Reading February payroll data...');
// Get one of the February payroll records
var record = db.prepare("\n  SELECT * FROM payroll_records \n  WHERE pay_period_start >= '2026-02-01' \n  ORDER BY pay_period_start \n  LIMIT 1\n").get();
if (!record) {
    console.log('No February payroll records found');
    process.exit(1);
}
console.log('Found record:', record);
// Get employer info
var employer = db.prepare('SELECT * FROM employers WHERE id = ?').get(record.employer_id);
console.log('Employer:', employer);
// Get caregiver info
var caregiver = db.prepare('SELECT * FROM caregivers WHERE id = ?').get(record.caregiver_id);
console.log('Caregiver:', caregiver);
// Get YTD data
var ytd = db.prepare("\n  SELECT \n    COALESCE(SUM(gross_wages), 0) as grossWages,\n    COALESCE(SUM(regular_wages), 0) as regularWages,\n    COALESCE(SUM(weekend_wages), 0) as weekendWages,\n    COALESCE(SUM(holiday_wages), 0) as holidayWages,\n    COALESCE(SUM(overtime_wages), 0) as overtimeWages,\n    COALESCE(SUM(ss_employee), 0) as ssEmployee,\n    COALESCE(SUM(medicare_employee), 0) as medicareEmployee,\n    COALESCE(SUM(federal_withholding), 0) as federalWithholding,\n    COALESCE(SUM(ss_employer), 0) as ssEmployer,\n    COALESCE(SUM(medicare_employer), 0) as medicareEmployer,\n    COALESCE(SUM(futa), 0) as futa,\n    COALESCE(SUM(colorado_suta), 0) as coloradoSuta,\n    COALESCE(SUM(colorado_famli_employee), 0) as coloradoFamliEmployee,\n    COALESCE(SUM(colorado_famli_employer), 0) as coloradoFamliEmployer,\n    COALESCE(SUM(net_pay), 0) as netPay\n  FROM payroll_records\n  WHERE caregiver_id = ? AND employer_id = ?\n    AND strftime('%Y', pay_period_start) = strftime('%Y', ?)\n    AND pay_period_start <= ?\n").get(record.caregiver_id, record.employer_id, record.pay_period_start, record.pay_period_end);
console.log('YTD data:', ytd);
// Create PaystubContext
var context = {
    record: {
        id: record.id,
        payPeriodStart: record.pay_period_start,
        payPeriodEnd: record.pay_period_end,
        paymentDate: record.payment_date,
        regular_hours: record.regular_hours,
        regular_wages: record.regular_wages,
        weekend_hours: record.weekend_hours,
        weekend_wages: record.weekend_wages,
        holiday_hours: record.holiday_hours,
        holiday_wages: record.holiday_wages,
        overtime_hours: record.overtime_hours,
        overtime_wages: record.overtime_wages,
        grossWages: record.gross_wages,
        ssEmployee: record.ss_employee,
        medicareEmployee: record.medicare_employee,
        federalWithholding: record.federal_withholding,
        ssEmployer: record.ss_employer,
        medicareEmployer: record.medicare_employer,
        futa: record.futa,
        colorado_suta: record.colorado_suta,
        colorado_famli_employee: record.colorado_famli_employee,
        colorado_famli_employer: record.colorado_famli_employer,
        netPay: record.net_pay
    },
    ytd: ytd
};
// Generate the paystub
console.log('\nGenerating paystub...');
var doc = paystub_generator_1.PaystubGenerator.generatePDF(context, employer, caregiver);
var pdfBytes = doc.output('arraybuffer');
fs.writeFileSync('./test-paystub-feb.pdf', Buffer.from(pdfBytes));
console.log("\nPaystub generated successfully: ./test-paystub-feb.pdf");
console.log('\nCheck the PDF for:');
console.log('1. Regular Earnings, Weekend Premium, and Holiday Premium rows always displayed');
console.log('2. Summary table headers: "Employee Deductions" and "Employer Taxes" (no overlap)');
console.log('3. Proper spacing in the summary table');
db.close();
