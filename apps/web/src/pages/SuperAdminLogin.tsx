import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, AlertTriangle } from "lucide-react";
import { signInSchema } from "@/lib/validationSchemas";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { checkServerRateLimit, recordFailedAttempt, resetServerRateLimit, formatBlockTimeRemaining } from "@/lib/serverRateLimit";

const SuperAdminLogin = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [blockExpiresAt, setBlockExpiresAt] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(user);

  // Handle redirect after successful admin login
  useEffect(() => {
    // Wait for both auth and role checks to complete
    if (authLoading || roleLoading) {
      return;
    }

    if (user && isAdmin) {
      console.log('SuperAdminLogin - Redirecting admin to dashboard');
      // Reset rate limit on successful login
      resetServerRateLimit(`superadmin_${email}`, 'superadmin_login');
      navigate("/super-admin-dashboard");
    } else if (user && isAdmin === false) {
      // User is logged in but not admin - sign them out
      console.log('SuperAdminLogin - User is not admin, signing out');
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Only administrators can access this portal.",
      });
      supabase.auth.signOut();
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate, toast, email]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitKey = `superadmin_${normalizedEmail}`;
    
    try {
      const validated = signInSchema.parse({ email, password });

      // Check server-side rate limit
      const rateLimitResult = await checkServerRateLimit(rateLimitKey, 'superadmin_login');
      
      if (!rateLimitResult.allowed) {
        setBlockExpiresAt(rateLimitResult.blockExpiresAt || null);
        const timeRemaining = rateLimitResult.blockExpiresAt 
          ? formatBlockTimeRemaining(rateLimitResult.blockExpiresAt)
          : "30 minutes";
        toast({
          variant: "destructive",
          title: "Too many attempts",
          description: `Please try again in ${timeRemaining}`,
        });
        setLoading(false);
        return;
      }
      
      setRemainingAttempts(rateLimitResult.remainingAttempts);
      setBlockExpiresAt(null);

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        // Record failed attempt server-side
        const recordResult = await recordFailedAttempt(rateLimitKey, 'superadmin_login');
        setRemainingAttempts(recordResult.remainingAttempts);
        
        if (recordResult.isBlocked) {
          setBlockExpiresAt(new Date(Date.now() + 30 * 60 * 1000).toISOString());
          toast({
            variant: "destructive",
            title: "Account temporarily locked",
            description: "Too many failed attempts. Please try again in 30 minutes.",
          });
        } else if (recordResult.remainingAttempts <= 2) {
          toast({
            variant: "destructive",
            title: "Sign in failed",
            description: `${error.message}. ${recordResult.remainingAttempts} attempt${recordResult.remainingAttempts !== 1 ? 's' : ''} remaining.`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Sign in failed",
            description: error.message,
          });
        }
        return;
      }

      toast({
        title: "Welcome back!",
        description: "Verifying admin access...",
      });
    } catch (error: any) {
      if (error.errors) {
        error.errors.forEach((err: any) => {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: err.message,
          });
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isBlocked = blockExpiresAt && new Date(blockExpiresAt) > new Date();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Super Admin Portal</CardTitle>
          <CardDescription>
            Access the administrative dashboard for full platform control
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isBlocked && blockExpiresAt && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Too many login attempts. Please try again in {formatBlockTimeRemaining(blockExpiresAt)}.
              </AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@paizeis.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isBlocked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isBlocked}
              />
            </div>

            {remainingAttempts !== null && remainingAttempts <= 3 && remainingAttempts > 0 && (
              <p className="text-sm text-amber-500">
                Warning: {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading || authLoading || roleLoading || isBlocked}>
              {(loading || roleLoading) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {roleLoading ? "Verifying..." : "Signing in..."}
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Access Admin Dashboard
                </>
              )}
            </Button>

            <div className="text-center text-sm">
              <Button
                type="button"
                variant="link"
                onClick={() => navigate("/admin_signin")}
                className="text-muted-foreground hover:text-foreground"
              >
                Venue Manager? Sign in here
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminLogin;
