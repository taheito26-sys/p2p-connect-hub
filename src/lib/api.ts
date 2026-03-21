// ─── Cloudflare Workers API Client ──────────────────────────────────
// All business state lives on the server. No localStorage for business data.

import type {
  MerchantProfile,
  MerchantSearchResult,
  MerchantInvite,
  MerchantRelationship,
  MerchantDeal,
  MerchantApproval,
  MerchantMessage,
  MerchantNotification,
  AuditLog,
  Batch,
  Trade,
  P2PSnapshot,
  P2PHistoryPoint,
  FinancialDeal,
  UserPreferences,
} from '@/types/domain';

export interface PortfolioAnalytics {
  totalDeployed: number;
  activeDeployed: number;
  returnedCapital: number;
  realizedProfit: number;
  unsettledExposure: number;
  overdueDeals: number;
  activeRelationships: number;
  pendingApprovals: number;
  capitalByCounterparty: { name: string; deployed: number; returned: number; profit: number; roi: number }[];
  dealsByType: Record<string, number>;
  riskIndicators: { type: string; severity: 'high' | 'medium' | 'low'; message: string }[];
}

// ─── Configuration ──────────────────────────────────────────────────
const DEFAULT_REMOTE_API_BASE = 'https://tracker-platform.taheito26.workers.dev';
// Use empty string in dev (proxy via Vite) to avoid CORS; direct URL in production
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
type CompatCredentials = { userId: string; email: string } | null;
let compatCredentials: CompatCredentials = null;

export function setCompatCredentials(creds: CompatCredentials) {
  compatCredentials = creds;
}

async function fetchJson<T>(url: string, options: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (compatCredentials) {
    headers['X-User-Id'] = compatCredentials.userId;
    headers['X-User-Email'] = compatCredentials.email;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText, body);
  }

  return res.json() as Promise<T>;
}

