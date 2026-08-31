import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, UserPlus, Calendar, MapPin, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import Navbar from "@/components/Navbar";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Any Position"];
const CITIES = ["Nicosia", "Limassol", "Larnaca", "Paphos", "Famagusta"];

interface PlayerListing {
  id: string;
  user_id: string;
  listing_type: string;
  position: string | null;
  message: string | null;
  city: string | null;
  available_days: string[] | null;
  is_active: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

const LookingForTeam = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  
  const [matchListings, setMatchListings] = useState<PlayerListing[]>([]);
  const [teamListings, setTeamListings] = useState<PlayerListing[]>([]);
  const [myListings, setMyListings] = useState<PlayerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [listingType, setListingType] = useState<'match' | 'team'>('match');
  const [position, setPosition] = useState("");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    setLoading(true);
    
    // Fetch match listings with profiles
    const { data: matchData } = await supabase
      .from('player_listings')
      .select('*')
      .eq('listing_type', 'match')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Fetch team listings with profiles  
    const { data: teamData } = await supabase
      .from('player_listings')
      .select('*')
      .eq('listing_type', 'team')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Fetch profile data for listings
    const allListings = [...(matchData || []), ...(teamData || [])];
    const userIds = [...new Set(allListings.map(l => l.user_id))];
    
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
      }
    }

    // Attach profiles to listings
    const enrichMatch = (matchData || []).map(l => ({
      ...l,
      profiles: profilesMap[l.user_id]
    }));
    
    const enrichTeam = (teamData || []).map(l => ({
      ...l,
      profiles: profilesMap[l.user_id]
    }));

    setMatchListings(enrichMatch);
    setTeamListings(enrichTeam);

    // Fetch user's own listings
    if (user) {
      const { data: myData } = await supabase
        .from('player_listings')
        .select('*')
        .eq('user_id', user.id);
      
      setMyListings(myData || []);
    }

    setLoading(false);
  };

  const handleDayToggle = (day: string) => {
    setAvailableDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: language === 'el' ? "Απαιτείται σύνδεση" : "Sign in required",
        description: language === 'el' ? "Πρέπει να συνδεθείτε για να δημιουργήσετε αγγελία" : "You need to sign in to create a listing",
      });
      navigate('/auth');
      return;
    }

    if (!city) {
      toast({
        variant: "destructive",
        title: language === 'el' ? "Επιλέξτε πόλη" : "Select a city",
        description: language === 'el' ? "Η πόλη είναι υποχρεωτική" : "City is required",
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('player_listings')
      .insert({
        user_id: user.id,
        listing_type: listingType,
        position: position || null,
        city,
        message: message || null,
        available_days: availableDays.length > 0 ? availableDays : null,
        is_active: true
      });

    setSubmitting(false);

    if (error) {
      console.error('Error creating listing:', error);
      toast({
        variant: "destructive",
        title: language === 'el' ? "Σφάλμα" : "Error",
        description: language === 'el' ? "Αποτυχία δημιουργίας αγγελίας" : "Failed to create listing",
      });
      return;
    }

    toast({
      title: language === 'el' ? "Επιτυχία!" : "Success!",
      description: language === 'el' ? "Η αγγελία σας δημοσιεύτηκε" : "Your listing has been published",
    });

    setDialogOpen(false);
    setPosition("");
    setCity("");
    setMessage("");
    setAvailableDays([]);
    fetchListings();
  };

  const handleDeleteListing = async (listingId: string) => {
    const { error } = await supabase
      .from('player_listings')
      .delete()
      .eq('id', listingId);

    if (error) {
      toast({
        variant: "destructive",
        title: language === 'el' ? "Σφάλμα" : "Error",
        description: language === 'el' ? "Αποτυχία διαγραφής" : "Failed to delete listing",
      });
      return;
    }

    toast({
      title: language === 'el' ? "Διαγράφηκε" : "Deleted",
      description: language === 'el' ? "Η αγγελία διαγράφηκε" : "Listing has been deleted",
    });
    fetchListings();
  };

  const renderListingCard = (listing: PlayerListing) => (
    <Card key={listing.id} className="hover:border-primary/50 transition-colors">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={listing.profiles?.avatar_url || undefined} />
            <AvatarFallback>
              {listing.profiles?.full_name?.substring(0, 2).toUpperCase() || '??'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{listing.profiles?.full_name || 'Unknown Player'}</h3>
              {listing.user_id === user?.id && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteListing(listing.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {listing.position && (
                <Badge variant="secondary">{listing.position}</Badge>
              )}
              {listing.city && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {listing.city}
                </Badge>
              )}
            </div>
            {listing.message && (
              <p className="text-sm text-muted-foreground mt-2">{listing.message}</p>
            )}
            {listing.available_days && listing.available_days.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {listing.available_days.map(day => (
                  <Badge key={day} variant="outline" className="text-xs">
                    {day.substring(0, 3)}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(listing.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            {language === 'el' ? 'Φόρτωση...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {language === 'el' ? 'Ψάχνεις Ομάδα;' : 'Looking for a Team?'}
              </h1>
              <p className="text-muted-foreground">
                {language === 'el' 
                  ? 'Βρες παίκτες για αγώνες ή ομάδες που αναζητούν μέλη'
                  : 'Find players for matches or teams looking for members'}
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  {language === 'el' ? 'Δημιουργία Αγγελίας' : 'Create Listing'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {language === 'el' ? 'Νέα Αγγελία' : 'New Listing'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{language === 'el' ? 'Τύπος' : 'Type'}</Label>
                    <Select value={listingType} onValueChange={(v: 'match' | 'team') => setListingType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="match">
                          {language === 'el' ? 'Ψάχνω αγώνα' : 'Looking for a match'}
                        </SelectItem>
                        <SelectItem value="team">
                          {language === 'el' ? 'Ψάχνω ομάδα' : 'Looking for a team'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{language === 'el' ? 'Πόλη' : 'City'} *</Label>
                    <Select value={city} onValueChange={setCity}>
                      <SelectTrigger>
                        <SelectValue placeholder={language === 'el' ? 'Επιλέξτε πόλη' : 'Select city'} />
                      </SelectTrigger>
                      <SelectContent>
                        {CITIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{language === 'el' ? 'Θέση' : 'Position'}</Label>
                    <Select value={position} onValueChange={setPosition}>
                      <SelectTrigger>
                        <SelectValue placeholder={language === 'el' ? 'Επιλέξτε θέση' : 'Select position'} />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITIONS.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{language === 'el' ? 'Διαθέσιμες μέρες' : 'Available days'}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map(day => (
                        <label key={day} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={availableDays.includes(day)}
                            onCheckedChange={() => handleDayToggle(day)}
                          />
                          {day.substring(0, 3)}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>{language === 'el' ? 'Μήνυμα' : 'Message'}</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={language === 'el' 
                        ? 'Πες κάτι για τον εαυτό σου...' 
                        : 'Tell something about yourself...'}
                      rows={3}
                    />
                  </div>

                  <Button 
                    onClick={handleSubmit} 
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting 
                      ? (language === 'el' ? 'Δημοσίευση...' : 'Publishing...') 
                      : (language === 'el' ? 'Δημοσίευση' : 'Publish')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* My Listings */}
          {user && myListings.length > 0 && (
            <Card className="mb-8 border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">
                  {language === 'el' ? 'Οι Αγγελίες μου' : 'My Listings'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {myListings.map(listing => renderListingCard(listing))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs for Match/Team listings */}
          <Tabs defaultValue="match" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="match" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {language === 'el' ? 'Ψάχνουν Αγώνα' : 'Looking for Match'}
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {language === 'el' ? 'Ψάχνουν Ομάδα' : 'Looking for Team'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="match">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {language === 'el' ? 'Παίκτες που ψάχνουν αγώνα' : 'Players looking for a match'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'el' 
                      ? 'Αυτοί οι παίκτες θέλουν να παίξουν σε έναν αγώνα'
                      : 'These players want to play in a match'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {matchListings.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {matchListings.map(listing => renderListingCard(listing))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>{language === 'el' ? 'Δεν υπάρχουν αγγελίες ακόμα' : 'No listings yet'}</p>
                      <p className="text-sm mt-1">
                        {language === 'el' ? 'Γίνε ο πρώτος!' : 'Be the first one!'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {language === 'el' ? 'Παίκτες που ψάχνουν ομάδα' : 'Players looking for a team'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'el' 
                      ? 'Αυτοί οι παίκτες θέλουν να γίνουν μέλη μιας ομάδας'
                      : 'These players want to become members of a team'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {teamListings.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {teamListings.map(listing => renderListingCard(listing))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>{language === 'el' ? 'Δεν υπάρχουν αγγελίες ακόμα' : 'No listings yet'}</p>
                      <p className="text-sm mt-1">
                        {language === 'el' ? 'Γίνε ο πρώτος!' : 'Be the first one!'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default LookingForTeam;
