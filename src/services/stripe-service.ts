import Stripe from 'stripe';
import { EmployerService } from './employer-service';
import { CaregiverService } from './caregiver-service';
import { Caregiver } from '../types';

export class StripeService {
    private static stripeClient: Stripe | null = null;

    private static async getClient(): Promise<Stripe> {
        if (this.stripeClient) return this.stripeClient;

        const employer = EmployerService.getEmployer();
        if (!employer || !employer.stripeSecretKey) {
            throw new Error('Stripe is not configured. Please add your API keys in Settings.');
        }

        this.stripeClient = new Stripe(employer.stripeSecretKey, {
            apiVersion: '2025-01-27-acacia' as any,
        });

        return this.stripeClient;
    }

    /**
     * Clear the client (useful when API keys are updated)
     */
    static resetClient() {
        this.stripeClient = null;
    }

    /**
     * Create a Stripe Customer for a caregiver
     */
    static async createCustomer(caregiverId: number): Promise<string> {
        const stripe = await this.getClient();
        const caregiver = CaregiverService.getCaregiverById(caregiverId);
        if (!caregiver) throw new Error('Caregiver not found');

        const customer = await stripe.customers.create({
            name: caregiver.fullLegalName,
            metadata: {
                caregiverId: caregiver.id.toString(),
            },
        });

        await CaregiverService.updateCaregiver(caregiverId, { stripeCustomerId: customer.id });
        return customer.id;
    }

    /**
     * Attach a bank account to a customer (via Account/Routing tokens)
     * For ACH Payouts, we usually need to create a Bank Account token first.
     */
    static async addBankAccount(caregiverId: number, routingNumber: string, accountNumber: string): Promise<string> {
        const stripe = await this.getClient();
        const caregiver = CaregiverService.getCaregiverById(caregiverId);
        if (!caregiver) throw new Error('Caregiver not found');

        let customerId = caregiver.stripeCustomerId;
        if (!customerId) {
            customerId = await this.createCustomer(caregiverId);
        }

        // Create a bank account token securely
        const token = await stripe.tokens.create({
            bank_account: {
                country: 'US',
                currency: 'usd',
                routing_number: routingNumber,
                account_number: accountNumber,
                account_holder_name: caregiver.fullLegalName,
                account_holder_type: 'individual',
            },
        });

        // Attach to customer
        const bankAccount = await stripe.customers.createSource(customerId, {
            source: token.id,
        }) as Stripe.BankAccount;

        await CaregiverService.updateCaregiver(caregiverId, { stripeBankAccountId: bankAccount.id });
        return bankAccount.id;
    }

    /**
     * Process a payout for a payroll record
     * Note: In a real system, you'd likely use Stripe Connect for true payroll payouts.
     * For individual usage, we can use Transfers or Payouts if the platform allows.
     */
    static async createPayment(payrollId: number, amount: number, caregiverId: number): Promise<string> {
        const stripe = await this.getClient();
        const caregiver = CaregiverService.getCaregiverById(caregiverId);
        if (!caregiver || !caregiver.stripeCustomerId) {
            throw new Error('Caregiver Stripe account not set up');
        }

        // Create a charge or transfer (Depending on account type)
        // For this demo/test mode, we'll create a Payout (if using connected account) 
        // Or a Payout to the bank account if it's the platform's bank account.

        // Simulating a successful Stripe Payment / Payout creation
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            customer: caregiver.stripeCustomerId,
            description: `Payroll Payment #${payrollId}`,
            payment_method_types: ['ach_debit'], // Using ACH for payroll
            metadata: { payrollId: payrollId.toString() }
        });

        return paymentIntent.id;
    }
}
