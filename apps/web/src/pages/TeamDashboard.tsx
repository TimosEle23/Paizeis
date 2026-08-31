import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Mail, Calendar, Trophy, Target, Plus, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";

const TeamDashboard = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [team, setTeam] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [matchStats, setMatchStats] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId && user) {
      fetchTeamData();
    }
  }, [teamId, user]);

  const fetchTeamData = async () => {
    setLoading(true);

    // Fetch team details
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamData) {
      setTeam(teamData);
      
      // Verify user is captain
      if (teamData.captain_id !== user?.id) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "Only team captains can access the dashboard.",
        });
        navigate('/teams');
        return;
      }
    }

    // Fetch roster
    const { data: rosterData } = await supabase
      .from('team_roster')
      .select(`
        *,
        profiles(full_name, email, avatar_url)
      `)
      .eq('team_id', teamId);

    if (rosterData) setRoster(rosterData);

    // Fetch match stats
    const { data: statsData } = await supabase
      .from('match_stats')
      .select(`
        *,
        profiles(full_name),
        bookings(booking_date, start_time, pitches(name, venues(name)))
      `)
      .eq('team_id', teamId)
      .order('match_date', { ascending: false });

    if (statsData) setMatchStats(statsData);

    // Fetch bookings
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(`
        *,
        pitches(name, pitch_type, venues(name, city))
      `)
      .eq('team_id', teamId)
      .order('booking_date', { ascending: false });

    if (bookingsData) setBookings(bookingsData);

    setLoading(false);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !teamId) return;

    // Get current user's full name
    const { data: captainProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user?.id)
      .single();

    // Check if user exists in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', inviteEmail)
      .maybeSingle();

    if (profile) {
      // User exists - check if already a member
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMember) {
        toast({
          variant: "destructive",
          title: "Already Invited",
          description: "This user has already been invited to the team.",
        });
        return;
      }

      // Create team member invitation for existing user
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: profile.id,
          status: 'pending'
        });

      if (error) {
        console.error('Invitation error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to send invitation. Please try again.",
        });
        return;
      }

      // Send email to existing user
      await supabase.functions.invoke('send-invitation', {
        body: {
          inviteeEmail: profile.email,
          inviteeName: profile.full_name,
          teamName: team?.name,
          inviterName: captainProfile?.full_name || user?.email || 'Team Captain',
          isNewUser: false
        }
      });
    } else {
      // User doesn't exist - check for existing email invitation
      const { data: existingInvite } = await supabase
        .from('email_invitations')
        .select('id')
        .eq('email', inviteEmail)
        .eq('team_id', teamId)
        .eq('invitation_type', 'team')
        .maybeSingle();

      if (existingInvite) {
        toast({
          variant: "destructive",
          title: "Already Invited",
          description: "An invitation has already been sent to this email.",
        });
        return;
      }

      // Store pending invitation for non-registered user
      const { error: inviteError } = await supabase
        .from('email_invitations')
        .insert({
          email: inviteEmail,
          team_id: teamId,
          invitation_type: 'team',
          invited_by: user?.id
        });

      if (inviteError) {
        console.error('Email invitation error:', inviteError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create invitation. Please try again.",
        });
        return;
      }

      // Send email with signup invitation
      await supabase.functions.invoke('send-invitation', {
        body: {
          inviteeEmail: inviteEmail,
          inviteeName: inviteEmail.split('@')[0],
          teamName: team?.name,
          inviterName: captainProfile?.full_name || user?.email || 'Team Captain',
          isNewUser: true
        }
      });
    }

    toast({
      title: "Invitation Sent!",
      description: `Invitation sent to ${inviteEmail}`,
    });
    setInviteEmail("");
    setInviteDialogOpen(false);
  };

  const removeFromRoster = async (rosterId: string) => {
    const { error } = await supabase
      .from('team_roster')
      .delete()
      .eq('id', rosterId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove player.",
      });
    } else {
      toast({
        title: "Success",
        description: "Player removed from roster.",
      });
      fetchTeamData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 container mx-auto px-4 text-center">
          <p className="text-muted-foreground">Loading team dashboard...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 container mx-auto px-4 text-center">
          <p className="text-muted-foreground">Team not found.</p>
        </div>
      </div>
    );
  }

  const teamStats = {
    totalMatches: matchStats.length,
    totalGoals: matchStats.reduce((sum, m) => sum + (m.goals || 0), 0),
    totalAssists: matchStats.reduce((sum, m) => sum + (m.assists || 0), 0),
    cleanSheets: matchStats.filter(m => m.clean_sheet).length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-8">
            <Button variant="ghost" onClick={() => navigate('/teams')} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Teams
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">{team.name}</h1>
                <p className="text-muted-foreground">Team Captain Dashboard</p>
              </div>
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <Mail className="w-4 h-4 mr-2" />
                    Invite Player
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Player to {team.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">Player Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="player@example.com"
                      />
                    </div>
                    <Button onClick={sendInvite} className="w-full">
                      Send Invitation
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Team Stats Overview */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Matches</p>
                    <p className="text-3xl font-bold">{teamStats.totalMatches}</p>
                  </div>
                  <Trophy className="w-12 h-12 text-primary opacity-20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Goals</p>
                    <p className="text-3xl font-bold text-warning">{teamStats.totalGoals}</p>
                  </div>
                  <Target className="w-12 h-12 text-warning opacity-20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Assists</p>
                    <p className="text-3xl font-bold text-info">{teamStats.totalAssists}</p>
                  </div>
                  <Users className="w-12 h-12 text-info opacity-20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Clean Sheets</p>
                    <p className="text-3xl font-bold text-success">{teamStats.cleanSheets}</p>
                  </div>
                  <Trophy className="w-12 h-12 text-success opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="roster" className="space-y-6">
            <TabsList>
              <TabsTrigger value="roster">Team Roster</TabsTrigger>
              <TabsTrigger value="stats">Match Statistics</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="roster">
              <Card>
                <CardHeader>
                  <CardTitle>Team Roster ({roster.length} players)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roster.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={member.profiles?.avatar_url} />
                                <AvatarFallback>
                                  {member.profiles?.full_name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{member.profiles?.full_name}</p>
                                <p className="text-sm text-muted-foreground">{member.profiles?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{member.position || "Not set"}</TableCell>
                          <TableCell>
                            <Badge variant={member.is_captain ? "default" : "secondary"}>
                              {member.is_captain ? "Captain" : "Player"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!member.is_captain && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeFromRoster(member.id)}
                              >
                                Remove
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <Card>
                <CardHeader>
                  <CardTitle>Match Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  {matchStats.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead>Goals</TableHead>
                          <TableHead>Assists</TableHead>
                          <TableHead>Clean Sheet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchStats.map((stat) => (
                          <TableRow key={stat.id}>
                            <TableCell>{new Date(stat.match_date).toLocaleDateString()}</TableCell>
                            <TableCell>{stat.profiles?.full_name}</TableCell>
                            <TableCell>{stat.goals || 0}</TableCell>
                            <TableCell>{stat.assists || 0}</TableCell>
                            <TableCell>
                              {stat.clean_sheet ? (
                                <Badge variant="default">Yes</Badge>
                              ) : (
                                <Badge variant="secondary">No</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No match statistics yet. Play matches to see stats here!
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bookings">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Team Bookings</CardTitle>
                    <Button onClick={() => navigate('/booking')}>
                      <Calendar className="w-4 h-4 mr-2" />
                      New Booking
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {bookings.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Venue</TableHead>
                          <TableHead>Pitch</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell>{new Date(booking.booking_date).toLocaleDateString()}</TableCell>
                            <TableCell>{booking.start_time} - {booking.end_time}</TableCell>
                            <TableCell>
                              {booking.pitches?.venues?.name}
                              <p className="text-xs text-muted-foreground">{booking.pitches?.venues?.city}</p>
                            </TableCell>
                            <TableCell>{booking.pitches?.name}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  booking.status === 'confirmed'
                                    ? 'default'
                                    : booking.status === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {booking.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">€{booking.total_amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No bookings yet. Schedule your first match!
                    </p>
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

export default TeamDashboard;
