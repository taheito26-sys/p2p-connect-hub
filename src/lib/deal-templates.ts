// ─── Agreement Templates ────────────────────────────────────────────
// Predefined agreement configurations that traders can quick-apply
// when linking a sale to a partner agreement.
//
// Supported families:
//   - Profit Share (partnership) — splits net profit from linked sales
//   - Sales Deal (arbitrage)    — splits sale-linked economics per order

import type { SupportedDealType } from '@/types/domain';

export interface AgreementTemplate {
  id: string;
  label: { en: string; ar: string };
  description: { en: string; ar: string };
  /** Helper text shown below the template card */
  helperText: { en: string; ar: string };
  dealType: SupportedDealType;
  /** Agreement family for display */
  family: 'profit_share' | 'sales_deal';
  icon: string;
  /** Predefined metadata values auto-applied on agreement creation */
  defaults: {
    counterparty_share_pct?: number;
    merchant_share_pct?: number;
    partner_ratio?: number;
    merchant_ratio?: number;
    settlement_period?: string;
  };
  /** Color accent for the template card */
  accent: 'brand' | 'good';
  /** Short ratio display like "40/60" */
  ratioDisplay: string;
  /** Tags for quick filtering */
  tags: string[];
}

export const AGREEMENT_TEMPLATES: AgreementTemplate[] = [
  // ── Profit Share ──
  {
    id: 'profit_share_40_60',
    label: { en: 'Profit Share 40/60', ar: 'مشاركة أرباح 40/60' },
    description: {
      en: 'Partner gets 40% of net profit, you keep 60%.',
      ar: 'الشريك يحصل على 40% من صافي الربح، وتحتفظ أنت بـ 60%.',
    },
    helperText: {
      en: 'Use when this partner shares net profit from linked sales.',
      ar: 'استخدم عندما يتشارك هذا الشريك صافي الربح من المبيعات المرتبطة.',
    },
    dealType: 'partnership',
    family: 'profit_share',
    icon: '🤝',
    defaults: { partner_ratio: 40, merchant_ratio: 60, settlement_period: 'monthly' },
    accent: 'brand',
    ratioDisplay: '40/60',
    tags: ['profit-share', 'popular'],
  },
  {
    id: 'profit_share_50_50',
    label: { en: 'Profit Share 50/50', ar: 'مشاركة أرباح 50/50' },
    description: {
      en: 'Equal net profit split — partner and you each get 50%.',
      ar: 'تقسيم صافي أرباح متساوي — الشريك وأنت كل منكما يحصل على 50%.',
    },
    helperText: {
      en: 'Use when this partner shares net profit from linked sales.',
      ar: 'استخدم عندما يتشارك هذا الشريك صافي الربح من المبيعات المرتبطة.',
    },
    dealType: 'partnership',
    family: 'profit_share',
    icon: '🤝',
    defaults: { partner_ratio: 50, merchant_ratio: 50, settlement_period: 'monthly' },
    accent: 'brand',
    ratioDisplay: '50/50',
    tags: ['profit-share'],
  },

  // ── Sales Deal ──
  {
    id: 'sales_deal_60_40',
    label: { en: 'Sales Deal 60/40', ar: 'صفقة بيع 60/40' },
    description: {
      en: 'Counterparty takes 60% of sale-linked economics, you keep 40%. Applies only to linked sell orders.',
      ar: 'الطرف المقابل يأخذ 60% من اقتصاديات البيع، وتحتفظ بـ 40%. ينطبق فقط على أوامر البيع المرتبطة.',
    },
    helperText: {
      en: 'Use when this partner participates only in selected sale orders.',
      ar: 'استخدم عندما يشارك هذا الشريك فقط في أوامر بيع محددة.',
    },
    dealType: 'arbitrage',
    family: 'sales_deal',
    icon: '📊',
    defaults: { counterparty_share_pct: 60, merchant_share_pct: 40, settlement_period: 'per_order' },
    accent: 'brand',
    ratioDisplay: '60/40',
    tags: ['sales', 'popular'],
  },
  {
    id: 'sales_deal_50_50',
    label: { en: 'Sales Deal 50/50', ar: 'صفقة بيع 50/50' },
    description: {
      en: 'Equal split — counterparty and merchant each get 50% of sale-linked economics. Applies only to linked sell orders.',
      ar: 'تقسيم متساوي — الطرف المقابل والتاجر كل منهما يحصل على 50% من اقتصاديات البيع. ينطبق فقط على أوامر البيع المرتبطة.',
    },
    helperText: {
      en: 'Use when this partner participates only in selected sale orders.',
      ar: 'استخدم عندما يشارك هذا الشريك فقط في أوامر بيع محددة.',
    },
    dealType: 'arbitrage',
    family: 'sales_deal',
    icon: '📊',
    defaults: { counterparty_share_pct: 50, merchant_share_pct: 50, settlement_period: 'per_order' },
    accent: 'good',
    ratioDisplay: '50/50',
    tags: ['sales'],
  },
];

