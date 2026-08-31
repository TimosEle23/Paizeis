import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import pixelBackground from "@/assets/pixel_pitch_bg.jpg.asset.json";


const TeamsManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchTeams();
      fetchInvites();
    }
  }, [user]);

  const fetchTeams = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('teams')
      .select(`
        *,
        team_roster!inner(user_id, is_captain)
      `)
      .eq('team_roster.user_id', user.id);

    if (data) setMyTeams(data);
  };

  const fetchInvites = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('team_members')
      .select(`
        *,
        teams(name)
      `)
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (data) setPendingInvites(data);
  };

  const createTeam = async () => {
    if (!user || !teamName.trim()) return;

    setIsCreating(true);

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: teamName,
        captain_id: user.id,
        member_count: 1
      })
      .select()
      .single();

    if (teamError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create team.",
      });
      setIsCreating(false);
      return;
    }

    const { error: rosterError } = await supabase
      .from('team_roster')
      .insert({
        team_id: team.id,
        user_id: user.id,
        is_captain: true
      });

    setIsCreating(false);

    if (rosterError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add you to the team roster.",
      });
    } else {
      toast({
        title: "Success!",
        description: "Team created successfully.",
      });
      setTeamName("");
      setDialogOpen(false);
      fetchTeams();
    }
  };

  const handleInvite = async (inviteId: string, accept: boolean) => {
    if (!user) return;

    const { data: invite } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('id', inviteId)
      .single();

    if (!invite) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invitation not found.",
      });
      return;
    }

    const { error: updateError } = await supabase
      .from('team_members')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', inviteId);

    if (updateError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to respond to invitation.",
      });
      return;
    }

    if (accept) {
      const { error: rosterError } = await supabase
        .from('team_roster')
        .insert({
          team_id: invite.team_id,
          user_id: user.id,
          is_captain: false
        });

      if (rosterError) {
        console.error('Roster error:', rosterError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to add you to the team roster.",
        });
        return;
      }

      const { data: currentTeam } = await supabase
        .from('teams')
        .select('member_count')
        .eq('id', invite.team_id)
        .single();

      if (currentTeam) {
        await supabase
          .from('teams')
          .update({ member_count: (currentTeam.member_count || 0) + 1 })
          .eq('id', invite.team_id);
      }
    }

    toast({
      title: accept ? "Invitation accepted!" : "Invitation declined",
      description: accept ? "You've joined the team." : "You've declined the invitation.",
    });
    
    fetchInvites();
    if (accept) fetchTeams();
  };

  const deleteTeam = async (teamId: string) => {
    if (!user) return;

    const { error: rosterError } = await supabase
      .from('team_roster')
      .delete()
      .eq('team_id', teamId);

    if (rosterError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete team roster.",
      });
      return;
    }

    const { error: teamError } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (teamError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete team.",
      });
      return;
    }

    toast({
      title: "Team deleted",
      description: "The team has been successfully deleted.",
    });

    setDeleteTeamId(null);
    fetchTeams();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Navbar />
        <div className="relative z-10 pt-24 pb-16 container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4 text-white font-mono uppercase">My Teams</h1>
          <p className="text-white/70 mb-8 font-mono">Please sign in to manage your teams.</p>
          <Button onClick={() => window.location.href = '/auth'} className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <Navbar />

      {/* Pixel pitch background (desktop + mobile) */}
      <div
        className="fixed inset-0 w-full h-full bg-cover bg-center md:bg-cover"
        style={{ backgroundImage: `url(${pixelBackground.url})`, imageRendering: "pixelated" }}
      />
      <div className="fixed inset-0 bg-black/75" />


      <div className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-white font-mono uppercase">My Teams</h1>
              <p className="text-white/70 font-mono">
                Manage your teams and respond to invitations
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Team
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black/90 border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white font-mono uppercase">Create New Team</DialogTitle>
                  <DialogDescription className="text-white/70 font-mono">
                    Give your team a name and start inviting players.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="teamName" className="text-white font-mono">Team Name</Label>
                    <Input
                      id="teamName"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Enter team name"
                      className="bg-black/60 border-white/20 text-white placeholder:text-white/50 font-mono"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createTeam} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono" disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Team"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Teams List */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4 text-white font-mono uppercase">Your Teams</h2>
                {myTeams.length > 0 ? (
                  <div className="space-y-4">
                    {myTeams.map((team) => (
                      <Card key={team.id} className="bg-black/60 border-white/10 backdrop-blur-sm">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="text-xl text-white font-mono">{team.name}</CardTitle>
                                <Badge variant={team.captain_id === user.id ? "default" : "secondary"} className="font-mono">
                                  {team.captain_id === user.id ? "Captain" : "Member"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-white/70 font-mono">
                                <div className="flex items-center gap-1">
                                  <Users className="w-4 h-4 text-primary" />
                                  {team.member_count} members
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            {team.captain_id === user.id && (
                              <>
                                <Button onClick={() => window.location.href = `/team/${team.id}`} className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
                                  Manage Team
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => setDeleteTeamId(team.id)}
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-black/60 border-white/10 backdrop-blur-sm">
                    <CardContent className="pt-6 text-center text-white/70 font-mono">
                      You're not part of any teams yet. Create one to get started!
                    </CardContent>
                  </Card>
                )}
              </div>
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
                      {pendingInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-3"
                        >
                          <div>
                            <h3 className="font-semibold mb-1 text-white font-mono">{invite.teams?.name}</h3>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-mono" onClick={() => handleInvite(invite.id, true)}>
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10 hover:text-white font-mono" onClick={() => handleInvite(invite.id, false)}>
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
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTeamId} onOpenChange={() => setDeleteTeamId(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-mono uppercase">Delete Team</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70 font-mono">
              Are you sure you want to delete this team? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-white/20 font-mono">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTeamId && deleteTeam(deleteTeamId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamsManager;
