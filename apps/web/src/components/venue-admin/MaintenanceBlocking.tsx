import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Ban, Trash2, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface MaintenanceBlockingProps {
  selectedPitch: any;
}

export const MaintenanceBlocking = ({ selectedPitch }: MaintenanceBlockingProps) => {
  const queryClient = useQueryClient();
  const [blockDate, setBlockDate] = useState<Date | undefined>(new Date());
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // Fetch blocked slots for selected pitch
  const { data: blockedSlots } = useQuery({
    queryKey: ["blocked-slots", selectedPitch?.id],
    queryFn: async () => {
      if (!selectedPitch?.id) return [];
      
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("pitch_id", selectedPitch.id)
        .eq("status", "blocked")
        .gte("booking_date", new Date().toISOString().split('T')[0])
        .order("booking_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedPitch?.id,
  });

  // Create blocked slot mutation
  const createBlockMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPitch || !blockDate || !blockStartTime || !blockEndTime) {
        throw new Error("All fields are required");
      }

      const { error } = await supabase
        .from("bookings")
        .insert({
          pitch_id: selectedPitch.id,
          booking_date: blockDate.toISOString().split('T')[0],
          start_time: blockStartTime,
          end_time: blockEndTime,
          status: "blocked",
          user_id: (await supabase.auth.getUser()).data.user?.id || "",
          team_id: selectedPitch.id, // Using pitch_id as placeholder
          total_amount: 0,
          deposit_amount: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Time slot blocked for maintenance");
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["pitch-bookings"] });
      
      // Reset form
      setBlockStartTime("");
      setBlockEndTime("");
      setBlockReason("");
    },
    onError: (error: any) => {
      toast.error("Failed to block time slot", {
        description: error.message,
      });
    },
  });

  // Delete blocked slot mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blocked slot removed");
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["pitch-bookings"] });
    },
    onError: (error: any) => {
      toast.error("Failed to remove block", {
        description: error.message,
      });
    },
  });

  if (!selectedPitch) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground py-8">
            Please select a pitch to manage maintenance blocks
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Block */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5" />
            Block Time Slot for Maintenance
          </CardTitle>
          <CardDescription>
            Block specific time slots to prevent bookings during maintenance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Calendar
                mode="single"
                selected={blockDate}
                onSelect={setBlockDate}
                className="rounded-md border"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="blockStartTime">Start Time</Label>
                <Input
                  id="blockStartTime"
                  type="time"
                  value={blockStartTime}
                  onChange={(e) => setBlockStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="blockEndTime">End Time</Label>
                <Input
                  id="blockEndTime"
                  type="time"
                  value={blockEndTime}
                  onChange={(e) => setBlockEndTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="blockReason">Reason (optional)</Label>
                <Textarea
                  id="blockReason"
                  placeholder="E.g., Pitch maintenance, equipment repair"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={() => createBlockMutation.mutate()}
                disabled={createBlockMutation.isPending || !blockDate || !blockStartTime || !blockEndTime}
                className="w-full"
              >
                {createBlockMutation.isPending ? "Blocking..." : "Block Time Slot"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Blocks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Existing Maintenance Blocks
          </CardTitle>
          <CardDescription>
            View and manage all blocked time slots
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {blockedSlots && blockedSlots.length > 0 ? (
            blockedSlots.map((block) => (
              <Card key={block.id} className="border-2 border-warning">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-warning">
                          <Ban className="w-3 h-3 mr-1" />
                          Blocked
                        </Badge>
                        <span className="text-sm font-medium">
                          {new Date(block.booking_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">
                        {block.start_time} - {block.end_time}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Block?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will make the time slot available for booking again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteBlockMutation.mutate(block.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove Block
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No maintenance blocks scheduled
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
