// ─── Deal Agreement Templates ───────────────────────────────────────
// Predefined agreement configurations that traders can quick-apply
// when linking a sale to a merchant deal. Eliminates manual setup.

import type { DealType } from '@/types/domain';
import { DEAL_TYPE_CONFIGS } from '@/lib/deal-engine';

export interface DealTemplate {
  id: string;
  label: { en: string; ar: string };
  description: { en: string; ar: string };
  dealType: DealType;
  icon: string;
  /** Predefined metadata values auto-applied on deal creation */
  defaults: {
    counterparty_share_pct?: number;
    merchant_share_pct?: number;
    partner_ratio?: number;
    merchant_ratio?: number;
    pool_owner_share_pct?: number;
    settlement_period?: string;
    interest_rate?: number;
  };
  /** Whether this template requires a due date */
  requiresDueDate: boolean;
  /** Color accent for the template card */
  accent: 'brand' | 'good' | 'bad' | 'warn';
  /** Short ratio display like "40/60" */
  ratioDisplay: string;
  /** Tags for quick filtering */
  tags: string[];
}

export const DEAL_TEMPLATES: DealTemplate[] = [
  // ── Profit-Share Templates ──
  {
    id: 'profit_share_40_60',
    label: { en: 'Profit Share 40/60', ar: 'مشاركة أرباح 40/60' },
    description: { en: 'Partner gets 40%, you keep 60% of profits from linked orders.', ar: 'الشريك يحصل على 40%، وتحتفظ أنت بـ 60% من أرباح الطلبات المرتبطة.' },
    dealType: 'partnership',
    icon: '🤝',
    defaults: { partner_ratio: 40, merchant_ratio: 60, settlement_period: 'monthly' },
    requiresDueDate: false,
    accent: 'brand',
    ratioDisplay: '40/60',
    tags: ['profit-share', 'popular'],
  },
  {
    id: 'profit_share_50_50',
    label: { en: 'Profit Share 50/50', ar: 'مشاركة أرباح 50/50' },
    description: { en: 'Equal profit split — partner and you each get 50%.', ar: 'تقسيم أرباح متساوي — الشريك وأنت كل منكما يحصل على 50%.' },
    dealType: 'partnership',
    icon: '🤝',
    defaults: { partner_ratio: 50, merchant_ratio: 50, settlement_period: 'monthly' },
    requiresDueDate: false,
    accent: 'brand',
    ratioDisplay: '50/50',
    tags: ['profit-share'],
  },
  {
    id: 'profit_share_30_70',
    label: { en: 'Profit Share 30/70', ar: 'مشاركة أرباح 30/70' },
    description: { en: 'Partner gets 30%, you keep 70%. Lower partner exposure.', ar: 'الشريك يحصل على 30%، وتحتفظ أنت بـ 70%. تعرض أقل للشريك.' },
    dealType: 'partnership',
    icon: '🤝',
    defaults: { partner_ratio: 30, merchant_ratio: 70, settlement_period: 'monthly' },
    requiresDueDate: false,
    accent: 'good',
    ratioDisplay: '30/70',
    tags: ['profit-share'],
  },

  // ── Sales Deal Templates ──
  {
    id: 'sales_deal_60_40',
    label: { en: 'Sales Deal 60/40', ar: 'صفقة بيع 60/40' },
    description: { en: 'Capital owner takes 60% of sell-order economics, you keep 40%.', ar: 'مالك رأس المال يأخذ 60% من اقتصاديات أوامر البيع، وتحتفظ بـ 40%.' },
    dealType: 'arbitrage',
    icon: '📊',
    defaults: { counterparty_share_pct: 60, merchant_share_pct: 40, settlement_period: 'per_order' },
    requiresDueDate: false,
    accent: 'brand',
    ratioDisplay: '60/40',
    tags: ['sales', 'popular'],
  },
  {
    id: 'sales_deal_50_50',
    label: { en: 'Sales Deal 50/50', ar: 'صفقة بيع 50/50' },
    description: { en: 'Equal split — capital owner and merchant each get 50%.', ar: 'تقسيم متساوي — مالك رأس المال والتاجر كل منهما يحصل على 50%.' },
    dealType: 'arbitrage',
    icon: '📊',
    defaults: { counterparty_share_pct: 50, merchant_share_pct: 50, settlement_period: 'per_order' },
    requiresDueDate: false,
    accent: 'brand',
    ratioDisplay: '50/50',
    tags: ['sales'],
  },

  // ── Capital Pool Templates ──
  {
    id: 'capital_pool_60_40',
    label: { en: 'Capital Pool 60/40', ar: 'مجمع رأس مال 60/40' },
    description: { en: 'Pool owner holds 60% share, merchant operates with 40%.', ar: 'مالك المجمع يمتلك حصة 60%، والتاجر يعمل بـ 40%.' },
    dealType: 'capital_placement',
    icon: '🏦',
    defaults: { pool_owner_share_pct: 60, settlement_period: 'monthly' },
    requiresDueDate: false,
    accent: 'warn',
    ratioDisplay: '60/40',
    tags: ['capital'],
  },

  // ── Advance Template ──
  {
    id: 'advance_standard',
    label: { en: 'Standard Advance', ar: 'سلفة قياسية' },
    description: { en: 'Capital advance with repayment. Set amount, due date, and expected return.', ar: 'سلفة رأسمالية مع سداد. حدد المبلغ وتاريخ الاستحقاق والعائد المتوقع.' },
    dealType: 'lending',
    icon: '💰',
    defaults: { settlement_period: 'manual' },
    requiresDueDate: true,
    accent: 'bad',
    ratioDisplay: '—',
    tags: ['advance', 'lending'],
  },
];

