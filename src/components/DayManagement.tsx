import { useState, useEffect, useRef } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchAllRows } from '../lib/paginate';
import { useToast } from '../contexts/ToastContext';

interface PaymentSummary { count: number; total: number; cashPortion?: number; cardPortion?: number }
interface DaySummary {
  cash: PaymentSummary;
  card: PaymentSummary;
  credit: PaymentSummary;
  mixed: PaymentSummary;
  total: PaymentSummary;
}

export function DayManagement({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const settingKey = `opening_balance_${today}`;

  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [summary, setSummary] = useState<DaySummary | null>(null);
  // Cash handed back against return credits today. Expected cash is otherwise built
  // only from sales, so without this the drawer reads short by every refund given.
  const [cashRefunds, setCashRefunds] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: setting }, sales, payouts] = await Promise.all([
        (supabase.from('app_settings') as any)
          .select('value').eq('key', settingKey).maybeSingle(),
        // Whole day's sales feed the cash-drawer totals — page past the 1000-row cap.
        fetchAllRows<any>(() => (supabase.from('sales') as any)
          .select('payment_method, total_amount, paid_amount, cash_amount, card_amount')
          .gte('sale_date', `${today}T00:00:00`)
          .lt('sale_date', new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0] + 'T00:00:00')
          .neq('status', 'refunded')
          .order('id')),
        fetchAllRows<any>(() => (supabase.from('credit_payouts') as any)
          .select('amount')
          .gte('created_at', `${today}T00:00:00`)
          .lt('created_at', new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0] + 'T00:00:00')
          .order('id')),
      ]);

      setCashRefunds({
        count: (payouts ?? []).length,
        total: (payouts ?? []).reduce((sum: number, p: any) => sum + Number(p.amount), 0),
      });

      if (setting) {
        const bal = parseFloat(setting.value);
        setOpeningBalance(bal);
        setBalanceInput(String(bal));
      }

      if (sales) {
        const s: DaySummary = {
          cash:   { count: 0, total: 0 },
          card:   { count: 0, total: 0 },
          credit: { count: 0, total: 0 },
          mixed:  { count: 0, total: 0 },
          total:  { count: 0, total: 0 },
        };
        for (const row of sales) {
          const m = (row.payment_method ?? 'cash') as keyof Omit<DaySummary, 'total'>;
          const amt = Number(row.total_amount);
          if (m in s) {
            s[m].count++;
            s[m].total += amt;
          }
          s.total.count++;
          s.total.total += amt;

          // For mixed payments, track cash/card portions for display
          if (m === 'mixed') {
            const cash = row.cash_amount != null ? Number(row.cash_amount) : 0;
            const card = row.card_amount != null ? Number(row.card_amount) : 0;
            s.mixed.cashPortion = (s.mixed.cashPortion ?? 0) + cash;
            s.mixed.cardPortion = (s.mixed.cardPortion ?? 0) + card;
          }
        }
        setSummary(s);
      }
    } catch {
      showToast('Failed to load day data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveOpeningBalance() {
    if (inFlight.current) return;
    const bal = parseFloat(balanceInput);
    if (isNaN(bal) || bal < 0) { showToast('Enter a valid amount', 'error'); return; }
    inFlight.current = true;
    setSaving(true);
    try {
      const { error } = await (supabase.from('app_settings') as any)
        .upsert({ key: settingKey, value: String(bal) }, { onConflict: 'key' });
      if (error) throw error;
      setOpeningBalance(bal);
      showToast('Opening balance saved', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const fmtLKR = (n: number) => `LKR ${Math.round(n).toLocaleString()}`;
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const mixedCash = summary?.mixed.cashPortion ?? 0;
  const mixedCard = summary?.mixed.cardPortion ?? 0;
  // Cash in minus cash out. Refunds paid from a return credit leave the drawer just
  // like change does, so they have to come off the expected figure.
  const totalCashInDrawer = (summary?.cash.total ?? 0) + mixedCash - cashRefunds.total;

  const METHODS: { key: keyof Omit<DaySummary, 'total'>; label: string; color: string; bg: string }[] = [
    { key: 'cash',   label: 'Cash',   color: 'var(--accent-ink)', bg: 'var(--accent-soft)' },
    { key: 'card',   label: 'Card',   color: '#1d4ed8',            bg: '#eff6ff' },
    { key: 'credit', label: 'Credit', color: 'var(--warn)',        bg: 'var(--warn-soft)' },
    { key: 'mixed',  label: 'Mixed',  color: 'var(--ink-2)',       bg: 'rgba(20,22,26,0.06)' },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,12,15,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} strokeWidth={1.8} />
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Day Management</h2>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{todayLabel}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Opening Balance */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Opening Balance</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
                <span style={{ padding: '0 10px', fontSize: 12, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>LKR</span>
                <input
                  type="number" min={0} step={100} autoFocus
                  value={balanceInput}
                  onChange={e => setBalanceInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveOpeningBalance()}
                  placeholder="0"
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 12px', fontSize: 15, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
                />
              </div>
              <button
                onClick={saveOpeningBalance}
                disabled={saving || !balanceInput}
                className="btn btn-primary"
                style={{ height: 38, fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {saving ? 'Saving…' : openingBalance !== null ? 'Update' : 'Set Opening'}
              </button>
            </div>
            {openingBalance !== null && (
              <div style={{ fontSize: 11.5, color: 'var(--accent)', marginTop: 6, fontWeight: 500 }}>
                ✓ {fmtLKR(openingBalance)} set as opening balance
              </div>
            )}
          </div>

          {/* Sales Summary */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Today's Sales</div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
            ) : !summary || summary.total.count === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--faint)', fontSize: 13 }}>No sales recorded today yet</div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {METHODS.filter(m => (summary[m.key]?.count ?? 0) > 0).map(({ key, label, color, bg }) => {
                  const d = summary[key];
                  const isMixed = key === 'mixed';
                  const hasMixedBreakdown = isMixed && (mixedCash > 0 || mixedCard > 0);
                  return (
                    <div key={key} style={{ borderBottom: '1px solid var(--line-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: bg, color, letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0, minWidth: 54, textAlign: 'center' }}>{label}</span>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)', marginLeft: 12 }}>{d.count} sale{d.count !== 1 ? 's' : ''}</span>
                        <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fmtLKR(d.total)}</span>
                      </div>
                      {hasMixedBreakdown && (
                        <div style={{ padding: '0 14px 10px 14px', display: 'flex', gap: 16, paddingLeft: 82 }}>
                          {mixedCash > 0 && (
                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                              Cash <span className="num" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>{fmtLKR(mixedCash)}</span>
                            </span>
                          )}
                          {mixedCard > 0 && (
                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                              Card <span className="num" style={{ color: '#1d4ed8', fontWeight: 600 }}>{fmtLKR(mixedCard)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '13px 14px', background: 'var(--panel-2)' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>Total Sales</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 14 }}>{summary.total.count} sales</span>
                  <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtLKR(summary.total.total)}</span>
                </div>
              </div>
            )}
          </div>

          {cashRefunds.total > 0 && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--panel-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Cash refunds</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {cashRefunds.count} paid out from return credits
                </div>
              </div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>
                −{fmtLKR(cashRefunds.total)}
              </div>
            </div>
          )}

          {/* Expected cash in drawer */}
          {openingBalance !== null && (totalCashInDrawer > 0 || cashRefunds.total > 0) && (
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-ink)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Expected Cash in Drawer</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-ink)', letterSpacing: '-0.02em' }}>{fmtLKR((openingBalance ?? 0) + totalCashInDrawer)}</div>
              <div style={{ fontSize: 12, color: 'var(--accent-ink)', opacity: 0.7, marginTop: 5 }}>
                Opening {fmtLKR(openingBalance ?? 0)}
                {(summary?.cash.total ?? 0) > 0 && ` + Cash ${fmtLKR(summary?.cash.total ?? 0)}`}
                {mixedCash > 0 && ` + Mixed cash ${fmtLKR(mixedCash)}`}
                {cashRefunds.total > 0 && ` − Cash refunds ${fmtLKR(cashRefunds.total)}`}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
