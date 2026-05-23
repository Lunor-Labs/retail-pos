import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { LoyaltyTransaction, AppSetting } from '../types';

export class LoyaltyRepository extends BaseRepository<LoyaltyTransaction> {
  constructor(adapter: DatabaseAdapter) {
    super(adapter, 'loyalty_transactions');
  }

  async findByCustomerId(customerId: string): Promise<LoyaltyTransaction[]> {
    return this.query({
      where: [{ field: 'customer_id', operator: '=', value: customerId }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
    });
  }

  async getSetting(key: string): Promise<string | null> {
    const client = (this.adapter as any).getClient();
    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error) return null;
    return (data as AppSetting)?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const client = (this.adapter as any).getClient();
    await client
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  }

  async addPoints(customerId: string, points: number, saleId: string | null, currentBalance: number): Promise<void> {
    const client = (this.adapter as any).getClient();
    const newBalance = currentBalance + points;
    await client.from('loyalty_transactions').insert({
      customer_id: customerId,
      sale_id: saleId,
      type: 'earn',
      points,
      balance_after: newBalance,
    });
    await client
      .from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', customerId);
  }

  async redeemPoints(customerId: string, points: number, saleId: string | null, currentBalance: number): Promise<void> {
    if (points > currentBalance) throw new Error('Insufficient loyalty points.');
    const client = (this.adapter as any).getClient();
    const newBalance = currentBalance - points;
    await client.from('loyalty_transactions').insert({
      customer_id: customerId,
      sale_id: saleId,
      type: 'redeem',
      points: -points,
      balance_after: newBalance,
    });
    await client
      .from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', customerId);
  }
}
