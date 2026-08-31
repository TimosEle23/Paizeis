import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreditCard, Lock, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

const DemoCheckout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  
  const bookingId = searchParams.get("bookingId") || searchParams.get("booking_id");

  // Verify user authentication and booking ownership
  useEffect(() => {
    const verifyUserAndBooking = async () => {
      try {
        // Check authentication
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          toast.error("Please sign in to complete your booking");
          navigate("/auth");
          return;
        }
        
        setUser(currentUser);
        
        if (!bookingId) {
          toast.error("Invalid booking");
          navigate("/");
          return;
        }

        // Verify booking exists and belongs to the user
        const { data: booking, error } = await supabase
          .from('bookings')
          .select(`
            id,
            user_id,
            deposit_amount,
            booking_date,
            start_time,
            end_time,
            status,
            pitches (
              name,
              venues (name)
            )
          `)
          .eq('id', bookingId)
          .single();

        if (error || !booking) {
          toast.error("Booking not found");
          navigate("/");
          return;
        }

        // CRITICAL: Verify the booking belongs to the current user
        if (booking.user_id !== currentUser.id) {
          toast.error("You are not authorized to access this booking");
          navigate("/");
          return;
        }

        // Verify booking is in pending status
        if (booking.status !== 'pending') {
          toast.error("This booking has already been processed");
          navigate("/profile");
          return;
        }

        setBookingDetails({
          id: booking.id,
          amount: booking.deposit_amount,
          venueName: booking.pitches?.venues?.name || 'Unknown Venue',
          pitchName: booking.pitches?.name || 'Unknown Pitch',
          bookingDate: booking.booking_date,
          startTime: booking.start_time,
          endTime: booking.end_time,
        });
      } catch (error) {
        console.error("Error verifying booking:", error);
        toast.error("An error occurred. Please try again.");
        navigate("/");
      } finally {
        setInitialLoading(false);
      }
    };

    verifyUserAndBooking();
  }, [bookingId, navigate]);

  const handlePayment = async () => {
    if (!bookingId || !user) {
      toast.error("Invalid booking or not authenticated");
      return;
    }

    setLoading(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Update booking status to confirmed - RLS ensures only the owner can update
    // The .eq('user_id', user.id) adds an extra layer of protection
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', bookingId)
      .eq('user_id', user.id);

    if (error) {
      toast.error("Payment failed. Please try again.");
      console.error(error);
      setLoading(false);
      return;
    }

    // Navigate to success page
    navigate(`/booking-success?booking_id=${bookingId}&demo=true`);
  };

  if (initialLoading || !bookingDetails) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-lg">Loading checkout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Card>
            <CardHeader className="text-center space-y-2">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">Secure Checkout</CardTitle>
              <CardDescription>
                Complete your booking deposit payment
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Order Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-lg">Booking Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Venue</span>
                    <span className="font-medium">{bookingDetails.venueName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pitch</span>
                    <span className="font-medium">{bookingDetails.pitchName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">{bookingDetails.bookingDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{bookingDetails.startTime} - {bookingDetails.endTime}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Deposit Amount</span>
                  <span className="text-primary">€{bookingDetails.amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Demo Payment Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="cardNumber"
                      placeholder="4242 4242 4242 4242"
                      className="pl-10"
                      defaultValue="4242 4242 4242 4242"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input 
                      id="expiry"
                      placeholder="MM/YY"
                      defaultValue="12/28"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvc">CVC</Label>
                    <Input 
                      id="cvc"
                      placeholder="123"
                      defaultValue="123"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Cardholder Name</Label>
                  <Input 
                    id="name"
                    placeholder="John Doe"
                    defaultValue="Demo User"
                  />
                </div>
              </div>

              {/* Demo Notice */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-primary">Demo Mode:</span> This is a simulated checkout. No real payment will be processed.
                </p>
              </div>

              <Button 
                onClick={handlePayment}
                disabled={loading}
                className="w-full h-12 text-lg"
              >
                {loading ? (
                  "Processing..."
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Pay €{bookingDetails.amount.toFixed(2)}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Your payment is secure and encrypted
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DemoCheckout;
