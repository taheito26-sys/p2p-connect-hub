import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { SignIn } from "@clerk/clerk-react";
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard';

  if (isAuthenticated) {
    return <Navigate to={redirectUrl} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass border-border/60 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <TrendingUp className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">Sign In</CardTitle>
          <CardDescription>Access your TRACKER platform account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignIn
            path="/auth/login"
            routing="path"
            signUpUrl="/auth/signup"
            forceRedirectUrl={redirectUrl}
          />
          <p className="text-center text-sm text-muted-foreground">
            Need an account?{' '}
            <Link to="/auth/signup" className="text-primary hover:underline">Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

