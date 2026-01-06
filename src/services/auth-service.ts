/**
 * AuthService - Handles 4-digit PIN authentication
 */

import * as bcrypt from 'bcryptjs';
import { getDatabase } from '../database/db';

export class AuthService {
    /**
     * Check if PIN is already set
     */
    static isPinSet(): boolean {
        const db = getDatabase();
        const result = db.prepare('SELECT COUNT(*) as count FROM auth').get() as { count: number };
        return result.count > 0;
    }

    /**
     * Set up initial PIN (4 digits)
     */
    static async setupPin(pin: string): Promise<void> {
        if (!/^\d{4}$/.test(pin)) {
            throw new Error('PIN must be exactly 4 digits');
        }

        const pinHash = await bcrypt.hash(pin, 10);
        const db = getDatabase();

        db.prepare('INSERT INTO auth (pin_hash) VALUES (?)').run(pinHash);
    }

    /**
     * Verify PIN
     */
    static async verifyPin(pin: string): Promise<boolean> {
        if (!/^\d{4}$/.test(pin)) {
            return false;
        }

        const db = getDatabase();
        const auth = db.prepare('SELECT pin_hash FROM auth ORDER BY id DESC LIMIT 1').get() as { pin_hash: string } | undefined;

        if (!auth) {
            return false;
        }

        return await bcrypt.compare(pin, auth.pin_hash);
    }

    /**
     * Update PIN
     */
    static async updatePin(currentPin: string, newPin: string): Promise<void> {
        const isValid = await this.verifyPin(currentPin);
        if (!isValid) {
            throw new Error('Current PIN is incorrect');
        }

        if (!/^\d{4}$/.test(newPin)) {
            throw new Error('New PIN must be exactly 4 digits');
        }

        const pinHash = await bcrypt.hash(newPin, 10);
        const db = getDatabase();

        db.prepare('UPDATE auth SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT MAX(id) FROM auth)').run(pinHash);
    }
}
