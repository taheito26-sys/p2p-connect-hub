import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck } from 'lucide-react';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass text-center">
        <CardHeader className="space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-2">
            <MailCheck className="w-6 h-6 text-accent-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">Check Your Email</CardTitle>
          <CardDescription>We've sent a verification link to your email address. Click the link to verify your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/auth/login">Return to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
