import type { MerchantProfile } from '@/types/domain';

let _demoMode: boolean | null = null;
const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

export async function isDemoMode(): Promise<boolean> {
  if (_demoMode !== null) return _demoMode;
  if (!DEMO_MODE_ENABLED) {
    _demoMode = false;
    return _demoMode;
  }

  try {
    const res = await fetch('/api/auth/session', { method: 'GET', credentials: 'include' });
    const ct = res.headers.get('content-type') || '';

    if (res.status === 401 && ct.includes('application/json')) {
      _demoMode = false;
    } else {
      _demoMode = !res.ok || ct.includes('text/html');
    }
  } catch {
    _demoMode = DEMO_MODE_ENABLED;
  }
  return _demoMode;
}

export function getDemoMode(): boolean {
  return _demoMode ?? DEMO_MODE_ENABLED;
}

export const DEMO_USER = {
  user_id: 'demo-user-001',
  email: 'demo@tracker.local',
  token: 'demo-token',
};

export const DEMO_PROFILE: MerchantProfile = {
  id: 'demo-merchant-001',
  owner_user_id: DEMO_USER.user_id,
  merchant_id: 'MRC-00000001',
  nickname: 'demo_trader',
  display_name: 'Demo Trader',
  merchant_type: 'independent',
  region: 'MENA',
  default_currency: 'USDT',
  discoverability: 'public',
  bio: 'Demo account for exploring the platform',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
