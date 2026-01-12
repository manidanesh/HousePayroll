/**
 * Application Error Hierarchy
 * Provides structured error handling with context and error codes
 */

export class ApplicationError extends Error {
    constructor(
        message: string,
        public code: string,
        public context?: Record<string, any>,
        public userMessage?: string
    ) {
        super(message);
        this.name = 'ApplicationError';
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(): string {
        return this.userMessage || this.message;
    }

    /**
     * Get full error details for logging
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            stack: this.stack
        };
    }
}

export class DatabaseError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, any>,
        userMessage: string = 'A database error occurred. Please try again.'
    ) {
        super(message, 'DB_ERROR', context, userMessage);
        this.name = 'DatabaseError';
    }
}

export class ValidationError extends ApplicationError {
    constructor(
        message: string,
        public field?: string,
        context?: Record<string, any>
    ) {
        super(
            message,
            'VALIDATION_ERROR',
            { ...context, field },
            message // Validation errors are user-facing
        );
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends ApplicationError {
    constructor(
        resource: string,
        identifier?: string | number,
        context?: Record<string, any>
    ) {
        const message = identifier
            ? `${resource} with ID ${identifier} not found`
            : `${resource} not found`;

        super(
            message,
            'NOT_FOUND',
            { ...context, resource, identifier },
            message
        );
        this.name = 'NotFoundError';
    }
}

export class AuthenticationError extends ApplicationError {
    constructor(
        message: string = 'Authentication failed',
        context?: Record<string, any>
    ) {
        super(
            message,
            'AUTH_ERROR',
            context,
            'Authentication failed. Please check your credentials.'
        );
        this.name = 'AuthenticationError';
    }
}

export class BusinessRuleError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, any>
    ) {
        super(
            message,
            'BUSINESS_RULE_VIOLATION',
            context,
            message // Business rule errors are user-facing
        );
        this.name = 'BusinessRuleError';
    }
}

export class PayrollCalculationError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, any>
    ) {
        super(
            message,
            'PAYROLL_CALC_ERROR',
            context,
            'An error occurred during payroll calculation. Please verify your inputs.'
        );
        this.name = 'PayrollCalculationError';
    }
}

export class EncryptionError extends ApplicationError {
    constructor(
        message: string,
        context?: Record<string, any>
    ) {
        super(
            message,
            'ENCRYPTION_ERROR',
            context,
            'A security error occurred. Please contact support.'
        );
        this.name = 'EncryptionError';
    }
}

/**
 * Helper function to wrap database operations with error handling
 */
export function wrapDatabaseOperation<T>(
    operation: () => T,
    context?: Record<string, any>
): T {
    try {
        return operation();
    } catch (err: any) {
        if (err instanceof ApplicationError) {
            throw err;
        }
        throw new DatabaseError(
            `Database operation failed: ${err.message}`,
            { ...context, originalError: err.message }
        );
    }
}

/**
 * Helper function to validate required fields
 */
export function validateRequired(
    data: Record<string, any>,
    requiredFields: string[]
): void {
    for (const field of requiredFields) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            throw new ValidationError(
                `${field} is required`,
                field,
                { providedFields: Object.keys(data) }
            );
        }
    }
}

/**
 * Helper function to validate number range
 */
export function validateRange(
    value: number,
    field: string,
    min?: number,
    max?: number
): void {
    if (min !== undefined && value < min) {
        throw new ValidationError(
            `${field} must be at least ${min}`,
            field,
            { value, min, max }
        );
    }
    if (max !== undefined && value > max) {
        throw new ValidationError(
            `${field} must be at most ${max}`,
            field,
            { value, min, max }
        );
    }
}
