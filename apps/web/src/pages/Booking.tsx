import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Clock, Users, CreditCard, Target, Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bookingSchema } from "@/lib/validationSchemas";
import bookingBgDesktop from "@/assets/booking_bg_desktop.jpg.asset.json";
import bookingBgMobile from "@/assets/booking_bg_mobile.jpg.asset.json";

const cardClass = "bg-black/85 border-white/15 text-white backdrop-blur-sm";
const titleClass = "flex items-center gap-2 font-mono text-primary tracking-wide";


const Booking = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [selectedPitchType, setSelectedPitchType] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<any>(null);
  const [availablePitchTypes, setAvailablePitchTypes] = useState<string[]>([]);
  const [availablePitches, setAvailablePitches] = useState<any[]>([]);
  const [venue, setVenue] = useState<any>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [userTeams, setUserTeams] = useState<any[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [teammates, setTeammates] = useState<string[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [teamRoster, setTeamRoster] = useState<any[]>([]);
  const [selectedRosterMember, setSelectedRosterMember] = useState<string>("");

  const durationOptions = [
    { hours: 1, label: "1 hr, 0 min", multiplier: 1 },
    { hours: 1.5, label: "1 hr, 30 min", multiplier: 1.5 },
    { hours: 2, label: "2 hr, 0 min", multiplier: 2 },
  ];

  // Fetch venue and available pitch types
  useEffect(() => {
    const fetchVenueData = async () => {
      const { data: venueData } = await supabase
        .from('venues')
        .select('*')
        .eq('id', venueId)
        .single();
      
      if (venueData) {
        setVenue(venueData);
        
        // Get unique pitch types for this venue
        const { data: pitches } = await supabase
          .from('pitches')
          .select('pitch_type')
          .eq('venue_id', venueId)
          .eq('is_available', true);
        
        if (pitches) {
          const types = [...new Set(pitches.map(p => p.pitch_type))]
            .filter(type => ["5v5", "7v7", "9v9", "11v11", "futsal"].includes(type.toLowerCase()));
          setAvailablePitchTypes(types);
        }
      }
    };
    
    if (venueId) fetchVenueData();
  }, [venueId]);

  // Fetch user's teams
  useEffect(() => {
    const fetchUserTeams = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: teams } = await supabase
        .from('team_roster')
        .select('team_id, teams(id, name)')
        .eq('user_id', user.id);

      if (teams) {
        const uniqueTeams = teams
          .filter((t: any) => t.teams)
          .map((t: any) => t.teams);
        setUserTeams(uniqueTeams);
      }
    };

    fetchUserTeams();
  }, []);

  // Fetch team roster when team is selected
  useEffect(() => {
    const fetchTeamRoster = async () => {
      if (!selectedTeamId) {
        setTeamRoster([]);
        return;
      }

      const { data: roster } = await supabase
        .from('team_roster')
        .select('user_id, profiles(id, full_name, email)')
        .eq('team_id', selectedTeamId);

      if (roster) {
        const members = roster
          .filter((r: any) => r.profiles)
          .map((r: any) => r.profiles);
        setTeamRoster(members);
      }
    };

    fetchTeamRoster();
  }, [selectedTeamId]);

  // Fetch pitches when pitch type is selected
  useEffect(() => {
    const fetchPitches = async () => {
      if (!selectedPitchType) {
        setAvailablePitches([]);
        return;
      }
      
      const { data } = await supabase
        .from('pitches')
        .select('*')
        .eq('venue_id', venueId)
        .eq('pitch_type', selectedPitchType)
        .eq('is_available', true);
      
      if (data) setAvailablePitches(data);
    };
    
    fetchPitches();
  }, [selectedPitchType, venueId]);

  // Generate time slots based on selected duration
  const generateTimeSlots = (duration: number) => {
    const slots = [];
    const startHour = 9;
    const endHour = 21;
    
    // Mock unavailable slots (hour-based for simplicity)
    const unavailableHours = [11, 13, 16, 20];
    
    for (let hour = startHour; hour <= endHour - duration; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endMinutes = (hour + duration) % 1 === 0 ? '00' : '30';
      const endHour = Math.floor(hour + duration);
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinutes}`;
      
      // Check if any hour in the duration is unavailable
      const isAvailable = !Array.from({ length: Math.ceil(duration) }, (_, i) => hour + i)
        .some(h => unavailableHours.includes(h));
      
      slots.push({
        time: `${startTime} - ${endTime}`,
        available: isAvailable
      });
    }
    
    return slots;
  };

  const timeSlots = generateTimeSlots(selectedDuration);

  const handleAddRosterMember = () => {
    if (!selectedRosterMember) return;

    const member = teamRoster.find(m => m.id === selectedRosterMember);
    if (!member) return;

    // Check if already added
    if (teammates.includes(member.email)) {
      toast.warning(`${member.full_name} is already added to this booking`);
      return;
    }

    setTeammates([...teammates, member.email]);
    setSelectedRosterMember("");
    toast.success(`${member.full_name} added to booking!`);
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    try {
      setIsCreatingTeam(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create a team");
        return;
      }

      // Create the new team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: newTeamName.trim(),
          captain_id: user.id,
          member_count: 1
        })
        .select()
        .single();

      if (teamError) {
        toast.error("Failed to create team");
        console.error(teamError);
        return;
      }

      // Add the user to the team roster
      const { error: rosterError } = await supabase
        .from('team_roster')
        .insert({
          team_id: team.id,
          user_id: user.id,
          is_captain: true
        });

      if (rosterError) {
        console.error("Failed to add to roster:", rosterError);
      }

      // Refresh the teams list
      const { data: teams } = await supabase
        .from('team_roster')
        .select('team_id, teams(id, name)')
        .eq('user_id', user.id);

      if (teams) {
        const uniqueTeams = teams
          .filter((t: any) => t.teams)
          .map((t: any) => t.teams);
        setUserTeams(uniqueTeams);
        setSelectedTeamId(team.id);
      }

      toast.success(`Team "${team.name}" created successfully!`);
      setNewTeamName("");
      setShowCreateTeamDialog(false);
    } catch (error: any) {
      toast.error("Failed to create team");
      console.error(error);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleAddTeammate = async () => {
    try {
      const selectedTeam = userTeams.find(t => t.id === selectedTeamId);
      const validatedData = bookingSchema.parse({
        teamName: selectedTeam?.name || "Team",
        playerName: playerName,
      });
      
      const playerInput = validatedData.playerName.trim();
      
      // Check if input is an email or just a name
      const isEmail = playerInput.includes('@');
      
      if (isEmail) {
        // Get current user info
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("You must be logged in to send invitations");
          return;
        }

        // Get current user's profile
        const { data: inviterProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        // Get invitee profile by email
        const { data: inviteeProfile } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('email', playerInput)
          .single();

        if (inviteeProfile) {
          const selectedTeam = userTeams.find(t => t.id === selectedTeamId);
          // Send email invitation with match details
          const { error: inviteError } = await supabase.functions.invoke('send-invitation', {
            body: {
              inviteeEmail: inviteeProfile.email,
              inviteeName: inviteeProfile.full_name,
              teamName: selectedTeam?.name || "Team",
              inviterName: inviterProfile?.full_name || "Someone",
              matchDate: selectedDate?.toLocaleDateString(),
              matchTime: selectedSlot || undefined,
              venueName: venue?.name || undefined,
            }
          });

          if (inviteError) {
            console.error('Error sending invitation email:', inviteError);
            toast.error("Could not send email invitation. Please verify your email domain in Resend.");
          } else {
            toast.success(`Email invitation sent to ${inviteeProfile.full_name}!`);
          }
        } else {
          toast.warning(`Email sent to ${playerInput} (user not found in database)`);
        }
      }
      
      setTeammates([...teammates, playerInput]);
      setPlayerName("");
      
      if (!isEmail) {
        toast.success(`${playerInput} added to team!`);
      }
    } catch (error: any) {
      const message = error.errors?.[0]?.message || "Please enter a valid player name.";
      toast.error(message);
    }
  };

  const handleReserve = async () => {
    if (!selectedSlot || !selectedPitch) {
      toast.error("Please select a pitch and time slot");
      return;
    }

    if (!selectedTeamId) {
      toast.error("Please select a team");
      return;
    }
    
    if (teammates.length === 0) {
      toast.error("Please add at least one teammate");
      return;
    }
    
    if (teammates.length > 7) {
      toast.error("Team can have maximum 7 players");
      return;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to make a booking");
        return;
      }

      const totalAmount = selectedPitch.price_per_hour * selectedDuration;
      const depositAmount = totalAmount * 0.15; // 15% deposit

      // Create booking in database
      const [startTime, endTime] = selectedSlot.split(' - ');
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          booking_date: selectedDate?.toISOString().split('T')[0],
          start_time: startTime,
          end_time: endTime,
          pitch_id: selectedPitch.id,
          team_id: selectedTeamId,
          total_amount: totalAmount,
          deposit_amount: depositAmount,
          status: 'pending'
        })
        .select()
        .single();

      if (bookingError) {
        toast.error("Failed to create booking");
        console.error(bookingError);
        return;
      }

      // Redirect to Stripe payment link with booking ID
      toast.success("Booking created! Redirecting to payment...");
      window.location.href = `https://book.stripe.com/test_7sY8wP0WH2r0chV3T8cs800?client_reference_id=${booking.id}`;
      
    } catch (error: any) {
      const message = error.errors?.[0]?.message || "Please enter a valid team name.";
      toast.error(message);
    }
  };

  const steps = [
    { label: "PITCH TYPE", done: !!selectedPitchType },
    { label: "PITCH", done: !!selectedPitch },
    { label: "DATE & TIME", done: !!selectedSlot },
    { label: "TEAM", done: !!selectedTeamId },
  ];

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Pixel-art backgrounds: landscape on desktop, portrait on mobile */}
      <div className="fixed inset-0 z-0">
        <img
          src={bookingBgMobile.url}
          alt=""
          aria-hidden="true"
          className="md:hidden w-full h-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
        <img
          src={bookingBgDesktop.url}
          alt=""
          aria-hidden="true"
          className="hidden md:block w-full h-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 font-mono text-primary hover:text-primary hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Venues
          </Button>

          {/* Compact black progress strip */}
          <div className="mb-6 inline-flex flex-wrap items-center gap-2 rounded-md border border-white/15 bg-black/85 px-3 py-2 font-mono text-[11px] tracking-widest">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                {i > 0 && <span className="text-white/25">/</span>}
                <span className={step.done ? "text-primary" : "text-white/45"}>
                  {String(i + 1).padStart(2, "0")} {step.label}
                </span>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Date & Time Selection */}
            <div className="lg:col-span-2 space-y-6">
              {/* Pitch Type Selection */}
              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className={titleClass}>
                    <Target className="w-5 h-5 text-primary" />
                    Select Pitch Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {availablePitchTypes.map((type) => (
                      <Button
                        key={type}
                        variant={selectedPitchType === type ? "default" : "outline"}
                        onClick={() => {
                          setSelectedPitchType(type);
                          setSelectedPitch(null);
                        }}
                        className="h-20 flex flex-col gap-1"
                      >
                        <span className="text-lg font-bold">{type.toUpperCase()}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pitch Selection */}
              {selectedPitchType && availablePitches.length > 0 && (
                <Card className={cardClass}>
                  <CardHeader>
                    <CardTitle className={titleClass}>Select Pitch</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availablePitches.map((pitch) => (
                        <Button
                          key={pitch.id}
                          variant={selectedPitch?.id === pitch.id ? "default" : "outline"}
                          onClick={() => setSelectedPitch(pitch)}
                          className="h-auto p-4 flex flex-col items-start gap-2"
                        >
                          <span className="font-semibold">{pitch.name}</span>
                          <span className="text-sm">€{pitch.price_per_hour}/hour</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className={titleClass}>
                    <Clock className="w-5 h-5 text-primary" />
                    Select Date & Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border border-white/15 bg-black/60"
                      disabled={(date) => date < new Date()}
                    />
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Select Duration</h3>
                    <div className="space-y-2">
                      {durationOptions.map((option) => (
                        <Button
                          key={option.hours}
                          variant={selectedDuration === option.hours ? "default" : "outline"}
                          onClick={() => setSelectedDuration(option.hours)}
                          className="w-full h-auto py-4 flex items-center justify-between"
                        >
                          <span className="font-medium">{option.label}</span>
                          <span className="font-semibold">
                            €{selectedPitch ? (selectedPitch.price_per_hour * option.multiplier).toFixed(2) : (45 * option.multiplier).toFixed(2)}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Available Time Slots</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {timeSlots.map((slot) => (
                        <Button
                          key={slot.time}
                          variant={selectedSlot === slot.time ? "default" : "outline"}
                          disabled={!slot.available}
                          onClick={() => slot.available && setSelectedSlot(slot.time)}
                          className={`${
                            !slot.available
                              ? "border-destructive text-destructive opacity-50"
                              : slot.time === selectedSlot
                              ? ""
                              : "border-success text-success hover:bg-success hover:text-success-foreground"
                          }`}
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-success" />
                        <span>Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-destructive" />
                        <span>Booked</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className={titleClass}>
                    <Users className="w-5 h-5 text-primary" />
                    Team Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Team Name</Label>
                    <div className="flex gap-2">
                      <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                        <SelectTrigger id="teamName" className="flex-1">
                          <SelectValue placeholder="Select your team" />
                        </SelectTrigger>
                        <SelectContent>
                          {userTeams.length === 0 ? (
                            <SelectItem value="no-teams" disabled>
                              No teams yet - create one!
                            </SelectItem>
                          ) : (
                            userTeams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      
                      <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" title="Create new team">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create New Team</DialogTitle>
                            <DialogDescription>
                              Create a new team for your booking. You'll be set as the team captain.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="newTeamName">Team Name</Label>
                              <Input
                                id="newTeamName"
                                placeholder="Enter team name (e.g., Warriors FC)"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowCreateTeamDialog(false);
                                setNewTeamName("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleCreateTeam}
                              disabled={isCreatingTeam || !newTeamName.trim()}
                            >
                              {isCreatingTeam ? "Creating..." : "Create Team"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Add Team Members</Label>
                    
                    {/* Quick add from team roster */}
                    {selectedTeamId && teamRoster.length > 0 && (
                      <div className="space-y-2 p-3 border border-white/15 rounded-md bg-white/5">
                        <Label htmlFor="rosterMember" className="text-sm text-white/60">
                          From Team Roster
                        </Label>
                        <div className="flex gap-2">
                          <Select value={selectedRosterMember} onValueChange={setSelectedRosterMember}>
                            <SelectTrigger id="rosterMember" className="flex-1 bg-background">
                              <SelectValue placeholder="Select team member" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {teamRoster
                                .filter(member => !teammates.includes(member.email))
                                .map((member) => (
                                  <SelectItem key={member.id} value={member.id}>
                                    {member.full_name} ({member.email})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            onClick={handleAddRosterMember}
                            disabled={!selectedRosterMember}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Manual add by name or email */}
                    <div className="space-y-2">
                      <Label htmlFor="playerName" className="text-sm text-white/60">
                        Or add by name/email (Max 7 players)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="playerName"
                          placeholder="Teammate name or email"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddTeammate()}
                          disabled={teammates.length >= 7}
                        />
                        <Button onClick={handleAddTeammate} disabled={teammates.length >= 7}>
                          Add
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-white/50">
                      {teammates.length}/7 players added
                    </p>
                  </div>

                  {teammates.length > 0 && (
                    <div>
                      <Label>Your Team ({teammates.length}/7)</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {teammates.map((teammate, index) => (
                          <Badge key={index} variant="secondary">
                            {teammate}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Booking Summary */}
            <div className="lg:col-span-1">
              <Card className={`sticky top-24 ${cardClass}`}>
                <CardHeader>
                  <CardTitle className={titleClass}>Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Venue</span>
                      <span className="font-medium">{venue?.name || "Loading..."}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Pitch Type</span>
                      <span className="font-medium">{selectedPitchType?.toUpperCase() || "Not selected"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Pitch</span>
                      <span className="font-medium">{selectedPitch?.name || "Not selected"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Date</span>
                      <span className="font-medium">
                        {selectedDate?.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Time</span>
                      <span className="font-medium">{selectedSlot || "Not selected"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Duration</span>
                      <span className="font-medium">
                        {durationOptions.find(d => d.hours === selectedDuration)?.label}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Team</span>
                      <span className="font-medium">
                        {userTeams.find(t => t.id === selectedTeamId)?.name || "Not set"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Players</span>
                      <span className="font-medium">{teammates.length}/7</span>
                    </div>
                  </div>

                  <div className="border-t border-white/15 pt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/60">Pitch Fee ({selectedDuration}h)</span>
                      <span>€{((selectedPitch?.price_per_hour || 45) * selectedDuration).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Deposit (20%)</span>
                      <span className="text-primary">€{((selectedPitch?.price_per_hour || 45) * selectedDuration * 0.2).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-white/50 mt-2">
                      Reserve now with just 20% deposit
                    </p>
                  </div>

                  <Button
                    className="w-full font-mono shadow-[0_0_25px_hsl(var(--primary)/0.5)]"
                    size="lg"
                    onClick={handleReserve}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Reserve & Pay Deposit
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;
