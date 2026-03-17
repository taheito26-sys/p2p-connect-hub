import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { merchant as merchantApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const [form, setForm] = useState({
    display_name: '',
    nickname: '',
    merchant_type: 'independent',
    region: '',
    default_currency: 'USDT',
    discoverability: 'public',
    bio: '',
  });

  const checkNickname = async (nick: string) => {
    if (nick.length < 3) { setNicknameStatus('idle'); return; }
    setNicknameStatus('checking');
    try {
      const { available } = await merchantApi.checkNickname(nick);
      setNicknameStatus(available ? 'available' : 'taken');
    } catch {
      setNicknameStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nicknameStatus === 'taken') {
      toast.error('Nickname is already taken');
      return;
    }
    setLoading(true);
    try {
      await merchantApi.ensureProfile(form);
      await refreshProfile();
      toast.success('Merchant portfolio created!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg glass">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="font-display text-2xl">Create Your Merchant Portfolio</CardTitle>
          <CardDescription>Set up your identity on the TRACKER platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input placeholder="Taheito Trading" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required minLength={2} maxLength={80} />
            </div>

            <div className="space-y-2">
              <Label>Public Nickname</Label>
              <div className="relative">
                <Input
                  placeholder="taheito_trading"
                  value={form.nickname}
                  onChange={e => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
                    setForm(f => ({ ...f, nickname: v }));
                    checkNickname(v);
                  }}
                  required
                  minLength={3}
                  maxLength={32}
                  className="pr-8"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {nicknameStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {nicknameStatus === 'taken' && <XCircle className="w-4 h-4 text-destructive" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Lowercase, numbers, dots, underscores, dashes. 3-32 chars.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Merchant Type</Label>
                <Select value={form.merchant_type} onValueChange={v => setForm(f => ({ ...f, merchant_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="independent">Independent</SelectItem>
                    <SelectItem value="desk">Desk</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Region</Label>
                <Input placeholder="Qatar" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Input placeholder="USDT" value={form.default_currency} onChange={e => setForm(f => ({ ...f, default_currency: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-2">
                <Label>Discoverability</Label>
                <Select value={form.discoverability} onValueChange={v => setForm(f => ({ ...f, discoverability: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="merchant_id_only">Merchant ID Only</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bio (optional)</Label>
              <Textarea placeholder="Tell others about your merchant business..." value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} maxLength={500} rows={3} />
              <p className="text-xs text-muted-foreground text-right">{form.bio.length}/500</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || nicknameStatus === 'taken'}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Merchant Portfolio
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
