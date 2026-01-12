/**
 * PayTimingValidator - Utility for Colorado pay timing compliance
 */

/**
 * Checks if a payment is late according to Colorado labor law.
 * Household employers must pay employees within 10 days of the end of the pay period.
 * 
 * @param payPeriodEnd The end date of the pay period (YYYY-MM-DD)
 * @param payDate The date payment was made (YYYY-MM-DD)
 * @returns boolean True if the payment is more than 10 days after the period end
 */
export function isPaymentLate(payPeriodEnd: string, payDate: string): boolean {
    if (!payPeriodEnd || !payDate) return false;

    const end = new Date(payPeriodEnd);
    const pay = new Date(payDate);

    // Calculate difference in days
    const diffTime = pay.getTime() - end.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 10;
}
