import { useState, useRef } from 'react';
import { Sunrise } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export function StartOfDayGate({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const settingKey = `opening_balance_${today}`;

  const [balanceInput, setBalanceInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const inFlight = useRef(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function startDay() {
    if (inFlight.current) return;
    const bal = parseFloat(balanceInput);
    if (isNaN(bal) || bal < 0) { showToast('Enter a valid amount', 'error'); return; }
    inFlight.current = true;
    setSaving(true);
    try {
      const { error } = await (supabase.from('app_settings') as any)
        .upsert({ key: settingKey, value: String(bal) }, { onConflict: 'key' });
      if (error) throw error;
      showToast('Opening balance saved', 'success');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function skipToday() {
    try { localStorage.setItem(`opening_balance_skipped_${today}`, '1'); } catch { /* ignore */ }
    onDone();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,12,15,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        <div style={{ padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Sunrise size={20} style={{ color: 'var(--accent)' }} strokeWidth={1.8} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{greeting}</h2>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{dateLabel}</div>
            </div>
          </div>

          {confirmingSkip ? (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Continue without recording the opening float? You can still set it later from Day Report.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmingSkip(false)} className="btn" style={{ flex: 1, height: 40, fontSize: 13 }}>
                  Back
                </button>
                <button onClick={skipToday} className="btn" style={{ flex: 1, height: 40, fontSize: 13, color: 'var(--warn)' }}>
                  Skip
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Set today&rsquo;s opening cash float to begin.
              </div>

              <div style={{ display: 'flex', alignItems: 'center', height: 46, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
                <span style={{ padding: '0 12px', fontSize: 13, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>LKR</span>
                <input
                  type="number" min={0} step={100} autoFocus
                  value={balanceInput}
                  onChange={e => setBalanceInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startDay()}
                  placeholder="0"
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 14px', fontSize: 18, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
                />
              </div>

              <button
                onClick={startDay}
                disabled={saving || !balanceInput}
                className="btn btn-primary"
                style={{ height: 44, fontSize: 14, fontWeight: 600 }}
              >
                {saving ? 'Saving…' : 'Start Day'}
              </button>

              <button
                onClick={() => setConfirmingSkip(true)}
                style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12.5, padding: 2, alignSelf: 'center' }}
              >
                Skip for today
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
