import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { DEAL_TYPE_CONFIGS, SUPPORTED_DEAL_TYPES, generateRuleSummary, type DealTypeConfig } from '@/lib/deal-engine';
import { useT } from '@/lib/i18n';
import type { DealType } from '@/types/domain';
import type { Customer, TrackerState, Trade, Batch } from '@/lib/tracker-helpers';
import { uid, computeFIFO, totalStock, fmtU } from '@/lib/tracker-helpers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationshipId: string;
  counterpartyName: string;
  onCreated: () => void;
  /** Shared customer list from TrackerState */
  customers?: Customer[];
  /** Shared supplier names from batches + manual suppliers */
  suppliers?: string[];
  /** Current tracker state for stock reservation */
  trackerState?: TrackerState;
  /** Callback to apply state changes (stock reservation) */
  onStateChange?: (next: TrackerState) => void;
  /** Whether creating a deal should also reserve/add a tracker trade */
  reserveTrackerTradeOnCreate?: boolean;
  /** Pre-filled amount from new sale flow (locks the field) */
  prefillAmount?: string;
  /** Pre-filled currency from new sale flow */
  prefillCurrency?: string;
  /** Pre-filled customer ID from new sale flow (locks the field) */
  prefillCustomerId?: string;
  /** Pre-filled customer name from new sale flow */
  prefillCustomerName?: string;
}

const dealTypeOrder: DealType[] = ['lending', 'arbitrage', 'partnership', 'capital_placement', 'general'];

/** Generate a structured deal label from deal type + customer */
function generateDealLabel(dealType: DealType, customerName: string): string {
  const cfg = DEAL_TYPE_CONFIGS[dealType];
  return `${cfg.label} · ${customerName}`;
}

