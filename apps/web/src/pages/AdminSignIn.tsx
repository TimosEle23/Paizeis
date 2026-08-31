import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Loader2, AlertTriangle } from "lucide-react";
import { signInSchema } from "@/lib/validationSchemas";
import { checkServerRateLimit, recordFailedAttempt, resetServerRateLimit, formatBlockTimeRemaining } from "@/lib/serverRateLimit";

const AdminSignIn = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [blockExpiresAt, setBlockExpiresAt] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if user is venue manager after sign in
  useEffect(() => {
    const checkVenueManager = async () => {
      if (user) {
        const { data, error } = await supabase
          .from("venue_managers")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data && !error) {
          // Reset rate limit on successful login
          await resetServerRateLimit(`admin_${email}`, 'admin_login');
          navigate("/venue-admin");
        } else {
          toast({
            variant: "destructive",
            title: "Access Denied",
            description: "You are not registered as a venue manager.",
          });
        }
      }
    };

    checkVenueManager();
  }, [user, navigate, toast, email]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitKey = `admin_${normalizedEmail}`;
    
    try {
      const validated = signInSchema.parse({
        email,
        password,
      });

      // Check server-side rate limit
      const rateLimitResult = await checkServerRateLimit(rateLimitKey, 'admin_login');
      
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
        const recordResult = await recordFailedAttempt(rateLimitKey, 'admin_login');
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
        description: "Checking venue manager access...",
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
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Venue Manager Portal</CardTitle>
          <CardDescription>
            Sign in to manage your venue's bookings and availability
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="manager@venue.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isBlocked}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button
                  type="button"
                  variant="link"
                  className="text-xs px-0 h-auto text-primary"
                  onClick={async () => {
                    if (!email) {
                      toast({
                        variant: "destructive",
                        title: "Email required",
                        description: "Please enter your email address first.",
                      });
                      return;
                    }
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/admin_signin`,
                    });
                    if (error) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: error.message,
                      });
                    } else {
                      toast({
                        title: "Check your email",
                        description: "We've sent you a password reset link.",
                      });
                    }
                  }}
                >
                  Forgot password?
                </Button>
              </div>
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

            <Button type="submit" className="w-full" disabled={loading || isBlocked}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="text-center space-y-2">
              <Button
                type="button"
                variant="link"
                onClick={() => navigate("/auth")}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Regular user? Sign in here
              </Button>
              <div>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate("/super-admin-login")}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Super Admin Portal
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSignIn;