// ─── HTTP Transport ─────────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  return fetchJson<T>(url, options);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ─── Merchant Profile API ───────────────────────────────────────────
export const merchant = {
  getMyProfile: () =>
    request<{ profile: MerchantProfile | null }>('/api/merchant/profile/me'),

  ensureProfile: (data: {
    nickname: string;
    display_name: string;
    merchant_type?: string;
    region?: string;
    default_currency?: string;
    discoverability?: string;
    bio?: string;
  }) =>
    request<{ profile: MerchantProfile }>('/api/merchant/profile/ensure', {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateProfile: (data: Partial<MerchantProfile>) =>
    request<{ profile: MerchantProfile }>('/api/merchant/profile/me', {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  getProfile: (merchantId: string) =>
    request<{ profile: MerchantProfile }>(`/api/merchant/profile/${encodeURIComponent(merchantId)}`),

  search: (q: string) =>
    request<{ results: MerchantSearchResult[] }>(`/api/merchant/search?q=${encodeURIComponent(q)}`),

  checkNickname: (nickname: string) =>
    request<{ nickname: string; available: boolean }>(`/api/merchant/check-nickname?nickname=${encodeURIComponent(nickname)}`),
};

// ─── Invites API ────────────────────────────────────────────────────
export const invites = {
  send: (data: {
    to_merchant_id: string;
    purpose?: string;
    requested_role?: string;
    message?: string;
    requested_scope?: string[];
  }) =>
    request<{ ok: boolean; invite: MerchantInvite }>('/api/merchant/invites', {
      method: 'POST', body: JSON.stringify(data),
    }),

  inbox: () =>
    request<{ invites: MerchantInvite[] }>('/api/merchant/invites/inbox'),

  sent: () =>
    request<{ invites: MerchantInvite[] }>('/api/merchant/invites/sent'),

  accept: (id: string) =>
    request<{ ok: boolean; relationship_id: string }>(`/api/merchant/invites/${id}/accept`, { method: 'POST' }),

  reject: (id: string) =>
    request<{ ok: boolean }>(`/api/merchant/invites/${id}/reject`, { method: 'POST' }),

  withdraw: (id: string) =>
    request<{ ok: boolean }>(`/api/merchant/invites/${id}/withdraw`, { method: 'POST' }),
};

// ─── Relationships API ──────────────────────────────────────────────
export const relationships = {
  list: () =>
    request<{ relationships: MerchantRelationship[] }>('/api/merchant/relationships'),

  get: (id: string) =>
    request<{ relationship: MerchantRelationship }>(`/api/merchant/relationships/${id}`),

  updateSettings: (id: string, data: Partial<MerchantRelationship>) =>
    request<{ ok: boolean; relationship: MerchantRelationship }>(`/api/merchant/relationships/${id}/settings`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  suspend: (id: string) =>
    request<{ ok: boolean; approval_id: string }>(`/api/merchant/relationships/${id}/suspend`, { method: 'POST' }),

  terminate: (id: string) =>
    request<{ ok: boolean; approval_id: string }>(`/api/merchant/relationships/${id}/terminate`, { method: 'POST' }),
};

// ─── Deals API ──────────────────────────────────────────────────────
export const deals = {
  list: (relationshipId?: string) =>
    request<{ deals: MerchantDeal[] }>(
      relationshipId
        ? `/api/merchant/deals?relationship_id=${relationshipId}`
        : '/api/merchant/deals'
    ),

  create: (data: Partial<MerchantDeal> & { relationship_id: string }) =>
    request<{ ok: boolean; deal: MerchantDeal }>('/api/merchant/deals', {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<MerchantDeal>) =>
    request<{ ok: boolean; deal: MerchantDeal }>(`/api/merchant/deals/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  submitSettlement: (dealId: string, data: { amount: number; currency?: string; note?: string }) =>
    request<{ ok: boolean; settlement_id: string; approval_id: string }>(`/api/merchant/deals/${dealId}/submit-settlement`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  recordProfit: (dealId: string, data: { amount: number; period_key?: string; currency?: string; note?: string }) =>
    request<{ ok: boolean; profit_id: string; approval_id: string }>(`/api/merchant/deals/${dealId}/record-profit`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  close: (dealId: string, data?: { close_date?: string; note?: string }) =>
    request<{ ok: boolean; approval_id: string }>(`/api/merchant/deals/${dealId}/close`, {
      method: 'POST', body: JSON.stringify(data || {}),
    }),
};

// ─── Messages API ───────────────────────────────────────────────────
export const messages = {
  list: (relationshipId: string) =>
    request<{ messages: MerchantMessage[] }>(`/api/merchant/messages/${relationshipId}/messages`),

  send: (relationshipId: string, body: string, messageType?: string) =>
    request<{ ok: boolean; message: MerchantMessage }>(`/api/merchant/messages/${relationshipId}/messages`, {
      method: 'POST', body: JSON.stringify({ body, message_type: messageType || 'text' }),
    }),

  markRead: (messageId: string) =>
    request<{ ok: boolean }>(`/api/merchant/messages/mark-read/${messageId}`, { method: 'POST' }),
};

// ─── Approvals API ──────────────────────────────────────────────────
export const approvals = {
  inbox: () =>
    request<{ approvals: MerchantApproval[] }>('/api/merchant/approvals/inbox'),

  sent: () =>
    request<{ approvals: MerchantApproval[] }>('/api/merchant/approvals/sent'),

  approve: (id: string, note?: string) =>
    request<{ ok: boolean }>(`/api/merchant/approvals/${id}/approve`, {
      method: 'POST', body: JSON.stringify({ note }),
    }),

  reject: (id: string, note?: string) =>
    request<{ ok: boolean }>(`/api/merchant/approvals/${id}/reject`, {
      method: 'POST', body: JSON.stringify({ note }),
    }),
};

// ─── Audit API ──────────────────────────────────────────────────────
export const audit = {
  relationship: (relationshipId: string) =>
    request<{ logs: AuditLog[] }>(`/api/merchant/audit/relationship/${relationshipId}`),

  activity: () =>
    request<{ logs: AuditLog[] }>('/api/merchant/audit/activity'),
};

// ─── Notifications API ──────────────────────────────────────────────
export const notifications = {
  list: (limit = 50, unread = false) =>
    request<{ notifications: MerchantNotification[] }>(
      `/api/merchant/notifications?limit=${limit}${unread ? '&unread=true' : ''}`
    ),

  count: () =>
    request<{ unread: number }>('/api/merchant/notifications/count'),

  markRead: (id: string) =>
    request<{ ok: boolean }>(`/api/merchant/notifications/${id}/read`, { method: 'POST' }),

  markAllRead: () =>
    request<{ ok: boolean }>('/api/merchant/notifications/read-all', { method: 'POST' }),
};

// ─── Trading API ────────────────────────────────────────────────────
export const trading = {
  getBatches: (assetSymbol?: string) =>
    request<{ batches: Batch[] }>(
      assetSymbol ? `/api/batches?asset_symbol=${assetSymbol}` : '/api/batches'
    ),

  createBatch: (data: Omit<Batch, 'id' | 'user_id' | 'created_at' | 'updated_at'>) =>
    request<{ ok: boolean; batch: Batch }>('/api/batches', {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateBatch: (id: string, data: Partial<Batch>) =>
    request<{ ok: boolean; batch: Batch }>(`/api/batches/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteBatch: (id: string) =>
    request<{ ok: boolean; deleted: string }>(`/api/batches/${id}`, { method: 'DELETE' }),

  getTrades: () =>
    request<{ trades: Trade[] }>('/api/trades'),

  createTrade: (data: Omit<Trade, 'id' | 'user_id' | 'created_at' | 'updated_at'>) =>
    request<{ ok: boolean; trade: Trade }>('/api/trades', {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateTrade: (id: string, data: Partial<Trade>) =>
    request<{ ok: boolean; trade: Trade }>(`/api/trades/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  voidTrade: (id: string) =>
    request<{ ok: boolean }>(`/api/trades/${id}/void`, { method: 'PATCH' }),

  deleteTrade: (id: string) =>
    request<{ ok: boolean; deleted: string }>(`/api/trades/${id}`, { method: 'DELETE' }),
};

// ─── P2P Tracker API ────────────────────────────────────────────────
export const p2p = {
  status: () =>
    request<{ ok: boolean; lastUpdate: string }>('/api/status'),

  latest: (market?: string) =>
    request<P2PSnapshot>(market && market !== 'qatar' ? `/api/latest?market=${market}` : '/api/latest'),

  history: (market?: string) =>
    request<P2PHistoryPoint[]>(market && market !== 'qatar' ? `/api/history?market=${market}` : '/api/history'),
};

// ─── Financials API ─────────────────────────────────────────────────
export const financials = {
  listDeals: (params?: { status?: string; deal_type?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.deal_type) search.set('deal_type', params.deal_type);
    const qs = search.toString();
    return request<{ deals: FinancialDeal[] }>(`/api/deals${qs ? `?${qs}` : ''}`);
  },

  createDeal: (data: Partial<FinancialDeal>) =>
    request<{ ok: boolean; deal: FinancialDeal }>('/api/deals', {
      method: 'POST', body: JSON.stringify(data),
    }),

  getDeal: (id: string) =>
    request<{ deal: FinancialDeal }>(`/api/deals/${id}`),

  updateDeal: (id: string, data: Partial<FinancialDeal>) =>
    request<{ ok: boolean; deal: FinancialDeal }>(`/api/deals/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  settleDeal: (id: string, data?: { amount?: number; currency?: string; settled_at?: string }) =>
    request<{ ok: boolean }>(`/api/deals/${id}/settle`, {
      method: 'PATCH', body: JSON.stringify(data || {}),
    }),
};

// ─── Preferences API ───────────────────────────────────────────────
export const preferences = {
  get: () =>
    request<{ preferences: UserPreferences }>('/api/preferences'),

  update: (data: Partial<UserPreferences>) =>
    request<{ ok: boolean; preferences: UserPreferences }>('/api/preferences', {
      method: 'PATCH', body: JSON.stringify(data),
    }),
};

// ─── Analytics API ──────────────────────────────────────────────────
export const analytics = {
  get: () =>
    request<PortfolioAnalytics>('/api/analytics'),
};

// ─── Import API ─────────────────────────────────────────────────────
export const importApi = {
  json: (data: { idempotency_key: string; batches?: unknown[]; trades?: unknown[] }) =>
    request<{ ok: boolean; reused: boolean; import_job: unknown }>('/api/import/json', {
      method: 'POST', body: JSON.stringify(data),
    }),
};

// ─── Polling fallback for real-time ─────────────────────────────────
export const poll = {
  changes: (since: string) =>
    request<{ invites: MerchantInvite[]; messages: MerchantMessage[] }>(
      `/api/merchant/poll?since=${encodeURIComponent(since)}`
    ),
};
