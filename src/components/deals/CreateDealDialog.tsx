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
      toast.success('Deal created successfully');
      resetAndClose();
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create New Deal
            <Badge variant="outline" className="text-xs font-mono">Step {step}/3</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Choose deal type */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Choose the type of deal to create with <span className="font-medium text-foreground">{counterpartyName}</span>:</p>
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
              <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
              <Button disabled={!selectedType} onClick={() => setStep(2)}>Next →</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Type-specific fields */}
        {step === 2 && config && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span>{config.icon}</span>
              <span className="font-medium">{config.label}</span>
              <Badge variant="outline" className="text-xs">with {counterpartyName}</Badge>
            </div>

            <div className="space-y-2">
              <Label>Deal Title *</Label>
              <Input placeholder={`e.g. ${config.label} - Q1 2026`} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" placeholder="10000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
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
                <Label>Due Date {config.requiredFields.includes('due_date') ? '*' : '(optional)'}</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            )}

            {config.hasExpectedReturn && (
              <div className="space-y-2">
                <Label>Expected Return (optional)</Label>
                <Input type="number" placeholder="500" value={form.expected_return} onChange={e => setForm(f => ({ ...f, expected_return: e.target.value }))} />
              </div>
            )}

            {config.hasRepaymentLogic && (
              <div className="space-y-2">
                <Label>Interest Rate % (optional)</Label>
                <Input type="number" step="0.1" placeholder="5" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} />
              </div>
            )}

            {/* Counterparty share fields */}
            {config.hasCounterpartyShare && selectedType === 'arbitrage' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{counterpartyName}'s Share %</Label>
                  <Input type="number" min="1" max="99" value={form.counterparty_share_pct} onChange={e => setForm(f => ({ ...f, counterparty_share_pct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Your Share %</Label>
                  <Input disabled value={String(merchantSharePct)} />
                </div>
              </div>
            )}

            {config.hasCounterpartyShare && selectedType === 'partnership' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Partner Ratio % ({counterpartyName})</Label>
                  <Input type="number" min="1" max="99" value={form.partner_ratio} onChange={e => setForm(f => ({ ...f, partner_ratio: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Your Ratio %</Label>
                  <Input disabled value={String(100 - Number(form.partner_ratio))} />
                </div>
              </div>
            )}

            {config.hasCounterpartyShare && selectedType === 'capital_placement' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Pool Owner Share % ({counterpartyName})</Label>
                  <Input type="number" min="1" max="99" value={form.pool_owner_share_pct} onChange={e => setForm(f => ({ ...f, pool_owner_share_pct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Your Share %</Label>
                  <Input disabled value={String(100 - Number(form.pool_owner_share_pct))} />
                </div>
              </div>
            )}

            {config.hasCounterpartyShare && (
              <div className="space-y-2">
                <Label>Settlement Period</Label>
                <Select value={form.settlement_period} onValueChange={v => setForm(f => ({ ...f, settlement_period: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_order">Per Order</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Additional terms or context..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button disabled={!form.title || !form.amount} onClick={() => setStep(3)}>Review →</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && config && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span>{config.icon}</span>
              <span className="font-medium">{config.label}</span>
              <Badge variant="outline" className="text-xs">Review</Badge>
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">{form.title}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Amount: <strong className="text-foreground">{Number(form.amount).toLocaleString()} {form.currency}</strong></span>
                  {form.due_date && <span>Due: <strong className="text-foreground">{form.due_date}</strong></span>}
                  {form.expected_return && <span>Expected Return: <strong className="text-foreground">{Number(form.expected_return).toLocaleString()} {form.currency}</strong></span>}
                </div>
              </CardContent>
            </Card>

            {/* Rule Summary */}
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
                <span>Settlements and profit records for this deal will require counterparty approval.</span>
              </div>
            )}

            {config.eligibleOrderSides.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Eligible {config.eligibleOrderSides.join('/')} orders can be linked to this deal for automatic allocation.</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Deal'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
