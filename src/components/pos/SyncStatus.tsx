import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useState, useEffect } from 'react';

const pill: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '5px 12px', borderRadius: 999,
  fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
};

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pendingSalesCount = useLiveQuery(() => db.offline_sales.where('status').equals('pending').count());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div style={{ ...pill, background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', color: 'var(--danger)' }}>
        <CloudOff size={14} strokeWidth={1.8} />
        <span>Offline</span>
        {pendingSalesCount && pendingSalesCount > 0 ? (
          <span style={{ background: 'var(--danger)', color: '#fff', padding: '1px 7px', borderRadius: 999, fontSize: 11 }}>
            {pendingSalesCount} pending
          </span>
        ) : null}
      </div>
    );
  }

  if (pendingSalesCount && pendingSalesCount > 0) {
    return (
      <div style={{ ...pill, background: 'color-mix(in srgb, var(--warn) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 25%, transparent)', color: 'var(--warn)' }}>
        <RefreshCw size={14} strokeWidth={1.8} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Syncing {pendingSalesCount}…</span>
      </div>
    );
  }

  return (
    <div style={{ ...pill, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent-ink)' }}>
      <Cloud size={14} strokeWidth={1.8} />
      <span>Synced</span>
    </div>
  );
}
