import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Calendar, Users, MapPin, Award, Minus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import TournamentBracket from "@/components/TournamentBracket";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Tournaments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [deleteRegistrationId, setDeleteRegistrationId] = useState<string | null>(null);

  const { data: dbTournaments } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*, venues(name)")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: userTeams } = useQuery({
    queryKey: ["user-teams", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("captain_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userRegistrations } = useQuery({
    queryKey: ["user-tournament-registrations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: teams } = await supabase
        .from("teams")
        .select("id")
        .eq("captain_id", user.id);
      
      if (!teams?.length) return [];
      
      const teamIds = teams.map(t => t.id);
      const { data, error } = await supabase
        .from("tournament_teams")
        .select("*, tournaments(name), teams(name)")
        .in("team_id", teamIds);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const registerMutation = useMutation({
    mutationFn: async ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
      const { error } = await supabase
        .from("tournament_teams")
        .insert({
          tournament_id: tournamentId,
          team_id: teamId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team registered successfully!");
      setIsRegistering(false);
      setSelectedTeam("");
      setSelectedTournament(null);
      queryClient.invalidateQueries({ queryKey: ["user-tournament-registrations", user?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to register team");
    },
  });

  const handleRegisterClick = (tournamentId: string) => {
    if (!user) {
      toast.error("Please sign in to register for tournaments");
      navigate("/auth");
      return;
    }
    if (!userTeams || userTeams.length === 0) {
      toast.error("You need to create a team first");
      navigate("/teams");
      return;
    }
    setSelectedTournament(tournamentId);
    setIsRegistering(true);
  };

  const handleRegisterSubmit = () => {
    if (!selectedTeam || !selectedTournament) {
      toast.error("Please select a team");
      return;
    }
    registerMutation.mutate({
      tournamentId: selectedTournament,
      teamId: selectedTeam,
    });
  };

  const unregisterMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from("tournament_teams")
        .delete()
        .eq("id", registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registration cancelled successfully!");
      setDeleteRegistrationId(null);
      queryClient.invalidateQueries({ queryKey: ["user-tournament-registrations", user?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to cancel registration");
    },
  });

  const staticTournaments = [
    {
      id: 3,
      name: "KickOff Winter League 2025/26",
      venue: "Cyprus",
      format: "5v5 Futsal",
      teams: 24,
      maxTeams: 32,
      startDate: "2025/26 Season",
      prize: "League Championship Trophy",
      status: "Open",
      description: "Winter futsal league across Cyprus",
    },
    {
      id: 4,
      name: "APOEL Tournament U13 Boys U15 Girls",
      venue: "PASCAL English School",
      format: "Youth Football",
      teams: 12,
      maxTeams: 16,
      startDate: "Dec 27-29, 2025",
      prize: "Trophy + Medals",
      status: "Open",
      description: "2 Age Categories - U13 Boys and U15 Girls",
    },
    {
      id: 5,
      name: "Mavroudes Coerver Football Tournament 2025",
      venue: "Campeone Sports Center, Olympion",
      format: "Youth Football",
      teams: 32,
      maxTeams: 64,
      startDate: "Jan 10-11, 2026",
      prize: "Trophies + Awards",
      status: "Open",
      description: "20 Age Categories - Youth development tournament",
    },
    {
      id: 6,
      name: "APOEL Nicosia Tournament 2026",
      venue: "PASCAL International Education",
      format: "Youth Football",
      teams: 16,
      maxTeams: 32,
      startDate: "Apr 14-16, 2026",
      prize: "Championship Trophy",
      status: "Open",
      description: "International youth football tournament",
    },
    {
      id: 7,
      name: "Platres Football Tournament 2026",
      venue: "Platres Arena",
      format: "Youth Football",
      teams: 40,
      maxTeams: 64,
      startDate: "May 23 - Jul 6, 2026",
      prize: "Trophies + Medals",
      status: "Open",
      description: "23 Age Categories - Summer mountain tournament",
    },
    {
      id: 8,
      name: "Palaichori Youth Tournament 2026",
      venue: "Michalis Karaolis Stadium",
      format: "Youth Football",
      teams: 16,
      maxTeams: 24,
      startDate: "May 30 - Jun 21, 2026",
      prize: "Trophy + Medals",
      status: "Open",
      description: "4 Age Categories - Traditional village tournament",
    },
    {
      id: 9,
      name: "Omonoia Nicosia Football Tournament 2026",
      venue: "OMONOIA FC Training Center 'Elias Poullos'",
      format: "Youth Football",
      teams: 24,
      maxTeams: 32,
      startDate: "Jun 2-4, 2026",
      prize: "Championship Trophy + Medals",
      status: "Open",
      description: "11 Age Categories - Professional club tournament",
    },
  ];

  const tournaments = dbTournaments?.length ? dbTournaments.map((t, index) => ({
    id: t.id,
    name: t.name,
    venue: t.venues?.name || "TBD",
    format: "Tournament",
    teams: 0,
    maxTeams: t.max_teams || 32,
    startDate: new Date(t.start_date).toLocaleDateString(),
    prize: t.prize || "TBD",
    status: t.status === "upcoming" ? "Open" : t.status === "ongoing" ? "In Progress" : "Closed",
    description: "",
  })) : staticTournaments;

  const leaderboard = [
    { rank: 1, team: "Thunder FC", points: 45, wins: 15, losses: 0 },
    { rank: 2, team: "Green Eagles", points: 42, wins: 14, losses: 1 },
    { rank: 3, team: "City Strikers", points: 39, wins: 13, losses: 2 },
    { rank: 4, team: "United Lions", points: 36, wins: 12, losses: 3 },
    { rank: 5, team: "Coastal FC", points: 33, wins: 11, losses: 4 },
  ];

  const bracketData = [
    {
      name: "Quarter Finals",
      matches: [
        {
          id: 1,
          team1: "Thunder FC",
          team2: "Coastal FC",
          score1: 3,
          score2: 1,
          winner: "Thunder FC",
        },
        {
          id: 2,
          team1: "Green Eagles",
          team2: "United Lions",
          score1: 2,
          score2: 1,
          winner: "Green Eagles",
        },
        {
          id: 3,
          team1: "City Strikers",
          team2: "Phoenix FC",
          score1: 4,
          score2: 2,
          winner: "City Strikers",
        },
        {
          id: 4,
          team1: "Elite United",
          team2: "Victory FC",
          score1: 2,
          score2: 2,
          winner: "Elite United",
        },
      ],
    },
    {
      name: "Semi Finals",
      matches: [
        {
          id: 5,
          team1: "Thunder FC",
          team2: "Green Eagles",
          score1: 2,
          score2: 1,
          winner: "Thunder FC",
        },
        {
          id: 6,
          team1: "City Strikers",
          team2: "Elite United",
          scheduled: "Jun 28, 18:00",
        },
      ],
    },
    {
      name: "Final",
      matches: [
        {
          id: 7,
          team1: "Thunder FC",
          team2: "TBD",
          scheduled: "Jul 5, 20:00",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Tournaments</h1>
            <p className="text-muted-foreground">
              Compete in tournaments and climb the leaderboards
            </p>
          </div>

          <Tabs defaultValue="tournaments" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
              <TabsTrigger value="bracket">Live Bracket</TabsTrigger>
            </TabsList>

            <TabsContent value="tournaments">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Tournaments List */}
                <div className="lg:col-span-2 space-y-6">
                  {/* User's Registrations */}
                  {userRegistrations && userRegistrations.length > 0 && (
                    <div>
                      <h2 className="text-2xl font-bold mb-4">My Tournament Registrations</h2>
                      <div className="space-y-4 mb-6">
                        {userRegistrations.map((registration: any) => (
                          <Card key={registration.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h3 className="font-semibold">{registration.tournaments?.name}</h3>
                                  <p className="text-sm text-muted-foreground">Team: {registration.teams?.name}</p>
                                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>Registered: {new Date(registration.created_at).toLocaleDateString()}</span>
                                    <span>Status: <Badge variant="secondary" className="text-xs">Active</Badge></span>
                                  </div>
                                </div>
                                <Button 
                                  variant="destructive" 
                                  size="icon"
                                  onClick={() => setDeleteRegistrationId(registration.id)}
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <h2 className="text-2xl font-bold">Upcoming Tournaments</h2>
                  {tournaments.map((tournament) => (
                    <Card key={tournament.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-xl mb-2">{tournament.name}</CardTitle>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                {tournament.venue}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                {tournament.startDate}
                              </div>
                              {(tournament as any).description && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {(tournament as any).description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant={tournament.status === "Open" ? "default" : "secondary"}
                          >
                            {tournament.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Format</p>
                            <p className="font-semibold">{tournament.format}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Teams</p>
                            <p className="font-semibold">
                              {tournament.teams}/{tournament.maxTeams}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Prize Pool</p>
                            <p className="font-semibold text-accent">{tournament.prize}</p>
                          </div>
                          <div className="flex items-end">
                            <Button
                              disabled={tournament.status === "Full" || tournament.status === "Closed"}
                              onClick={() => handleRegisterClick(tournament.id as string)}
                              className="w-full"
                            >
                              {tournament.status === "Full" ? "Full" : tournament.status === "Closed" ? "Closed" : "Register Team"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Leaderboard */}
                <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Season Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {leaderboard.map((team) => (
                      <div
                        key={team.rank}
                        className={`p-4 rounded-lg ${
                          team.rank <= 3
                            ? "bg-gradient-pitch border border-primary/20"
                            : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                team.rank === 1
                                  ? "bg-accent text-accent-foreground"
                                  : team.rank === 2
                                  ? "bg-muted text-foreground"
                                  : team.rank === 3
                                  ? "bg-warning text-warning-foreground"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                            >
                              {team.rank}
                            </div>
                            <div>
                              <p className="font-semibold">{team.team}</p>
                            </div>
                          </div>
                          {team.rank <= 3 && (
                            <Award className="w-5 h-5 text-accent" />
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Points</p>
                            <p className="font-bold text-primary">{team.points}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Wins</p>
                            <p className="font-semibold">{team.wins}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Losses</p>
                            <p className="font-semibold">{team.losses}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-lg bg-gradient-accent">
                    <div className="flex items-center gap-3 mb-2">
                      <Trophy className="w-5 h-5 text-accent-foreground" />
                      <p className="font-semibold text-accent-foreground">Top Prize</p>
                    </div>
                    <p className="text-2xl font-bold text-accent-foreground">€2,500</p>
                    <p className="text-sm text-accent-foreground/90">
                      + Championship Trophy
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bracket">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-6 h-6" />
                Athens Summer Cup 2024 - Tournament Bracket
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Follow the live progression of matches
              </p>
            </CardHeader>
            <CardContent>
              <TournamentBracket rounds={bracketData} />
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
        </div>
      </div>

      <Dialog open={isRegistering} onOpenChange={setIsRegistering}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Team for Tournament</DialogTitle>
            <DialogDescription>
              Select which team you want to register for this tournament
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {userTeams?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRegistering(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRegisterSubmit}
                disabled={!selectedTeam || registerMutation.isPending}
                className="flex-1"
              >
                {registerMutation.isPending ? "Registering..." : "Register Team"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRegistrationId} onOpenChange={() => setDeleteRegistrationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Tournament Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this tournament registration? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteRegistrationId && unregisterMutation.mutate(deleteRegistrationId)} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Registration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tournaments;
