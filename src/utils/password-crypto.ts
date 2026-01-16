import * as crypto from 'crypto';

/**
 * Password-based encryption utility for portable database backups.
 * Uses industry-standard crypto: PBKDF2 + AES-256-GCM
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const ALGORITHM = 'aes-256-gcm';

export interface EncryptedData {
    salt: string;
    iv: string;
    authTag: string;
    ciphertext: string;
}

/**
 * Derives an encryption key from a password using PBKDF2.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
        password,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha256'
    );
}

/**
 * Encrypts data with a password using AES-256-GCM.
 * Returns base64-encoded components for storage.
 */
export function encryptWithPassword(data: string, password: string): EncryptedData {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive encryption key from password
    const key = deriveKey(password, salt);

    // Encrypt data
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let ciphertext = cipher.update(data, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        ciphertext
    };
}

/**
 * Decrypts data with a password using AES-256-GCM.
 * Throws error if password is incorrect or data is tampered.
 */
export function decryptWithPassword(encrypted: EncryptedData, password: string): string {
    try {
        // Decode components
        const salt = Buffer.from(encrypted.salt, 'base64');
        const iv = Buffer.from(encrypted.iv, 'base64');
        const authTag = Buffer.from(encrypted.authTag, 'base64');

        // Derive decryption key from password
        const key = deriveKey(password, salt);

        // Decrypt data
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
        plaintext += decipher.final('utf8');

        return plaintext;
    } catch (error) {
        // Authentication failure or wrong password
        throw new Error('Incorrect password or corrupted backup file');
    }
}

/**
 * Validates password strength.
 * Returns error message if invalid, null if valid.
 */
export function validatePassword(password: string): string | null {
    if (password.length < 12) {
        return 'Password must be at least 12 characters long';
    }

    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }

    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }

    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number';
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
        return 'Password must contain at least one special character';
    }

    return null;
}

/**
 * Calculates password strength score (0-100).
 */
export function calculatePasswordStrength(password: string): number {
    let score = 0;

    // Length score (max 40 points)
    score += Math.min(password.length * 2, 40);

    // Character variety (max 60 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[^a-zA-Z0-9]/.test(password)) score += 10;

    // Multiple of each type
    const lowercase = (password.match(/[a-z]/g) || []).length;
    const uppercase = (password.match(/[A-Z]/g) || []).length;
    const numbers = (password.match(/[0-9]/g) || []).length;
    const special = (password.match(/[^a-zA-Z0-9]/g) || []).length;

    if (lowercase > 2) score += 5;
    if (uppercase > 2) score += 5;
    if (numbers > 2) score += 5;
    if (special > 2) score += 5;

    return Math.min(score, 100);
}
