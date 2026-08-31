import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Building2, 
  Users, 
  Calendar, 
  UserPlus, 
  MapPin,
  Loader2,
  ChevronRight,
  Shield,
  Activity
} from "lucide-react";
import { toast } from "sonner";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(user);

  // Check if user has admin role - wait for both loading states to complete
  useEffect(() => {
    // Don't do anything while still loading
    if (authLoading || roleLoading) {
      return;
    }
    
    // Only redirect if we have finished loading
    if (!user) {
      navigate("/super-admin-login");
      return;
    }
    
    // Only deny access if role check completed and isAdmin is explicitly false
    if (isAdmin === false) {
      toast.error("Access Denied", {
        description: "Only administrators can access this page.",
      });
      navigate("/");
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: async () => {
      const [venues, managers, bookings, users] = await Promise.all([
        supabase.from("venues").select("id", { count: "exact" }),
        supabase.from("venue_managers").select("id", { count: "exact" }),
        supabase.from("bookings").select("id", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
      ]);
      
      return {
        venues: venues.count || 0,
        managers: managers.count || 0,
        bookings: bookings.count || 0,
        users: users.count || 0,
      };
    },
    enabled: !!user && isAdmin,
  });

  // Fetch recent bookings
  const { data: recentBookings } = useQuery({
    queryKey: ["super-admin-recent-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          pitches(name, venues(name, city)),
          teams(name),
          profiles:user_id(full_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // Fetch all venues
  const { data: venues } = useQuery({
    queryKey: ["super-admin-venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // Fetch venue managers with details
  const { data: venueManagers } = useQuery({
    queryKey: ["super-admin-venue-managers"],
    queryFn: async () => {
      // First get venue managers
      const { data: managers, error: managersError } = await supabase
        .from("venue_managers")
        .select(`
          *,
          venues(name, city)
        `)
        .order("created_at", { ascending: false });
      
      if (managersError) throw managersError;
      
      // Then get profile info for each manager using the find_user_by_email function or direct lookup
      // Admins can view all profiles via RLS policy
      const managersWithProfiles = await Promise.all(
        (managers || []).map(async (manager) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", manager.user_id)
            .single();
          
          return {
            ...manager,
            profiles: profile
          };
        })
      );
      
      return managersWithProfiles;
    },
    enabled: !!user && isAdmin,
  });

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
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-6 h-6 text-primary" />
                <Badge variant="default" className="bg-primary">Super Admin</Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Full control over the Paizeis platform</p>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => navigate("/venue-manager-assignment")} variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Manager
              </Button>
              <Button onClick={() => navigate("/admin/venues")} variant="outline">
                <Building2 className="w-4 h-4 mr-2" />
                Manage Venues
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.venues || 0}</p>
                    <p className="text-xs text-muted-foreground">Venues</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Users className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.managers || 0}</p>
                    <p className="text-xs text-muted-foreground">Managers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.bookings || 0}</p>
                    <p className="text-xs text-muted-foreground">Bookings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Activity className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.users || 0}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="bookings" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
              <TabsTrigger value="bookings">Recent Bookings</TabsTrigger>
              <TabsTrigger value="managers">Venue Managers</TabsTrigger>
              <TabsTrigger value="venues">Venues</TabsTrigger>
            </TabsList>

            <TabsContent value="bookings">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Bookings</CardTitle>
                  <CardDescription>Latest bookings across all venues</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Venue</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentBookings?.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{(booking.profiles as any)?.full_name || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">{(booking.profiles as any)?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{(booking.pitches as any)?.venues?.name || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">{(booking.pitches as any)?.name}</p>
                              </div>
                            </TableCell>
                            <TableCell>{booking.booking_date}</TableCell>
                            <TableCell>{booking.start_time} - {booking.end_time}</TableCell>
                            <TableCell>
                              <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                                {booking.status}
                              </Badge>
                            </TableCell>
                            <TableCell>€{booking.total_amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="managers">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Venue Managers</CardTitle>
                    <CardDescription>All assigned venue managers</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/venue-manager-assignment")}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Manager
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Venue</TableHead>
                          <TableHead>City</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {venueManagers?.map((manager) => (
                          <TableRow key={manager.id}>
                            <TableCell className="font-medium">
                              {(manager.profiles as any)?.full_name || "N/A"}
                            </TableCell>
                            <TableCell>{(manager.profiles as any)?.email || "N/A"}</TableCell>
                            <TableCell>{(manager.venues as any)?.name || "N/A"}</TableCell>
                            <TableCell>{(manager.venues as any)?.city || "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="venues">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>All Venues</CardTitle>
                    <CardDescription>Manage all registered venues</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/admin/venues")}>
                    <Building2 className="w-4 h-4 mr-2" />
                    Manage Venues
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {venues?.slice(0, 9).map((venue) => (
                      <Card key={venue.id} className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold">{venue.name}</h3>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {venue.city}
                              </div>
                              {venue.google_rating && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-yellow-500">★</span>
                                  <span className="text-sm">{venue.google_rating}</span>
                                </div>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
