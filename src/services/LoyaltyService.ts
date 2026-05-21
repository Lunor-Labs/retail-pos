import { LoyaltyRepository } from '../repositories/LoyaltyRepository';
import { logger } from '../lib/logger';

export class LoyaltyService {
  constructor(private loyaltyRepo: LoyaltyRepository) {}

  async getEarnRate(): Promise<number> {
    const val = await this.loyaltyRepo.getSetting('loyalty_earn_rate');
    return val ? parseInt(val, 10) : 100;
  }

  async getRedeemRate(): Promise<number> {
    const val = await this.loyaltyRepo.getSetting('loyalty_redeem_rate');
    return val ? parseInt(val, 10) : 100;
  }

  async setEarnRate(lkrPerPoint: number): Promise<void> {
    await this.loyaltyRepo.setSetting('loyalty_earn_rate', String(lkrPerPoint));
  }

  async setRedeemRate(pointsPerLkr: number): Promise<void> {
    await this.loyaltyRepo.setSetting('loyalty_redeem_rate', String(pointsPerLkr));
  }

  async calculatePointsEarned(saleAmount: number): Promise<number> {
    const rate = await this.getEarnRate();
    return Math.floor(saleAmount / rate);
  }

  async calculateRedemptionValue(points: number): Promise<number> {
    const rate = await this.getRedeemRate();
    return points / rate;
  }

  async earnPoints(customerId: string, saleAmount: number, saleId: string, currentBalance: number): Promise<number> {
    try {
      const points = await this.calculatePointsEarned(saleAmount);
      if (points > 0) {
        await this.loyaltyRepo.addPoints(customerId, points, saleId, currentBalance);
      }
      return points;
    } catch (error) {
      logger.error('Failed to earn loyalty points', error as Error);
      throw error;
    }
  }

  async redeemPoints(customerId: string, points: number, saleId: string | null, currentBalance: number): Promise<void> {
    try {
      await this.loyaltyRepo.redeemPoints(customerId, points, saleId, currentBalance);
    } catch (error) {
      logger.error('Failed to redeem loyalty points', error as Error);
      throw error;
    }
  }

  async getCustomerHistory(customerId: string) {
    return this.loyaltyRepo.findByCustomerId(customerId);
  }
}
