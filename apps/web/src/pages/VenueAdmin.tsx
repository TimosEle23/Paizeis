import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Calendar as CalendarIcon, Users, DollarSign, Target, TrendingUp, Settings, ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookingAnalytics } from "@/components/venue-admin/BookingAnalytics";
import { BookingManagement } from "@/components/venue-admin/BookingManagement";
import { MaintenanceBlocking } from "@/components/venue-admin/MaintenanceBlocking";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const VenueAdmin = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedPitchType, setSelectedPitchType] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<any>(null);
  const [availablePitchTypes, setAvailablePitchTypes] = useState<string[]>([]);
  const [availablePitches, setAvailablePitches] = useState<any[]>([]);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);

  // Fetch venues managed by this user
  const { data: managedVenues } = useQuery({
    queryKey: ["managed-venues", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venue_managers")
        .select("venue_id, venues(*)")
        .eq("user_id", user?.id);
      
      if (error) throw error;
      return data?.map(v => v.venues) || [];
    },
    enabled: !!user,
  });

  // Fetch available pitch types for managed venues
  useEffect(() => {
    const fetchPitchTypes = async () => {
      if (!managedVenues?.length) return;
      
      const venueIds = managedVenues.map(v => v.id);
      const { data: pitches } = await supabase
        .from('pitches')
        .select('pitch_type')
        .in('venue_id', venueIds)
        .eq('is_available', true);
      
      if (pitches) {
        const types = [...new Set(pitches.map(p => p.pitch_type))];
        setAvailablePitchTypes(types);
      }
    };
    
    fetchPitchTypes();
  }, [managedVenues]);

  // Fetch pitches when pitch type is selected
  useEffect(() => {
    const fetchPitches = async () => {
      if (!selectedPitchType || !managedVenues?.length) {
        setAvailablePitches([]);
        setSelectedPitch(null);
        return;
      }
      
      const venueIds = managedVenues.map(v => v.id);
      const { data } = await supabase
        .from('pitches')
        .select('*, venues(name)')
        .in('venue_id', venueIds)
        .eq('pitch_type', selectedPitchType)
        .eq('is_available', true);
      
      if (data) setAvailablePitches(data);
    };
    
    fetchPitches();
  }, [selectedPitchType, managedVenues]);

  // Fetch bookings for selected pitch
  const { data: bookings } = useQuery({
    queryKey: ["pitch-bookings", selectedPitch?.id, selectedDate],
    queryFn: async () => {
      if (!selectedPitch?.id) return [];
      
      let query = supabase
        .from("bookings")
        .select(`
          *,
          pitches(*),
          teams(name),
          profiles!bookings_user_id_fkey(full_name)
        `)
        .eq("pitch_id", selectedPitch.id);

      if (selectedDate) {
        const dateStr = selectedDate.toISOString().split('T')[0];
        query = query.eq("booking_date", dateStr);
      }

      const { data, error } = await query.order("start_time");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedPitch?.id,
  });

  // Calculate statistics for all managed venues
  const { data: allBookings } = useQuery({
    queryKey: ["all-venue-bookings", managedVenues],
    queryFn: async () => {
      if (!managedVenues?.length) return [];
      
      const venueIds = managedVenues.map(v => v.id);
      const { data: pitchIds } = await supabase
        .from("pitches")
        .select("id")
        .in("venue_id", venueIds);
      
      if (!pitchIds?.length) return [];
      
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .in("pitch_id", pitchIds.map(p => p.id));
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!managedVenues?.length,
  });

  // Calculate statistics from all bookings
  const totalBookings = allBookings?.length || 0;
  const totalRevenue = allBookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
  const upcomingBookings = allBookings?.filter(b => 
    new Date(b.booking_date) >= new Date() && b.status === "confirmed"
  ).length || 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 container mx-auto px-4">
          <p>Please log in to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-20 md:pt-24 pb-16">
        <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
          {/* Header - Mobile optimized */}
          <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 md:mb-2">Venue Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground">Manage your venue bookings</p>
            </div>
            
            {/* Mobile Calendar Button */}
            <Sheet open={mobileCalendarOpen} onOpenChange={setMobileCalendarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {selectedDate?.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Select Date</SheetTitle>
                </SheetHeader>
                <div className="flex justify-center pt-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setMobileCalendarOpen(false);
                    }}
                    className="rounded-md border"
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Stats Cards - Mobile grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Total Bookings</CardTitle>
                <CalendarIcon className="h-3 w-3 md:h-4 md:w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-xl md:text-2xl font-bold">{totalBookings}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Upcoming</CardTitle>
                <Users className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-xl md:text-2xl font-bold">{upcomingBookings}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-xl md:text-2xl font-bold">€{totalRevenue.toFixed(0)}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Venues</CardTitle>
                <Building2 className="h-3 w-3 md:h-4 md:w-4 text-purple-500" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-xl md:text-2xl font-bold">{managedVenues?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs - Mobile optimized */}
          <Tabs defaultValue="bookings" className="mb-6 md:mb-8">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1">
              <TabsTrigger value="bookings" className="text-xs sm:text-sm py-2 sm:py-2.5">Bookings</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm py-2 sm:py-2.5">Analytics</TabsTrigger>
              <TabsTrigger value="maintenance" className="text-xs sm:text-sm py-2 sm:py-2.5">Maintenance</TabsTrigger>
            </TabsList>

            <TabsContent value="bookings" className="mt-4 md:mt-6">
              <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
                <div className="lg:col-span-2 space-y-4 md:space-y-6">
                  {/* Pitch Type Selection - Collapsible on mobile */}
                  <Collapsible defaultOpen>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                          <CardTitle className="flex items-center justify-between text-base md:text-lg">
                            <span className="flex items-center gap-2">
                              <Target className="w-4 h-4 md:w-5 md:h-5" />
                              Select Pitch Type
                            </span>
                            {selectedPitchType && (
                              <Badge variant="secondary" className="text-xs">{selectedPitchType}</Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                            {availablePitchTypes.map((type) => (
                              <Button
                                key={type}
                                variant={selectedPitchType === type ? "default" : "outline"}
                                onClick={() => {
                                  setSelectedPitchType(type);
                                  setSelectedPitch(null);
                                }}
                                className="h-14 md:h-20 flex flex-col gap-0.5 md:gap-1 text-xs md:text-base"
                              >
                                <span className="text-sm md:text-lg font-bold">{type.toUpperCase()}</span>
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Pitch Selection */}
                  {selectedPitchType && availablePitches.length > 0 && (
                    <Card className="animate-in slide-in-from-top-2 duration-200">
                      <CardHeader className="pb-2 md:pb-4">
                        <CardTitle className="text-base md:text-lg">Select Pitch</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="w-full">
                          <div className="flex gap-2 md:gap-3 pb-2 md:grid md:grid-cols-2">
                            {availablePitches.map((pitch) => (
                              <Button
                                key={pitch.id}
                                variant={selectedPitch?.id === pitch.id ? "default" : "outline"}
                                onClick={() => setSelectedPitch(pitch)}
                                className="h-auto p-3 md:p-4 flex flex-col items-start gap-1 md:gap-2 min-w-[140px] md:min-w-0 shrink-0"
                              >
                                <span className="font-semibold text-xs md:text-sm truncate max-w-full">{pitch.name}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-full">{(pitch.venues as any)?.name}</span>
                                <span className="text-xs md:text-sm font-medium">€{pitch.price_per_hour}/hr</span>
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Bookings for Selected Pitch */}
                  {selectedPitch && (
                    <div className="space-y-3 md:space-y-4 animate-in slide-in-from-bottom-2 duration-200">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-lg md:text-xl font-semibold">
                          {selectedPitch.name}
                        </h2>
                        <Badge variant="outline" className="text-xs md:text-sm">
                          {selectedDate?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        </Badge>
                      </div>
                      <BookingManagement 
                        bookings={bookings || []} 
                        selectedPitch={selectedPitch}
                        selectedDate={selectedDate}
                      />
                    </div>
                  )}
                </div>

                {/* Calendar - Desktop only */}
                <div className="hidden lg:block lg:col-span-1">
                  <Card className="sticky top-24">
                    <CardHeader>
                      <CardTitle>Select Date</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="rounded-md border"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-4 md:mt-6">
              <BookingAnalytics bookings={allBookings || []} />
            </TabsContent>

            <TabsContent value="maintenance" className="mt-4 md:mt-6">
              <MaintenanceBlocking selectedPitch={selectedPitch} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default VenueAdmin;
