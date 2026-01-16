/**
 * Database Schema Definitions
 * Shared between main application and test environment
 */

export const SCHEMA = {
  employers: `
    CREATE TABLE IF NOT EXISTS employers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      child_name TEXT,
      ssn_or_ein_encrypted TEXT NOT NULL,
      pay_frequency TEXT NOT NULL CHECK(pay_frequency IN ('weekly', 'bi-weekly', 'monthly')),
      default_hourly_rate REAL NOT NULL,
      federal_withholding_enabled INTEGER DEFAULT 0,
      colorado_suta_rate REAL DEFAULT 0.0,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      paystub_title TEXT,
      service_address TEXT,
      stripe_publishable_key_enc TEXT,
      stripe_secret_key_enc TEXT,
      stripe_account_id_enc TEXT,
      payment_verification_status TEXT DEFAULT 'none',
      masked_funding_account TEXT,
      fein_enc TEXT,
      ui_account_number_enc TEXT,
      sui_wage_base REAL DEFAULT 16000.0,
      sui_effective_date TEXT,
      wc_acknowledged INTEGER DEFAULT 0,
      wc_carrier_enc TEXT,
      wc_policy_number_enc TEXT,
      wc_acknowledgment_date TEXT,
      colorado_famli_rate_ee REAL DEFAULT 0.0045,
      colorado_famli_rate_er REAL DEFAULT 0.0045,
      is_active INTEGER DEFAULT 0, -- Track currently selected household
      holiday_pay_multiplier REAL DEFAULT 1.0,
      weekend_pay_multiplier REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  caregivers: `
    CREATE TABLE IF NOT EXISTS caregivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_legal_name TEXT NOT NULL,
      ssn_encrypted TEXT NOT NULL,
      hourly_rate REAL NOT NULL,
      employer_id INTEGER, -- Foreign Key
      relationship_note TEXT,
      is_active INTEGER DEFAULT 1,
      hfwa_balance REAL DEFAULT 0,
      stripe_customer_id TEXT,
      stripe_bank_account_id TEXT,
      payout_method TEXT DEFAULT 'check',
      masked_destination_account TEXT,
      stripe_payout_id_enc TEXT,
      i9_completed INTEGER DEFAULT 0,
      i9_completion_date TEXT,
      i9_notes TEXT,
      w4_filing_status TEXT DEFAULT 'single',
      w4_multiple_jobs INTEGER DEFAULT 0,
      w4_dependents_amount REAL DEFAULT 0,
      w4_other_income REAL DEFAULT 0,
      w4_deductions REAL DEFAULT 0,
      w4_extra_withholding REAL DEFAULT 0,
      w4_last_updated TEXT,
      w4_effective_date TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `,
  time_entries: `
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caregiver_id INTEGER NOT NULL,
      employer_id INTEGER, -- Added for isolation
      work_date DATE NOT NULL,
      hours_worked REAL NOT NULL CHECK(hours_worked >= 0),
      is_finalized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `,
  payroll_records: `
    CREATE TABLE IF NOT EXISTS payroll_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caregiver_id INTEGER NOT NULL,
      employer_id INTEGER, -- Added for isolation
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      total_hours REAL NOT NULL,
      gross_wages REAL NOT NULL,
      regular_hours REAL DEFAULT 0,
      weekend_hours REAL DEFAULT 0,
      holiday_hours REAL DEFAULT 0,
      regular_wages REAL DEFAULT 0,
      weekend_wages REAL DEFAULT 0,
      holiday_wages REAL DEFAULT 0,
      ss_employee REAL NOT NULL,
      medicare_employee REAL NOT NULL,
      federal_withholding REAL DEFAULT 0,
      net_pay REAL NOT NULL,
      ss_employer REAL NOT NULL,
      medicare_employer REAL NOT NULL,
      futa REAL NOT NULL,
      colorado_suta REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      overtime_wages REAL DEFAULT 0,
      colorado_famli_employee REAL DEFAULT 0,
      colorado_famli_employer REAL DEFAULT 0,
      colorado_state_income_tax REAL DEFAULT 0,
      employer_sui_rate REAL,
      employer_sui_paid REAL,
      calculation_version TEXT NOT NULL,
      tax_version TEXT NOT NULL,
      is_finalized INTEGER DEFAULT 0,
      status TEXT DEFAULT 'approved' CHECK(status IN ('draft', 'approved')),
      is_minimum_wage_compliant INTEGER DEFAULT 1,
      check_number TEXT,
      payment_date DATE,
      payment_method TEXT,
      is_voided INTEGER DEFAULT 0,
      void_reason TEXT,
      is_late_payment INTEGER DEFAULT 0,
      i9_snapshot INTEGER DEFAULT 0,
      paystub_pdf BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `,
  payments: `
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employer_id INTEGER NOT NULL,
      caregiver_id INTEGER NOT NULL,
      payroll_record_id INTEGER,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'usd',
      stripe_id TEXT,
      status TEXT NOT NULL, -- 'pending', 'paid', 'failed'
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (payroll_record_id) REFERENCES payroll_records(id)
    )
  `,
  payment_transactions: `
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY, -- UUID
      payroll_record_id INTEGER,
      employer_id INTEGER NOT NULL,
      caregiver_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'pending', 'paid', 'failed', 'reversed'
      stripe_tx_id TEXT,
      source_masked TEXT,
      dest_masked TEXT,
      initiated_by TEXT DEFAULT 'employer',
      idempotency_key TEXT UNIQUE,
      tax_logic_version TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payroll_record_id) REFERENCES payroll_records(id),
      FOREIGN KEY (employer_id) REFERENCES employers(id),
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
    )
  `,
  tax_configurations: `
    CREATE TABLE IF NOT EXISTS tax_configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tax_year INTEGER,
      ss_rate_employee REAL NOT NULL,
      ss_rate_employer REAL NOT NULL,
      ss_wage_base REAL DEFAULT 176100,
      medicare_rate_employee REAL NOT NULL,
      medicare_rate_employer REAL NOT NULL,
      medicare_wage_base REAL,
      futa_rate REAL NOT NULL,
      futa_wage_base REAL DEFAULT 7000,
      effective_date DATE NOT NULL,
      version TEXT NOT NULL,
      is_default INTEGER DEFAULT 1,
      notes TEXT
    )
  `,
  audit_log: `
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      employer_id INTEGER,
      action TEXT NOT NULL,
      changes_json TEXT,
      calculation_version TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `,
  export_logs: `
    CREATE TABLE IF NOT EXISTS export_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employer_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER,
      filename TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `,
  auth: `
    CREATE TABLE IF NOT EXISTS auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin_hash TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
};

export const INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_year ON tax_configurations(tax_year)`,
  `CREATE INDEX IF NOT EXISTS idx_payroll_caregiver_id ON payroll_records(caregiver_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payroll_pay_period_end ON payroll_records(pay_period_end)`,
  `CREATE INDEX IF NOT EXISTS idx_payroll_employer_id ON payroll_records(employer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payroll_finalized ON payroll_records(caregiver_id, is_finalized, pay_period_end)`,
  `CREATE INDEX IF NOT EXISTS idx_time_entries_caregiver_date ON time_entries(caregiver_id, work_date)`,
  `CREATE INDEX IF NOT EXISTS idx_time_entries_finalized ON time_entries(is_finalized)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_payroll_id ON payments(payroll_record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(table_name, record_id)`
];
