import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { venueSchema } from "@/lib/validationSchemas";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Building2, MapPin, Phone, Star } from "lucide-react";
import VenueImageUpload from "@/components/VenueImageUpload";

const AdminVenues = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(user);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    location: "",
    phone: "",
    website: "",
    image_url: "",
    futsal_image_url: "",
    paddle_image_url: "",
    google_rating: "",
    google_reviews_count: "",
    booking_method: "",
  });

  useEffect(() => {
    // Don't do anything while still loading
    if (authLoading || roleLoading) {
      return;
    }
    
    // Only redirect if we have finished loading and confirmed the user is not an admin
    if (!user) {
      navigate("/super-admin-login");
    } else if (isAdmin === false) {
      // Use explicit false check - undefined means still checking
      toast.error("Access Denied", {
        description: "Only administrators can access this page.",
      });
      navigate("/");
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  const { data: venues, isLoading: venuesLoading } = useQuery({
    queryKey: ["admin-all-venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const createVenueMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("venues").insert({
        name: formData.name,
        city: formData.city,
        location: formData.location,
        phone: formData.phone || null,
        website: formData.website || null,
        image_url: formData.image_url || null,
        futsal_image_url: formData.futsal_image_url || null,
        paddle_image_url: formData.paddle_image_url || null,
        google_rating: formData.google_rating ? parseFloat(formData.google_rating) : null,
        google_reviews_count: formData.google_reviews_count ? parseInt(formData.google_reviews_count) : null,
        booking_method: formData.booking_method || null,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venue created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-all-venues"] });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error("Failed to create venue", { description: error.message });
    },
  });

  const updateVenueMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("venues")
        .update({
          name: formData.name,
          city: formData.city,
          location: formData.location,
          phone: formData.phone || null,
          website: formData.website || null,
          image_url: formData.image_url || null,
          futsal_image_url: formData.futsal_image_url || null,
          paddle_image_url: formData.paddle_image_url || null,
          google_rating: formData.google_rating ? parseFloat(formData.google_rating) : null,
          google_reviews_count: formData.google_reviews_count ? parseInt(formData.google_reviews_count) : null,
          booking_method: formData.booking_method || null,
        })
        .eq("id", editingVenue.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venue updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-all-venues"] });
      resetForm();
      setDialogOpen(false);
      setEditingVenue(null);
    },
    onError: (error: any) => {
      toast.error("Failed to update venue", { description: error.message });
    },
  });

  const deleteVenueMutation = useMutation({
    mutationFn: async (venueId: string) => {
      const { error } = await supabase.from("venues").delete().eq("id", venueId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venue deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-all-venues"] });
    },
    onError: (error: any) => {
      toast.error("Failed to delete venue", { description: error.message });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      city: "",
      location: "",
      phone: "",
      website: "",
      image_url: "",
      futsal_image_url: "",
      paddle_image_url: "",
      google_rating: "",
      google_reviews_count: "",
      booking_method: "",
    });
    setEditingVenue(null);
  };

  const handleEdit = (venue: any) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name || "",
      city: venue.city || "",
      location: venue.location || "",
      phone: venue.phone || "",
      website: venue.website || "",
      image_url: venue.image_url || "",
      futsal_image_url: venue.futsal_image_url || "",
      paddle_image_url: venue.paddle_image_url || "",
      google_rating: venue.google_rating?.toString() || "",
      google_reviews_count: venue.google_reviews_count?.toString() || "",
      booking_method: venue.booking_method || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const result = venueSchema.safeParse(formData);
    
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast.error("Validation Error", { description: firstError.message });
      return;
    }
    
    if (editingVenue) {
      updateVenueMutation.mutate();
    } else {
      createVenueMutation.mutate();
    }
  };

  if (authLoading || roleLoading || venuesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Venue Management</h1>
              <p className="text-muted-foreground">Add, edit, and manage all venues</p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/super-admin")}>
                Back to Dashboard
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Venue
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingVenue ? "Edit Venue" : "Add New Venue"}</DialogTitle>
                    <DialogDescription>
                      {editingVenue ? "Update venue details" : "Fill in the venue information"}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Venue Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., Arena Futsal"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="e.g., Nicosia"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="location">Full Address *</Label>
                      <Textarea
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Full street address"
                      />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+357 99 123456"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    
                    <VenueImageUpload
                      currentImageUrl={formData.image_url}
                      onUploadComplete={(url) => setFormData({ ...formData, image_url: url })}
                      label="Main Venue Image"
                    />
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <VenueImageUpload
                        currentImageUrl={formData.futsal_image_url}
                        onUploadComplete={(url) => setFormData({ ...formData, futsal_image_url: url })}
                        label="Futsal Image"
                      />
                      <VenueImageUpload
                        currentImageUrl={formData.paddle_image_url}
                        onUploadComplete={(url) => setFormData({ ...formData, paddle_image_url: url })}
                        label="Padel Image"
                      />
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="google_rating">Google Rating</Label>
                        <Input
                          id="google_rating"
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={formData.google_rating}
                          onChange={(e) => setFormData({ ...formData, google_rating: e.target.value })}
                          placeholder="4.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="google_reviews_count">Review Count</Label>
                        <Input
                          id="google_reviews_count"
                          type="number"
                          value={formData.google_reviews_count}
                          onChange={(e) => setFormData({ ...formData, google_reviews_count: e.target.value })}
                          placeholder="150"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="booking_method">Booking Method</Label>
                        <Input
                          id="booking_method"
                          value={formData.booking_method}
                          onChange={(e) => setFormData({ ...formData, booking_method: e.target.value })}
                          placeholder="online, phone, etc."
                        />
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={createVenueMutation.isPending || updateVenueMutation.isPending}
                    >
                      {(createVenueMutation.isPending || updateVenueMutation.isPending) ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {editingVenue ? "Update Venue" : "Create Venue"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                All Venues ({venues?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {venues?.map((venue) => (
                      <TableRow key={venue.id}>
                        <TableCell className="font-medium">{venue.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {venue.city}
                          </div>
                        </TableCell>
                        <TableCell>
                          {venue.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {venue.phone}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {venue.google_rating ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              {venue.google_rating}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(venue)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => deleteVenueMutation.mutate(venue.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminVenues;
