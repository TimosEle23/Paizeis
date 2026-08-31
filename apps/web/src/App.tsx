import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Venues from "./pages/Venues";
import Booking from "./pages/Booking";
import BookingSuccess from "./pages/BookingSuccess";
import DemoCheckout from "./pages/DemoCheckout";
import StatsNew from "./pages/StatsNew";
import AddMatchStats from "./pages/AddMatchStats";
import Rewards from "./pages/Rewards";
import Tournaments from "./pages/Tournaments";
import TeamsManager from "./pages/TeamsManager";
import TeamDashboard from "./pages/TeamDashboard";
import LookingForTeam from "./pages/LookingForTeam";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import CRM from "./pages/CRM";
import VenueAdmin from "./pages/VenueAdmin";
import AdminSignIn from "./pages/AdminSignIn";
import VenueManagerAssignment from "./pages/VenueManagerAssignment";
import SetupTestManagers from "./pages/SetupTestManagers";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import AdminVenues from "./pages/AdminVenues";
import NotFound from "./pages/NotFound";
import { RequireAccess } from "./components/RequireAccess";
import { ROUTE_ACCESS, type RouteAccess } from "./routes/routeAccess";

const queryClient = new QueryClient();

/** Wraps an element with the guard declared for its path in ROUTE_ACCESS. */
const guard = (path: string, element: React.ReactNode) => {
  const access: RouteAccess = ROUTE_ACCESS[path] ?? "authenticated";
  if (access === "public") return element;
  return <RequireAccess access={access}>{element}</RequireAccess>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={guard("/", <Index />)} />
            <Route path="/auth" element={guard("/auth", <Auth />)} />
            {/* Dashboard is hidden for now; redirect any direct navigation to /venues */}
            <Route path="/dashboard" element={<Navigate to="/venues" replace />} />
            <Route path="/venues" element={guard("/venues", <Venues />)} />
            <Route path="/booking/:venueId" element={guard("/booking/:venueId", <Booking />)} />
            <Route path="/demo-checkout" element={guard("/demo-checkout", <DemoCheckout />)} />
            <Route path="/booking-success" element={guard("/booking-success", <BookingSuccess />)} />
            <Route path="/stats" element={guard("/stats", <StatsNew />)} />
            <Route path="/stats/:playerId" element={guard("/stats/:playerId", <StatsNew />)} />
            <Route path="/add-match-stats" element={guard("/add-match-stats", <AddMatchStats />)} />
            <Route path="/rewards" element={guard("/rewards", <Rewards />)} />
            <Route path="/tournaments" element={guard("/tournaments", <Tournaments />)} />
            <Route path="/teams" element={guard("/teams", <TeamsManager />)} />
            <Route path="/team/:teamId" element={guard("/team/:teamId", <TeamDashboard />)} />
            <Route path="/find-team" element={guard("/find-team", <LookingForTeam />)} />
            <Route path="/profile" element={guard("/profile", <Profile />)} />
            <Route path="/crm" element={guard("/crm", <CRM />)} />
            <Route path="/venue-admin" element={guard("/venue-admin", <VenueAdmin />)} />
            <Route path="/admin_signin" element={guard("/admin_signin", <AdminSignIn />)} />
            <Route
              path="/venue-manager-assignment"
              element={guard("/venue-manager-assignment", <VenueManagerAssignment />)}
            />
            <Route path="/setup-test-managers" element={guard("/setup-test-managers", <SetupTestManagers />)} />
            {/* Super Admin Routes */}
            <Route path="/super-admin-login" element={guard("/super-admin-login", <SuperAdminLogin />)} />
            <Route path="/super-admin" element={guard("/super-admin", <SuperAdminDashboard />)} />
            <Route
              path="/super-admin-dashboard"
              element={guard("/super-admin-dashboard", <SuperAdminDashboard />)}
            />
            <Route path="/admin/venues" element={guard("/admin/venues", <AdminVenues />)} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
