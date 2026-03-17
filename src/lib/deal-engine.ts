// ─── Deal Engine: Predefined Deal Type Logic ────────────────────────
// Each deal type has strict required fields, rules, lifecycle, and downstream effects.

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
}

export const DEAL_TYPE_CONFIGS: Record<DealType, DealTypeConfig> = {
  lending: {
    type: 'lending',
    label: 'Advance',
    description: 'Capital advance with repayment terms. A principal amount is lent with expected return by a due date.',
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
    ruleSummaryTemplate: 'This advance of {amount} {currency} is due on {due_date}. Expected return: {expected_return} {currency}. Settlement requires counterparty approval.',
  },
  arbitrage: {
    type: 'arbitrage',
    label: 'Sales Deal',
    description: 'Linked to sell orders. Capital owner funds a share of trading economics. Profit is split based on participation ratio.',
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
    ruleSummaryTemplate: 'This deal allocates {counterparty_share_pct}% of eligible sell-order economics to {counterparty_name} and {merchant_share_pct}% to the merchant. Linked sell orders automatically generate allocations.',
  },
  partnership: {
    type: 'partnership',
    label: 'Profit-Share Deal',
    description: 'Partners share profits from linked order activity based on predefined ratios.',
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
    ruleSummaryTemplate: 'Profits from linked orders are shared {partner_ratio}% to {counterparty_name} and {merchant_ratio}% to the merchant. Distributions are calculated {settlement_period}.',
  },
  capital_placement: {
    type: 'capital_placement',
    label: 'Capital Pool Deal',
    description: 'Capital pool where a capital owner provides funds for the merchant to utilize in trading. Pool shares determine distribution.',
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
    ruleSummaryTemplate: 'Capital pool of {amount} {currency} with {pool_owner_share_pct}% belonging to {counterparty_name}. Utilization into deals or orders is tracked. Distributions follow pool share ratios.',
  },
  general: {
    type: 'general',
    label: 'General Deal',
    description: 'A flexible deal type for agreements that do not fit other categories.',
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
    ruleSummaryTemplate: 'General deal of {amount} {currency}.',
  },
};

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

export function calculateAllocation(
  deal: MerchantDeal,
  orderAmount: number,
  orderCurrency: string,
): { counterpartyAmount: number; merchantAmount: number } | null {
  const config = DEAL_TYPE_CONFIGS[deal.deal_type];
  if (!config.hasCounterpartyShare) return null;

  const meta = deal.metadata || {};
  const sharePct = (meta.counterparty_share_pct ?? meta.pool_owner_share_pct ?? meta.partner_ratio ?? 0) as number;
  if (sharePct <= 0 || sharePct > 100) return null;

  const counterpartyAmount = (orderAmount * sharePct) / 100;
  const merchantAmount = orderAmount - counterpartyAmount;

  return { counterpartyAmount, merchantAmount };
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
