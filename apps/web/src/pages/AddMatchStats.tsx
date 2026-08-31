import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, TrendingUp } from "lucide-react";

const AddMatchStats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [cleanSheet, setCleanSheet] = useState(false);
  const [matchResult, setMatchResult] = useState<"win" | "loss" | "draw">("draw");

  useEffect(() => {
    if (user) {
      fetchUserBookings();
      fetchUserTeams();
    }
  }, [user]);

  const fetchUserBookings = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("bookings")
      .select(`
        *,
        pitches(name, venues(name))
      `)
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .order("booking_date", { ascending: false })
      .limit(20);

    if (data) setBookings(data);
  };

  const fetchUserTeams = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("team_roster")
      .select("teams(id, name)")
      .eq("user_id", user.id);

    if (data) {
      const uniqueTeams = data
        .map((item: any) => item.teams)
        .filter((team: any) => team !== null);
      setTeams(uniqueTeams);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBooking || !selectedTeam) {
      toast.error("Please select a match and team");
      return;
    }

    setLoading(true);

    try {
      const booking = bookings.find((b) => b.id === selectedBooking);
      
      // Insert match stats
      const { error: matchStatsError } = await supabase
        .from("match_stats")
        .insert({
          user_id: user.id,
          team_id: selectedTeam,
          booking_id: selectedBooking,
          match_date: booking.booking_date,
          goals: goals,
          assists: assists,
          clean_sheet: cleanSheet,
        });

      if (matchStatsError) throw matchStatsError;

      // Fetch current player stats
      const { data: currentStats } = await supabase
        .from("player_stats")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Update player stats
      const { error: playerStatsError } = await supabase
        .from("player_stats")
        .update({
          total_matches: (currentStats?.total_matches || 0) + 1,
          wins: matchResult === "win" ? (currentStats?.wins || 0) + 1 : currentStats?.wins || 0,
          losses: matchResult === "loss" ? (currentStats?.losses || 0) + 1 : currentStats?.losses || 0,
          goals: (currentStats?.goals || 0) + goals,
          assists: (currentStats?.assists || 0) + assists,
          clean_sheets: cleanSheet ? (currentStats?.clean_sheets || 0) + 1 : currentStats?.clean_sheets || 0,
        })
        .eq("user_id", user.id);

      if (playerStatsError) throw playerStatsError;

      toast.success("Match stats recorded successfully!");
      navigate("/stats");
    } catch (error: any) {
      console.error("Error recording stats:", error);
      toast.error(error.message || "Failed to record stats");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Add Match Stats</h1>
          <p className="text-muted-foreground mb-8">Please sign in to record your match stats.</p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Add Match Stats</h1>
            <p className="text-muted-foreground">
              Record your performance statistics after a match
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Match Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="booking">Select Match</Label>
                  <Select value={selectedBooking} onValueChange={setSelectedBooking}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a recent booking" />
                    </SelectTrigger>
                    <SelectContent>
                      {bookings.map((booking) => (
                        <SelectItem key={booking.id} value={booking.id}>
                          {booking.pitches?.venues?.name} - {booking.booking_date} at {booking.start_time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team">Select Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="goals">Goals Scored</Label>
                    <Input
                      id="goals"
                      type="number"
                      min="0"
                      value={goals}
                      onChange={(e) => setGoals(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assists">Assists</Label>
                    <Input
                      id="assists"
                      type="number"
                      min="0"
                      value={assists}
                      onChange={(e) => setAssists(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="result">Match Result</Label>
                  <Select value={matchResult} onValueChange={(v: any) => setMatchResult(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="win">Win</SelectItem>
                      <SelectItem value="loss">Loss</SelectItem>
                      <SelectItem value="draw">Draw</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="cleanSheet"
                    checked={cleanSheet}
                    onCheckedChange={setCleanSheet}
                  />
                  <Label htmlFor="cleanSheet">Clean Sheet (no goals conceded)</Label>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Record Stats
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/stats")}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AddMatchStats;
