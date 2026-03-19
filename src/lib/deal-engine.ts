// ─── Deal Engine: Agreement Type Logic ──────────────────────────────
// Each agreement type has strict required fields, rules, lifecycle, and downstream effects.
// Supported types: arbitrage (Sales Deal) and partnership (Profit Share)
// Legacy types (lending, capital_placement, general) are preserved for old records.

import type { DealType, DealStatus, MerchantDeal } from '@/types/domain';

// ─── Deal Type Configurations ───────────────────────────────────────

export interface DealTypeConfig {
  type: DealType;
  label: string;
  description: string;
  icon: string;
  requiredFields: string[];
  optionalFields: string[];
  hasCounterpartyShare: boolean;
  hasDueDate: boolean;
  hasExpectedReturn: boolean;
  hasRepaymentLogic: boolean;
  eligibleOrderSides: ('buy' | 'sell')[];
  requiresApproval: boolean;
  settlementBehavior: 'manual' | 'auto_on_close' | 'periodic';
  lifecycleSteps: string[];
  ruleSummaryTemplate: string;
  /** Whether this type is still supported for new agreement creation */
  isLegacy: boolean;
  /** Allocation base: net_profit for Profit Share, sale_economics for Sales Deal */
  allocationBase: 'net_profit' | 'sale_economics' | 'none';
}

export const DEAL_TYPE_CONFIGS: Record<DealType, DealTypeConfig> = {
  partnership: {
    type: 'partnership',
    label: 'Profit Share',
    description: 'Net profit from linked sales is split between partner and merchant based on predefined ratios.',
    icon: '🤝',
    requiredFields: ['title', 'amount', 'metadata.partner_ratio'],
    optionalFields: ['metadata.settlement_period', 'metadata.min_profit_threshold'],
    hasCounterpartyShare: true,
    hasDueDate: false,
    hasExpectedReturn: false,
    hasRepaymentLogic: false,
    eligibleOrderSides: ['sell'],
    requiresApproval: true,
    settlementBehavior: 'periodic',
    lifecycleSteps: ['draft', 'active', 'settled', 'closed'],
    ruleSummaryTemplate: 'Net profit from linked sales is shared {partner_ratio}% to {counterparty_name} (partner) and {merchant_ratio}% to you (merchant). Distributions are calculated {settlement_period}.',
    isLegacy: false,
    allocationBase: 'net_profit',
  },
  arbitrage: {
    type: 'arbitrage',
    label: 'Sales Deal',
    description: 'Sale-linked economics split for specific sell orders. Counterparty receives a share of order economics.',
    icon: '📊',
    requiredFields: ['title', 'amount', 'metadata.counterparty_share_pct'],
    optionalFields: ['due_date', 'metadata.merchant_share_pct', 'metadata.min_order_amount'],
    hasCounterpartyShare: true,
    hasDueDate: false,
    hasExpectedReturn: false,
    hasRepaymentLogic: false,
    eligibleOrderSides: ['sell'],
    requiresApproval: true,
    settlementBehavior: 'periodic',
    lifecycleSteps: ['draft', 'active', 'settled', 'closed'],
    ruleSummaryTemplate: 'This agreement allocates {counterparty_share_pct}% of sale-linked economics to {counterparty_name} (counterparty) and {merchant_share_pct}% to you (merchant). Applies only to linked sell orders.',
    isLegacy: false,
    allocationBase: 'sale_economics',
  },
  // ── Legacy types (read-only, not available for new creation) ──
  lending: {
    type: 'lending',
    label: 'Advance (Legacy)',
    description: 'Capital advance with repayment terms. This agreement type is no longer available for new creation.',
    icon: '💰',
    requiredFields: ['title', 'amount', 'due_date'],
    optionalFields: ['expected_return', 'metadata.interest_rate', 'metadata.repayment_terms'],
    hasCounterpartyShare: false,
    hasDueDate: true,
    hasExpectedReturn: true,
    hasRepaymentLogic: true,
    eligibleOrderSides: [],
    requiresApproval: true,
    settlementBehavior: 'manual',
    lifecycleSteps: ['draft', 'active', 'due', 'overdue', 'settled', 'closed'],
    ruleSummaryTemplate: 'Legacy advance of {amount} {currency} due on {due_date}.',
    isLegacy: true,
    allocationBase: 'none',
  },
  capital_placement: {
    type: 'capital_placement',
    label: 'Capital Pool (Legacy)',
    description: 'Capital pool agreement. This agreement type is no longer available for new creation.',
    icon: '🏦',
    requiredFields: ['title', 'amount', 'metadata.pool_owner_share_pct'],
    optionalFields: ['metadata.utilization_cap', 'metadata.distribution_schedule'],
    hasCounterpartyShare: true,
    hasDueDate: false,
    hasExpectedReturn: false,
    hasRepaymentLogic: false,
    eligibleOrderSides: ['buy', 'sell'],
    requiresApproval: true,
    settlementBehavior: 'periodic',
    lifecycleSteps: ['draft', 'active', 'settled', 'closed'],
    ruleSummaryTemplate: 'Legacy capital pool of {amount} {currency} with {pool_owner_share_pct}% belonging to {counterparty_name}.',
    isLegacy: true,
    allocationBase: 'sale_economics',
  },
  general: {
    type: 'general',
    label: 'General (Legacy)',
    description: 'A flexible agreement type. No longer available for new creation.',
    icon: '📋',
    requiredFields: ['title', 'amount'],
    optionalFields: ['due_date', 'expected_return'],
    hasCounterpartyShare: false,
    hasDueDate: true,
    hasExpectedReturn: true,
    hasRepaymentLogic: false,
    eligibleOrderSides: [],
    requiresApproval: false,
    settlementBehavior: 'manual',
    lifecycleSteps: ['draft', 'active', 'settled', 'closed'],
    ruleSummaryTemplate: 'Legacy agreement of {amount} {currency}.',
    isLegacy: true,
    allocationBase: 'none',
  },
};

