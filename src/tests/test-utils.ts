/**
 * Test Utilities
 * Shared helpers and factories for tests
 */

import Database from 'better-sqlite3';
import { Employer } from '../types';

/**
 * Create an in-memory test database
 */
export function createTestDatabase(): Database.Database {
    const db = new Database(':memory:');
    // Database schema will be created by migration scripts if needed
    return db;
}

/**
 * Create a test employer with default values
 */
export function createTestEmployer(overrides: Partial<Employer> = {}): Employer {
    return {
        id: 1,
        displayName: 'Test Household',
        childName: 'Test Child',
        ssnOrEin: '123-45-6789',
        payFrequency: 'bi-weekly',
        defaultHourlyRate: 20.00,
        federalWithholdingEnabled: true,
        coloradoSutaRate: 0.017,
        holidayPayMultiplier: 2.0,
        weekendPayMultiplier: 1.5,
        addressLine1: '123 Test St',
        city: 'Denver',
        state: 'CO',
        zip: '80202',
        paymentVerificationStatus: 'none',
        fein: '12-3456789',
        uiAccountNumber: 'UI123456',
        suiWageBase: 16000,
        wcAcknowledged: true,
        coloradoFamliRateEE: 0.0045,
        coloradoFamliRateER: 0.0045,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Assert that two numbers are approximately equal (for currency/decimal comparisons)
 * @param actual - The actual value
 * @param expected - The expected value
 * @param precision - Number of decimal places (default: 2 for currency)
 */
export function expectCurrencyEqual(actual: number, expected: number, precision: number = 2): void {
    const multiplier = Math.pow(10, precision);
    const actualRounded = Math.round(actual * multiplier) / multiplier;
    const expectedRounded = Math.round(expected * multiplier) / multiplier;
    expect(actualRounded).toBe(expectedRounded);
}

/**
 * 2024 Tax Constants for Testing
 */
export const TAX_CONSTANTS_2024 = {
    socialSecurityRate: 0.062,
    socialSecurityWageBase: 176100,
    medicareRate: 0.0145,
    futaRate: 0.006,
    futaWageBase: 7000,
    coloradoSutaRate: 0.017, // Example rate
    coloradoSutaWageBase: 16000,
    coloradoFamliRateEE: 0.0045,
    coloradoFamliRateER: 0.0045,
};