/** Get a template by its ID */
export function getTemplate(templateId: string): DealTemplate | undefined {
  return DEAL_TEMPLATES.find(t => t.id === templateId);
}

/** Get the ratio display string for a template, e.g. "Partner 40% / You 60%" */
export function getTemplateRatioLabel(template: DealTemplate, lang: 'en' | 'ar'): string {
  const d = template.defaults;
  const partnerPct = d.counterparty_share_pct ?? d.partner_ratio ?? d.pool_owner_share_pct;
  if (partnerPct == null) return '';
  const yourPct = 100 - partnerPct;
  if (lang === 'ar') {
    return `الشريك ${partnerPct}% / أنت ${yourPct}%`;
  }
  return `Partner ${partnerPct}% / You ${yourPct}%`;
}

/** Build the metadata object from a template's defaults */
export function buildTemplateMetadata(template: DealTemplate): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const d = template.defaults;

  if (template.dealType === 'arbitrage') {
    if (d.counterparty_share_pct != null) meta.counterparty_share_pct = d.counterparty_share_pct;
    if (d.merchant_share_pct != null) meta.merchant_share_pct = d.merchant_share_pct;
  } else if (template.dealType === 'partnership') {
    if (d.partner_ratio != null) meta.partner_ratio = d.partner_ratio;
    if (d.merchant_ratio != null) meta.merchant_ratio = d.merchant_ratio;
  } else if (template.dealType === 'capital_placement') {
    if (d.pool_owner_share_pct != null) meta.pool_owner_share_pct = d.pool_owner_share_pct;
  }

  if (d.settlement_period) meta.settlement_period = d.settlement_period;
  if (d.interest_rate) meta.interest_rate = d.interest_rate;

  return meta;
}

/** Generate auto-title from a template + customer name */
export function generateTemplateTitle(template: DealTemplate, customerName: string, lang: 'en' | 'ar'): string {
  const cfg = DEAL_TYPE_CONFIGS[template.dealType];
  const typeLabel = lang === 'ar'
    ? (template.label.ar.split(' ').slice(0, -1).join(' ') || cfg.label)
    : cfg.label;
  return `${typeLabel} · ${customerName} · ${template.ratioDisplay}`;
}
