import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp, Target, Award, Activity, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Stats = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchPlayerStats();
    }
  }, [user]);

  const fetchPlayerStats = async () => {
    if (!user) return;

    setLoading(true);

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch player stats
    const { data: statsData } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileData) setProfile(profileData);
    if (statsData) setPlayerStats(statsData);
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Player Statistics</h1>
          <p className="text-muted-foreground mb-8">Please sign in to view your stats.</p>
          <Button onClick={() => window.location.href = '/auth'}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const stats = playerStats || {
    goals: 0,
    assists: 0,
    wins: 0,
    losses: 0,
    total_matches: 0,
    clean_sheets: 0
  };

  const totalMatches = stats.total_matches || 1;
  const winRate = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;
  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Player Statistics</h1>
            <p className="text-muted-foreground">
              Track your performance and compare with top players
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Player Card & Stats */}
            <div className="lg:col-span-2 space-y-6">
              {/* Player Overview Card */}
              <Card className="bg-gradient-pitch border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    <Avatar className="w-24 h-24">
                      <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold">{profile?.full_name || 'Player'}</h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Matches</p>
                          <p className="text-2xl font-bold">{stats.total_matches}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Wins</p>
                          <p className="text-2xl font-bold text-success">{stats.wins}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Goals</p>
                          <p className="text-2xl font-bold text-primary">{stats.goals}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Win Rate</p>
                          <p className="text-2xl font-bold">{winRate}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Goals</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{stats.goals}</div>
                    <p className="text-xs text-muted-foreground">
                      {(stats.goals / totalMatches).toFixed(1)} per match
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Assists</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-accent">{stats.assists}</div>
                    <p className="text-xs text-muted-foreground">
                      {(stats.assists / totalMatches).toFixed(1)} per match
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Clean Sheets</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-success">{stats.clean_sheets}</div>
                    <p className="text-xs text-muted-foreground">
                      {totalMatches > 0 ? ((stats.clean_sheets / totalMatches) * 100).toFixed(0) : 0}% of matches
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Losses</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.losses}</div>
                    <p className="text-xs text-muted-foreground">
                      {totalMatches > 0 ? ((stats.losses / totalMatches) * 100).toFixed(0) : 0}% of matches
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;