/** Only supported (non-legacy) types for creation flows */
export const SUPPORTED_DEAL_TYPES: DealType[] = ['partnership', 'arbitrage'];

// ─── Deal Rule Summary Generator ────────────────────────────────────

export function generateRuleSummary(
  dealType: DealType,
  params: {
    amount: number;
    currency: string;
    counterpartyName?: string;
    dueDate?: string;
    expectedReturn?: number;
    counterpartySharePct?: number;
    merchantSharePct?: number;
    partnerRatio?: number;
    poolOwnerSharePct?: number;
    settlementPeriod?: string;
  }
): string {
  const config = DEAL_TYPE_CONFIGS[dealType];
  let summary = config.ruleSummaryTemplate;

  summary = summary.replace('{amount}', params.amount.toLocaleString());
  summary = summary.replace('{currency}', params.currency);
  summary = summary.replace('{counterparty_name}', params.counterpartyName || 'the counterparty');
  summary = summary.replace('{due_date}', params.dueDate || 'N/A');
  summary = summary.replace('{expected_return}', String(params.expectedReturn || 0));

  const cpShare = params.counterpartySharePct ?? params.poolOwnerSharePct ?? params.partnerRatio ?? 0;
  const mShare = params.merchantSharePct ?? (100 - cpShare);

  summary = summary.replace('{counterparty_share_pct}', String(cpShare));
  summary = summary.replace('{merchant_share_pct}', String(mShare));
  summary = summary.replace('{partner_ratio}', String(cpShare));
  summary = summary.replace('{merchant_ratio}', String(mShare));
  summary = summary.replace('{pool_owner_share_pct}', String(cpShare));
  summary = summary.replace('{settlement_period}', params.settlementPeriod || 'monthly');

  return summary;
}

// ─── Allocation Logic ───────────────────────────────────────────────

export interface DealAllocation {
  orderId: string;
  dealId: string;
  relationshipId: string;
  counterpartyShare: number;
  merchantShare: number;
  totalAmount: number;
  currency: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'settled';
}

/**
 * Calculate allocation for a deal based on the correct base:
 * - Profit Share (partnership): allocates based on NET PROFIT (revenue - FIFO cost)
 * - Sales Deal (arbitrage): allocates based on sale-linked economics (order amount)
 * - Legacy types: use order amount as fallback
 *
 * @param netProfit - Net profit from the sale (revenue - FIFO cost). Used for Profit Share.
 */
export function calculateAllocation(
  deal: MerchantDeal,
  orderAmount: number,
  orderCurrency: string,
  netProfit?: number,
): { counterpartyAmount: number; merchantAmount: number; allocationBase: 'net_profit' | 'sale_economics' } | null {
  const config = DEAL_TYPE_CONFIGS[deal.deal_type];
  if (!config.hasCounterpartyShare) return null;

  const meta = deal.metadata || {};
  const sharePct = (meta.counterparty_share_pct ?? meta.pool_owner_share_pct ?? meta.partner_ratio ?? 0) as number;
  if (sharePct <= 0 || sharePct > 100) return null;

  // Profit Share: allocate from NET PROFIT
  if (deal.deal_type === 'partnership') {
    const base = netProfit ?? 0;
    const counterpartyAmount = (base * sharePct) / 100;
    const merchantAmount = base - counterpartyAmount;
    return { counterpartyAmount, merchantAmount, allocationBase: 'net_profit' };
  }

  // Sales Deal / Legacy: allocate from order amount (sale-linked economics)
  const counterpartyAmount = (orderAmount * sharePct) / 100;
  const merchantAmount = orderAmount - counterpartyAmount;
  return { counterpartyAmount, merchantAmount, allocationBase: 'sale_economics' };
}

// ─── Deal Status Transitions ────────────────────────────────────────

export function getAvailableTransitions(status: DealStatus, dealType: DealType): DealStatus[] {
  const transitions: Record<DealStatus, DealStatus[]> = {
    draft: ['active', 'cancelled'],
    active: ['due', 'settled', 'closed', 'cancelled'],
    due: ['overdue', 'settled', 'closed'],
    settled: ['closed'],
    closed: [],
    overdue: ['settled', 'closed', 'cancelled'],
    cancelled: [],
  };
  return transitions[status] || [];
}

// ─── Outstanding Balance Calculator ─────────────────────────────────

export function calculateOutstanding(deal: MerchantDeal): {
  principal: number;
  expectedReturn: number;
  realizedPnl: number;
  outstanding: number;
  isOverdue: boolean;
} {
  const principal = deal.amount;
  const expectedReturn = deal.expected_return || 0;
  const realizedPnl = deal.realized_pnl || 0;
  const outstanding = principal + expectedReturn - realizedPnl;
  const isOverdue = deal.due_date ? new Date(deal.due_date) < new Date() && deal.status !== 'settled' && deal.status !== 'closed' : false;

  return { principal, expectedReturn, realizedPnl, outstanding, isOverdue };
}
