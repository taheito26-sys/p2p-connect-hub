// ─── Core Domain Types ───────────────────────────────────────────────
// All entities match the D1 schema and API contracts exactly.

// ─── Auth ────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  email_verified: boolean;
  mfa_enabled: boolean;
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  token: string;
  user_id: string;
  email: string;
  expires_at: string;
}

// ─── Merchant Profiles ──────────────────────────────────────────────
export type MerchantType = 'independent' | 'desk' | 'partner' | 'other';
export type Discoverability = 'public' | 'merchant_id_only' | 'hidden';
export type MerchantStatus = 'active' | 'restricted' | 'suspended' | 'archived';

export interface MerchantProfile {
  id: string;
  owner_user_id: string;
  merchant_id: string; // MRC-XXXXXXXX or 5-digit
  nickname: string;
  display_name: string;
  merchant_type: MerchantType;
  region: string;
  default_currency: string;
  discoverability: Discoverability;
  bio: string | null;
  status: MerchantStatus;
  created_at: string;
  updated_at: string;
}

export interface MerchantSearchResult {
  id: string;
  merchant_id: string;
  nickname: string;
  display_name: string;
  merchant_type: string;
  region: string;
}

// ─── Invites ────────────────────────────────────────────────────────
export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

export interface MerchantInvite {
  id: string;
  from_merchant_id: string;
  to_merchant_id: string;
  status: InviteStatus;
  purpose: string;
  requested_role: string;
  message: string;
  requested_scope: string[];
  expires_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  from_display_name?: string;
  from_nickname?: string;
  from_public_id?: string;
  to_display_name?: string;
  to_nickname?: string;
  to_public_id?: string;
}

// ─── Relationships ──────────────────────────────────────────────────
export type RelationshipType = 'general' | 'lending' | 'arbitrage' | 'capital' | 'strategic';
export type RelationshipStatus = 'active' | 'restricted' | 'suspended' | 'terminated' | 'archived';

export interface ApprovalPolicy {
  settlement_submit?: string;
  profit_record_submit?: string;
  deal_close?: string;
  capital_changes?: boolean;
  closures?: boolean;
}

export interface MerchantRelationship {
  id: string;
  merchant_a_id: string;
  merchant_b_id: string;
  invite_id: string;
  relationship_type: RelationshipType;
  status: RelationshipStatus;
  shared_fields: string[];
  approval_policy: ApprovalPolicy;
  created_at: string;
  updated_at: string;
  // Enriched
  my_role?: string;
  counterparty?: Partial<MerchantProfile>;
  summary?: RelationshipSummary;
}

export interface RelationshipSummary {
  totalDeals: number;
  activeExposure: number;
  realizedProfit: number;
  pendingApprovals: number;
}

// ─── Deals ──────────────────────────────────────────────────────────
export type DealType = 'lending' | 'arbitrage' | 'partnership' | 'capital_placement' | 'general';
export type DealStatus = 'draft' | 'active' | 'due' | 'settled' | 'closed' | 'overdue' | 'cancelled';

export interface MerchantDeal {
  id: string;
  relationship_id: string;
  deal_type: DealType;
  title: string;
  amount: number;
  currency: string;
  status: DealStatus;
  metadata: Record<string, unknown>;
  issue_date: string;
  due_date: string | null;
  close_date: string | null;
  expected_return: number | null;
  realized_pnl: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Approvals ──────────────────────────────────────────────────────
export type ApprovalType =
  | 'settlement_submit'
  | 'profit_record_submit'
  | 'capital_adjustment'
  | 'deal_close'
  | 'relationship_suspend'
  | 'relationship_terminate'
  | 'permissions_change';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface MerchantApproval {
  id: string;
  relationship_id: string;
  type: ApprovalType;
  target_entity_type: string;
  target_entity_id: string;
  proposed_payload: Record<string, unknown>;
  status: ApprovalStatus;
  submitted_by_user_id: string;
  submitted_by_merchant_id: string;
  reviewer_user_id: string;
  resolution_note: string | null;
  submitted_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Messages ───────────────────────────────────────────────────────
export type MessageType = 'text' | 'system' | 'request-note';

export interface MerchantMessage {
  id: string;
  relationship_id: string;
  sender_user_id: string;
  sender_merchant_id: string;
  body: string;
  message_type: MessageType;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

// ─── Notifications ──────────────────────────────────────────────────
export interface MerchantNotification {
  id: string;
  user_id: string;
  relationship_id: string | null;
  category: string;
  title: string;
  body: string;
  data_json: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// ─── Audit ──────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  relationship_id: string | null;
  actor_user_id: string;
  actor_merchant_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  detail_json: Record<string, unknown>;
  created_at: string;
}

// ─── Settlements ────────────────────────────────────────────────────
export interface MerchantSettlement {
  id: string;
  relationship_id: string;
  deal_id: string;
  submitted_by_user_id: string;
  amount: number;
  currency: string;
  note: string;
  status: string;
  submitted_at: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Profit Records ─────────────────────────────────────────────────
export interface ProfitRecord {
  id: string;
  relationship_id: string;
  deal_id: string;
  period_key: string;
  amount: number;
  currency: string;
  note: string;
  status: string;
  submitted_by_user_id: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Trading / Portfolio ────────────────────────────────────────────
export interface Batch {
  id: string;
  user_id: string;
  asset_symbol: string;
  acquired_at: string;
  quantity: number;
  unit_cost: number;
  notes: string;
  allocated_qty?: number;
  remaining_qty?: number;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  asset_symbol: string;
  side: 'buy' | 'sell';
  traded_at: string;
  quantity: number;
  unit_price: number;
  fee: number;
  status: 'active' | 'void';
  source_batch_id: string | null;
  notes: string;
  allocated_qty?: number;
  allocated_cost?: number;
  created_at: string;
  updated_at: string;
}

// ─── P2P Price Tracking ─────────────────────────────────────────────
export interface P2POffer {
  price: number;
  min: number;
  max: number;
  nick: string;
  methods: string[];
  available: number;
}

export interface P2PSnapshot {
  ts: number;
  sellAvg: number | null;
  buyAvg: number | null;
  bestSell: number | null;
  bestBuy: number | null;
  sellDepth: number;
  buyDepth: number;
  spread: number | null;
  spreadPct: number | null;
  sellOffers: P2POffer[];
  buyOffers: P2POffer[];
}

export interface P2PHistoryPoint {
  ts: number;
  sellAvg: number | null;
  buyAvg: number | null;
  spread: number | null;
  spreadPct: number | null;
}

// ─── Financials ─────────────────────────────────────────────────────
export interface FinancialDeal {
  id: string;
  user_id: string;
  deal_type: 'advance' | 'purchase' | 'profit_share' | 'pool' | 'general';
  title: string;
  principal_amount: number;
  currency: string;
  status: 'active' | 'due' | 'overdue' | 'settled' | 'cancelled';
  issued_at: string;
  due_at: string | null;
  settled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_type: string;
  ref_type: string;
  ref_id: string;
  amount: number;
  currency: string;
  debit_account: string;
  credit_account: string;
  note: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

// ─── User Preferences ───────────────────────────────────────────────
export interface UserPreferences {
  id: string;
  user_id: string;
  theme: 'dark' | 'light' | 'system';
  default_currency: string;
  notifications_enabled: boolean;
  last_page: string | null;
  data_json: Record<string, unknown>;
  updated_at: string;
}
