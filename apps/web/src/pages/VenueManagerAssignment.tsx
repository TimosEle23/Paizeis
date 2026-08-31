import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { venueManagerSchema } from "@/lib/validationSchemas";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Building2, User, Shield } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const VenueManagerAssignment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(user);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const queryClient = useQueryClient();

  // Check admin access
  useEffect(() => {
    // Don't do anything while still loading
    if (roleLoading) {
      return;
    }
    
    // Only redirect if we have finished loading and confirmed the user is not an admin
    if (!user) {
      navigate("/super-admin-login");
    } else if (isAdmin === false) {
      // Use explicit false check
      toast.error("Access Denied", {
        description: "Only administrators can access this page.",
      });
      navigate("/");
    }
  }, [user, isAdmin, roleLoading, navigate]);

  // Fetch all venues
  const { data: venues } = useQuery({
    queryKey: ["all-venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch all venue managers with venue details
  const { data: venueManagers, isLoading } = useQuery({
    queryKey: ["venue-managers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venue_managers")
        .select(`
          *,
          venues(name, city)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles separately since there might be RLS restrictions
      const userIds = data?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      // Merge profiles with venue managers
      return data?.map(manager => ({
        ...manager,
        profile: profiles?.find(p => p.id === manager.user_id)
      }));
    },
    enabled: isAdmin,
  });

  // Generate strong password
  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
    return password;
  };

  // Create venue manager mutation using edge function
  const createManagerMutation = useMutation({
    mutationFn: async () => {
      // Validate with Zod schema
      const validationResult = venueManagerSchema.safeParse({
        email,
        fullName,
        venueId: selectedVenueId,
        password: generatedPassword,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

      // Get current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to create venue managers");
      }

      const { data, error } = await supabase.functions.invoke('create-venue-manager', {
        body: {
          email: validationResult.data.email,
          fullName: validationResult.data.fullName,
          venueId: validationResult.data.venueId,
          password: validationResult.data.password
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      
      return { email: validationResult.data.email, password: validationResult.data.password };
    },
    onSuccess: (data) => {
      toast.success("Venue Manager Created", {
        description: `Email: ${data.email}\nPassword: ${data.password}\n\nMake sure to share these credentials securely!`,
        duration: 10000,
      });
      queryClient.invalidateQueries({ queryKey: ["venue-managers-list"] });
      
      // Reset form
      setEmail("");
      setFullName("");
      setSelectedVenueId("");
      setGeneratedPassword("");
    },
    onError: (error: any) => {
      toast.error("Failed to create venue manager", {
        description: error.message,
      });
    },
  });

  // Delete venue manager mutation
  const deleteManagerMutation = useMutation({
    mutationFn: async (managerId: string) => {
      const { error } = await supabase
        .from("venue_managers")
        .delete()
        .eq("id", managerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venue manager removed successfully");
      queryClient.invalidateQueries({ queryKey: ["venue-managers-list"] });
    },
    onError: (error: any) => {
      toast.error("Failed to remove venue manager", {
        description: error.message,
      });
    },
  });

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-8 flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-4xl font-bold mb-1">Venue Manager Assignment</h1>
              <p className="text-muted-foreground">Create and manage venue manager accounts</p>
            </div>
          </div>

          {/* Create New Manager Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Venue Manager
              </CardTitle>
              <CardDescription>
                Assign a new manager to a venue with auto-generated secure credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="manager@venue.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues?.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name} - {venue.city}
                        </SelectItem>
                      ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Generated Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type="text"
                      value={generatedPassword}
                      readOnly
                      placeholder="Click generate"
                      className="font-mono text-sm"
                    />
                    <Button type="button" onClick={generatePassword} variant="outline">
                      Generate
                    </Button>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => createManagerMutation.mutate()}
                disabled={createManagerMutation.isPending || !email || !fullName || !selectedVenueId || !generatedPassword}
                className="mt-6"
              >
                {createManagerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Venue Manager
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Managers Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Existing Venue Managers
              </CardTitle>
              <CardDescription>
                View and manage all venue manager assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : venueManagers && venueManagers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Manager Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {venueManagers.map((manager) => (
                      <TableRow key={manager.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {manager.profile?.full_name || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>{manager.profile?.email || "N/A"}</TableCell>
                        <TableCell>{(manager.venues as any)?.name || "N/A"}</TableCell>
                        <TableCell>{(manager.venues as any)?.city || "N/A"}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Venue Manager?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove manager access for {manager.profile?.full_name} from {(manager.venues as any)?.name}. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteManagerMutation.mutate(manager.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No venue managers assigned yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VenueManagerAssignment;
