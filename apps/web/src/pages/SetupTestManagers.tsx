import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Shield, Users } from "lucide-react";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";

const SetupTestManagers = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { isAdmin, loading: roleLoading } = useAdminRole(user);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate("/super-admin-login");
      } else if (!isAdmin) {
        toast.error("Access Denied", {
          description: "Only administrators can access this page.",
        });
        navigate("/");
      }
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  const createTestManagers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-test-managers");
      
      if (error) throw error;
      
      setResults(data.results || []);
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const alreadyExists = data.results?.filter((r: any) => r.status === 'already_exists').length || 0;
      
      if (successCount > 0) {
        toast.success(`Created ${successCount} venue manager(s)`, {
          description: "Credentials have been logged securely. Contact support for passwords."
        });
      } else if (alreadyExists > 0) {
        toast.info(`${alreadyExists} manager(s) already exist`);
      }
    } catch (error: any) {
      toast.error("Failed to create managers", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Super Admin</span>
              </div>
              <h1 className="text-3xl font-bold">Setup Venue Managers</h1>
              <p className="text-muted-foreground">Create venue manager accounts for all futsal venues</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/super-admin")}>
              Back to Dashboard
            </Button>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Create Venue Manager Accounts
              </CardTitle>
              <CardDescription>
                Creates venue manager accounts for all futsal venues that don't have managers. 
                Secure passwords are generated automatically and logged server-side.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={createTestManagers} disabled={loading} size="lg">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Venue Managers"
                )}
              </Button>
            </CardContent>
          </Card>

          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  Passwords are securely generated and logged server-side. Contact pezeiscy@gmail.com for credentials.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.map((result, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border ${
                        result.success 
                          ? "bg-green-500/10 border-green-500/20" 
                          : result.status === 'already_exists'
                          ? "bg-muted border-border"
                          : "bg-destructive/10 border-destructive/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {result.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                        ) : result.status === 'already_exists' ? (
                          <CheckCircle2 className="w-5 h-5 text-muted-foreground mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{result.venue || result.email}</p>
                          <p className="text-sm text-muted-foreground">{result.email}</p>
                          {result.city && (
                            <p className="text-xs text-muted-foreground">{result.city}</p>
                          )}
                          {result.status === 'already_exists' && (
                            <p className="text-sm text-muted-foreground">Already exists</p>
                          )}
                          {result.error && (
                            <p className="text-sm text-destructive">{result.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupTestManagers;
