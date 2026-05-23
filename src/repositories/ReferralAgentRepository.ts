import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { ReferralAgent } from '../types';

export class ReferralAgentRepository extends BaseRepository<ReferralAgent> {
    constructor(adapter: DatabaseAdapter) {
        super(adapter, 'referral_agents');
    }

    async findAllActive(): Promise<ReferralAgent[]> {
        return this.findAll({ active: true });
    }
}
