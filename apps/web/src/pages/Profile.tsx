import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, MapPin, Calendar, Trophy, Target, Users, Clock, Edit } from "lucide-react";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { AvatarUpload } from "@/components/AvatarUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { profileSchema } from "@/lib/validationSchemas";
import pixelBackground from "@/assets/pixel_pitch_bg.jpg.asset.json";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState({
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    phone: "+30 123 456 7890",
    location: "Athens, Greece",
    avatarUrl: null as string | null
  });

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const {
          data: profile
        } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
          setUserData({
            name: profile.full_name || "User",
            email: profile.email || "",
            phone: profile.phone || "",
            location: profile.location || "",
            avatarUrl: profile.avatar_url
          });
        }
      }
    };
    fetchProfile();
  }, []);
  const handleSaveProfile = async () => {
    try {
      // Validate data
      const validatedData = profileSchema.parse({
        fullName: userData.name,
        email: userData.email,
        phone: userData.phone || "",
        location: userData.location || ""
      });
      if (!userId) {
        toast.error("User not found. Please log in again.");
        return;
      }

      // Update profile in database
      const {
        error
      } = await supabase.from('profiles').update({
        full_name: validatedData.fullName,
        email: validatedData.email,
        phone: validatedData.phone || null,
        location: validatedData.location || null
      }).eq('id', userId);
      if (error) throw error;
      toast.success("Profile updated successfully.");
      setIsEditing(false);
    } catch (error: any) {
      const message = error.errors?.[0]?.message || error.message || "Failed to update profile.";
      toast.error(message);
    }
  };
  const [bookingHistory, setBookingHistory] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState({
    totalMatches: 0,
    wins: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0
  });
  const [userTeams, setUserTeams] = useState<any[]>([]);

  // Fetch user bookings
  useEffect(() => {
    const fetchBookings = async () => {
      if (!userId) return;
      
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          pitches(name, pitch_type, venues(name))
        `)
        .eq('user_id', userId)
        .order('booking_date', { ascending: false })
        .limit(10);
      
      if (data) setBookingHistory(data);
    };
    
    fetchBookings();
  }, [userId]);

  // Fetch user teams
  useEffect(() => {
    const fetchTeams = async () => {
      if (!userId) return;
      
      const { data } = await supabase
        .from('team_roster')
        .select(`
          is_captain,
          teams(id, name, member_count)
        `)
        .eq('user_id', userId);
      
      if (data) {
        const teamsData = data
          .filter((item: any) => item.teams !== null)
          .map((item: any) => ({
            id: item.teams.id,
            name: item.teams.name,
            role: item.is_captain ? 'Captain' : 'Member',
            members: item.teams.member_count || 0
          }));
        setUserTeams(teamsData);
      }
    };
    
    fetchTeams();
  }, [userId]);

  // Fetch player stats
  useEffect(() => {
    const fetchPlayerStats = async () => {
      if (!userId) return;
      
      const { data } = await supabase
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (data) {
        setPlayerStats({
          totalMatches: data.total_matches || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          goals: data.goals || 0,
          assists: data.assists || 0,
          cleanSheets: data.clean_sheets || 0
        });
      }
    };
    
    fetchPlayerStats();
  }, [userId]);
  return <div className="min-h-screen bg-black relative overflow-hidden">
      <Navbar />

      {/* Pixel pitch background (desktop + mobile) */}
      <div
        className="fixed inset-0 w-full h-full bg-cover bg-center"
        style={{ backgroundImage: `url(${pixelBackground.url})`, imageRendering: "pixelated" }}
      />
      <div className="fixed inset-0 bg-black/75" />

      <div className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 font-mono uppercase text-primary">My Profile</h1>
            <p className="text-white/70 font-mono">
              Manage your account and view your football journey
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Profile Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Profile Card */}
              <Card className="bg-black/70 border-primary/30 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-mono uppercase text-primary">Personal Information</CardTitle>
                    <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20 hover:text-primary" onClick={() => setIsEditing(!isEditing)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center mb-6 font-mono">
                    {userId && <AvatarUpload userId={userId} currentAvatarUrl={userData.avatarUrl} userName={userData.name} onUploadComplete={url => setUserData({
                    ...userData,
                    avatarUrl: url
                  })} />}
                  </div>

                  {isEditing ? <div className="space-y-4">
                      <div>
                        <Label htmlFor="name" className="text-white/80 font-mono">Full Name</Label>
                        <Input id="name" className="bg-black/60 border-white/20 text-white" value={userData.name} onChange={e => setUserData({
                      ...userData,
                      name: e.target.value
                    })} />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-white/80 font-mono">Email</Label>
                        <Input id="email" type="email" className="bg-black/60 border-white/20 text-white" value={userData.email} onChange={e => setUserData({
                      ...userData,
                      email: e.target.value
                    })} />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-white/80 font-mono">Phone</Label>
                        <Input id="phone" className="bg-black/60 border-white/20 text-white" value={userData.phone} onChange={e => setUserData({
                      ...userData,
                      phone: e.target.value
                    })} />
                      </div>
                      <div>
                        <Label htmlFor="location" className="text-white/80 font-mono">Location</Label>
                        <Input id="location" className="bg-black/60 border-white/20 text-white" value={userData.location} onChange={e => setUserData({
                      ...userData,
                      location: e.target.value
                    })} />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveProfile} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
                          Save Changes
                        </Button>
                        <Button onClick={() => setIsEditing(false)} variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10 hover:text-white font-mono">
                          Cancel
                        </Button>
                      </div>
                    </div> : <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-primary" />
                        <span className="font-mono text-white">{userData.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-primary" />
                        <span className="text-sm font-mono text-white">{userData.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-primary" />
                        <span className="font-mono text-white">{userData.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-primary" />
                        <span className="font-mono text-white">{userData.location}</span>
                      </div>
                    </div>}
                </CardContent>
              </Card>

              {/* Stats Overview */}
              <Card className="bg-black/70 border-primary/30 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-mono uppercase text-primary">
                    <Trophy className="w-5 h-5" />
                    Career Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Matches", value: playerStats.totalMatches },
                      { label: "Wins", value: playerStats.wins },
                      { label: "Goals", value: playerStats.goals },
                      { label: "Assists", value: playerStats.assists },
                    ].map(stat => (
                      <div key={stat.label} className="text-center p-4 rounded-lg bg-white/5 border border-primary/20">
                        <p className="text-2xl font-bold text-primary font-mono">{stat.value}</p>
                        <p className="text-xs text-white/60 font-mono uppercase">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* My Teams */}
              <Card className="bg-black/70 border-primary/30 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-mono uppercase text-primary">
                    <Users className="w-5 h-5" />
                    My Teams
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {userTeams.length === 0 ? (
                    <p className="text-center text-white/60 py-4 font-mono">No teams yet</p>
                  ) : (
                    userTeams.map(team => (
                      <div key={team.id} className="p-3 rounded-lg bg-white/5 border border-primary/20">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold font-mono text-white">{team.name}</p>
                          <Badge variant="secondary" className="font-mono">{team.role}</Badge>
                        </div>
                        <p className="text-sm text-white/60 font-mono">
                          {team.members} members
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Booking History */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-black/70 border-primary/30 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-mono uppercase text-primary">
                    <Calendar className="w-5 h-5" />
                    Booking History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {bookingHistory.length === 0 ? (
                      <p className="text-center text-white/60 py-8 font-mono">No bookings yet</p>
                    ) : (
                      bookingHistory.map(booking => (
                        <div key={booking.id} className="p-4 rounded-lg border border-white/10 bg-white/5 hover:border-primary/40 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-lg mb-1 font-mono text-white uppercase">
                                {booking.pitches?.venues?.name}
                              </h3>
                              <p className="text-sm text-white/60 font-mono">
                                {booking.pitches?.name} • {booking.pitches?.pitch_type}
                              </p>
                            </div>
                            <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className="font-mono">
                              {booking.status === "confirmed" ? "Completed" : booking.status}
                            </Badge>
                          </div>
                          <Separator className="my-3 bg-white/10" />
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" />
                              <span className="text-sm font-mono text-white/80">{booking.booking_date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-primary" />
                              <span className="text-sm font-mono text-white/80">{booking.start_time} - {booking.end_time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-primary" />
                              <span className="text-sm font-semibold text-primary font-mono">
                                €{booking.total_amount}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default Profile;
