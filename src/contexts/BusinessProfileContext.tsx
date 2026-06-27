import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface BusinessProfile {
  name: string;
  tagline: string;
  phone: string;
  address: string;
}

// Per-app default — change `name` per app when replicating.
const DEFAULT_BUSINESS: BusinessProfile = {
  name: 'RIVONLAK',
  tagline: 'Fashion Retail',
  phone: '',
  address: '',
};

interface BusinessProfileContextType {
  profile: BusinessProfile;
  setProfile: (p: BusinessProfile) => void;
}

const BusinessProfileContext = createContext<BusinessProfileContextType>({
  profile: DEFAULT_BUSINESS,
  setProfile: () => {},
});

export function BusinessProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase.from('app_settings') as any)
          .select('value').eq('key', 'business_profile').maybeSingle();
        if (data?.value) {
          const stored = JSON.parse(data.value);
          setProfile({
            name: stored.name || DEFAULT_BUSINESS.name,        // blank name falls back
            tagline: stored.tagline ?? DEFAULT_BUSINESS.tagline, // present-but-empty stays empty
            phone: stored.phone ?? DEFAULT_BUSINESS.phone,
            address: stored.address ?? DEFAULT_BUSINESS.address,
          });
        }
      } catch {
        // keep default — business identity is never blank
      }
    })();
  }, []);

  return (
    <BusinessProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </BusinessProfileContext.Provider>
  );
}

export const useBusinessProfile = () => useContext(BusinessProfileContext);
