/**
 * Security Sanitization Utilities
 * Centralizes logic for scrubbing sensitive data from objects before logging
 */

/**
 * Strips sensitive fields (SSN, etc.) from an object for safe logging.
 * Returns a deep copy of the object with sensitive fields masked or removed.
 */
export function sanitizeData(data: any): any {
    if (!data) return data;
    if (typeof data !== 'object') return data;

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item));
    }

    // Handle objects
    const sanitized: any = { ...data };

    // List of sensitive keys to redact
    const SENSITIVE_KEYS = [
        'ssn',
        'ssnOrEin',
        'ssnEncrypted',
        'pin',
        'password',
        'secret',
        'key',
        'stripeSecretKey',
        'stripe_secret_key_enc',
        'stripe_account_id_enc',
        'stripe_publishable_key_enc',
        'accountNumber',
        'routingNumber'
    ];

    for (const key of Object.keys(sanitized)) {
        // Redact specific keys
        if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()) && !key.toLowerCase().includes('masked'))) {
            sanitized[key] = '[REDACTED]';
        }
        // Recursively sanitize nested objects
        else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeData(sanitized[key]);
        }
    }

    return sanitized;
}

/**
 * Specific sanitizer for Caregiver input data
 */
export function sanitizeCaregiverInput(data: any): any {
    if (!data) return data;
    
    // Use the generic sanitizer first
    const sanitized = sanitizeData(data);
    
    // Additional specific masking if needed (e.g. keeping last 4)
    // For logs, full redaction is safer.
    
    return sanitized;
}