export function CreateDealDialog({
  open,
  onOpenChange,
  relationshipId,
  counterpartyName,
  onCreated,
  customers = [],
  suppliers = [],
  trackerState,
  onStateChange,
  reserveTrackerTradeOnCreate = true,
  prefillAmount,
  prefillCurrency,
  prefillCustomerId,
  prefillCustomerName,
}: Props) {
  const t = useT();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<DealType | null>(null);
  const [form, setForm] = useState({
    customTitle: '',
    amount: prefillAmount || '',
    currency: prefillCurrency || 'USDT',
    due_date: '',
    expected_return: '',
    counterparty_share_pct: '60',
    partner_ratio: '50',
    pool_owner_share_pct: '60',
    settlement_period: 'monthly',
    interest_rate: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const hasPrefillAmount = !!prefillAmount;
  const hasPrefillCustomer = !!prefillCustomerId;

  // Customer selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState(prefillCustomerId || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropOpen, setCustomerDropOpen] = useState(false);

  // Auto-select supplier from batches (system-assigned)
  const autoSupplierName = useMemo(() => {
    const supplierNames = [...new Set(suppliers.filter(Boolean))];
    return supplierNames.length > 0 ? supplierNames[0] : 'System';
  }, [suppliers]);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const selectedCustomer = prefillCustomerId
    ? customers.find(c => c.id === prefillCustomerId) || (prefillCustomerName ? { id: prefillCustomerId, name: prefillCustomerName, phone: '', tier: 'C' as const, dailyLimitUSDT: 0, notes: '', createdAt: Date.now() } : undefined)
    : customers.find(c => c.id === selectedCustomerId);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(customerSearch));
  }, [customers, customerSearch]);

  const config = selectedType ? DEAL_TYPE_CONFIGS[selectedType] : null;

  const merchantSharePct = useMemo(() => {
    if (!config?.hasCounterpartyShare) return 0;
    const cpShare = Number(
      selectedType === 'arbitrage' ? form.counterparty_share_pct :
      selectedType === 'partnership' ? form.partner_ratio :
      selectedType === 'capital_placement' ? form.pool_owner_share_pct : 0
    );
    return 100 - cpShare;
  }, [selectedType, form, config]);

  // Auto-generated title
  const autoTitle = useMemo(() => {
    if (!selectedType || !selectedCustomer) return '';
    return generateDealLabel(selectedType, selectedCustomer.name);
  }, [selectedType, selectedCustomer]);

  const effectiveTitle = form.customTitle.trim() || autoTitle;

  // Available stock check
  const availableStock = useMemo(() => {
    if (!trackerState) return null;
    const derived = computeFIFO(trackerState.batches, trackerState.trades);
    return totalStock(derived);
  }, [trackerState]);

  const dealAmountUSDT = useMemo(() => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return 0;
    // For USDT currency, amount is directly in USDT
    if (form.currency === 'USDT') return amt;
    // For QAR, we'd need a conversion - approximate with WACOP
    return amt; // simplified: treat as USDT equivalent
  }, [form.amount, form.currency]);

  const hasInsufficientStock = availableStock !== null && dealAmountUSDT > 0 && form.currency === 'USDT' && dealAmountUSDT > availableStock;

  const ruleSummary = useMemo(() => {
    if (!selectedType || !form.amount) return '';
    return generateRuleSummary(selectedType, {
      amount: Number(form.amount),
      currency: form.currency,
      counterpartyName,
      dueDate: form.due_date || undefined,
      expectedReturn: form.expected_return ? Number(form.expected_return) : undefined,
      counterpartySharePct: Number(form.counterparty_share_pct),
      merchantSharePct,
      partnerRatio: Number(form.partner_ratio),
      poolOwnerSharePct: Number(form.pool_owner_share_pct),
      settlementPeriod: form.settlement_period,
    });
  }, [selectedType, form, counterpartyName, merchantSharePct]);

  const resetAndClose = () => {
    setStep(1);
    setSelectedType(null);
    setForm({ customTitle: '', amount: prefillAmount || '', currency: prefillCurrency || 'USDT', due_date: '', expected_return: '', counterparty_share_pct: '60', partner_ratio: '50', pool_owner_share_pct: '60', settlement_period: 'monthly', interest_rate: '', notes: '' });
    if (!hasPrefillCustomer) setSelectedCustomerId('');
    setCustomerSearch('');
    setCustomerDropOpen(false);
    setValidationErrors([]);
    onOpenChange(false);
  };

  const validateStep2 = (): boolean => {
    const errs: string[] = [];
    if (!form.amount || !(Number(form.amount) > 0)) errs.push(t('amount'));
    if (!selectedCustomerId) errs.push(t('dealCustomerRequired'));
    setValidationErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async () => {
    if (!selectedType || !form.amount || !selectedCustomerId) return;
    if (!effectiveTitle) return;

    setSubmitting(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (config?.hasCounterpartyShare) {
        if (selectedType === 'arbitrage') {
          metadata.counterparty_share_pct = Number(form.counterparty_share_pct);
          metadata.merchant_share_pct = merchantSharePct;
        } else if (selectedType === 'partnership') {
          metadata.partner_ratio = Number(form.partner_ratio);
          metadata.merchant_ratio = 100 - Number(form.partner_ratio);
        } else if (selectedType === 'capital_placement') {
          metadata.pool_owner_share_pct = Number(form.pool_owner_share_pct);
        }
        metadata.settlement_period = form.settlement_period;
      }
      if (form.interest_rate) metadata.interest_rate = Number(form.interest_rate);
      if (form.notes) metadata.notes = form.notes;

      // Persist customer/supplier references in metadata (mandatory)
      metadata.customer_id = selectedCustomerId;
      metadata.customer_name = selectedCustomer!.name;
      metadata.supplier_name = autoSupplierName;

      const dealResult = await api.deals.create({
        relationship_id: relationshipId,
        deal_type: selectedType,
        title: effectiveTitle,
        amount: parseFloat(form.amount),
        currency: form.currency,
        due_date: form.due_date || undefined,
        expected_return: form.expected_return ? parseFloat(form.expected_return) : undefined,
        metadata,
      });

      // ── Stock reservation: create a linked trade entry in Orders ──
      if (reserveTrackerTradeOnCreate && trackerState && onStateChange && form.currency === 'USDT' && dealAmountUSDT > 0) {
        const dealId = dealResult.deal?.id || '';
        // Ensure customer exists in tracker state
        let nextCustomers = trackerState.customers;
        let customerId = selectedCustomerId;
        const existing = trackerState.customers.find(c => c.id === selectedCustomerId);
        if (!existing && selectedCustomer) {
          const newCust: Customer = {
            id: selectedCustomerId,
            name: selectedCustomer.name,
            phone: selectedCustomer.phone || '',
            tier: selectedCustomer.tier || 'C',
            dailyLimitUSDT: 0,
            notes: '',
            createdAt: Date.now(),
          };
          nextCustomers = [...trackerState.customers, newCust];
        }

        // Create a merchant-linked trade that consumes stock
        const trade: Trade = {
          id: uid(),
          ts: Date.now(),
          inputMode: 'USDT',
          amountUSDT: dealAmountUSDT,
          sellPriceQAR: 0, // merchant deal - not a market sale, placeholder
          feeQAR: 0,
          note: `Merchant deal: ${effectiveTitle}`,
          voided: false,
          usesStock: true,
          revisions: [],
          customerId,
          linkedDealId: dealId,
          linkedRelId: relationshipId,
        };

        const nextState: TrackerState = {
          ...trackerState,
          customers: nextCustomers,
          trades: [...trackerState.trades, trade],
        };
        onStateChange(nextState);
        toast.success(t('dealCreatedAsOrder'));
      } else if (reserveTrackerTradeOnCreate) {
        toast.success(t('dealCreated'));
      } else {
        toast.success(t('dealCreated'));
      }

      resetAndClose();
      onCreated();
    } catch (err: any) {
      toast.error(err.message || t('failedCreateDeal'));
    } finally {
      setSubmitting(false);
    }
  };

  // Build deal summary note with customer context
  const dealContextSummary = useMemo(() => {
    if (!selectedCustomer) return '';
    const custName = selectedCustomer?.name || t('noCustomerSelected');
    return t('dealSummaryNote')
      .replace('{customer}', custName)
      .replace('{supplier}', autoSupplierName);
  }, [selectedCustomer, autoSupplierName, t]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('createNewDeal')}
            <Badge variant="outline" className="text-xs font-mono">{t('step')} {step}/3</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Choose deal type */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('chooseDealType')} <span className="font-medium text-foreground">{counterpartyName}</span>:</p>
            {dealTypeOrder.map(dt => {
              const cfg = DEAL_TYPE_CONFIGS[dt];
              return (
                <Card
                  key={dt}
                  className={`cursor-pointer transition-all ${selectedType === dt ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'hover:border-muted-foreground/30'}`}
                  onClick={() => setSelectedType(dt)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cfg.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{t(`dealType_${dt}_label` as any)}</p>
                        <p className="text-xs text-muted-foreground">{t(`dealType_${dt}_desc` as any)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>{t('cancel')}</Button>
              <Button disabled={!selectedType} onClick={() => setStep(2)}>{t('nextStep')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Type-specific fields + Customer/Supplier (both mandatory) */}
        {step === 2 && config && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span>{config.icon}</span>
              <span className="font-medium">{selectedType ? t(`dealType_${selectedType}_label` as any) : config.label}</span>
              <Badge variant="outline" className="text-xs">{t('with')} {counterpartyName}</Badge>
            </div>

            {/* ─── CUSTOMER SELECTOR ─── */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                👤 {t('dealCustomer')} <span className="text-xs text-destructive font-bold">*</span>
              </Label>
              {hasPrefillCustomer ? (
                <div className="flex items-center border rounded-md bg-muted/30 border-input px-3 h-9">
                  <span className="text-sm text-foreground font-medium">{selectedCustomer?.name || prefillCustomerName}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{t('fromOrder')}</Badge>
                </div>
              ) : (
                <div className="relative">
                  <div className={`flex items-center border rounded-md bg-background ${validationErrors.includes(t('dealCustomerRequired')) ? 'border-destructive' : 'border-input'}`}>
                    <Search className="w-3.5 h-3.5 ml-2.5 text-muted-foreground shrink-0" />
                    <input
                      className="flex-1 h-9 px-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                      placeholder={t('searchCustomerPlaceholder')}
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setCustomerDropOpen(true); }}
                      onFocus={() => setCustomerDropOpen(true)}
                    />
                    {selectedCustomer && (
                      <Badge variant="secondary" className="mr-2 text-xs shrink-0">{selectedCustomer.name}</Badge>
                    )}
                  </div>
                  {customerDropOpen && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto border border-border rounded-md bg-popover shadow-md">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between ${selectedCustomerId === c.id ? 'bg-accent/50' : ''}`}
                          onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(''); setCustomerDropOpen(false); setValidationErrors(prev => prev.filter(e => e !== t('dealCustomerRequired'))); }}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.phone || c.tier}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {validationErrors.includes(t('dealCustomerRequired')) && (
                <p className="text-xs text-destructive">{t('dealCustomerRequired')}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">{t('amount')} <span className="text-xs text-destructive font-bold">*</span>{hasPrefillAmount && <Badge variant="secondary" className="ml-1 text-[9px]">{t('fromOrder')}</Badge>}</Label>
                <Input type="number" placeholder="10000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} disabled={hasPrefillAmount} className={hasPrefillAmount ? 'opacity-70' : ''} />
              </div>
              <div className="space-y-2">
                <Label>{t('currency')}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))} disabled={hasPrefillAmount}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="QAR">QAR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stock availability indicator */}
            {form.currency === 'USDT' && dealAmountUSDT > 0 && availableStock !== null && (
              <div className={`flex items-center gap-2 text-xs p-2 rounded-md ${hasInsufficientStock ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                {hasInsufficientStock ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                <span>
                  {hasInsufficientStock
                    ? t('insufficientStock')
                    : t('dealWillReserveStock').replace('{amount}', fmtU(dealAmountUSDT))
                  }
                  {' '}({t('availableUsdt')}: {fmtU(availableStock)})
                </span>
              </div>
            )}

            {config.hasDueDate && (
              <div className="space-y-2">
                <Label>{t('dueDate')} {config.requiredFields.includes('due_date') ? '*' : t('optional')}</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            )}

            {config.hasExpectedReturn && (
              <div className="space-y-2">
                <Label>{t('expectedReturn')} {t('optional')}</Label>
                <Input type="number" placeholder="500" value={form.expected_return} onChange={e => setForm(f => ({ ...f, expected_return: e.target.value }))} />
              </div>
            )}

            {config.hasRepaymentLogic && (
              <div className="space-y-2">
                <Label>{t('interestRate')} {t('optional')}</Label>
                <Input type="number" step="0.1" placeholder="5" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} />
              </div>
            )}

            {config.hasCounterpartyShare && selectedType === 'arbitrage' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{counterpartyName}{t('sharePercent')}</Label>
                  <Input type="number" min="1" max="99" value={form.counterparty_share_pct} onChange={e => setForm(f => ({ ...f, counterparty_share_pct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('yourSharePct')}</Label>
                  <Input disabled value={String(merchantSharePct)} />
                </div>
              </div>
            )}

            {config.hasCounterpartyShare && selectedType === 'partnership' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('partnerRatio')} ({counterpartyName})</Label>
                  <Input type="number" min="1" max="99" value={form.partner_ratio} onChange={e => setForm(f => ({ ...f, partner_ratio: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('yourRatio')}</Label>
                  <Input disabled value={String(100 - Number(form.partner_ratio))} />
                </div>
              </div>
            )}

            {config.hasCounterpartyShare && selectedType === 'capital_placement' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('poolOwnerShare')} ({counterpartyName})</Label>
                  <Input type="number" min="1" max="99" value={form.pool_owner_share_pct} onChange={e => setForm(f => ({ ...f, pool_owner_share_pct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('yourSharePct')}</Label>
                  <Input disabled value={String(100 - Number(form.pool_owner_share_pct))} />
                </div>
              </div>
            )}

            {config.hasCounterpartyShare && (
              <div className="space-y-2">
                <Label>{t('settlementPeriod')}</Label>
                <Select value={form.settlement_period} onValueChange={v => setForm(f => ({ ...f, settlement_period: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_order">{t('perOrder')}</SelectItem>
                    <SelectItem value="daily">{t('daily')}</SelectItem>
                    <SelectItem value="weekly">{t('weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('monthly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Auto-generated label display */}
            {autoTitle && (
              <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/30">
                <span className="text-muted-foreground">{t('dealAutoTitle')}:</span>
                <strong className="text-foreground">{autoTitle}</strong>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('notesOptional')}</Label>
              <Textarea placeholder={t('additionalTerms')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            {/* Validation errors summary */}
            {validationErrors.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{t('fixFields')} {validationErrors.join(', ')}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>{t('backStep')}</Button>
              <Button disabled={!form.amount || !selectedCustomerId} onClick={() => { if (validateStep2()) setStep(3); }}>{t('reviewAndConfirm')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && config && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span>{config.icon}</span>
              <span className="font-medium">{selectedType ? t(`dealType_${selectedType}_label` as any) : config.label}</span>
              <Badge variant="outline" className="text-xs">{t('reviewConfirm')}</Badge>
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">{effectiveTitle}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{t('amount')}: <strong className="text-foreground">{Number(form.amount).toLocaleString()} {form.currency}</strong></span>
                  {form.due_date && <span>{t('dueDate')}: <strong className="text-foreground">{form.due_date}</strong></span>}
                  {form.expected_return && <span>{t('expectedReturn')}: <strong className="text-foreground">{Number(form.expected_return).toLocaleString()} {form.currency}</strong></span>}
                </div>
                {/* Customer summary in review */}
                <div className="flex flex-wrap gap-3 text-xs mt-2 pt-2 border-t border-border/50">
                  <span className="flex items-center gap-1">
                    👤 {t('dealLinkedCustomer')}: <strong className="text-foreground">{selectedCustomer?.name}</strong>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Stock reservation notice */}
            {form.currency === 'USDT' && dealAmountUSDT > 0 && (
              <Card className="bg-warning/10 border-warning/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      {t('dealWillReserveStock').replace('{amount}', fmtU(dealAmountUSDT))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{ruleSummary}</p>
                </div>
              </CardContent>
            </Card>

            {/* Deal context summary with customer/supplier */}
            {dealContextSummary && (
              <Card className="bg-accent/10 border-accent/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">{dealContextSummary}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {config.requiresApproval && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{t('requiresApprovalNote')}</span>
              </div>
            )}

            {config.eligibleOrderSides.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{t('eligible')} {config.eligibleOrderSides.join('/')} {t('eligibleOrdersNote')}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>{t('backStep')}</Button>
              <Button onClick={handleSubmit} disabled={submitting || hasInsufficientStock}>
                {submitting ? t('creating') : t('createDeal')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
