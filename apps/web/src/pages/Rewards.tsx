import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Flame, Shield, Star, TrendingUp, Award, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
const Rewards = () => {
  const {
    user
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [playerStats, setPlayerStats] = useState<any>(null);
  useEffect(() => {
    if (user) {
      fetchPlayerStats();
    }
  }, [user]);
  const fetchPlayerStats = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch player stats
    const {
      data: statsData
    } = await supabase.from('player_stats').select('*').eq('user_id', user.id).single();
    if (statsData) setPlayerStats(statsData);
    setLoading(false);
  };
  if (!user) {
    return <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4 font-mono">Rewards & Achievements</h1>
          <p className="text-muted-foreground mb-8">Please sign in to view your rewards.</p>
          <Button onClick={() => window.location.href = '/auth'}>Sign In</Button>
        </div>
      </div>;
  }
  if (loading) {
    return <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>;
  }
  const stats = playerStats || {
    goals: 0,
    assists: 0,
    wins: 0,
    losses: 0,
    total_matches: 0,
    clean_sheets: 0
  };

  // Calculate streaks from stats
  const winStreak = stats.wins >= 3 ? Math.min(stats.wins, 12) : 0;
  const cleanSheetStreak = stats.clean_sheets >= 2 ? Math.min(stats.clean_sheets, 7) : 0;
  const scoringStreak = stats.goals >= 5 ? Math.min(Math.floor(stats.goals / 3), 15) : 0;
  const myStreaks = [{
    icon: Flame,
    title: "Winning Streak",
    current: winStreak,
    record: 12,
    color: "text-accent",
    bgColor: "bg-accent/10",
    description: "Consecutive victories"
  }, {
    icon: Shield,
    title: "Clean Sheet Streak",
    current: cleanSheetStreak,
    record: 7,
    color: "text-success",
    bgColor: "bg-success/10",
    description: "Games without conceding"
  }, {
    icon: TrendingUp,
    title: "Scoring Streak",
    current: scoringStreak,
    record: 15,
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "Consecutive games with goals"
  }];
  const achievements = [{
    name: "Hat-Trick Hero",
    description: "Score 3 goals in a match",
    unlocked: stats.goals >= 3,
    rarity: "Rare"
  }, {
    name: "Perfect Week",
    description: "Win all matches in a week",
    unlocked: stats.wins >= 7,
    rarity: "Epic"
  }, {
    name: "Century Club",
    description: "Play 100 matches",
    unlocked: stats.total_matches >= 100,
    progress: Math.min(stats.total_matches / 100 * 100, 100),
    rarity: "Legendary"
  }, {
    name: "Unbeatable",
    description: "Win 10 matches in a row",
    unlocked: stats.wins >= 10,
    progress: Math.min(stats.wins / 10 * 100, 100),
    rarity: "Epic"
  }, {
    name: "Team Player",
    description: "Provide 50 assists",
    unlocked: stats.assists >= 50,
    progress: Math.min(stats.assists / 50 * 100, 100),
    rarity: "Rare"
  }, {
    name: "Goal Machine",
    description: "Score 100 career goals",
    unlocked: stats.goals >= 100,
    progress: Math.min(stats.goals / 100 * 100, 100),
    rarity: "Legendary"
  }];
  const seasonPoints = stats.wins * 3 + stats.goals * 2 + stats.assists * 1;
  const seasonRewards = [{
    rank: "Gold",
    minPoints: 1000,
    reward: "€50 Credit + Trophy",
    achieved: seasonPoints >= 1000
  }, {
    rank: "Silver",
    minPoints: 750,
    reward: "€30 Credit",
    achieved: seasonPoints >= 750,
    progress: Math.min(seasonPoints / 750 * 100, 100)
  }, {
    rank: "Bronze",
    minPoints: 500,
    reward: "€15 Credit",
    achieved: seasonPoints >= 500,
    progress: Math.min(seasonPoints / 500 * 100, 100)
  }];
  return <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4 font-mono">Rewards & Achievements</h1>
            <p className="text-muted-foreground font-mono">
              Track your streaks and unlock exclusive rewards
            </p>
          </div>

          <Tabs defaultValue="my-rewards" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="my-rewards">My Rewards</TabsTrigger>
              <TabsTrigger value="team-rewards">Team's Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value="my-rewards">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Active Streaks */}
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-4 font-mono">My Active Streaks</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myStreaks.map(streak => <Card key={streak.title} className="overflow-hidden">
                          <CardContent className="p-6">
                            <div className={`w-12 h-12 rounded-lg ${streak.bgColor} flex items-center justify-center mb-4`}>
                              <streak.icon className={`w-6 h-6 ${streak.color}`} />
                            </div>
                            <h3 className="font-semibold mb-1 font-mono">{streak.title}</h3>
                            <p className="text-sm text-muted-foreground mb-3 font-mono">{streak.description}</p>
                            <div className="flex items-baseline gap-2 border-none">
                              <span className={`text-3xl font-bold ${streak.color}`}>{streak.current}</span>
                              <span className="text-sm text-muted-foreground">/ {streak.record} record</span>
                            </div>
                            <Progress value={streak.current / streak.record * 100} className="mt-3" />
                          </CardContent>
                        </Card>)}
                    </div>
                  </div>

                  {/* Achievements */}
                  <div>
                    <h2 className="text-2xl font-bold mb-4 font-mono">My Achievements</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {achievements.map(achievement => <Card key={achievement.name} className={achievement.unlocked ? "border-primary" : ""}>
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${achievement.unlocked ? "bg-gradient-hero" : "bg-muted"}`}>
                                <Award className={`w-6 h-6 ${achievement.unlocked ? "text-primary-foreground" : "text-muted-foreground"}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold font-mono">{achievement.name}</h3>
                                  <Badge variant={achievement.rarity === "Legendary" ? "default" : achievement.rarity === "Epic" ? "secondary" : "outline"} className="text-xs">
                                    {achievement.rarity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2 font-mono">
                                  {achievement.description}
                                </p>
                                {!achievement.unlocked && achievement.progress && <>
                                    <Progress value={achievement.progress} className="mb-1" />
                                    <p className="text-xs text-muted-foreground font-mono">
                                      {Math.round(achievement.progress)}% complete
                                    </p>
                                  </>}
                                {achievement.unlocked && <Badge variant="default" className="bg-success">
                                    <Star className="w-3 h-3 mr-1 fill-current" />
                                    Unlocked
                                  </Badge>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>)}
                    </div>
                  </div>
                </div>

                {/* Season Rewards */}
                <div className="lg:col-span-1">
                  <Card className="sticky top-24">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-mono">
                        <Trophy className="w-5 h-5" />
                        Season Rewards
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center p-4 rounded-lg bg-gradient-pitch">
                        <p className="text-sm text-muted-foreground mb-1 font-mono">Current Points</p>
                        <p className="text-3xl font-bold text-primary">{seasonPoints}</p>
                      </div>

                      {seasonRewards.map(reward => <div key={reward.rank} className={`p-4 rounded-lg border ${reward.achieved ? "border-primary bg-primary/5" : "border-border"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold font-mono">{reward.rank} Tier</h3>
                            {reward.achieved && <Badge variant="default" className="bg-success">
                                <Star className="w-3 h-3 mr-1 fill-current" />
                                Achieved
                              </Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 font-mono">
                            {reward.minPoints} points required
                          </p>
                          <p className="text-sm font-medium font-mono">{reward.reward}</p>
                          {!reward.achieved && reward.progress && <>
                              <Progress value={reward.progress} className="mt-2" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {Math.round(reward.progress)}% complete
                              </p>
                            </>}
                        </div>)}

                      <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <p className="text-sm font-medium mb-1 font-mono">Season Ends In</p>
                        <p className="text-2xl font-bold font-mono">23 days</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="team-rewards">
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p className="text-lg font-mono">Team rewards coming soon...</p>
                  <p className="text-sm mt-2">Join or create a team to track team-based achievements and rewards.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>;
};
export default Rewards;