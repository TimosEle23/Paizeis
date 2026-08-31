import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Clock, Euro } from "lucide-react";

interface BookingAnalyticsProps {
  bookings: any[];
}

export const BookingAnalytics = ({ bookings }: BookingAnalyticsProps) => {
  // Calculate booking trends by day of week
  const dayOfWeekData = Array.from({ length: 7 }, (_, i) => ({
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
    bookings: 0,
    revenue: 0,
  }));

  bookings.forEach((booking) => {
    const dayIndex = new Date(booking.booking_date).getDay();
    dayOfWeekData[dayIndex].bookings += 1;
    dayOfWeekData[dayIndex].revenue += booking.total_amount || 0;
  });

  // Calculate peak times
  const timeSlotData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour}:00`,
    bookings: 0,
  }));

  bookings.forEach((booking) => {
    const hour = parseInt(booking.start_time.split(':')[0]);
    if (hour >= 0 && hour < 24) {
      timeSlotData[hour].bookings += 1;
    }
  });

  // Calculate statistics
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const avgBookingValue = bookings.length > 0 ? totalRevenue / bookings.length : 0;
  const peakHour = timeSlotData.reduce((max, curr) => 
    curr.bookings > max.bookings ? curr : max
  , timeSlotData[0]);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: €{avgBookingValue.toFixed(2)} per booking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{peakHour.hour}</div>
            <p className="text-xs text-muted-foreground">
              {peakHour.bookings} bookings at this hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Busiest Day</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dayOfWeekData.reduce((max, curr) => 
                curr.bookings > max.bookings ? curr : max
              ).day}
            </div>
            <p className="text-xs text-muted-foreground">
              Most bookings this day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Day of Week Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Bookings by Day of Week</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dayOfWeekData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="bookings" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Peak Times Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Peak Times (Hourly Distribution)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSlotData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue by Day */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Day of Week</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dayOfWeekData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value) => `€${value}`} />
              <Bar dataKey="revenue" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
