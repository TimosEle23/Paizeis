import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Target, Users, TrendingUp, Search, Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

const StatsPage = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"players" | "teams" | "matches">("players");
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  useEffect(() => {
    if (playerId) {
      fetchPlayerDetails(playerId);
    }
  }, [playerId]);

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select(`
        *,
        player_stats(*)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      const playersWithStats = data.filter(p => p.player_stats && p.player_stats.length > 0);
      setPlayers(playersWithStats);
      if (!playerId && playersWithStats.length > 0) {
        setSelectedPlayer(playersWithStats[0]);
      }
    }
  };

  const fetchPlayerDetails = async (id: string) => {
    const { data } = await supabase
      .from('profiles')
      .select(`
        *,
        player_stats(*)
      `)
      .eq('id', id)
      .single();
    
    if (data) setSelectedPlayer(data);
  };

  const filteredPlayers = players.filter(p =>
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topScorers = [...players]
    .sort((a, b) => (b.player_stats?.[0]?.goals || 0) - (a.player_stats?.[0]?.goals || 0))
    .slice(0, 10);

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'NA';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-4">Player Statistics</h1>
              <p className="text-muted-foreground">
                Track your performance and compare with other players
              </p>
            </div>
            <Button onClick={() => navigate("/add-match-stats")} className="gap-2">
              <Plus className="w-4 h-4" />
              Prosthiki Statistikon
            </Button>
          </div>

          <Tabs value={selectedTab} onValueChange={(v: any) => setSelectedTab(v)} className="mb-8">
            <TabsList>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="matches">Matches</TabsTrigger>
            </TabsList>

            <TabsContent value="players" className="space-y-6">
              {/* Search */}
              <Card>
                <CardContent className="pt-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search players..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Player List */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle>All Players</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredPlayers.map((player) => (
                      <Button
                        key={player.id}
                        variant={selectedPlayer?.id === player.id ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3"
                        onClick={() => {
                          setSelectedPlayer(player);
                          navigate(`/stats/${player.id}`);
                        }}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={player.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {getInitials(player.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{player.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.player_stats?.[0]?.goals || 0} goals
                          </p>
                        </div>
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                {/* Player Details */}
                {selectedPlayer && (
                  <div className="lg:col-span-2 space-y-6">
                    {/* Player Overview */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={selectedPlayer.avatar_url} />
                            <AvatarFallback className="text-xl">
                              {getInitials(selectedPlayer.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle>{selectedPlayer.full_name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {selectedPlayer.location || "Location not set"}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {selectedPlayer.player_stats?.[0]?.total_matches || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Matches</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-success">
                              {selectedPlayer.player_stats?.[0]?.wins || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Wins</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-warning">
                              {selectedPlayer.player_stats?.[0]?.goals || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Goals</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">
                              {selectedPlayer.player_stats?.[0]?.total_matches > 0
                                ? Math.round((selectedPlayer.player_stats[0].wins / selectedPlayer.player_stats[0].total_matches) * 100)
                                : 0}%
                            </div>
                            <div className="text-sm text-muted-foreground">Win Rate</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Performance Metrics */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Goals</p>
                              <p className="text-3xl font-bold text-warning">
                                {selectedPlayer.player_stats?.[0]?.goals || 0}
                              </p>
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
                              <p className="text-3xl font-bold text-info">
                                {selectedPlayer.player_stats?.[0]?.assists || 0}
                              </p>
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
                              <p className="text-3xl font-bold text-success">
                                {selectedPlayer.player_stats?.[0]?.clean_sheets || 0}
                              </p>
                            </div>
                            <Trophy className="w-12 h-12 text-success opacity-20" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Losses</p>
                              <p className="text-3xl font-bold text-destructive">
                                {selectedPlayer.player_stats?.[0]?.losses || 0}
                              </p>
                            </div>
                            <TrendingUp className="w-12 h-12 text-destructive opacity-20" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>

              {/* Leaderboard */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Top Goal Scorers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topScorers.map((player, index) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedPlayer(player);
                          navigate(`/stats/${player.id}`);
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {index + 1}
                        </div>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={player.avatar_url} />
                          <AvatarFallback>{getInitials(player.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold">{player.full_name}</p>
                          <p className="text-sm text-muted-foreground">{player.location || "Cyprus"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-warning">
                            {player.player_stats?.[0]?.goals || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">goals</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teams">
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  Team statistics coming soon...
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="matches">
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  Match statistics coming soon...
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
