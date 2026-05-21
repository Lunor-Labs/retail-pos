import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Customer } from '../../types';

interface LoyaltyPanelProps {
  customer: Customer | null;
  totalAmount: number;
  earnRate: number;
  onRedeemChange: (pointsToRedeem: number, lkrDiscount: number) => void;
}

export function LoyaltyPanel({ customer, totalAmount, earnRate, onRedeemChange }: LoyaltyPanelProps) {
  const [redeeming, setRedeeming] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const pointsToEarn = Math.floor(totalAmount / earnRate);
  const maxRedeemablePoints = customer?.loyalty_points ?? 0;
  const lkrDiscount = pointsToRedeem;

  useEffect(() => {
    if (!redeeming) {
      setPointsToRedeem(0);
      onRedeemChange(0, 0);
    }
  }, [redeeming]);

  useEffect(() => {
    onRedeemChange(pointsToRedeem, lkrDiscount);
  }, [pointsToRedeem]);

  if (!customer) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-800">
            {customer.loyalty_points.toLocaleString()} points
          </span>
        </div>
        <span className="text-xs text-amber-600">+{pointsToEarn} pts this sale</span>
      </div>

      {maxRedeemablePoints > 0 && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={redeeming}
            onChange={e => setRedeeming(e.target.checked)}
            className="rounded text-amber-500"
          />
          <span className="text-xs text-amber-700">Redeem points for discount</span>
        </label>
      )}

      {redeeming && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={maxRedeemablePoints}
            step={1}
            value={pointsToRedeem}
            onChange={e => setPointsToRedeem(Math.min(Number(e.target.value), maxRedeemablePoints))}
            className="w-20 border border-amber-300 rounded px-2 py-1 text-sm text-center focus:outline-none"
          />
          <span className="text-xs text-amber-700">pts = LKR {lkrDiscount.toLocaleString()} off</span>
        </div>
      )}
    </div>
  );
}
