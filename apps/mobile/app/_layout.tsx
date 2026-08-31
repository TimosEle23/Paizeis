import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth/AuthProvider";
import { Loading } from "../src/components/ui";
import { colors } from "../src/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Availability changes as other people book; a stale slot list is worse
      // than a brief spinner.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * Route access, mirroring the website's own rules (see routeAccess.ts there):
 * the home page and the venues list are public, everything that touches a
 * person's data is not.
 *
 * The app used to bounce every signed-out visitor straight to sign-in, which
 * is why the "Back home" link on that screen had nowhere to go.
 */
const PUBLIC_TAB_ROUTES = new Set(["index", "venues"]);

function requiresAuth(segments: string[]): boolean {
  if (segments[0] === "(auth)") return false;
  if (segments[0] === "(tabs)") {
    // The default tab is the home screen, which is public.
    return !PUBLIC_TAB_ROUTES.has(segments[1] ?? "index");
  }
  // Venue details are public; booking and everything else is not.
  return segments[0] !== "venue";
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!user && requiresAuth(segments as string[])) router.replace("/(auth)/sign-in");
    else if (user && inAuthGroup) router.replace("/(tabs)");
  }, [user, loading, segments, router]);

  if (loading) return <Loading />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: "700" },
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="venue/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="booking/[venueId]" options={{ headerShown: false }} />
              <Stack.Screen name="team/[id]" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
