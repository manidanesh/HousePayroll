"use strict";
/**
 * AuthService - Handles 4-digit PIN authentication
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt = __importStar(require("bcryptjs"));
const db_1 = require("../database/db");
class AuthService {
    /**
     * Check if PIN is already set
     */
    static isPinSet() {
        const db = (0, db_1.getDatabase)();
        const result = db.prepare('SELECT COUNT(*) as count FROM auth').get();
        return result.count > 0;
    }
    /**
     * Set up initial PIN (4 digits)
     */
    static async setupPin(pin) {
        if (!/^\d{4}$/.test(pin)) {
            throw new Error('PIN must be exactly 4 digits');
        }
        const pinHash = await bcrypt.hash(pin, 10);
        const db = (0, db_1.getDatabase)();
        db.prepare('INSERT INTO auth (pin_hash) VALUES (?)').run(pinHash);
    }
    /**
     * Verify PIN
     */
    static async verifyPin(pin) {
        if (!/^\d{4}$/.test(pin)) {
            return false;
        }
        const db = (0, db_1.getDatabase)();
        const auth = db.prepare('SELECT pin_hash FROM auth ORDER BY id DESC LIMIT 1').get();
        if (!auth) {
            return false;
        }
        return await bcrypt.compare(pin, auth.pin_hash);
    }
    /**
     * Update PIN
     */
    static async updatePin(currentPin, newPin) {
        const isValid = await this.verifyPin(currentPin);
        if (!isValid) {
            throw new Error('Current PIN is incorrect');
        }
        if (!/^\d{4}$/.test(newPin)) {
            throw new Error('New PIN must be exactly 4 digits');
        }
        const pinHash = await bcrypt.hash(newPin, 10);
        const db = (0, db_1.getDatabase)();
        db.prepare('UPDATE auth SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT MAX(id) FROM auth)').run(pinHash);
    }
}
exports.AuthService = AuthService;