/** Get a template by its ID */
export function getTemplate(templateId: string): AgreementTemplate | undefined {
  return AGREEMENT_TEMPLATES.find(t => t.id === templateId);
}

/** Get the ratio display string for a template, e.g. "Partner 40% / You 60%" */
export function getTemplateRatioLabel(template: AgreementTemplate, lang: 'en' | 'ar'): string {
  const d = template.defaults;
  const partnerPct = d.counterparty_share_pct ?? d.partner_ratio;
  if (partnerPct == null) return '';
  const yourPct = 100 - partnerPct;
  if (lang === 'ar') {
    return `الشريك ${partnerPct}% / أنت ${yourPct}%`;
  }
  if (template.family === 'sales_deal') {
    return `Counterparty ${partnerPct}% / You ${yourPct}%`;
  }
  return `Partner ${partnerPct}% / You ${yourPct}%`;
}

/** Build the metadata object from a template's defaults */
export function buildTemplateMetadata(template: AgreementTemplate): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const d = template.defaults;

  if (template.dealType === 'arbitrage') {
    if (d.counterparty_share_pct != null) meta.counterparty_share_pct = d.counterparty_share_pct;
    if (d.merchant_share_pct != null) meta.merchant_share_pct = d.merchant_share_pct;
  } else if (template.dealType === 'partnership') {
    if (d.partner_ratio != null) meta.partner_ratio = d.partner_ratio;
    if (d.merchant_ratio != null) meta.merchant_ratio = d.merchant_ratio;
  }

  if (d.settlement_period) meta.settlement_period = d.settlement_period;
  meta.agreement_family = template.family;

  return meta;
}

/** Generate auto-title from a template + customer name */
export function generateTemplateTitle(template: AgreementTemplate, customerName: string, lang: 'en' | 'ar'): string {
  const familyLabel = lang === 'ar'
    ? (template.family === 'profit_share' ? 'مشاركة أرباح' : 'صفقة بيع')
    : (template.family === 'profit_share' ? 'Profit Share' : 'Sales Deal');
  return `${familyLabel} · ${customerName} · ${template.ratioDisplay}`;
}

/** Get agreement family label */
export function getAgreementFamilyLabel(dealType: string, lang: 'en' | 'ar'): { label: string; icon: string } {
  if (dealType === 'partnership') {
    return { label: lang === 'ar' ? 'مشاركة أرباح' : 'Profit Share', icon: '🤝' };
  }
  if (dealType === 'arbitrage') {
    return { label: lang === 'ar' ? 'صفقة بيع' : 'Sales Deal', icon: '📊' };
  }
  // Legacy fallback
  return { label: lang === 'ar' ? 'اتفاقية' : 'Agreement', icon: '📋' };
}

/** Get partner/merchant share percentages from a deal's metadata */
export function getDealShares(deal: { deal_type: string; metadata: Record<string, unknown> }): {
  partnerPct: number | null;
  merchantPct: number | null;
  allocationBase: 'net_profit' | 'sale_economics';
} {
  let partnerPct: number | null = null;

  if (deal.deal_type === 'partnership') {
    partnerPct = (deal.metadata?.partner_ratio as number) ?? null;
    return { partnerPct, merchantPct: partnerPct != null ? 100 - partnerPct : null, allocationBase: 'net_profit' };
  }
  if (deal.deal_type === 'arbitrage') {
    partnerPct = (deal.metadata?.counterparty_share_pct as number) ?? null;
    return { partnerPct, merchantPct: partnerPct != null ? 100 - partnerPct : null, allocationBase: 'sale_economics' };
  }
  // Legacy types
  if (deal.deal_type === 'capital_placement') {
    partnerPct = (deal.metadata?.pool_owner_share_pct as number) ?? null;
    return { partnerPct, merchantPct: partnerPct != null ? 100 - partnerPct : null, allocationBase: 'sale_economics' };
  }

  return { partnerPct: null, merchantPct: null, allocationBase: 'net_profit' };
}
