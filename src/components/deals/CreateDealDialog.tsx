import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { DEAL_TYPE_CONFIGS, generateRuleSummary, type DealTypeConfig } from '@/lib/deal-engine';
import { useT } from '@/lib/i18n';
import type { DealType, MerchantRelationship } from '@/types/domain';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationshipId: string;
  counterpartyName: string;
  onCreated: () => void;
}

const dealTypeOrder: DealType[] = ['lending', 'arbitrage', 'partnership', 'capital_placement', 'general'];

export function CreateDealDialog({ open, onOpenChange, relationshipId, counterpartyName, onCreated }: Props) {
  const t = useT();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<DealType | null>(null);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    currency: 'USDT',
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
    setForm({ title: '', amount: '', currency: 'USDT', due_date: '', expected_return: '', counterparty_share_pct: '60', partner_ratio: '50', pool_owner_share_pct: '60', settlement_period: 'monthly', interest_rate: '', notes: '' });
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!selectedType || !form.title || !form.amount) return;
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

      await api.deals.create({
        relationship_id: relationshipId,
        deal_type: selectedType,
        title: form.title,
        amount: parseFloat(form.amount),
        currency: form.currency,
        due_date: form.due_date || undefined,
        expected_return: form.expected_return ? parseFloat(form.expected_return) : undefined,
        metadata,
      });
      toast.success(t('dealCreated'));
      resetAndClose();
      onCreated();
    } catch (err: any) {
      toast.error(err.message || t('failedCreateDeal'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-lg">
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
                        <p className="font-medium text-sm">{cfg.label}</p>
                        <p className="text-xs text-muted-foreground">{cfg.description}</p>
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

        {/* Step 2: Type-specific fields */}
        {step === 2 && config && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span>{config.icon}</span>
              <span className="font-medium">{config.label}</span>
              <Badge variant="outline" className="text-xs">{t('with')} {counterpartyName}</Badge>
            </div>

            <div className="space-y-2">
              <Label>{t('dealTitle')} *</Label>
              <Input placeholder={`e.g. ${config.label} - Q1 2026`} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('amount')} *</Label>
                <Input type="number" placeholder="10000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('currency')}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="QAR">QAR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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

            <div className="space-y-2">
              <Label>{t('notesOptional')}</Label>
              <Textarea placeholder={t('additionalTerms')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>{t('backStep')}</Button>
              <Button disabled={!form.title || !form.amount} onClick={() => setStep(3)}>{t('reviewAndConfirm')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && config && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span>{config.icon}</span>
              <span className="font-medium">{config.label}</span>
              <Badge variant="outline" className="text-xs">{t('reviewConfirm')}</Badge>
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">{form.title}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{t('amount')}: <strong className="text-foreground">{Number(form.amount).toLocaleString()} {form.currency}</strong></span>
                  {form.due_date && <span>{t('dueDate')}: <strong className="text-foreground">{form.due_date}</strong></span>}
                  {form.expected_return && <span>{t('expectedReturn')}: <strong className="text-foreground">{Number(form.expected_return).toLocaleString()} {form.currency}</strong></span>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{ruleSummary}</p>
                </div>
              </CardContent>
            </Card>

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
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? t('creating') : t('createDeal')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
