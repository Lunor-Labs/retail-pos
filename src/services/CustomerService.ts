import { CustomerRepository } from '../repositories/CustomerRepository';
import { ReferralAgentRepository } from '../repositories/ReferralAgentRepository';
import { Customer } from '../types';
import { logger } from '../lib/logger';

export interface CreateCustomerInput {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    credit_limit?: number;
    notes?: string | null;
}

export class CustomerService {
    constructor(
        private customerRepo: CustomerRepository,
        private referralAgentRepo: ReferralAgentRepository
    ) { }

    async getAllCustomers(): Promise<Customer[]> {
        try {
            logger.debug('Fetching all active customers');
            return await this.customerRepo.findAllActive();
        } catch (error) {
            logger.error('Failed to fetch customers', error as Error);
            throw new Error('Unable to load customers');
        }
    }

    async getCustomerCount(): Promise<number> {
        try {
            return await this.customerRepo.countActive();
        } catch (error) {
            logger.error('Failed to count customers', error as Error);
            return 0;
        }
    }

    async createCustomer(input: CreateCustomerInput): Promise<Customer> {
        try {
            if (!input.name) throw new Error('Customer name is required');

            const customer = await this.customerRepo.create({
                ...input,
                active: true,
                current_credit: 0
            });
            logger.info('Customer created', { id: customer.id, name: customer.name });
            return customer;
        } catch (error) {
            logger.error('Failed to create customer', error as Error);
            throw error;
        }
    }

    async updateCustomer(id: string, updates: Partial<CreateCustomerInput>): Promise<Customer> {
        try {
            const customer = await this.customerRepo.update(id, updates);
            logger.info('Customer updated', { id });
            return customer;
        } catch (error) {
            logger.error('Failed to update customer', error as Error);
            throw error;
        }
    }

    async searchCustomers(term: string): Promise<Customer[]> {
        try {
            return await this.customerRepo.search(term);
        } catch (error) {
            logger.error('Failed to search customers', error as Error);
            throw new Error('Search failed');
        }
    }

    async getAllReferralAgents() {
        try {
            return await this.referralAgentRepo.findAllActive();
        } catch (error) {
            logger.error('Failed to fetch referral agents', error as Error);
            return [];
        }
    }

    async createReferralAgent(agentData: any) {
        try {
            return await this.referralAgentRepo.create({
                ...agentData,
                active: true
            });
        } catch (error) {
            logger.error('Failed to create referral agent', error as Error);
            throw error;
        }
    }

    async updateReferralAgent(id: string, updates: any) {
        try {
            const agent = await this.referralAgentRepo.update(id, {
                ...updates,
                updated_at: new Date().toISOString()
            });
            logger.info('Referral agent updated', { id });
            return agent;
        } catch (error) {
            logger.error('Failed to update referral agent', error as Error);
            throw error;
        }
    }

    async updateCredit(customerId: string, amount: number): Promise<Customer> {
        try {
            return await this.customerRepo.updateCredit(customerId, amount);
        } catch (error) {
            logger.error('Failed to update customer credit', error as Error);
            throw error;
        }
    }
}
