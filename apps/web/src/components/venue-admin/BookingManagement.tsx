import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Edit, Clock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface BookingManagementProps {
  bookings: any[];
  selectedPitch: any;
  selectedDate: Date | undefined;
}

export const BookingManagement = ({ bookings, selectedPitch, selectedDate }: BookingManagementProps) => {
  const queryClient = useQueryClient();
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");

  // Update booking status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["pitch-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["all-venue-bookings"] });
    },
    onError: (error: any) => {
      toast.error("Failed to update booking", {
        description: error.message,
      });
    },
  });

  // Update booking times mutation
  const updateTimesMutation = useMutation({
    mutationFn: async ({ bookingId, startTime, endTime }: { bookingId: string; startTime: string; endTime: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ 
          start_time: startTime,
          end_time: endTime,
        })
        .eq("id", bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking times updated successfully");
      queryClient.invalidateQueries({ queryKey: ["pitch-bookings"] });
      setEditingBooking(null);
      setNewStartTime("");
      setNewEndTime("");
    },
    onError: (error: any) => {
      toast.error("Failed to update booking times", {
        description: error.message,
      });
    },
  });

  const handleConfirm = (bookingId: string) => {
    updateStatusMutation.mutate({ bookingId, status: "confirmed" });
  };

  const handleCancel = (bookingId: string) => {
    updateStatusMutation.mutate({ bookingId, status: "cancelled" });
  };

  const handleEditTimes = (booking: any) => {
    setEditingBooking(booking);
    setNewStartTime(booking.start_time);
    setNewEndTime(booking.end_time);
  };

  const handleSaveTimes = () => {
    if (editingBooking && newStartTime && newEndTime) {
      updateTimesMutation.mutate({
        bookingId: editingBooking.id,
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {bookings && bookings.length > 0 ? (
          bookings.map((booking) => (
            <Card key={booking.id} className="border-2">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{booking.teams?.name || "No Team"}</h3>
                        <Badge variant={
                          booking.status === "confirmed" ? "default" :
                          booking.status === "pending" ? "secondary" :
                          "destructive"
                        }>
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{booking.start_time} - {booking.end_time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Booked by: {(booking.profiles as any)?.full_name || "Unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">€{booking.total_amount}</p>
                      <p className="text-sm text-muted-foreground">
                        Deposit: €{booking.deposit_amount}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    {booking.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(booking.id)}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Confirm
                      </Button>
                    )}

                    {booking.status !== "cancelled" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will cancel the booking for {booking.teams?.name}. The user will need to be notified separately.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No, keep it</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancel(booking.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Yes, cancel booking
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditTimes(booking)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit Times
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Booking Times</DialogTitle>
                          <DialogDescription>
                            Modify the start and end times for this booking
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="startTime">Start Time</Label>
                            <Input
                              id="startTime"
                              type="time"
                              value={newStartTime}
                              onChange={(e) => setNewStartTime(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="endTime">End Time</Label>
                            <Input
                              id="endTime"
                              type="time"
                              value={newEndTime}
                              onChange={(e) => setNewEndTime(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleSaveTimes}
                          disabled={updateTimesMutation.isPending || !newStartTime || !newEndTime}
                        >
                          {updateTimesMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No bookings found for this date
          </p>
        )}
      </CardContent>
    </Card>
  );
};
