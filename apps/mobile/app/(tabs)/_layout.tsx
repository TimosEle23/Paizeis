import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors, fonts } from "../../src/theme";

/** Emoji as tab icons keeps the app icon-library free while the design settles. */
const icon =
  (glyph: string) =>
  ({ color }: { focused: boolean; color: ColorValue; size: number }) => (
    <Text style={{ fontSize: 20, color, opacity: color === colors.primary ? 1 : 0.55 }}>{glyph}</Text>
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 11 },
        // Every screen draws the Paizeis navbar itself; the native header on
        // top of it made two bars and pushed the content down 100px.
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("⚽") }} />
      <Tabs.Screen name="venues" options={{ title: "Venues", tabBarIcon: icon("📍") }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings", tabBarIcon: icon("🗓") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
