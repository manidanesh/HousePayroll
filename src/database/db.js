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
exports.getDatabase = getDatabase;
exports.initializeDatabase = initializeDatabase;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const crypto = __importStar(require("crypto"));
let db = null;
// Encryption key for SSN (in production, this should be stored securely)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
function getDatabase() {
    if (!db) {
        const dbPath = path.join(electron_1.app.getPath('userData'), 'payroll.db');
        db = new better_sqlite3_1.default(dbPath);
        db.pragma('journal_mode = WAL');
    }
    return db;
}
function initializeDatabase() {
    const database = getDatabase();
    // Create employers table
    database.exec(`
    CREATE TABLE IF NOT EXISTS employers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      ssn_or_ein_encrypted TEXT NOT NULL,
      pay_frequency TEXT NOT NULL CHECK(pay_frequency IN ('weekly', 'bi-weekly', 'monthly')),
      default_hourly_rate REAL NOT NULL,
      federal_withholding_enabled INTEGER DEFAULT 0,
      colorado_suta_rate REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create caregivers table
    database.exec(`
    CREATE TABLE IF NOT EXISTS caregivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_legal_name TEXT NOT NULL,
      ssn_encrypted TEXT NOT NULL,
      hourly_rate REAL NOT NULL,
      relationship_note TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create time_entries table
    database.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caregiver_id INTEGER NOT NULL,
      work_date DATE NOT NULL,
      hours_worked REAL NOT NULL CHECK(hours_worked >= 0),
      is_finalized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
    )
  `);
    // Create payroll_records table
    database.exec(`
    CREATE TABLE IF NOT EXISTS payroll_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caregiver_id INTEGER NOT NULL,
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      total_hours REAL NOT NULL,
      gross_wages REAL NOT NULL,
      ss_employee REAL NOT NULL,
      medicare_employee REAL NOT NULL,
      federal_withholding REAL DEFAULT 0,
      net_pay REAL NOT NULL,
      ss_employer REAL NOT NULL,
      medicare_employer REAL NOT NULL,
      futa REAL NOT NULL,
      calculation_version TEXT NOT NULL,
      tax_version TEXT NOT NULL,
      is_finalized INTEGER DEFAULT 0,
      check_number TEXT,
      payment_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
    )
  `);
    // Create tax_configurations table
    database.exec(`
    CREATE TABLE IF NOT EXISTS tax_configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL,
      ss_rate_employee REAL NOT NULL,
      ss_rate_employer REAL NOT NULL,
      medicare_rate_employee REAL NOT NULL,
      medicare_rate_employer REAL NOT NULL,
      futa_rate REAL NOT NULL,
      effective_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create audit_log table
    database.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      changes_json TEXT,
      calculation_version TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create auth table for PIN
    database.exec(`
    CREATE TABLE IF NOT EXISTS auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Insert default tax configuration if not exists
    const taxConfig = database.prepare('SELECT COUNT(*) as count FROM tax_configurations').get();
    if (taxConfig.count === 0) {
        database.prepare(`
      INSERT INTO tax_configurations (version, ss_rate_employee, ss_rate_employer, medicare_rate_employee, medicare_rate_employer, futa_rate, effective_date)
      VALUES (?, ?, ?, ?, ?, ?, date('now'))
    `).run('v1.0', 0.062, 0.062, 0.0145, 0.0145, 0.006);
    }
    // Migration: Add multiplier columns to employers table if they don't exist
    try {
        database.exec(`
      ALTER TABLE employers ADD COLUMN holiday_pay_multiplier REAL DEFAULT 1.0
    `);
        console.log('Added holiday_pay_multiplier column to employers table');
    }
    catch (err) {
        // Column already exists, ignore error
    }
    try {
        database.exec(`
      ALTER TABLE employers ADD COLUMN weekend_pay_multiplier REAL DEFAULT 1.0
    `);
        console.log('Added weekend_pay_multiplier column to employers table');
    }
    catch (err) {
        // Column already exists, ignore error
    }
    console.log('Database initialized successfully');
}
// Encryption utilities
function encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}
function decrypt(encryptedText) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
