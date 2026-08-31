import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { signUpSchema, signInSchema } from "@/lib/validationSchemas";
import { checkServerRateLimit, recordFailedAttempt, resetServerRateLimit, formatBlockTimeRemaining } from "@/lib/serverRateLimit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import futsal15Background from "@/assets/futsal_15.mp4.asset.json";
import futsalAuthMobileBackground from "@/assets/futsal_auth_mobile.mp4.asset.json";
import pixelPitchBg from "@/assets/pixel_pitch_bg.jpg.asset.json";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ blocked: boolean; blockExpiresAt: string | null; remainingAttempts: number }>({
    blocked: false,
    blockExpiresAt: null,
    remainingAttempts: 5
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          navigate("/venues");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate("/venues");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validated = signUpSchema.parse({
        email,
        password,
        fullName,
      });

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: { full_name: validated.fullName },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      toast({
        title: "Account created!",
        description: "You can now sign in with your credentials.",
      });
      setIsLogin(true);
    } catch (error: any) {
      if (error.errors) {
        // Zod validation errors
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
          title: "Sign up failed",
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      // Validate input first
      const validated = signInSchema.parse({
        email,
        password,
      });

      // Check server-side rate limit
      const rateLimitCheck = await checkServerRateLimit(normalizedEmail, 'login');
      
      if (!rateLimitCheck.allowed) {
        setRateLimitInfo({
          blocked: true,
          blockExpiresAt: rateLimitCheck.blockExpiresAt || null,
          remainingAttempts: 0
        });
        const timeRemaining = rateLimitCheck.blockExpiresAt 
          ? formatBlockTimeRemaining(rateLimitCheck.blockExpiresAt)
          : "30 minutes";
        toast({
          variant: "destructive",
          title: "Too many login attempts",
          description: `Please try again in ${timeRemaining}.`,
        });
        setLoading(false);
        return;
      }
      
      setRateLimitInfo({
        blocked: false,
        blockExpiresAt: null,
        remainingAttempts: rateLimitCheck.remainingAttempts
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        // Record failed attempt server-side
        const recordResult = await recordFailedAttempt(normalizedEmail, 'login');
        
        setRateLimitInfo({
          blocked: recordResult.isBlocked,
          blockExpiresAt: null,
          remainingAttempts: recordResult.remainingAttempts
        });
        
        if (recordResult.remainingAttempts <= 2 && recordResult.remainingAttempts > 0) {
          toast({
            variant: "destructive",
            title: "Sign in failed",
            description: `${error.message}. ${recordResult.remainingAttempts} attempt${recordResult.remainingAttempts === 1 ? '' : 's'} remaining.`,
          });
        } else if (recordResult.isBlocked) {
          toast({
            variant: "destructive",
            title: "Account temporarily locked",
            description: "Too many failed attempts. Please try again in 30 minutes.",
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

      // Reset rate limit on successful login
      await resetServerRateLimit(normalizedEmail, 'login');
      
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
        className: "border-2 border-primary/50 bg-cover bg-center text-white shadow-[0_0_20px_rgba(132,204,22,0.3)] font-mono",
        style: {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${pixelPitchBg.url})`,
        },
      });
    } catch (error: any) {
      if (error.errors) {
        // Zod validation errors
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      }
    });

    setLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Google sign in failed",
        description: error.message,
      });
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
        {/* Desktop/Tablet background video */}
        <video
          src={futsal15Background.url}
          autoPlay
          loop
          muted
          playsInline
          className="hidden md:block w-full h-full object-cover"
        />
        {/* Mobile background video */}
        <video
          src={futsalAuthMobileBackground.url}
          autoPlay
          loop
          muted
          playsInline
          className="block md:hidden w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>
      <Link
        to="/"
        className="absolute top-4 left-4 z-50 inline-flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Back home
      </Link>
      <Card className="relative w-full max-w-md bg-black/30 border-white/10 text-white backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white">
            {isLogin ? t('auth.signIn') : t('auth.createAccount')}
          </CardTitle>
          <CardDescription className="text-white/80">
            {isLogin ? t('auth.signIn.desc') : t('auth.createAccount.desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rateLimitInfo.blocked && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Too many failed login attempts. Please try again {rateLimitInfo.blockExpiresAt ? `in ${formatBlockTimeRemaining(rateLimitInfo.blockExpiresAt)}` : 'in 30 minutes'}.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={isLogin ? handleSignIn : handleSignUp} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-white/90">{t('auth.fullName')}</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  className="bg-black/60 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-black/60 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/90">{t('auth.password')}</Label>
                {isLogin && (
                  <Button
                    type="button"
                    variant="link"
                    className="text-xs px-0 h-auto text-white/70 hover:text-white"
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
                        redirectTo: `${window.location.origin}/auth`,
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
                    {t('auth.forgotPassword')}
                  </Button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-black/60 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : isLogin ? (
                t('auth.signIn')
              ) : (
                t('auth.signUp')
              )}
            </Button>

            {isLogin && (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full mt-2 border-gray-600 bg-gray-900/80 text-white hover:bg-gray-800 hover:text-white" 
                onClick={() => navigate("/admin_signin")}
              >
                Sign in as Venue Manager
              </Button>
            )}

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black/40 px-2 text-white/70">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-gray-600 bg-gray-900/80 text-white hover:bg-gray-800 hover:text-white"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('auth.googleSignIn')}
            </Button>

            <div className="text-center text-sm">
              <Button
                type="button"
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
                className="text-white/70 hover:text-white"
              >
                {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
