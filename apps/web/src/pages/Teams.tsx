import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Plus, Calendar, Trophy } from "lucide-react";
import Navbar from "@/components/Navbar";
import desktopBackground from "@/assets/homepage_paizeis-2.mp4.asset.json";
import mobileBackground from "@/assets/futsal-2.mp4.asset.json";

const Teams = () => {
  const myTeams = [
    {
      id: 1,
      name: "Thunder FC",
      role: "Captain",
      members: 12,
      wins: 18,
      losses: 5,
      nextMatch: "Tomorrow, 18:00",
    },
    {
      id: 2,
      name: "Weekend Warriors",
      role: "Member",
      members: 9,
      wins: 8,
      losses: 3,
      nextMatch: "Saturday, 15:00",
    },
  ];

  const pendingInvites = [
    { teamName: "City Strikers", invitedBy: "Alex Martinez", date: "2 days ago" },
    { teamName: "Green Eagles", invitedBy: "Sofia Chen", date: "5 days ago" },
  ];

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <Navbar />

      {/* Desktop background */}
      <div className="absolute inset-0 w-full h-full hidden md:block">
        <video
          src={desktopBackground.url}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Mobile background */}
      <div className="absolute inset-0 w-full h-full md:hidden">
        <video
          src={mobileBackground.url}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-white font-mono uppercase">My Teams</h1>
              <p className="text-white/70 font-mono">
                Manage your teams and respond to invitations
              </p>
            </div>
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Teams List */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4 text-white font-mono uppercase">Your Teams</h2>
                <div className="space-y-4">
                  {myTeams.map((team) => (
                    <Card key={team.id} className="bg-black/60 border-white/10 backdrop-blur-sm">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-xl text-white font-mono">{team.name}</CardTitle>
                              <Badge variant={team.role === "Captain" ? "default" : "secondary"} className="font-mono">
                                {team.role}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-white/70 font-mono">
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4 text-primary" />
                                {team.members} members
                              </div>
                              <div className="flex items-center gap-1">
                                <Trophy className="w-4 h-4 text-primary" />
                                {team.wins}W - {team.losses}L
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <p className="text-sm text-white/60 mb-1 font-mono">Next Match</p>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" />
                              <p className="font-semibold text-white font-mono">{team.nextMatch}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white font-mono">
                              View Details
                            </Button>
                            {team.role === "Captain" && (
                              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
                                Manage Team
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Team Members Section */}
              <Card className="bg-black/60 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white font-mono uppercase">Thunder FC - Team Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {["Alex M.", "Sofia C.", "Marcus J.", "Emma W.", "Dimitris P.", "Maria K."].map(
                      (member, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                        >
                          <Avatar>
                            <AvatarFallback className="bg-primary text-primary-foreground font-mono">
                              {member.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-white font-mono">{member}</p>
                            <p className="text-sm text-white/60 font-mono">
                              {index === 0 ? "Captain" : "Forward"}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pending Invites Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24 bg-black/60 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white font-mono uppercase">Team Invitations</CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingInvites.length > 0 ? (
                    <div className="space-y-4">
                      {pendingInvites.map((invite, index) => (
                        <div
                          key={index}
                          className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-3"
                        >
                          <div>
                            <h3 className="font-semibold mb-1 text-white font-mono">{invite.teamName}</h3>
                            <p className="text-sm text-white/70 font-mono">
                              Invited by {invite.invitedBy}
                            </p>
                            <p className="text-xs text-white/50 mt-1 font-mono">
                              {invite.date}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10 hover:text-white font-mono">
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 mx-auto text-white/50 mb-3" />
                      <p className="text-white/70 font-mono">No pending invitations</p>
                    </div>
                  )}

                  <div className="mt-6 p-4 rounded-lg bg-black/40 border border-primary/30">
                    <h3 className="font-semibold mb-2 text-white font-mono uppercase">Create Your Own Team</h3>
                    <p className="text-sm text-white/70 mb-3 font-mono">
                      Start your own team and invite friends to join
                    </p>
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono" variant="default">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Team
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Teams;
